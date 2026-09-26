<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import ChevronLeft from '@lucide/svelte/icons/chevron-left';
	import Lock from '@lucide/svelte/icons/lock';
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
	const enabled = $derived(config?.ordering?.customer_login ?? true);

	let phone = $state('');
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
	});

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		error = '';
		fieldError = '';
		const digits = phone.replace(/[^\d]/g, '');
		if (digits.length < 8) {
			fieldError = 'Enter a valid phone number';
			return;
		}
		sending = true;
		try {
			const result = await storefrontApi.sendOtp(phone.trim());
			// The countdown comes from the server so a reload cannot skip the wait,
			// and the masked number means this screen never has to hold the raw one.
			const query = new URLSearchParams({
				phone: phone.trim(),
				next: safeNext,
				resend_in: String(result.otp.resend_in)
			});
			if (result.phone) query.set('masked', result.phone);
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
		style="display:inline-flex;align-items:center;gap:4px;padding:8px 0;font-size:0.8125rem;font-weight:600;color:var(--sf-text-2);text-decoration:none;"
	>
		<ChevronLeft size={16} strokeWidth={2.2} aria-hidden="true" />
		Back
	</a>

	<div style="max-width:420px;margin:8px auto 0;">
		<h1 style="margin:0 0 6px;font-size:1.375rem;font-weight:800;letter-spacing:-0.02em;">
			Sign in
		</h1>
		<p style="margin:0 0 20px;font-size:0.9375rem;color:var(--sf-text-2);line-height:1.5;">
			We'll text you a code. No password, no email.
		</p>

		{#if !enabled}
			<div class="sf-alert" data-tone="warn" role="status">
				<span>Phone sign-in is switched off at this store. You can still order as a guest.</span>
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

			<form onsubmit={submit} novalidate>
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
				<button
					class="sf-btn sf-btn-primary sf-btn-lg sf-btn-block"
					type="submit"
					disabled={sending}
				>
					{sending ? 'Sending…' : 'Send code'}
				</button>
			</form>

			<div class="sf-panel" style="margin-top:18px;background:var(--sf-surface-2);">
				<p style="margin:0 0 4px;font-size:0.875rem;font-weight:650;">No account needed</p>
				<p style="margin:0;font-size:0.8125rem;color:var(--sf-text-2);line-height:1.45;">
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
				style="display:flex;align-items:center;justify-content:center;gap:5px;margin:16px 0 0;font-size:0.75rem;color:var(--sf-text-3);"
			>
				<Lock size={13} strokeWidth={1.9} aria-hidden="true" />
				We only use your number for sign-in and order updates.
			</p>
		{/if}
	</div>
</div>
