<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import { friendlyError, storefrontApi } from '$lib/storefront/api';
	import { customerSession } from '$lib/storefront/session.svelte';
	import { formatPhone } from '$lib/storefront/format';

	/**
	 * Phone sign-in, step two.
	 *
	 * Six separate boxes rather than one field, because a customer reading a code
	 * off another screen types it digit by digit anyway.
	 *
	 * The code is sent by the previous screen, and the resend timer starts from the
	 * seconds the *server* reported rather than a local guess, so reloading cannot
	 * be used to skip the wait. Arriving here directly is handled too: the screen
	 * offers to send a code instead of showing six boxes that will never fill.
	 */
	let { data } = $props();

	const phone = $derived($page.url.searchParams.get('phone') ?? '');
	const masked = $derived($page.url.searchParams.get('masked') ?? '');
	/** The countdown the previous screen was told about, if any. */
	const initialResend = $derived(Number($page.url.searchParams.get('resend_in') ?? 0));

	const next = $derived.by(() => {
		const raw = $page.url.searchParams.get('next') ?? '/profile';
		// Only a same-origin path is honoured, so `next` cannot be used to bounce
		// a customer to another site after signing in.
		return raw.startsWith('/') && !raw.startsWith('//') ? raw : '/profile';
	});

	const length = 6;
	let digits = $state<string[]>(Array(length).fill(''));
	let verifying = $state(false);
	let sending = $state(false);
	let error = $state('');
	let resendIn = $state(0);
	let devCode = $state('');
	let sent = $state(false);

	onMount(() => {
		if (!phone) {
			void goto('/login', { replaceState: true });
			return;
		}
		// A normal arrival means /login already sent the code; the timer carries
		// over. A direct arrival does not, so offer to send one.
		sent = initialResend > 0;
		resendIn = initialResend;
		const timer = setInterval(() => {
			if (resendIn > 0) resendIn -= 1;
		}, 1000);
		return () => clearInterval(timer);
	});

	async function send() {
		if (sending) return;
		sending = true;
		error = '';
		try {
			const result = await storefrontApi.sendOtp(phone);
			sent = true;
			resendIn = result.otp.resend_in;
			// Outside production no SMS provider is wired, so the code comes back
			// with the response. Autofilling it keeps the flow testable end to end.
			devCode = result.otp.dev_code ?? '';
			if (devCode) {
				digits = devCode.split('').slice(0, length);
				queueMicrotask(() => void verify());
			}
		} catch (err) {
			error = friendlyError(err, 'We could not send a code. Try again shortly.');
			if (resendIn <= 0) resendIn = 30;
		} finally {
			sending = false;
		}
	}

	async function verify() {
		const code = digits.join('');
		if (code.length !== length) {
			error = 'Enter the 6-digit code';
			return;
		}
		verifying = true;
		error = '';
		try {
			await customerSession.signIn(data.tenantSlug ?? '', phone, code);
			await goto(next, { replaceState: true });
		} catch (err) {
			error = friendlyError(err, 'That code did not work.');
			// Clear the boxes so the next attempt starts fresh; a wrong code should
			// not leave the customer editing digits in place.
			digits = Array(length).fill('');
			verifying = false;
		}
	}

	function onInput(index: number, event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		const value = input.value.replace(/\D/g, '');
		if (!value) {
			digits = digits.map((d, i) => (i === index ? '' : d));
			return;
		}
		const nextDigits = digits.slice();
		// Pasting the whole code into one box fills the rest of them.
		for (let i = 0; i < value.length && index + i < length; i++) {
			nextDigits[index + i] = value[i];
		}
		digits = nextDigits;
		const boxes = document.querySelectorAll<HTMLInputElement>('.sf-otp input');
		boxes[Math.min(index + value.length, length - 1)]?.focus();
		if (digits.join('').length === length) void verify();
	}

	function onKeydown(index: number, event: KeyboardEvent) {
		if (event.key === 'Backspace' && !digits[index] && index > 0) {
			document.querySelectorAll<HTMLInputElement>('.sf-otp input')[index - 1]?.focus();
		}
	}
</script>

<div class="sf-wrap" style="padding-top:16px;">
	<div style="max-width:420px;margin:8px auto 0;text-align:center;">
		<h1 style="margin:0 0 6px;font-size:var(--fs-stat);font-weight:800;letter-spacing:-0.02em;">
			{sent ? 'Enter the code' : 'Confirm your number'}
		</h1>
		<p class="sf-otp-note" style="margin-bottom:20px;">
			{#if sent}
				Sent to {masked || formatPhone(phone)}
			{:else}
				We will text a code to {formatPhone(phone)}
			{/if}
		</p>

		{#if error}
			<div class="sf-alert" data-tone="error" role="alert" style="margin-bottom:18px;text-align:left;">
				<span>{error}</span>
			</div>
		{/if}

		{#if !sent}
			<button
				class="sf-btn sf-btn-primary sf-btn-lg sf-btn-block"
				type="button"
				disabled={sending}
				onclick={send}
			>
				{sending ? 'Sending…' : 'Send code'}
			</button>
		{:else}
			<form onsubmit={(e) => { e.preventDefault(); void verify(); }}>
				<div class="sf-otp">
					{#each digits as digit, index (index)}
						<input
							type="tel"
							inputmode="numeric"
							autocomplete={index === 0 ? 'one-time-code' : 'off'}
							maxlength="6"
							aria-label={'Digit ' + (index + 1)}
							value={digit}
							disabled={verifying}
							oninput={(e) => onInput(index, e)}
							onkeydown={(e) => onKeydown(index, e)}
						/>
					{/each}
				</div>

				<button
					class="sf-btn sf-btn-primary sf-btn-lg sf-btn-block"
					type="submit"
					style="margin-top:22px;"
					disabled={verifying}
				>
					{verifying ? 'Checking…' : 'Continue'}
				</button>
			</form>

			<p class="sf-otp-note">
				{#if resendIn > 0}
					Resend available in {resendIn}s
				{:else}
					<button type="button" onclick={send} disabled={sending}>
						{sending ? 'Sending…' : 'Resend code'}
					</button>
				{/if}
			</p>

			{#if devCode}
				<div class="sf-alert" data-tone="info" style="margin-top:14px;text-align:left;">
					<span>Development mode: the code is {devCode} — no SMS provider is configured.</span>
				</div>
			{/if}
		{/if}

		<p style="margin:20px 0 0;">
			<a
				href={'/login?phone=' + encodeURIComponent(phone)}
				style="font-size:0.8125rem;color:var(--sf-text-2);text-decoration:underline;text-underline-offset:2px;"
			>
				Use a different number
			</a>
		</p>

		<p style="margin:16px 0 0;">
			<a
				href={next === '/profile' ? '/menu' : next}
				style="font-size:0.8125rem;color:var(--sf-primary);font-weight:600;text-decoration:none;"
			>
				Continue as guest
			</a>
		</p>
	</div>
</div>
