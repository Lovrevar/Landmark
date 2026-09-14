# The on-prem import agent

The scheduled script on the company file server that pushes 4D Wand exports
into Cognilion. Supabase Edge Functions run in the cloud and cannot see an
on-prem share, so the server has to initiate — see SPEC.md §2.1.

Not yet written. This is the contract it has to satisfy.

## Endpoint

```
POST https://<project>.supabase.co/functions/v1/import-erp
Content-Type: multipart/form-data
x-erp-import-secret: <shared secret>

feed=<accounts|cost_centers|partners|invoices|payments|bank_balances>
file=@<the export file>
```

CSV or XLSX, up to 25 MB. The secret lives in the function's environment as
`ERP_IMPORT_SECRET` (`supabase secrets set ERP_IMPORT_SECRET=…`) and is
compared in constant time. A browser upload from the app hits the same endpoint
with a user JWT instead, so both paths share one parser and one audit trail.

### Response

```json
{ "run_id": "…", "feed": "invoices",
  "rows_total": 120, "rows_staged": 118, "rows_rejected": 2,
  "problems": [ { "row": 41, "errors": ["due_date … is before issue_date …"] } ] }
```

HTTP 200 means the file was parsed and staged — **not** that every row was
good. Always check `rows_rejected`. Non-2xx returns `{ "error": "…" }`:
401 bad or missing secret, 400 unknown feed or unreadable file, 413 too large,
500 something failed mid-run (the run is marked `failed` with the message).

## Order matters

Reference feeds replace their register outright and the document feeds resolve
codes against them, so per cycle:

```
accounts → cost_centers → partners → invoices → payments → bank_balances
```

Importing invoices before partners is not an error, but every row lands
unresolved and has to be re-imported afterwards.

## What the script must do

1. **Watch the export directory** for new files. Match feed by filename —
   `invoices_20260831_060000.csv` → `feed=invoices`.
2. **Wait for the write to finish.** A file appearing is not a file that is
   complete; poll for a stable size, or have the exporter write to a temporary
   name and rename on completion. Uploading a half-written export is the most
   likely way to corrupt an import, and the `invoice_total` checksum only
   catches some of it.
3. **Upload, then move the file** to a processed/ folder. Do not delete it —
   when an import is wrong, the original file is the only evidence.
4. **Retry** on 5xx and network errors with backoff. Do not retry 4xx: the file
   is wrong and will stay wrong.
5. **Log the `run_id`** with the filename, so a run in the app can be traced
   back to a file on disk.
6. **Alert if a cycle produces no successful run.** A silently dead import is
   worse than a failed one, because the data merely looks old rather than
   wrong. The app has its own staleness alarm (SPEC.md §11), but the server
   knows first.

Re-uploading the same file is safe: `import_runs.file_hash` records the
SHA-256, and promotion compares `erp_content_hash` per document, so an
unchanged document is skipped before any write.

## Testing without the agent

The *Cashflow ▸ ERP import* screen accepts the same files, so the whole
pipeline can be exercised by hand first. `curl` works too:

```sh
curl -X POST "$URL/functions/v1/import-erp" \
  -H "x-erp-import-secret: $SECRET" \
  -F "feed=accounts" -F "file=@accounts.csv"
```
