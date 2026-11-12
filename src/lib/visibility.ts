/**
 * What the public pages show (owner, 2026-11-12, US-569: Radar is marketed to
 * small businesses too). Every switch hides, never deletes: the rows stay
 * stored, BuyerFinder's admin still counts them, and turning a switch back
 * brings them back.
 *
 * Kept free of server imports: the feed's tabs read `shownPlatforms` in the
 * browser.
 */

/** Reddit alone. Facebook groups and forums are hidden, as X is (US-511). */
export const shownPlatforms = ["reddit"] as const;

/**
 * Only posts a small independent seller could answer (US-561's seller fit).
 * A post with no answer yet, sorted before the question was asked, is hidden
 * too.
 */
export const fitOnly = true;

/** The MCP page, its links and the /mcp endpoint (US-462). */
export const mcpEnabled = false;
