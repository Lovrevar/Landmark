#!/usr/bin/env python3
"""
recover_migrations.py

Recover registry-only migrations from prod's supabase_migrations.schema_migrations
into supabase/migrations/<version>_<name>.sql files.

Reads versions to recover from /tmp/registry_only.txt (one version per line).
For each, fetches the row from the registry, unescapes the statements[] content,
and writes the file.

Usage:
    export PROD_DB_URL='postgresql://...'
    python3 recover_migrations.py

Idempotent: re-running overwrites existing files. Safe to retry.
"""

import os
import subprocess
import sys
from pathlib import Path

REGISTRY_ONLY_LIST = Path("/tmp/registry_only.txt")
OUT_DIR = Path("supabase/migrations")
DB_URL_ENV = "PROD_DB_URL"

# Sentinel for the backslash-protection trick. Two NULs around a tag
# that cannot appear in real SQL.
SENTINEL = "\x00DBL_BS\x00"


def unescape_sql(raw: str) -> str:
    """
    Convert the registry's stored escape sequences into real characters.
    Order matters: protect '\\\\' first so we never mis-decode it as '\\' + 'n'.
    Uses string ops (not codecs.decode) to keep UTF-8 intact.
    """
    s = raw
    s = s.replace("\\\\", SENTINEL)   # protect literal backslashes
    s = s.replace("\\n", "\n")
    s = s.replace("\\t", "\t")
    s = s.replace("\\r", "\r")
    s = s.replace("\\'", "'")
    s = s.replace('\\"', '"')
    s = s.replace(SENTINEL, "\\")     # restore real backslashes
    return s


def fetch_row(db_url: str, version: str) -> tuple[str, str] | None:
    """
    Fetch (name, raw_statements_concatenated) for a version.
    Statements are joined with ';\n' because Supabase strips trailing
    semicolons when ingesting into statements[], so we must restore them
    to produce valid SQL.
    """
    sep = "<<<NAMESEP>>>"
    sql = f"""
        SELECT name || '{sep}' || array_to_string(statements, ';\n') || ';'
        FROM supabase_migrations.schema_migrations
        WHERE version = '{version}';
    """
    result = subprocess.run(
        ["psql", db_url, "-At", "-v", "ON_ERROR_STOP=1", "-c", sql],
        capture_output=True, text=True, check=False
    )
    if result.returncode != 0:
        print(f"  psql error for {version}: {result.stderr.strip()}", file=sys.stderr)
        return None
    output = result.stdout
    if output.endswith("\n"):
        output = output[:-1]
    if not output:
        return None
    if sep not in output:
        print(f"  separator missing in result for {version}", file=sys.stderr)
        return None
    name, raw_sql = output.split(sep, 1)
    return name, raw_sql


def main() -> int:
    db_url = os.environ.get(DB_URL_ENV)
    if not db_url:
        print(f"ERROR: ${DB_URL_ENV} not set", file=sys.stderr)
        return 1
    if not REGISTRY_ONLY_LIST.exists():
        print(f"ERROR: {REGISTRY_ONLY_LIST} not found", file=sys.stderr)
        return 1
    if not OUT_DIR.exists():
        print(f"ERROR: {OUT_DIR} not found (run from repo root)", file=sys.stderr)
        return 1

    versions = [v.strip() for v in REGISTRY_ONLY_LIST.read_text().splitlines() if v.strip()]
    print(f"Recovering {len(versions)} migrations from {DB_URL_ENV}...")

    written = 0
    errors = []

    for version in versions:
        row = fetch_row(db_url, version)
        if row is None:
            errors.append(f"{version}: not found in registry or fetch failed")
            continue
        name, raw_sql = row
        try:
            sql = unescape_sql(raw_sql)
        except Exception as e:
            errors.append(f"{version}: unescape failed: {e}")
            continue
        out_path = OUT_DIR / f"{version}_{name}.sql"
        try:
            out_path.write_text(sql, encoding="utf-8")
            written += 1
            if written % 10 == 0:
                print(f"  {written}/{len(versions)} written...")
        except OSError as e:
            errors.append(f"{version}: write failed: {e}")

    print(f"\nDone: {written}/{len(versions)} files written to {OUT_DIR}")
    if errors:
        print(f"\n{len(errors)} error(s):")
        for err in errors:
            print(f"  - {err}")
        return 2
    return 0


if __name__ == "__main__":
    sys.exit(main())

