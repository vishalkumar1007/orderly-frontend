/**
 * PWA plumbing: service worker lifecycle, update prompts, install prompts and
 * connectivity state. Kept in one place so the shell can surface all of it
 * without every page wiring up its own listeners.
 */

type UpdateListener = (apply: () => void) => void;

let waitingWorker: ServiceWorker | null = null;
const updateListeners = new Set<UpdateListener>();

/** Subscribe to "a new version is ready" events. Returns an unsubscribe fn. */
export function onUpdateAvailable(fn: UpdateListener): () => void {
	updateListeners.add(fn);
	if (waitingWorker) fn(() => activateUpdate());
	return () => updateListeners.delete(fn);
}

function announceUpdate() {
	for (const fn of updateListeners) {
		fn(() => activateUpdate());
	}
}

/** Take the waiting worker and reload into the new version. */
export function activateUpdate() {
	if (!waitingWorker) {
		location.reload();
		return;
	}
	waitingWorker.postMessage('SKIP_WAITING');
	// The controllerchange event tells us the new worker has taken over.
	const onChange = () => {
		navigator.serviceWorker.removeEventListener('controllerchange', onChange);
		location.reload();
	};
	navigator.serviceWorker.addEventListener('controllerchange', onChange);
}

export function registerServiceWorker() {
	if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
	// Dev builds don't ship a worker, and reloading on every save is hostile.
	if (import.meta.env.DEV) return;

	const register = () => {
		navigator.serviceWorker
			.register('/service-worker.js', { type: 'module', scope: '/' })
			.then((reg) => {
				if (reg.waiting && navigator.serviceWorker.controller) {
					waitingWorker = reg.waiting;
					announceUpdate();
				}
				reg.addEventListener('updatefound', () => {
					const installing = reg.installing;
					if (!installing) return;
					installing.addEventListener('statechange', () => {
						if (installing.state === 'installed' && navigator.serviceWorker.controller) {
							// A previous worker is still in control, so this is an
							// update rather than a first install.
							waitingWorker = installing;
							announceUpdate();
						}
					});
				});
				// Check for a new build when the app regains focus.
				document.addEventListener('visibilitychange', () => {
					if (document.visibilityState === 'visible') reg.update().catch(() => {});
				});
			})
			.catch(() => {
				/* no worker — the app still works, just without offline support */
			});
	};

	// This runs from onMount, which frequently happens *after* the load event has
	// already fired (SvelteKit hydrates when its module executes). Waiting for
	// `load` unconditionally meant the worker silently never registered on pages
	// that hydrated late, so offline support came and went at random.
	if (document.readyState === 'complete') {
		register();
	} else {
		window.addEventListener('load', register, { once: true });
	}
}

/* ------------------------------------------------------------------ */
/* Install prompt                                                      */
/* ------------------------------------------------------------------ */

let deferredPrompt: BeforeInstallPromptEvent | null = null;
const installListeners = new Set<(canInstall: boolean) => void>();

/** iOS Safari never fires beforeinstallprompt, so we detect it separately. */
export function isIosLike(): boolean {
	if (typeof navigator === 'undefined') return false;
	const ua = navigator.userAgent;
	return (
		/iPad|iPhone|iPod/.test(ua) ||
		// iPadOS 13+ reports as Mac; touch points disambiguate it.
		(navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
	);
}

export function isStandalone(): boolean {
	if (typeof window === 'undefined') return false;
	return (
		window.matchMedia('(display-mode: standalone)').matches ||
		// iOS Safari uses a non-standard property.
		(navigator as { standalone?: boolean }).standalone === true
	);
}

/** True when we could plausibly show an install affordance. */
export function canInstall(): boolean {
	return deferredPrompt !== null;
}

export function onInstallPromptChange(fn: (canInstall: boolean) => void): () => void {
	installListeners.add(fn);
	return () => installListeners.delete(fn);
}

function setDeferred(e: BeforeInstallPromptEvent | null) {
	deferredPrompt = e;
	for (const fn of installListeners) fn(e !== null);
}

export function initInstallPrompt() {
	if (typeof window === 'undefined') return;
	window.addEventListener('beforeinstallprompt', (e) => {
		e.preventDefault();
		setDeferred(e as BeforeInstallPromptEvent);
	});
	window.addEventListener('appinstalled', () => {
		setDeferred(null);
	});
}

/** Prompt the user. Resolves once the flow has been shown. */
export async function promptInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
	if (!deferredPrompt) return 'unavailable';
	const evt = deferredPrompt;
	setDeferred(null);
	evt.prompt();
	const choice = await evt.userChoice;
	return choice.outcome === 'accepted' ? 'accepted' : 'dismissed';
}

/* ------------------------------------------------------------------ */
/* Connectivity                                                        */
/* ------------------------------------------------------------------ */

const onlineListeners = new Set<(online: boolean) => void>();
/** Rune-backed so `isOnline()` is reactive when read inside a template. */
let online = $state(true);

/** Current connectivity. Safe to read directly in a template — it tracks. */
export function isOnline(): boolean {
	return online;
}

export function onOnlineChange(fn: (online: boolean) => void): () => void {
	onlineListeners.add(fn);
	return () => onlineListeners.delete(fn);
}

export function initConnectivity() {
	if (typeof window === 'undefined') return;
	online = navigator.onLine;
	const set = (v: boolean) => {
		if (online === v) return;
		online = v;
		for (const fn of onlineListeners) fn(v);
	};
	window.addEventListener('online', () => set(true));
	window.addEventListener('offline', () => set(false));
}
