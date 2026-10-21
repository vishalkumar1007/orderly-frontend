/**
 * A nudge for the console shell to re-read /tenant/store-link.
 *
 * The shell fetches the link once per session for the rail (name, logo) and
 * the storefront button. Settings that change what the rail shows bump this
 * after saving, so the rail updates without a reload and nothing else has to
 * know how the shell loads itself.
 */
export const storeLinkState = $state({ version: 0 });

export function refreshStoreLink(): void {
	storeLinkState.version += 1;
}
