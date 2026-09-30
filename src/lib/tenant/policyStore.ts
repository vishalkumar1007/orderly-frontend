/**
 * Orderly Business Policy & Merchant Agreement Store
 *
 * Tracks the digital signing of the Orderly Platform Policy by tenant
 * administrators/owners during the initial onboarding setup workflow.
 */

export type PolicySignature = {
	signed: boolean;
	signedAt: string;
	signerName: string;
	signerEmail: string;
	version: string;
	ipAudit?: string;
};

const POLICY_VERSION = '1.0.0';

class PolicyStore {
	private subscribers = new Set<() => void>();
	private version = 0;

	subscribe(fn: () => void) {
		this.subscribers.add(fn);
		return () => this.subscribers.delete(fn);
	}

	private notify() {
		this.version++;
		for (const fn of this.subscribers) {
			fn();
		}
	}

	getSignatureKey(tenantSlug: string): string {
		const cleanSlug = tenantSlug.trim().toLowerCase() || 'default';
		return `orderly_policy_signed_${cleanSlug}`;
	}

	getSkipKey(tenantSlug: string): string {
		const cleanSlug = tenantSlug.trim().toLowerCase() || 'default';
		return `orderly_policy_skipped_${cleanSlug}`;
	}

	isSkipped(tenantSlug: string): boolean {
		if (typeof window === 'undefined') return false;
		try {
			return sessionStorage.getItem(this.getSkipKey(tenantSlug)) === 'true';
		} catch {
			return false;
		}
	}

	skip(tenantSlug: string): void {
		if (typeof window === 'undefined') return;
		try {
			sessionStorage.setItem(this.getSkipKey(tenantSlug), 'true');
		} catch {}
		this.notify();
	}

	clearSkip(tenantSlug: string): void {
		if (typeof window === 'undefined') return;
		try {
			sessionStorage.removeItem(this.getSkipKey(tenantSlug));
		} catch {}
		this.notify();
	}

	getSignature(tenantSlug: string): PolicySignature | null {
		if (typeof window === 'undefined') return null;
		try {
			const raw = localStorage.getItem(this.getSignatureKey(tenantSlug));
			if (!raw) return null;
			const parsed = JSON.parse(raw);
			if (parsed && parsed.signed) {
				return parsed as PolicySignature;
			}
			return null;
		} catch {
			return null;
		}
	}

	isSigned(tenantSlug: string): boolean {
		return !!this.getSignature(tenantSlug)?.signed;
	}

	sign(tenantSlug: string, signerName: string, signerEmail: string): PolicySignature {
		const signature: PolicySignature = {
			signed: true,
			signedAt: new Date().toISOString(),
			signerName: signerName.trim() || 'Business Owner',
			signerEmail: signerEmail.trim(),
			version: POLICY_VERSION,
			ipAudit: 'Local Browser Verified'
		};

		if (typeof window !== 'undefined') {
			try {
				localStorage.setItem(this.getSignatureKey(tenantSlug), JSON.stringify(signature));
			} catch (e) {
				console.error('Failed to save policy signature to localStorage', e);
			}
		}

		this.notify();
		return signature;
	}

	reset(tenantSlug: string): void {
		if (typeof window !== 'undefined') {
			try {
				localStorage.removeItem(this.getSignatureKey(tenantSlug));
			} catch {}
		}
		this.notify();
	}
}

export const policyStore = new PolicyStore();
