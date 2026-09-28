<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import ArrowRight from '@lucide/svelte/icons/arrow-right';
	import Eye from '@lucide/svelte/icons/eye';
	import EyeOff from '@lucide/svelte/icons/eye-off';
	import Lock from '@lucide/svelte/icons/lock';
	import ShieldCheck from '@lucide/svelte/icons/shield-check';
	import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
	import { homeForRole, setupPassword } from '$lib/auth';
	import { api } from '$lib/api/client';
	import { applyBrandTheme, clearBrandTheme, type BrandTheme } from '$lib/brandTheme';

	let password = $state('');
	let confirm = $state('');
	let error = $state('');
	let loading = $state(false);
	let showPassword = $state(false);
	let brandTheme = $state<BrandTheme | null>(null);
	let storeName = $state('');
	let storeLogo = $state('');

	const token = $derived($page.url.searchParams.get('token') || '');

	const hostKind = $derived($page.data.hostKind as 'admin' | 'tenant' | 'unknown');
	const tenantSlug = $derived(($page.data.tenantSlug as string | null) ?? null);

	const displayName = $derived(storeName || tenantSlug || 'Orderly');
	const displayLogo = $derived(storeLogo);

	const passwordStrength = $derived.by(() => {
		if (!password) return { level: 0, label: '', color: '' };
		let score = 0;
		if (password.length >= 8) score++;
		if (password.length >= 12) score++;
		if (/[A-Z]/.test(password)) score++;
		if (/[0-9]/.test(password)) score++;
		if (/[^A-Za-z0-9]/.test(password)) score++;
		if (score <= 2) return { level: 1, label: 'Weak', color: 'var(--danger)' };
		if (score <= 3) return { level: 2, label: 'Fair', color: 'var(--warn)' };
		if (score <= 4) return { level: 3, label: 'Good', color: 'var(--info)' };
		return { level: 4, label: 'Strong', color: 'var(--success)' };
	});

	onMount(() => {
		/*
		 * The business's brand, on the very first page its owner ever opens.
		 *
		 * `/api/v1/public/theme` and not `/api/v1/tenant/theme`: whoever is
		 * setting a password has no token yet by definition, so the
		 * authenticated route answered 401 and this page fell back to the
		 * built-in indigo — the one screen where the brand matters most was the
		 * one screen that never showed it. The public route is the same handler
		 * on the same host-resolved tenant, and the payload is presentation
		 * only.
		 */
		if (hostKind === 'tenant') {
			const storeConfig = ($page.data as {
				config?: { store?: { name?: string; logo_url?: string } };
			}).config;
			if (storeConfig?.store?.name) storeName = storeConfig.store.name;
			if (storeConfig?.store?.logo_url) storeLogo = storeConfig.store.logo_url;

			api<BrandTheme>('/api/v1/public/theme')
				.then((theme) => {
					brandTheme = theme;
					applyBrandTheme(theme);
				})
				.catch(() => {
					// Unreachable or unthemed: the storefront name and logo above
					// still identify the shop, which is the point of this page.
				});
		}

		return () => {
			clearBrandTheme();
		};
	});

	async function submit(e: Event) {
		e.preventDefault();
		error = '';
		if (password.length < 8) {
			error = 'Password must be at least 8 characters';
			return;
		}
		if (password !== confirm) {
			error = 'Passwords do not match';
			return;
		}
		if (!token) {
			error = 'Missing invite token';
			return;
		}
		loading = true;
		try {
			const user = await setupPassword(token, password);
			goto(homeForRole(user.role, 'tenant'));
		} catch (err) {
			error = err instanceof Error ? err.message : 'Setup failed';
		} finally {
			loading = false;
		}
	}
</script>

<main class="setup-page">
	<div class="setup-content">
		<div class="setup-brand">
			{#if displayLogo}
				<img class="setup-logo" src={displayLogo} alt="" width={32} height={32} />
			{:else}
				<span class="setup-mark" aria-hidden="true">
					{displayName.charAt(0).toUpperCase()}
				</span>
			{/if}
			<div>
				<p class="setup-name">{displayName}</p>
				<p class="setup-sub">Shop admin</p>
			</div>
		</div>

		<div class="setup-heading">
			<div class="setup-icon" aria-hidden="true">
				<ShieldCheck size={24} strokeWidth={1.8} />
			</div>
			<h1>Set your password</h1>
			<p>Create a secure password for your shop admin account</p>
		</div>

		<form class="setup-form" onsubmit={submit}>
			<div class="setup-field">
				<label for="password">New password</label>
				<div class="setup-input">
					<Lock size={16} strokeWidth={1.85} />
					<input
						id="password"
						type={showPassword ? 'text' : 'password'}
						bind:value={password}
						placeholder="At least 8 characters"
						autocomplete="new-password"
						required
						minlength="8"
					/>
					<button
						type="button"
						class="setup-eye"
						aria-label={showPassword ? 'Hide password' : 'Show password'}
						onclick={() => (showPassword = !showPassword)}
					>
						{#if showPassword}
							<EyeOff size={16} strokeWidth={1.85} />
						{:else}
							<Eye size={16} strokeWidth={1.85} />
						{/if}
					</button>
				</div>
				{#if password}
					<div class="setup-strength">
						<div class="setup-strength-bars">
							{#each [1, 2, 3, 4] as i}
								<div class="setup-strength-bar" class:filled={passwordStrength.level >= i} style="--bar-color: {passwordStrength.color}"></div>
							{/each}
						</div>
						<span class="setup-strength-label" style="color: {passwordStrength.color}">{passwordStrength.label}</span>
					</div>
				{/if}
			</div>

			<div class="setup-field">
				<label for="confirm">Confirm password</label>
				<div class="setup-input">
					<Lock size={16} strokeWidth={1.85} />
					<input
						id="confirm"
						type="password"
						bind:value={confirm}
						placeholder="Re-enter your password"
						autocomplete="new-password"
						required
						minlength="8"
					/>
				</div>
			</div>

			{#if error}
				<p class="setup-alert" role="alert">
					<TriangleAlert size={16} strokeWidth={2} />
					<span>{error}</span>
				</p>
			{/if}

			<button class="btn btn-primary setup-submit" type="submit" disabled={loading || !token}>
				{loading ? 'Creating account…' : 'Continue to dashboard'}
				{#if !loading}<ArrowRight size={16} strokeWidth={2.2} />{/if}
			</button>
		</form>

		<p class="setup-footer">
			<Lock size={12} strokeWidth={1.9} />
			Protected by secure authentication
		</p>
	</div>
</main>

<style>
	.setup-page {
		min-height: 100dvh;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 1.5rem;
		background:
			radial-gradient(120% 90% at 50% 0%, var(--accent-soft) 0%, transparent 62%),
			var(--bg);
	}

	.setup-content {
		width: 100%;
		max-width: 24rem;
	}

	.setup-brand {
		display: flex;
		align-items: center;
		gap: 0.7rem;
		margin-bottom: 2.5rem;
	}

	.setup-logo {
		width: 32px;
		height: 32px;
		border-radius: 8px;
		object-fit: cover;
		flex-shrink: 0;
	}

	.setup-mark {
		display: grid;
		place-items: center;
		width: 32px;
		height: 32px;
		border-radius: 8px;
		background: var(--accent);
		color: var(--on-accent);
		font-weight: 700;
		font-size: 0.95rem;
		flex-shrink: 0;
	}

	.setup-name {
		margin: 0;
		font-family: var(--font-display);
		font-size: 0.95rem;
		font-weight: 700;
		letter-spacing: -0.01em;
		line-height: 1.2;
	}

	.setup-sub {
		margin: 0.05rem 0 0;
		font-size: 0.7rem;
		font-weight: 650;
		text-transform: uppercase;
		letter-spacing: 0.07em;
		color: var(--text-3);
	}

	.setup-heading {
		margin-bottom: 1.5rem;
	}

	.setup-icon {
		display: grid;
		place-items: center;
		width: 44px;
		height: 44px;
		margin-bottom: 1rem;
		border-radius: 12px;
		background: var(--icon-bg);
		color: var(--icon-fg);
	}

	.setup-heading h1 {
		margin: 0 0 0.3rem;
		font-family: var(--font-display);
		font-size: 1.35rem;
		font-weight: 700;
		letter-spacing: -0.02em;
	}

	.setup-heading p {
		margin: 0;
		font-size: 0.86rem;
		color: var(--text-2);
		line-height: 1.5;
	}

	.setup-field {
		margin-bottom: 0.85rem;
	}

	.setup-field label {
		display: block;
		font-size: 0.78rem;
		font-weight: 600;
		color: var(--text-2);
		margin-bottom: 0.3rem;
	}

	.setup-input {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0 0.7rem;
		min-height: 2.9rem;
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		background: var(--surface-2);
		color: var(--text-3);
		transition: border-color var(--tr), box-shadow var(--tr);
	}

	.setup-input:focus-within {
		border-color: var(--accent);
		box-shadow: 0 0 0 3px var(--accent-ring);
	}

	.setup-input input {
		flex: 1;
		min-width: 0;
		border: none;
		background: none;
		outline: none;
		font: inherit;
		font-size: 0.95rem;
		color: var(--text);
		min-height: 2.85rem;
	}

	.setup-eye {
		flex: none;
		display: grid;
		place-items: center;
		width: 2rem;
		height: 2rem;
		border: none;
		background: none;
		color: var(--text-3);
		cursor: pointer;
		border-radius: 6px;
		-webkit-tap-highlight-color: transparent;
	}

	.setup-eye:hover {
		color: var(--text);
	}

	.setup-strength {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		margin-top: 0.4rem;
	}

	.setup-strength-bars {
		display: flex;
		gap: 4px;
		flex: 1;
	}

	.setup-strength-bar {
		height: 3px;
		flex: 1;
		border-radius: 999px;
		background: var(--surface-3);
		transition: background 0.2s ease;
	}

	.setup-strength-bar.filled {
		background: var(--bar-color, var(--accent));
	}

	.setup-strength-label {
		font-size: 0.7rem;
		font-weight: 600;
	}

	.setup-alert {
		display: flex;
		align-items: flex-start;
		gap: 0.45rem;
		margin: 0 0 0.85rem;
		padding: 0.6rem 0.7rem;
		border-radius: var(--radius-sm);
		background: var(--danger-bg);
		color: var(--danger);
		font-size: 0.82rem;
		line-height: 1.45;
	}

	.setup-submit {
		width: 100%;
		min-height: 3rem;
		font-size: 0.95rem;
		margin-top: 0.25rem;
	}

	.setup-footer {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.35rem;
		margin-top: 1.5rem;
		font-size: 0.72rem;
		color: var(--text-3);
	}
</style>
