# Appendix: format conventions recap

_Part of the [Cognilion Manual Testing Cheat Sheet](../TESTING.md). See that file for status markers and how to walk this document._

- Every action line ends with `( )` and is flipped to `(+)` / `(-)` / `(~)` / `(N/A)` during a testing pass.
- Each action group covers: 1 golden path, 1+ missing-field / invalid-input / edge-case, 1 cancel (where relevant), 1 permission line (where non-trivial).
- Croatian legal/domain terms stay untranslated in both locales — `cesija`, `kompenzacija`, `stan`, `garaža`, `repozitorij`, `TIC`, `OIB`.
- Destructive actions (deletes, bulk ops, imports) are included — run on staging only.
- The permissions matrix is **sampled**, not exhaustive. When roles change in [src/utils/permissions.ts](../../src/utils/permissions.ts), update the matrix cells first, then re-run the sampled checks.
