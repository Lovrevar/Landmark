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

/**
 * In-app voice calls with the AI assistant — on LandmarkDev only (docs/voice/04-dev-build.md). Hides
 * the call button, and keeps the chat history from filtering on ai_sessions.channel, a column that
 * exists only where the `voice_calls` migration is applied.
 *
 * To try voice against LandmarkDev, set it to true locally and do not commit it. Flip it for real
 * only with the migration applied and an agent worker running for that deployment.
 */
export const VOICE_CALLS_ENABLED = false
