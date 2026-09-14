/**
 * Compile-time switches for work that is merged but not released.
 *
 * A constant rather than a VITE_ env var on purpose: an env var can be switched on in one
 * deployment and not another, and every flag here guards code whose database side has not been
 * applied anywhere. Flipping one is a code change that ships with the migrations it depends on.
 */

/**
 * ERP (4D Wand) integration — ON HOLD. Hides the Šifrarnici and ERP import screens: their routes
 * are not registered and their Cashflow menu entries are not shown.
 *
 * Do not flip this on its own. The screens read views and an RPC that exist only once the parked
 * migrations are restored and applied — see "On hold" in docs/erp-integration/PROGRESS.md.
 */
export const ERP_INTEGRATION_ENABLED = false
