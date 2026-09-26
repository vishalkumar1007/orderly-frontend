/**
 * The signed-in storefront customer.
 *
 * Signing in is optional. Nothing in the guest path reads this store to decide
 * whether an order can be placed, and the cart, checkout and tracking screens all
 * work with it empty. That is why the token lives here rather than in the staff
 * auth module: a diner is not an operator of the shop, and mixing the two would
 * invite exactly the kind of privilege leak the API now guards against.
 *
 * Tokens are stored per tenant slug, because one browser can be signed in to
 * more than one shop on different subdomains.
 */

import { browser } from '$app/environment';
import { writable } from 'svelte/store';
import { storefrontApi, type SessionCustomer } from './api';

const ACCESS_KEY = 'orderly_customer_access';
const REFRESH_KEY = 'orderly_customer_refresh';
const PROFILE_KEY = 'orderly_customer_profile';

export type CustomerTokens = { access_token: string; refresh_token: string; expires_in: number };

export type CustomerSession = {
	customer: SessionCustomer;
	tokens: CustomerTokens;
};

const key = (slug: string, base: string) => `${base}_${slug}`;

function read<T>(storageKey: string, fallback: T): T {
	if (!browser) return fallback;
	try {
		const raw = localStorage.getItem(storageKey);
		return raw ? (JSON.parse(raw) as T) : fallback;
	} catch {
		return fallback;
	}
}

function write(storageKey: string, value: unknown): void {
	if (!browser) return;
	try {
		if (value === null || value === undefined) localStorage.removeItem(storageKey);
		else localStorage.setItem(storageKey, JSON.stringify(value));
	} catch {
		// Private browsing or a full quota. The session still works for this
		// page; it just will not survive a reload.
	}
}

/** `readSession` returns the stored session for a shop, or null. */
export function readSession(slug: string): CustomerSession | null {
	if (!browser || !slug) return null;
	const access = read<string | null>(key(slug, ACCESS_KEY), null);
	const refresh = read<string | null>(key(slug, REFRESH_KEY), null);
	if (!access || !refresh) return null;
	return {
		customer: read<SessionCustomer | null>(key(slug, PROFILE_KEY), null) ?? {
			id: '',
			name: '',
			phone: '',
			phone_full: '',
			is_new: false
		},
		tokens: { access_token: access, refresh_token: refresh, expires_in: 0 }
	};
}

/** `isSignedIn` is a one-shot read for places that need a boolean. */
export function isSignedIn(slug: string): boolean {
	return readSession(slug) !== null;
}

function createSessionStore() {
	const { subscribe, set } = writable<CustomerSession | null>(null);

	/** `load` restores a session from storage so a reload does not sign out. */
	function load(slug: string): CustomerSession | null {
		const stored = readSession(slug);
		set(stored);
		return stored;
	}

	/** `signIn` exchanges a verified code for a session. */
	async function signIn(slug: string, phone: string, code: string): Promise<CustomerSession> {
		const data = await storefrontApi.verifyOtp(phone, code);
		const session: CustomerSession = { customer: data.customer, tokens: data.tokens };
		write(key(slug, ACCESS_KEY), session.tokens.access_token);
		write(key(slug, REFRESH_KEY), session.tokens.refresh_token);
		write(key(slug, PROFILE_KEY), session.customer);
		set(session);
		return session;
	}

	/** `setCustomer` updates the cached profile without a new sign-in. */
	function setCustomer(slug: string, customer: SessionCustomer): void {
		const current = readSession(slug);
		if (!current) return;
		write(key(slug, PROFILE_KEY), customer);
		set({ ...current, customer });
	}

	/** `signOut` clears the local session. Tokens are stateless server-side, so
	 *  there is nothing to revoke; discarding them is the whole of it. */
	function signOut(slug: string): void {
		write(key(slug, ACCESS_KEY), null);
		write(key(slug, REFRESH_KEY), null);
		write(key(slug, PROFILE_KEY), null);
		set(null);
	}

	return { subscribe, load, signIn, signOut, setCustomer, set };
}

export const customerSession = createSessionStore();

/**
 * `customerToken` returns the credential for storefront calls, or `null` for a
 * guest. Passing it to `api({ authToken })` keeps a diner's session entirely
 * separate from the staff session in localStorage.
 */
export function customerToken(slug: string): string | null {
	return readSession(slug)?.tokens.access_token ?? null;
}
