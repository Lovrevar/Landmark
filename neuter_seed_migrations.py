#!/usr/bin/env python3
"""
neuter_seed_migrations.py

Empty the SQL content of seed-data migrations (file + registry).
Used to make migration history replay cleanly without seeding demo data.

Operates on a hardcoded list. Each file is replaced with an explanatory
comment, and the corresponding registry's statements[] is set to a single
no-op element to match. Performed in a single DB transaction.
"""

import os
import subprocess
import sys
import uuid
from pathlib import Path

MIGRATIONS_DIR = Path("supabase/migrations")

# (version, short_description)
SEEDS_TO_NEUTER = [
    ("20250904072100", "Initial demo users (pre-Supabase-Auth bootstrap data)"),
    ("20250904083953", "Demo data (projects, tasks, subcontractors, apartments, invoices, todos)"),
    ("20251116124513", "Test PM user for Kozara project"),
]


def neutered_file_content(version: str, description: str) -> str:
    return (
        f"-- Migration {version}: original content removed during history reconciliation.\n"
        f"-- Original content: {description}\n"
        f"-- Reason: Seed/test data not needed for replay in fresh environments.\n"
        f"-- Original SQL is preserved in git history.\n"
        f"-- This file is intentionally a no-op.\n"
    )


def main() -> int:
    db_url = os.environ.get("PROD_DB_URL")
    if not db_url:
        print("ERROR: PROD_DB_URL not set", file=sys.stderr)
        return 1

    dry_run = "--dry-run" in sys.argv

    # Pre-flight: confirm every file exists and every version is in the registry
    file_paths = {}
    for version, desc in SEEDS_TO_NEUTER:
        matches = list(MIGRATIONS_DIR.glob(f"{version}_*.sql"))
        if len(matches) != 1:
            print(f"ERROR: expected 1 file for {version}, found {len(matches)}", file=sys.stderr)
            return 1
        file_paths[version] = matches[0]

    # Check registry
    versions_quoted = ",".join(f"'{v}'" for v, _ in SEEDS_TO_NEUTER)
    check_sql = f"SELECT version FROM supabase_migrations.schema_migrations WHERE version IN ({versions_quoted}) ORDER BY version;"
    result = subprocess.run(
        ["psql", db_url, "-At", "-v", "ON_ERROR_STOP=1", "-c", check_sql],
        capture_output=True, text=True, check=False
    )
    if result.returncode != 0:
        print(f"ERROR: registry check failed: {result.stderr}", file=sys.stderr)
        return 1
    found_in_registry = set(result.stdout.strip().split("\n"))
    expected = {v for v, _ in SEEDS_TO_NEUTER}
    missing = expected - found_in_registry
    if missing:
        print(f"ERROR: versions missing from registry: {missing}", file=sys.stderr)
        return 1

    print(f"Pre-flight OK: {len(SEEDS_TO_NEUTER)} files exist, all registered.")
    print("")

    # Build transactional SQL
    tag = f"noop_{uuid.uuid4().hex[:12]}"
    noop_marker = f"-- no-op (seed data removed during history reconciliation)"
    sql_parts = ["BEGIN;", ""]
    for version, desc in SEEDS_TO_NEUTER:
        sql_parts.append(f"-- {version}: {desc}")
        sql_parts.append(
            f"UPDATE supabase_migrations.schema_migrations "
            f"SET statements = ARRAY[${tag}${noop_marker}${tag}$]::text[] "
            f"WHERE version = '{version}';"
        )
    sql_parts.append("")
    sql_parts.append("-- Verify all 3 updates landed")
    sql_parts.append(
        f"DO $verify$ DECLARE updated_count int; BEGIN "
        f"SELECT COUNT(*) INTO updated_count "
        f"FROM supabase_migrations.schema_migrations "
        f"WHERE version IN ({versions_quoted}) "
        f"AND statements = ARRAY['{noop_marker}']::text[]; "
        f"IF updated_count != {len(SEEDS_TO_NEUTER)} THEN "
        f"RAISE EXCEPTION 'Expected % updates, got %', {len(SEEDS_TO_NEUTER)}, updated_count; "
        f"END IF; "
        f"RAISE NOTICE 'Verification passed: % rows neutered', updated_count; "
        f"END $verify$;"
    )
    sql_parts.append("")
    sql_parts.append("ROLLBACK;" if dry_run else "COMMIT;")

    sql_script = "\n".join(sql_parts)
    script_path = Path("/tmp/neuter_seeds.sql")
    script_path.write_text(sql_script, encoding="utf-8")
    print(f"Generated SQL: {script_path}")
    print(f"Mode: {'DRY RUN (ROLLBACK)' if dry_run else 'LIVE (COMMIT)'}")
    print("")

    # Execute the registry update
    print("=== Running registry update ===")
    result = subprocess.run(
        ["psql", db_url, "-v", "ON_ERROR_STOP=1", "-f", str(script_path)],
        capture_output=True, text=True
    )
    print(result.stdout)
    if result.stderr:
        print("stderr:", result.stderr)
    if result.returncode != 0:
        print(f"FAILED with exit code {result.returncode}", file=sys.stderr)
        return result.returncode

    if dry_run:
        print("DRY RUN: files NOT modified, registry rolled back.")
        return 0

    # Rewrite files (only after successful commit)
    print("=== Rewriting files ===")
    for version, desc in SEEDS_TO_NEUTER:
        path = file_paths[version]
        content = neutered_file_content(version, desc)
        path.write_text(content, encoding="utf-8")
        print(f"  rewrote {path.name}")

    print("")
    print(f"Done: {len(SEEDS_TO_NEUTER)} seed migrations neutered.")
    return 0


if __name__ == "__main__":
    sys.exit(main())