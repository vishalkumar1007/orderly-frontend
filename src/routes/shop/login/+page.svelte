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
	import { brandVars, type BrandTheme } from '$lib/brandTheme';
	import { isIosLike, isStandalone, promptInstall, canInstall, onInstallPromptChange } from '$lib/pwa.svelte';

	let email = $state('');
	let password = $state('');
	let error = $state('');
	let loading = $state(false);
	let showPassword = $state(false);
	let installable = $state(canInstall());
	let installed = $state(isStandalone());

	const hostKind = $derived($page.data.hostKind as 'admin' | 'tenant' | 'unknown');
	const tenantSlug = $derived(($page.data.tenantSlug as string | null) ?? null);

	/**
	 * The shop's own identity, loaded server-side.
	 *
	 * `logoUrl` is empty whenever the shop has not uploaded one, and that is the
	 * common case — a placeholder glyph would be inventing a brand that does not
	 * exist. With no logo the name stands on its own, which is also what a shop
	 * called "Momo magic" wants: no competing mark stealing the first glance.
	 */
	const shop = $derived(($page.data.shop as { name: string; logoUrl: string } | null) ?? null);
	const shopName = $derived(shop?.name || tenantSlug || 'Orderly');
	const shopLogo = $derived(shop?.logoUrl || '');

	/**
	 * The console brand, rendered server-side onto this page's root element.
	 *
	 * Applying it here rather than through `applyBrandTheme` is deliberate: that
	 * function writes to `<html>`, which cannot be done from a server load without
	 * a flash — the browser would paint the default palette first and repaint after
	 * hydration. An inline style on the page root is in the very first frame, and
	 * because every token on this screen is read inside it, the override is scoped
	 * to exactly this page.
	 */
	const brand = $derived(($page.data.brand as BrandTheme | null) ?? null);
	const brandStyle = $derived(brandVars(brand));

	/**
	 * A logo URL that 404s must not leave a torn image where the brand should be,
	 * so a failed load falls back to showing the name alone — the same state as
	 * never having had a logo.
	 */
	let logoBroken = $state(false);

	$effect(() => {
		// Depends on the URL, so a shop that fixes a broken logo recovers without
		// a reload.
		void shopLogo;
		logoBroken = false;
	});

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

	Deliberately not a card. A floating panel with its own border and shadow reads
	as a dialog, and this is not one — it is a doorway. The page is a single
	centred column of type and inputs on the tenant's own background, which is what
	makes it look like part of the shop rather than a generic admin screen.
-->
<main class="osh-login" style={brandStyle}>
	<form class="osh-login-panel" onsubmit={submit}>
		<header class="osh-login-head">
			{#if shopLogo && !logoBroken}
				<img
					class="osh-login-logo"
					src={shopLogo}
					alt=""
					width="44"
					height="44"
					onerror={() => (logoBroken = true)}
				/>
			{/if}
			<!-- No logo means the name leads, at display size. A shop's name is the
			     clearest thing it can put on a sign-in screen. -->
			<h1 class="osh-login-name" class:osh-login-name--lead={!shopLogo || logoBroken}>
				{shopName}
			</h1>
			<p class="osh-login-sub">
				{hostKind === 'admin' ? 'Platform console' : 'Shop console'}
			</p>
		</header>

		<h2 class="osh-login-title">
			{hostKind === 'admin' ? 'Sign in to continue' : 'Sign in to manage your shop'}
		</h2>
		<p class="osh-login-sub-copy">
			{hostKind === 'admin'
				? 'Manage every shop on the platform.'
				: 'Your menu, orders and storefront.'}
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
	/*
		No card. A bordered, shadowed panel reads as a dialog or a modal, and a
		sign-in screen is neither — it is a doorway into the shop. So the page is a
		single narrow column of type and inputs sitting directly on the tenant's own
		background, with the shop's name as the one piece of real identity.

		The layout is intentionally top-weighted and generous in spacing, so the eye
		lands on the shop name, then the heading, then the two fields, and the
		submit button is reachable without the page feeling sparse.
	*/
	/*
		The shop's colour reaches the whole page, not just the button.

		Three layers, all derived from the brand tokens the server wrote onto this
		element, so the background is as themed as the accent is: a barely-tinted
		base surface, a wash from the top in the primary accent, and a cooler one
		from the bottom in the secondary.

		The base is mixed at 5%, not replaced. A sign-in form has to stay readable
		first — the text colour is unchanged and sits on a near-neutral surface, so
		contrast is preserved whatever accent the owner picks. Branding the page
		means tinting it, not inverting it.
	*/
	.osh-login {
		--osh-base: color-mix(in srgb, var(--accent) 5%, var(--bg));
		--osh-wash: color-mix(in srgb, var(--accent) 20%, transparent);
		--osh-wash-2: color-mix(in srgb, var(--accent-2) 13%, transparent);

		min-height: 100dvh;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 2rem 1.25rem;
		padding-top: calc(2rem + env(safe-area-inset-top, 0px));
		padding-bottom: calc(2rem + env(safe-area-inset-bottom, 0px));
		background:
			radial-gradient(120% 68% at 50% -12%, var(--osh-wash) 0%, transparent 62%),
			radial-gradient(85% 55% at 50% 112%, var(--osh-wash-2) 0%, transparent 58%),
			var(--osh-base);
	}

	.osh-login-panel {
		width: 100%;
		/* Narrow enough that a long email cannot stretch the field row. */
		max-width: 22.5rem;
		display: flex;
		flex-direction: column;
	}

	/* ---------------------------------------------------------------- *
	 * Identity
	 * ---------------------------------------------------------------- */
	.osh-login-head {
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
		margin-bottom: 2rem;
	}

	/*
		A logo is capped rather than allowed to fill the space: an uploaded image of
		unknown proportions must not push the form off the screen, so it is boxed
		and cropped to a square.
	*/
	.osh-login-logo {
		width: 44px;
		height: 44px;
		object-fit: cover;
		border-radius: var(--radius-md);
		margin-bottom: 0.9rem;
	}

	.osh-login-name {
		margin: 0;
		font-family: var(--font-display);
		font-size: var(--fs-title);
		font-weight: 700;
		letter-spacing: -0.01em;
		line-height: 1.2;
		color: var(--text);
	}

	/* With no logo above it, the name becomes the headline rather than a caption
	   sitting under a placeholder. */
	.osh-login-name--lead {
		font-size: var(--fs-display);
		font-weight: 800;
		letter-spacing: -0.03em;
	}

	.osh-login-sub {
		margin: 0.3rem 0 0;
		font-size: var(--fs-label);
		font-weight: 650;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--text-3);
	}

	/* ---------------------------------------------------------------- *
	 * Heading
	 * ---------------------------------------------------------------- */
	.osh-login-title {
		margin: 0 0 0.4rem;
		font-family: var(--font-display);
		font-size: var(--fs-h1);
		font-weight: 700;
		letter-spacing: -0.02em;
		color: var(--text);
	}

	.osh-login-sub-copy {
		margin: 0 0 1.75rem;
		font-size: var(--fs-body);
		color: var(--text-2);
		line-height: 1.55;
	}

	.osh-login-note {
		margin: 0 0 1.5rem;
		padding: 0.7rem 0.8rem;
		border-radius: var(--radius-sm);
		background: var(--surface-2);
		border: 1px solid var(--border);
		font-size: var(--fs-tab);
		color: var(--text-2);
		line-height: 1.55;
	}

	.osh-login-note code {
		font-family: var(--font-mono);
		font-size: var(--fs-code);
	}

	.osh-login-note a {
		color: var(--accent-dark);
	}

	/* ---------------------------------------------------------------- *
	 * Fields
	 *
	 * The label sits above a bare underlined input rather than inside a filled
	 * box. Without the card, filled boxes would be the only thing giving the
	 * column structure, and a column of five grey rectangles is a card by another
	 * name. An underline reads as a field and leaves the page quiet.
	 * ---------------------------------------------------------------- */
	.osh-login-field {
		margin-bottom: 1.15rem;
	}

	.osh-login-label {
		display: block;
		margin-bottom: 0.4rem;
		font-size: var(--fs-code);
		font-weight: 600;
		letter-spacing: 0.01em;
		color: var(--text-2);
	}

	.osh-login-input {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		color: var(--text-3);
		/* A faint accent in the resting underline, so the form belongs to the
		   page it is on. It strengthens to full accent on focus, below. */
		border-bottom: 1px solid color-mix(in srgb, var(--accent) 24%, var(--border));
		transition: border-color var(--tr), box-shadow var(--tr);
	}

	/*
		The focus ring is drawn as an inset shadow on the underline rather than an
		outline around the field, so the focus is visible without reintroducing a box
		around the input.
	*/
	.osh-login-input:focus-within {
		border-bottom-color: var(--accent);
		box-shadow: 0 1px 0 0 var(--accent);
	}

	.osh-login-input input {
		flex: 1;
		min-width: 0;
		border: none;
		background: none;
		outline: none;
		font: inherit;
		font-size: var(--fs-title);
		color: var(--text);
		padding: 0.6rem 0 0.65rem;
		/* 16px avoids iOS Safari zooming when a field is focused. */
		min-height: 2.75rem;
	}

	.osh-login-input input::placeholder {
		color: var(--text-3);
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

	.osh-login-eye:hover {
		color: var(--text-2);
	}

	/* ---------------------------------------------------------------- *
	 * Feedback and submit
	 * ---------------------------------------------------------------- */
	.osh-login-alert {
		display: flex;
		align-items: flex-start;
		gap: 0.45rem;
		margin: 0 0 1.15rem;
		padding: 0.65rem 0.75rem;
		border-radius: var(--radius-sm);
		background: var(--danger-bg);
		color: var(--danger);
		font-size: var(--fs-body);
		line-height: 1.45;
	}

	/*
		`:global` because the icon lives inside a child component, so Svelte's
		scoped selector never reaches it without it.
	*/
	.osh-login-alert :global(svg) {
		flex: none;
		margin-top: 0.1rem;
	}

	.osh-login-submit {
		width: 100%;
		min-height: 3rem;
		margin-top: 0.35rem;
		font-size: var(--fs-title);
		/* A single primary action, so it does not need to shout twice. */
		justify-content: center;
	}

	.osh-login-install {
		margin-top: 1.75rem;
		padding-top: 1.5rem;
		border-top: 1px solid var(--border-subtle);
		text-align: center;
	}

	.osh-login-install .btn {
		width: 100%;
		min-height: 2.75rem;
	}

	.osh-login-install-hint {
		margin: 0;
		font-size: var(--fs-code);
		color: var(--text-3);
		line-height: 1.5;
	}
</style>
