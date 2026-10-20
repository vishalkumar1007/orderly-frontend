<script lang="ts">
	import { experienceFor } from '$lib/storefront/experience';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import ChevronLeft from '@tabler/icons-svelte/icons/chevron-left';
	import Lock from '@tabler/icons-svelte/icons/lock';
	import { friendlyError, storefrontApi } from '$lib/storefront/api';
	import { formatPhone } from '$lib/storefront/format';

	/**
	 * Phone sign-in, step one.
	 *
	 * Reached from the header, from the checkout shortcut, or directly. The next
	 * destination is carried in `?next=` so a customer who started checking out
	 * and decided to sign in lands back at checkout with their details already
	 * filled in, rather than on their profile.
	 */
	let { data } = $props();

	const config = $derived(data.config);
	const exp = $derived(experienceFor(config));
	const enabled = $derived(exp.features.signIn);
	/** Only the methods this shop set up; a choice only when there are two. */
	const methods = $derived(exp.features.signInMethods);
	let picked = $state<'PHONE' | 'EMAIL' | null>(null);
	const method = $derived(picked && methods.includes(picked) ? picked : (methods[0] ?? 'PHONE'));

	let phone = $state('');
	let email = $state('');
	let sending = $state(false);
	let error = $state('');
	let fieldError = $state('');

	const next = $derived($page.url.searchParams.get('next') ?? '/profile');

	/** `next` is only honoured for a same-origin path, so it cannot be used to
	 *  bounce a customer to another site after signing in. */
	const safeNext = $derived(
		next.startsWith('/') && !next.startsWith('//') ? next : '/profile'
	);

	onMount(() => {
		const preset = $page.url.searchParams.get('phone');
		if (preset) phone = preset;
		const presetEmail = $page.url.searchParams.get('email');
		if (presetEmail) {
			email = presetEmail;
			picked = 'EMAIL';
		}
	});

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		error = '';
		fieldError = '';
		if (method === 'EMAIL') {
			if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
				fieldError = 'Enter a valid email address';
				return;
			}
		} else if (phone.replace(/[^\d]/g, '').length < 8) {
			fieldError = 'Enter a valid phone number';
			return;
		}
		sending = true;
		try {
			const to = method === 'EMAIL' ? { email: email.trim() } : { phone: phone.trim() };
			const result = await storefrontApi.sendOtp(to);
			// The countdown comes from the server so a reload cannot skip the wait,
			// and the masked address means this screen never has to hold the raw one.
			const query = new URLSearchParams({
				next: safeNext,
				resend_in: String(result.otp.resend_in)
			});
			if ('email' in to && to.email) query.set('email', to.email);
			else query.set('phone', phone.trim());
			const masked = result.email ?? result.phone;
			if (masked) query.set('masked', masked);
			if (result.otp.dev_code) query.set('dev', result.otp.dev_code);
			await goto(`/verify-otp?${query.toString()}`);
		} catch (err) {
			error = friendlyError(err, 'We could not send a code. Try again shortly.');
		} finally {
			sending = false;
		}
	}
</script>

<div class="sf-wrap" style="padding-top:16px;">
	<a
		href={safeNext}
		style="display:inline-flex;align-items:center;gap:4px;padding:8px 0;font-size:var(--fs-body);font-weight:600;color:var(--sf-text-2);text-decoration:none;"
	>
		<ChevronLeft size={16} stroke={1.6} aria-hidden="true" />
		Back
	</a>

	<div style="max-width:420px;margin:8px auto 0;">
		<h1 style="margin:0 0 6px;font-size:var(--fs-stat);font-weight:800;letter-spacing:-0.02em;">
			Sign in
		</h1>
		<p style="margin:0 0 20px;font-size:var(--fs-title);color:var(--sf-text-2);line-height:1.5;">
			{method === 'EMAIL' ? "We'll email you a code." : "We'll text you a code."} No password needed.
		</p>

		{#if !enabled}
			<div class="sf-alert" data-tone="warn" role="status">
				<span>This store does not offer sign-in right now. You can still order as a guest.</span>
			</div>
			<div style="margin-top:14px;">
				<a class="sf-btn sf-btn-primary sf-btn-block" href="/menu">Browse the menu</a>
			</div>
		{:else}
			{#if error}
				<div class="sf-alert" data-tone="error" role="alert" style="margin-bottom:14px;">
					<span>{error}</span>
				</div>
			{/if}

			{#if methods.length > 1}
				<div class="sf-signin-tabs" role="tablist" aria-label="Sign in with">
					<button type="button" role="tab" aria-selected={method === 'PHONE'} onclick={() => ((picked = 'PHONE'), (fieldError = ''))}>Phone</button>
					<button type="button" role="tab" aria-selected={method === 'EMAIL'} onclick={() => ((picked = 'EMAIL'), (fieldError = ''))}>Email</button>
				</div>
			{/if}

			<form onsubmit={submit} novalidate>
				{#if method === 'EMAIL'}
				<label class="sf-field">
					<span class="sf-label">Email address</span>
					<input
						class="sf-input"
						type="email"
						inputmode="email"
						bind:value={email}
						autocomplete="email"
						enterkeyhint="go"
						aria-invalid={Boolean(fieldError)}
						placeholder="you@example.com"
					/>
					{#if fieldError}
						<span class="sf-field-error">{fieldError}</span>
					{/if}
				</label>
				{:else}
				<label class="sf-field">
					<span class="sf-label">Phone number</span>
					<input
						class="sf-input"
						type="tel"
						inputmode="tel"
						bind:value={phone}
						autocomplete="tel"
						enterkeyhint="go"
						aria-invalid={Boolean(fieldError)}
						placeholder="98765 43210"
					/>
					{#if fieldError}
						<span class="sf-field-error">{fieldError}</span>
					{/if}
				</label>
				{/if}
				<button
					class="sf-btn sf-btn-primary sf-btn-lg sf-btn-block"
					type="submit"
					disabled={sending}
				>
					{sending ? 'Sending…' : 'Send code'}
				</button>
			</form>

			<div class="sf-panel" style="margin-top:18px;background:var(--sf-surface-2);">
				<p style="margin:0 0 4px;font-size:var(--fs-body);font-weight:650;">No account needed</p>
				<p style="margin:0;font-size:var(--fs-body);color:var(--sf-text-2);line-height:1.45;">
					You can order without signing in. Signing in just saves your details and keeps your
					order history in one place.
				</p>
				<a
					class="sf-btn sf-btn-secondary sf-btn-block"
					style="margin-top:12px;"
					href={safeNext === '/profile' ? '/menu' : safeNext}
				>
					Continue as guest
				</a>
			</div>

			<p
				style="display:flex;align-items:center;justify-content:center;gap:5px;margin:16px 0 0;font-size:var(--fs-code);color:var(--sf-text-3);"
			>
				<Lock size={13} stroke={1.6} aria-hidden="true" />
				We only use your {method === 'EMAIL' ? 'email' : 'number'} for sign-in and order updates.
			</p>
		{/if}
	</div>
</div>

<style>
	.sf-signin-tabs {
		display: flex;
		padding: 3px;
		margin-bottom: 16px;
		border-radius: var(--sf-radius-sm);
		background: var(--sf-surface-2);
	}
	.sf-signin-tabs button {
		flex: 1;
		height: 38px;
		border: 0;
		border-radius: calc(var(--sf-radius-sm) - 2px);
		background: transparent;
		color: var(--sf-text-2);
		font: inherit;
		font-weight: 600;
		cursor: pointer;
	}
	.sf-signin-tabs button[aria-selected='true'] {
		background: var(--sf-surface);
		color: var(--sf-text);
		box-shadow: var(--sf-shadow-xs);
	}
	.sf-signin-tabs button:focus-visible {
		outline: 2px solid var(--sf-primary);
		outline-offset: 2px;
	}
</style>
