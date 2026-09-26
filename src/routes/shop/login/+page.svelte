<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import ArrowRight from '@lucide/svelte/icons/arrow-right';
	import Eye from '@lucide/svelte/icons/eye';
	import EyeOff from '@lucide/svelte/icons/eye-off';
	import Lock from '@lucide/svelte/icons/lock';
	import Mail from '@lucide/svelte/icons/mail';
	import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
	import { adminLogin, homeForRole, tenantLogin } from '$lib/auth';
	import OrderlyMark from '$lib/components/admin/OrderlyMark.svelte';
	import { isIosLike, isStandalone, promptInstall, canInstall, onInstallPromptChange } from '$lib/pwa.svelte';
	import { toast } from '$lib/components/admin/toast';

	let email = $state('');
	let password = $state('');
	let error = $state('');
	let loading = $state(false);
	let showPassword = $state(false);
	let installable = $state(canInstall());
	let installed = $state(isStandalone());

	const hostKind = $derived($page.data.hostKind as 'admin' | 'tenant' | 'unknown');
	const tenantSlug = $derived(($page.data.tenantSlug as string | null) ?? null);

	$effect(() => {
		onInstallPromptChange((v) => (installable = v));
	});
	$effect(() => {
		installed = isStandalone();
	});

	$effect(() => {
		if (hostKind === 'admin') {
			goto('/superadmin/login');
		}
	});

	async function submit(e: Event) {
		e.preventDefault();
		error = '';
		loading = true;
		try {
			if (hostKind === 'admin') {
				const user = await adminLogin(email.trim(), password);
				goto(homeForRole(user.role, 'admin'));
			} else if (hostKind === 'tenant') {
				const user = await tenantLogin(email.trim(), password);
				goto(homeForRole(user.role, 'tenant'));
			} else {
				error = 'Open your shop address to sign in.';
			}
		} catch (err) {
			error = err instanceof Error ? err.message : 'Login failed';
		} finally {
			loading = false;
		}
	}

	async function install() {
		const result = await promptInstall();
		if (result === 'accepted') installed = true;
	}
</script>

<!--
	The tenant's brand theme is already applied to <html> for shop hosts, so this
	screen uses the tokens rather than hard-coded colours like the old page did.
-->
<main class="osh-login">
	<form class="osh-login-card" onsubmit={submit}>
		<div class="osh-login-brand">
			<span class="osh-login-mark"><OrderlyMark size={30} /></span>
			<div>
				<p class="osh-login-name">{tenantSlug ? tenantSlug : 'Orderly'}</p>
				<p class="osh-login-sub">
					{hostKind === 'admin' ? 'Super Admin' : 'Shop admin'}
				</p>
			</div>
		</div>

		<h1 class="osh-login-title">
			{hostKind === 'admin' ? 'Platform sign-in' : 'Welcome back'}
		</h1>
		<p class="osh-login-sub-copy">
			{hostKind === 'admin'
				? 'Sign in to manage every shop on the platform.'
				: 'Sign in to manage your menu, orders and storefront.'}
		</p>

		{#if hostKind === 'unknown'}
			<p class="osh-login-note">
				Open your shop's own address to sign in — for example
				<code>{'{shop}'}.localhost</code>. Platform admins use
				<a href="/superadmin/login">/superadmin/login</a>.
			</p>
		{/if}

		<div class="osh-login-field">
			<label class="osh-login-label" for="email">Email</label>
			<div class="osh-login-input">
				<Mail size={16} strokeWidth={1.85} />
				<input
					id="email"
					type="email"
					bind:value={email}
					placeholder="you@shop.com"
					autocomplete="username"
					autocapitalize="none"
					spellcheck="false"
					required
				/>
			</div>
		</div>

		<div class="osh-login-field">
			<label class="osh-login-label" for="password">Password</label>
			<div class="osh-login-input">
				<Lock size={16} strokeWidth={1.85} />
				<input
					id="password"
					type={showPassword ? 'text' : 'password'}
					bind:value={password}
					placeholder="Your password"
					autocomplete="current-password"
					required
				/>
				<button
					type="button"
					class="osh-login-eye"
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
		</div>

		{#if error}
			<p class="osh-login-alert" role="alert">
				<TriangleAlert size={16} strokeWidth={2} />
				<span>{error}</span>
			</p>
		{/if}

		<button
			class="btn btn-primary osh-login-submit"
			type="submit"
			disabled={loading || hostKind === 'unknown'}
		>
			{loading ? 'Signing in…' : 'Sign in'}
			{#if !loading}<ArrowRight size={16} strokeWidth={2.2} />{/if}
		</button>

		{#if !installed && (installable || isIosLike())}
			<div class="osh-login-install">
				{#if installable}
					<button class="btn btn-ghost" type="button" onclick={install}>
						Add to home screen
					</button>
				{:else}
					<p class="osh-login-install-hint">
						Tap <b>Share</b> then <b>Add to Home Screen</b> to use Orderly like an app.
					</p>
				{/if}
			</div>
		{/if}
	</form>
</main>

<style>
	.osh-login {
		min-height: 100dvh;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 1.25rem;
		padding-top: calc(1.25rem + env(safe-area-inset-top, 0px));
		padding-bottom: calc(1.25rem + env(safe-area-inset-bottom, 0px));
		background:
			radial-gradient(120% 90% at 50% 0%, var(--accent-soft) 0%, transparent 62%),
			var(--bg);
	}

	.osh-login-card {
		width: 100%;
		max-width: 24rem;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: var(--radius-lg);
		box-shadow: var(--shadow-md);
		padding: 1.5rem 1.25rem;
	}

	.osh-login-brand {
		display: flex;
		align-items: center;
		gap: 0.7rem;
		margin-bottom: 1.35rem;
	}

	.osh-login-mark {
		display: grid;
		place-items: center;
		flex: none;
	}

	.osh-login-name {
		margin: 0;
		font-family: var(--font-display);
		font-size: 0.95rem;
		font-weight: 700;
		letter-spacing: -0.01em;
		line-height: 1.2;
	}

	.osh-login-sub {
		margin: 0.05rem 0 0;
		font-size: 0.7rem;
		font-weight: 650;
		text-transform: uppercase;
		letter-spacing: 0.07em;
		color: var(--text-3);
	}

	.osh-login-title {
		margin: 0 0 0.3rem;
		font-family: var(--font-display);
		font-size: 1.35rem;
		font-weight: 700;
		letter-spacing: -0.02em;
	}

	.osh-login-sub-copy {
		margin: 0 0 1.25rem;
		font-size: 0.86rem;
		color: var(--text-2);
		line-height: 1.5;
	}

	.osh-login-note {
		margin: 0 0 1.1rem;
		padding: 0.65rem 0.75rem;
		border-radius: var(--radius-sm);
		background: var(--surface-2);
		border: 1px solid var(--border);
		font-size: 0.78rem;
		color: var(--text-2);
		line-height: 1.5;
	}

	.osh-login-note code {
		font-family: var(--font-mono);
		font-size: 0.75rem;
	}

	.osh-login-note a {
		color: var(--accent-dark);
	}

	.osh-login-field {
		margin-bottom: 0.85rem;
	}

	.osh-login-label {
		display: block;
		font-size: 0.78rem;
		font-weight: 600;
		color: var(--text-2);
		margin-bottom: 0.3rem;
	}

	.osh-login-input {
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

	.osh-login-input:focus-within {
		border-color: var(--accent);
		box-shadow: 0 0 0 3px var(--accent-ring);
	}

	.osh-login-input input {
		flex: 1;
		min-width: 0;
		border: none;
		background: none;
		outline: none;
		font: inherit;
		font-size: 0.95rem;
		color: var(--text);
		/* 16px avoids iOS Safari zooming when a field is focused. */
		min-height: 2.85rem;
	}

	.osh-login-eye {
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

	.osh-login-alert {
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

	.osh-login-submit {
		width: 100%;
		min-height: 3rem;
		font-size: 0.95rem;
		margin-top: 0.25rem;
	}

	.osh-login-install {
		margin-top: 0.9rem;
		padding-top: 0.9rem;
		border-top: 1px solid var(--border-subtle);
	}

	.osh-login-install .btn {
		width: 100%;
		min-height: 2.75rem;
	}

	.osh-login-install-hint {
		margin: 0;
		font-size: 0.76rem;
		color: var(--text-3);
		text-align: center;
		line-height: 1.5;
	}
</style>
