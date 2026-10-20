<script lang="ts">
	/**
	 * The second step of signing in, shared by the shop and platform consoles:
	 * entering a code (`challenge`) or turning two-step verification on for the
	 * first time (`enroll`).
	 *
	 * When more than one method is available (what the person has set up and
	 * their business allows), they choose first; `method` is empty until then.
	 *
	 * It renders inside the page's own form and brings its own submit button,
	 * so each console keeps its submit handler and only the screen is shared.
	 * One clear action per screen; the alternatives (a recovery code, going
	 * back) are quiet links, not buttons of equal weight.
	 */
	import ArrowLeft from '@tabler/icons-svelte/icons/arrow-left';
	import ArrowRight from '@tabler/icons-svelte/icons/arrow-right';
	import ChevronRight from '@tabler/icons-svelte/icons/chevron-right';
	import Check from '@tabler/icons-svelte/icons/check';
	import Copy from '@tabler/icons-svelte/icons/copy';
	import DeviceMobile from '@tabler/icons-svelte/icons/device-mobile';
	import Key from '@tabler/icons-svelte/icons/key';
	import Loader from '@tabler/icons-svelte/icons/loader-2';
	import MailOpened from '@tabler/icons-svelte/icons/mail-opened';
	import ShieldLock from '@tabler/icons-svelte/icons/shield-lock';
	import TriangleAlert from '@tabler/icons-svelte/icons/alert-triangle';
	import type { MfaSetup } from '$lib/mfaApi';
	import OtpInput from './OtpInput.svelte';

	let {
		kind,
		method,
		methods = [],
		email = '',
		setup = null,
		code = $bindable(''),
		useRecovery = $bindable(false),
		cooldown = 0,
		sending = false,
		loading = false,
		error = '',
		requiredBy = 'Your account',
		onresend,
		onback,
		onedit,
		onchoose
	}: {
		kind: 'challenge' | 'enroll';
		/** The method in use; empty while the person is still choosing. */
		method: 'TOTP' | 'EMAIL_OTP' | '';
		/** Every method on offer. More than one shows the choice first. */
		methods?: string[];
		/** The address being signed in, shown masked so the person knows where to look. */
		email?: string;
		setup?: MfaSetup | null;
		code?: string;
		useRecovery?: boolean;
		cooldown?: number;
		sending?: boolean;
		loading?: boolean;
		error?: string;
		/** Who requires setup, for the enroll explanation ("This business"). */
		requiredBy?: string;
		onresend?: () => void;
		onback: () => void;
		/** Called when the code changes, so the page can clear a stale error. */
		onedit?: () => void;
		/** A method was picked ('' goes back to the choice). */
		onchoose?: (method: 'TOTP' | 'EMAIL_OTP' | '') => void;
	} = $props();

	const choosing = $derived(method === '');
	const canSwitch = $derived(methods.length > 1);

	function choose(m: 'TOTP' | 'EMAIL_OTP' | '') {
		code = '';
		useRecovery = false;
		onedit?.();
		onchoose?.(m);
	}

	let wrap = $state<HTMLDivElement | null>(null);
	let copied = $state(false);

	const recovery = $derived(kind === 'challenge' && useRecovery);
	const isEmail = $derived(method === 'EMAIL_OTP');

	// v•••••@gmail.com: enough to recognise, not enough to read off a screen.
	const masked = $derived.by(() => {
		const [user, domain] = email.trim().split('@');
		if (!user || !domain) return 'your email';
		return `${user[0]}${'•'.repeat(Math.max(2, Math.min(user.length - 1, 6)))}@${domain}`;
	});

	// The setup key in groups of four, the way authenticator apps show it.
	const key = $derived((setup?.secret ?? '').replace(/(.{4})/g, '$1 ').trim());

	const title = $derived(
		choosing
			? kind === 'enroll'
				? 'Set up two-step verification'
				: 'Choose how to verify'
			: kind === 'enroll'
			? 'Set up two-step verification'
			: recovery
				? 'Use a recovery code'
				: isEmail
					? 'Check your email'
					: 'Open your authenticator app'
	);

	// Six digits in: submit without making anyone reach for the button.
	function complete() {
		if (!loading) wrap?.closest('form')?.requestSubmit();
	}

	async function copyKey() {
		try {
			await navigator.clipboard.writeText(setup?.secret ?? '');
			copied = true;
			setTimeout(() => (copied = false), 1800);
		} catch {
			/* clipboard blocked: the key is still on screen */
		}
	}

	function toggleRecovery() {
		useRecovery = !useRecovery;
		code = '';
		onedit?.();
	}
</script>

<div class="mfa" bind:this={wrap}>
	<span class="mfa-icon" aria-hidden="true">
		{#if kind === 'enroll' || choosing}
			<ShieldLock size={20} stroke={1.6} />
		{:else if recovery}
			<Key size={20} stroke={1.6} />
		{:else if isEmail}
			<MailOpened size={20} stroke={1.6} />
		{:else}
			<DeviceMobile size={20} stroke={1.6} />
		{/if}
	</span>

	<h2 class="mfa-title">{title}</h2>

	{#if choosing}
		<p class="mfa-copy">
			{kind === 'enroll'
				? `${requiredBy} requires a second step when you sign in. Pick the one that suits you.`
				: 'Your account has more than one way to confirm it is you. Pick one.'}
		</p>
		<div class="mfa-options">
			{#if methods.includes('TOTP')}
				<button type="button" class="mfa-option" onclick={() => choose('TOTP')}>
					<span class="mfa-option-icon"><DeviceMobile size={18} stroke={1.6} /></span>
					<span class="mfa-option-text">
						<span class="mfa-option-label">Authenticator app</span>
						<span class="mfa-option-note">
							{kind === 'enroll'
								? 'Codes from an app like Google Authenticator or 1Password. Works offline.'
								: 'Enter the 6-digit code from your app.'}
						</span>
					</span>
					<ChevronRight size={16} stroke={1.6} />
				</button>
			{/if}
			{#if methods.includes('EMAIL_OTP')}
				<button type="button" class="mfa-option" onclick={() => choose('EMAIL_OTP')}>
					<span class="mfa-option-icon"><MailOpened size={18} stroke={1.6} /></span>
					<span class="mfa-option-text">
						<span class="mfa-option-label">Email code</span>
						<span class="mfa-option-note">
							{kind === 'enroll'
								? `A code is emailed to ${masked} each time you sign in.`
								: `We'll send a code to ${masked}.`}
						</span>
					</span>
					<ChevronRight size={16} stroke={1.6} />
				</button>
			{/if}
		</div>
		<div class="mfa-links">
			<button type="button" class="mfa-link" onclick={onback}>
				<ArrowLeft size={14} stroke={1.6} /> Back to sign in
			</button>
		</div>
	{:else}
	{#if kind === 'enroll'}
		<p class="mfa-copy">{requiredBy} requires it before you can continue. It takes a minute.</p>

		{#if method === 'TOTP' && setup}
			<ol class="mfa-steps">
				<li>
					<span class="mfa-step-n">1</span>
					<span>Open an authenticator app, such as Google Authenticator, Microsoft Authenticator or 1Password.</span>
				</li>
				<li>
					<span class="mfa-step-n">2</span>
					<div class="mfa-step-body">
						<span>Scan this QR code with it.</span>
						<div class="mfa-qr">
							<img src={setup.qr_code_data_uri} alt="QR code for your authenticator app" width="168" height="168" />
						</div>
						<details class="mfa-key">
							<summary>Can't scan it? Enter a setup key instead</summary>
							<div class="mfa-key-row">
								<code>{key}</code>
								<button type="button" class="mfa-link" onclick={copyKey}>
									{#if copied}<Check size={14} stroke={1.8} /> Copied{:else}<Copy size={14} stroke={1.6} /> Copy{/if}
								</button>
							</div>
						</details>
					</div>
				</li>
				<li>
					<span class="mfa-step-n">3</span>
					<span>Enter the 6-digit code the app shows.</span>
				</li>
			</ol>
		{:else if method === 'TOTP'}
			<p class="mfa-copy">Preparing your QR code...</p>
		{:else}
			<p class="mfa-copy">We sent a 6-digit code to <strong>{masked}</strong>. Enter it below to turn it on.</p>
		{/if}
	{:else if recovery}
		<p class="mfa-copy">Enter one of the recovery codes you saved when you turned on two-step verification. Each code works once.</p>
	{:else if isEmail}
		<p class="mfa-copy">We sent a 6-digit code to <strong>{masked}</strong>. It expires in 10 minutes.</p>
	{:else}
		<p class="mfa-copy">Enter the 6-digit code your authenticator app shows for Orderly.</p>
	{/if}

	<div class="mfa-field">
		{#if recovery}
			<label class="mfa-label" for="mfa-recovery">Recovery code</label>
			<input
				id="mfa-recovery"
				class="input mfa-recovery"
				bind:value={code}
				oninput={() => onedit?.()}
				placeholder="xxxx-xxxx"
				autocomplete="off"
				autocapitalize="none"
				spellcheck="false"
				aria-invalid={error ? 'true' : undefined}
				aria-describedby={error ? 'mfa-error' : undefined}
			/>
		{:else}
			<label class="mfa-label" for="mfa-code">Verification code</label>
			<OtpInput
				id="mfa-code"
				bind:value={code}
				autofocus
				invalid={!!error}
				disabled={loading}
				describedby={error ? 'mfa-error' : undefined}
				oninput={onedit}
				oncomplete={complete}
			/>
		{/if}

		{#if isEmail && !recovery}
			<p class="mfa-resend">
				{#if cooldown > 0}
					You can ask for a new code in {cooldown}s.
				{:else}
					Didn't get it?
					<button type="button" class="mfa-link" disabled={sending} onclick={() => onresend?.()}>
						{sending ? 'Sending...' : 'Send a new code'}
					</button>
				{/if}
			</p>
		{/if}
	</div>

	{#if error}
		<p class="mfa-alert" id="mfa-error" role="alert">
			<TriangleAlert size={16} stroke={1.6} />
			<span>{error}</span>
		</p>
	{/if}

	<button class="btn btn-primary mfa-submit" type="submit" disabled={loading || !code.trim()}>
		{#if loading}
			<Loader class="mfa-spin" size={16} stroke={1.6} /> Verifying...
		{:else}
			{kind === 'enroll' ? 'Turn on and sign in' : 'Verify'}
			<ArrowRight size={16} stroke={1.6} />
		{/if}
	</button>

	<div class="mfa-links">
		{#if canSwitch && !recovery}
			<button type="button" class="mfa-link" onclick={() => choose('')}>Try another way</button>
			<span class="mfa-sep" aria-hidden="true"></span>
		{/if}
		{#if kind === 'challenge'}
			<button type="button" class="mfa-link" onclick={toggleRecovery}>
				{recovery ? (isEmail ? 'Use an email code instead' : 'Use my authenticator app instead') : 'Use a recovery code'}
			</button>
			<span class="mfa-sep" aria-hidden="true"></span>
		{/if}
		<button type="button" class="mfa-link" onclick={onback}>
			<ArrowLeft size={14} stroke={1.6} /> Back to sign in
		</button>
	</div>
	{/if}
</div>

<style>
	.mfa {
		display: flex;
		flex-direction: column;
		gap: var(--sp-8);
	}

	.mfa-icon {
		display: grid;
		place-items: center;
		width: 44px;
		height: 44px;
		border-radius: var(--radius-lg, 10px);
		background: var(--icon-bg, var(--surface-2));
		color: var(--icon-fg, var(--text-2));
	}

	.mfa-title {
		margin: calc(-1 * var(--sp-3)) 0 0;
		font-family: var(--font-display);
		font-size: var(--fs-h1, 20px);
		font-weight: 650;
		letter-spacing: -0.01em;
		color: var(--text);
	}

	.mfa-copy {
		margin: calc(-1 * var(--sp-5)) 0 0;
		font-size: var(--fs-body, 13px);
		line-height: 1.6;
		color: var(--text-2);
	}

	.mfa-copy strong {
		color: var(--text);
		font-weight: 600;
	}

	.mfa-field {
		display: flex;
		flex-direction: column;
		gap: var(--sp-4);
	}

	.mfa-label {
		font-size: var(--fs-label, 11px);
		font-weight: 600;
		letter-spacing: 0.02em;
		color: var(--text-2);
	}

	.mfa-recovery {
		max-width: 22rem;
		font-family: var(--font-mono);
		font-size: 16px;
		letter-spacing: 0.08em;
	}

	.mfa-resend {
		margin: 0;
		font-size: var(--fs-tab, 12.5px);
		color: var(--text-3);
	}

	.mfa-alert {
		display: flex;
		align-items: flex-start;
		gap: var(--sp-4);
		margin: 0;
		padding: var(--sp-5) var(--sp-6);
		border-radius: var(--radius-md, 8px);
		background: var(--danger-bg, rgba(220, 38, 38, 0.1));
		color: var(--danger);
		font-size: var(--fs-tab, 12.5px);
		line-height: 1.5;
	}

	.mfa-submit {
		width: 100%;
		justify-content: center;
		gap: var(--sp-3);
		min-height: 42px;
	}

	.mfa-links {
		display: flex;
		align-items: center;
		justify-content: center;
		flex-wrap: wrap;
		gap: var(--sp-6);
	}

	.mfa-sep {
		width: 3px;
		height: 3px;
		border-radius: 50%;
		background: var(--text-3);
	}

	.mfa-link {
		display: inline-flex;
		align-items: center;
		gap: var(--sp-2);
		padding: 0;
		border: 0;
		background: none;
		color: var(--accent);
		font: inherit;
		font-size: var(--fs-tab, 12.5px);
		font-weight: 600;
		cursor: pointer;
	}

	.mfa-links .mfa-link {
		color: var(--text-2);
		font-weight: 500;
	}

	.mfa-link:hover:not(:disabled) {
		text-decoration: underline;
		text-underline-offset: 3px;
	}

	.mfa-link:disabled {
		opacity: 0.6;
		cursor: default;
	}

	/* choosing a method */
	.mfa-options {
		display: flex;
		flex-direction: column;
		gap: var(--sp-5);
	}

	.mfa-option {
		display: flex;
		align-items: center;
		gap: var(--sp-6);
		width: 100%;
		padding: var(--sp-6) var(--sp-7);
		border: 1px solid var(--border);
		border-radius: var(--radius-lg, 10px);
		background: transparent;
		color: var(--text-3);
		font: inherit;
		text-align: left;
		cursor: pointer;
		transition:
			border-color var(--tr, 0.15s),
			background var(--tr, 0.15s);
	}

	.mfa-option:hover,
	.mfa-option:focus-visible {
		border-color: var(--accent);
		background: var(--accent-soft);
	}

	.mfa-option-icon {
		display: grid;
		place-items: center;
		flex: none;
		width: 36px;
		height: 36px;
		border-radius: var(--radius-md, 8px);
		background: var(--icon-bg, var(--surface-2));
		color: var(--icon-fg, var(--text-2));
	}

	.mfa-option-text {
		display: flex;
		flex-direction: column;
		gap: 2px;
		flex: 1;
		min-width: 0;
	}

	.mfa-option-label {
		font-size: var(--fs-body, 13px);
		font-weight: 600;
		color: var(--text);
	}

	.mfa-option-note {
		font-size: var(--fs-tab, 12.5px);
		line-height: 1.45;
		color: var(--text-3);
	}

	/* enrollment */
	.mfa-steps {
		display: flex;
		flex-direction: column;
		gap: var(--sp-7);
		margin: 0;
		padding: 0;
		list-style: none;
		font-size: var(--fs-body, 13px);
		line-height: 1.55;
		color: var(--text-2);
	}

	.mfa-steps li {
		display: flex;
		gap: var(--sp-5);
	}

	.mfa-step-n {
		display: grid;
		place-items: center;
		flex: none;
		width: 22px;
		height: 22px;
		border-radius: 50%;
		background: var(--surface-2);
		color: var(--text);
		font-size: var(--fs-label, 11px);
		font-weight: 650;
	}

	.mfa-step-body {
		display: flex;
		flex-direction: column;
		gap: var(--sp-5);
		min-width: 0;
	}

	/* Always on white: a QR code on a dark background does not scan everywhere. */
	.mfa-qr {
		align-self: flex-start;
		padding: var(--sp-5);
		border-radius: var(--radius-lg, 10px);
		background: #ffffff;
		box-shadow: 0 0 0 1px var(--border);
	}

	.mfa-qr img {
		display: block;
	}

	.mfa-key summary {
		color: var(--accent);
		font-size: var(--fs-tab, 12.5px);
		font-weight: 600;
		cursor: pointer;
	}

	.mfa-key-row {
		display: flex;
		align-items: center;
		gap: var(--sp-6);
		flex-wrap: wrap;
		margin-top: var(--sp-4);
		padding: var(--sp-5) var(--sp-6);
		border: 1px dashed var(--border);
		border-radius: var(--radius-md, 8px);
	}

	.mfa-key-row code {
		font-family: var(--font-mono);
		font-size: var(--fs-code, 12px);
		letter-spacing: 0.06em;
		color: var(--text);
		word-break: break-all;
	}

	:global(.mfa-spin) {
		animation: mfa-spin 0.8s linear infinite;
	}

	@keyframes mfa-spin {
		to {
			transform: rotate(360deg);
		}
	}
</style>
