/**
 * Turning a failed request into something a Super Admin can act on.
 *
 * Raw backend text is never shown. Not because it is secret — it is not — but
 * because "pq: duplicate key value violates unique constraint tenants_slug_key"
 * tells an operator nothing about what to do next, while "That subdomain is
 * already taken" tells them exactly.
 *
 * Every screen funnels its failures through {@link describeError}, so the
 * console has one voice and one place to improve when a new failure shows up.
 */

import { ApiClientError } from '$lib/api/client';

export type ErrorKind =
	| 'network'
	| 'timeout'
	| 'auth'
	| 'permission'
	| 'not_found'
	| 'conflict'
	| 'validation'
	| 'integration'
	| 'server'
	| 'unknown';

export type DescribedError = {
	kind: ErrorKind;
	/** One line, sentence case, no error codes. */
	title: string;
	/** What to do about it. Empty when there is nothing useful to add. */
	detail: string;
	/** Whether retrying the same request could plausibly succeed. */
	retryable: boolean;
};

/** Failures that are about a specific field, keyed by the backend's code. */
const CODE_MESSAGES: Record<string, { title: string; detail: string; kind: ErrorKind }> = {
	slug_taken: {
		title: 'That subdomain is already taken',
		detail: 'Choose a different subdomain — every business needs its own.',
		kind: 'conflict'
	},
	slug_reserved: {
		title: 'That subdomain is reserved',
		detail: 'The platform uses this name itself. Pick another one.',
		kind: 'conflict'
	},
	invalid_slug: {
		title: 'That subdomain is not valid',
		detail: 'Use lowercase letters, numbers and hyphens only.',
		kind: 'validation'
	},
	duplicate: {
		title: 'That name is already in use',
		detail: 'Pick a name that is not already taken.',
		kind: 'conflict'
	},
	plan_in_use: {
		title: 'Businesses are still on this plan',
		detail: 'Move them to another plan before renaming it.',
		kind: 'conflict'
	},
	configuration_unavailable: {
		title: 'That integration is not available',
		detail: 'Check the provider under Providers & integrations, then try again.',
		kind: 'integration'
	},
	timeout: {
		title: 'The request took too long',
		detail: 'The API did not answer in time. Check that it is running, then try again.',
		kind: 'timeout'
	},
	network_error: {
		title: 'Could not reach the API',
		detail: 'The console could not connect. Check your connection and that the API is running.',
		kind: 'network'
	}
};

/** Failures that are about the request as a whole, keyed by HTTP status. */
function fromStatus(status: number, message: string): DescribedError {
	switch (true) {
		case status === 401:
			return {
				kind: 'auth',
				title: 'Your session has expired',
				detail: 'Sign in again to continue.',
				retryable: false
			};
		case status === 403:
			return {
				kind: 'permission',
				title: 'You do not have access to this',
				detail: 'This action needs a Super Admin session on the platform host.',
				retryable: false
			};
		case status === 404:
			return {
				kind: 'not_found',
				title: 'That record no longer exists',
				detail: 'It may have been removed. Refresh the list to see the current state.',
				retryable: false
			};
		case status === 409:
			return {
				kind: 'conflict',
				title: 'That conflicts with something that already exists',
				detail: cleanDetail(message),
				retryable: false
			};
		case status === 400 || status === 422:
			return {
				kind: 'validation',
				title: 'Some details need fixing',
				detail: cleanDetail(message),
				retryable: false
			};
		case status === 429:
			return {
				kind: 'server',
				title: 'Too many requests',
				detail: 'Wait a moment and try again.',
				retryable: true
			};
		case status >= 500:
			return {
				kind: 'server',
				title: 'The platform could not complete that',
				detail: 'Something failed on the server. Try again; if it keeps failing, check system health.',
				retryable: true
			};
		default:
			return {
				kind: 'unknown',
				title: 'That did not work',
				detail: cleanDetail(message),
				retryable: true
			};
	}
}

/** Describe any thrown value as something worth putting on screen. */
export function describeError(err: unknown): DescribedError {
	if (err instanceof ApiClientError) {
		const known = CODE_MESSAGES[err.code];
		if (known) {
			return { ...known, retryable: known.kind === 'network' || known.kind === 'timeout' };
		}
		return fromStatus(err.status, err.message);
	}
	if (err instanceof Error) {
		return {
			kind: 'unknown',
			title: 'That did not work',
			detail: cleanDetail(err.message),
			retryable: true
		};
	}
	return {
		kind: 'unknown',
		title: 'That did not work',
		detail: '',
		retryable: true
	};
}

/**
 * The message for a failed sign-in or first-run setup.
 *
 * These cannot use {@link errorMessage}: a 401 there is answered with "your
 * session has expired", which is exactly wrong on a sign-in form — there was
 * no session, the password was simply wrong. Anything that is not a rejected
 * credential falls through to the shared mapper, so a database outage during
 * sign-in still reads as a server problem rather than a typo.
 */
export function authErrorMessage(err: unknown, action: 'sign in' | 'create the account'): string {
	if (err instanceof ApiClientError) {
		if (err.status === 401 || err.code === 'invalid_credentials') {
			return 'That email and password do not match an account on this platform.';
		}
		if (err.status === 403) {
			return 'That account cannot sign in to the platform console.';
		}
	}
	const described = describeError(err);
	return `Unable to ${action}. ${described.title}.`;
}

/**
 * One line for a toast, prefixed with what was being attempted.
 *
 * `action` is written as a noun phrase — "create the business" — so the result
 * reads as a sentence: "Unable to create the business. That subdomain is
 * already taken."
 */
export function errorMessage(err: unknown, action: string): string {
	const described = describeError(err);
	const lead = `Unable to ${action}`;
	if (described.kind === 'unknown' && !described.detail) return `${lead}.`;
	return `${lead}. ${described.title}.`;
}

/** The full two-line form, for an inline error panel rather than a toast. */
export function errorLines(err: unknown, action: string): { title: string; detail: string; retryable: boolean } {
	const described = describeError(err);
	return {
		title: `Unable to ${action}`,
		detail: described.detail ? `${described.title}. ${described.detail}` : described.title,
		retryable: described.retryable
	};
}

/**
 * Keep a backend message only when it reads like a sentence written for a
 * person. Anything with a driver prefix, a stack frame or SQL in it is dropped
 * rather than shown.
 */
function cleanDetail(message: string): string {
	const text = (message ?? '').trim();
	if (!text) return '';
	if (text.length > 160) return '';
	if (/(pq:|pgx|sql:|panic:|goroutine|\bERROR\b|constraint|\bnil\b)/i.test(text)) return '';
	return text.charAt(0).toUpperCase() + text.slice(1);
}
