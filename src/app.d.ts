// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces

declare global {
	/**
	 * Chrome/Android fires `beforeinstallprompt`, but the event type is not in
	 * lib.dom yet. iOS Safari never fires it, so the app detects that case
	 * separately rather than relying on this event alone.
	 */
	interface BeforeInstallPromptEvent extends Event {
		readonly platforms: string[];
		readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
		prompt(): Promise<void>;
	}

	namespace App {
		// interface Error {}
		interface Locals {
			hostKind: 'admin' | 'tenant' | 'unknown';
			tenantSlug: string | null;
		}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
