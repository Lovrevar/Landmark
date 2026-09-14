# Parked: ERP integration migrations

**Do not apply these.** They belong to the ERP (4D Wand) integration, which is on
hold. They live outside `supabase/migrations/` so `supabase db push` never sees them.

Their `20260831…` timestamps are older than migrations already applied everywhere.
Before they go back into `supabase/migrations/` they need fresh timestamps, and the
body of `public.calculate_invoice_amounts()` in `20260831160000_erp_phase3_promotion.sql`
needs checking against the current definition.

The full resume checklist is in
[`docs/erp-integration/PROGRESS.md`](../../../docs/erp-integration/PROGRESS.md), under "On hold".
