#!/usr/bin/env python3
"""
backfill_registry.py

Insert the 17 directory-only migrations into supabase_migrations.schema_migrations.

Reads versions from /tmp/directory_only.txt.
For each, reads supabase/migrations/<version>_<name>.sql.
Inserts (version, name, statements=ARRAY[full_sql]) in a single transaction.

Uses psql for the connection. SQL content is passed via stdin to a single
psql session running BEGIN ... COMMIT, so one bad insert rolls back the whole
batch. Quoting uses dollar-quoting with a randomized tag to handle any
SQL content safely.

Usage:
    export PROD_DB_URL='postgresql://...'
    python3 backfill_registry.py [--dry-run]
"""

import os
import subprocess
import sys
import uuid
from pathlib import Path

LIST_PATH = Path("/tmp/directory_only.txt")
MIGRATIONS_DIR = Path("supabase/migrations")


def main() -> int:
    db_url = os.environ.get("PROD_DB_URL")
    if not db_url:
        print("ERROR: PROD_DB_URL not set", file=sys.stderr)
        return 1
    if not LIST_PATH.exists():
        print(f"ERROR: {LIST_PATH} not found", file=sys.stderr)
        return 1

    dry_run = "--dry-run" in sys.argv

    versions = [v.strip() for v in LIST_PATH.read_text().splitlines() if v.strip()]
    if not versions:
        print("ERROR: no versions to backfill", file=sys.stderr)
        return 1

    print(f"Preparing to backfill {len(versions)} migrations"
          + (" (DRY RUN)" if dry_run else "") + "...")

    # Build the SQL script in memory, then pipe to a single psql session.
    sql_parts = ["BEGIN;", ""]

    for version in versions:
        matches = list(MIGRATIONS_DIR.glob(f"{version}_*.sql"))
        if len(matches) != 1:
            print(f"ERROR: expected 1 file for version {version}, found {len(matches)}",
                  file=sys.stderr)
            return 1
        file_path = matches[0]
        # Extract name from filename: <version>_<name>.sql
        stem = file_path.stem  # e.g. "20260303100000_rename_..."
        name = stem[len(version) + 1:]  # strip "<version>_"
        if not name:
            print(f"ERROR: empty name for {version}", file=sys.stderr)
            return 1

        sql_content = file_path.read_text(encoding="utf-8")

        # Use a randomized dollar-quote tag that is virtually guaranteed not to
        # appear in the SQL content. Postgres allows tags in $tag$...$tag$.
        tag = f"backfill_{uuid.uuid4().hex[:12]}"
        if f"${tag}$" in sql_content:
            # Astronomically unlikely, but handle it just in case.
            print(f"ERROR: dollar-quote tag collision in {file_path}", file=sys.stderr)
            return 1

        # Build the INSERT. statements is text[] — single-element array.
        sql_parts.append(f"-- {version} ({file_path.name})")
        sql_parts.append(
            f"INSERT INTO supabase_migrations.schema_migrations "
            f"(version, name, statements) VALUES "
            f"('{version}', '{name}', ARRAY[${tag}${sql_content}${tag}$]::text[]);"
        )
        sql_parts.append("")

    # Verification block inside the same transaction:
    # confirm the 17 are now present, and the total count is exactly 285+17=302.
    sql_parts.append("-- Verify the inserts worked")
    sql_parts.append(
        "DO $verify$ DECLARE expected_count int := "
        f"{285 + len(versions)}; "
        "actual_count int; BEGIN "
        "SELECT COUNT(*) INTO actual_count FROM supabase_migrations.schema_migrations; "
        "IF actual_count != expected_count THEN "
        "RAISE EXCEPTION 'Count mismatch: expected % rows, got %', expected_count, actual_count; "
        "END IF; "
        f"IF (SELECT COUNT(*) FROM supabase_migrations.schema_migrations "
        f"WHERE version = ANY(ARRAY[{','.join(repr(v) for v in versions)}])) "
        f"!= {len(versions)} THEN "
        "RAISE EXCEPTION 'Not all backfilled versions found post-insert'; "
        "END IF; "
        "RAISE NOTICE 'Verification passed: % rows total', actual_count; "
        "END $verify$;"
    )
    sql_parts.append("")

    if dry_run:
        sql_parts.append("ROLLBACK;")
        print("DRY RUN: will ROLLBACK at end")
    else:
        sql_parts.append("COMMIT;")

    sql_script = "\n".join(sql_parts)

    # Save the script for inspection
    script_path = Path("/tmp/phase_b_backfill.sql")
    script_path.write_text(sql_script, encoding="utf-8")
    print(f"Generated SQL script: {script_path} ({len(sql_script)} bytes)")
    print(f"Statements: {len(versions)} INSERTs + verification + "
          f"{'ROLLBACK' if dry_run else 'COMMIT'}")
    print("")

    # Execute via psql
    result = subprocess.run(
        ["psql", db_url, "-v", "ON_ERROR_STOP=1", "-f", str(script_path)],
        capture_output=True, text=True
    )
    print("=== psql stdout ===")
    print(result.stdout)
    print("=== psql stderr ===")
    print(result.stderr)
    print(f"=== exit code: {result.returncode} ===")
    return result.returncode


if __name__ == "__main__":
    sys.exit(main())