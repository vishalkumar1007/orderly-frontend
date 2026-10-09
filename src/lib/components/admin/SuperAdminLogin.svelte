<script lang="ts">
	import { onMount } from 'svelte';
	import { authErrorMessage, errorMessage } from '$lib/admin/errors';
	import { goto } from '$app/navigation';
	import ArrowRight from '@lucide/svelte/icons/arrow-right';
	import Eye from '@lucide/svelte/icons/eye';
	import EyeOff from '@lucide/svelte/icons/eye-off';
	import KeyRound from '@lucide/svelte/icons/key-round';
	import LoaderCircle from '@lucide/svelte/icons/loader-circle';
	import Lock from '@lucide/svelte/icons/lock';
	import Mail from '@lucide/svelte/icons/mail';
	import ShieldCheck from '@lucide/svelte/icons/shield-check';
	import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
	import { getAccessToken } from '$lib/api/client';
	import {
		adminLogin,
		adminSetupStatus,
		enrollMfaConfirm,
		enrollMfaEmailConfirm,
		enrollMfaEmailSend,
		enrollMfaStart,
		homeForRole,
		me,
		sendChallengeEmailOtp,
		verifyMfa
	} from '$lib/auth';
	import type { MfaSetup } from '$lib/mfaApi';
	import AuthLayout from './AuthLayout.svelte';

	let email = $state('');
	let password = $state('');
	let showPassword = $state(false);
	let error = $state('');
	let loading = $state(false);
	let checking = $state(true);

	let mfaStep = $state(false);
	let challengeToken = $state('');
	let mfaCode = $state('');
	let useRecoveryCode = $state(false);
	let challengeMethod = $state<'TOTP' | 'EMAIL_OTP'>('TOTP');
	let emailSending = $state(false);
	let resendCooldown = $state(0);

	let enrollStep = $state(false);
	let enrollmentToken = $state('');
	let enrollMethod = $state<'TOTP' | 'EMAIL_OTP'>('TOTP');
	let enrollSetup = $state<MfaSetup | null>(null);
	let enrollCode = $state('');
	let enrollEmailSending = $state(false);
	let enrollResendCooldown = $state(0);

	let cooldownHandle: ReturnType<typeof setInterval> | undefined;
	function startCooldown(assign: (n: number) => void) {
		let left = 30;
		assign(left);
		clearInterval(cooldownHandle);
		cooldownHandle = setInterval(() => {
			left -= 1;
			assign(left);
			if (left <= 0) clearInterval(cooldownHandle);
		}, 1000);
	}

	function pickMethod(methods: string[]): 'TOTP' | 'EMAIL_OTP' {
		return methods.includes('TOTP') ? 'TOTP' : 'EMAIL_OTP';
	}

	async function sendChallengeEmail() {
		emailSending = true;
		try {
			await sendChallengeEmailOtp(challengeToken);
			startCooldown((n) => (resendCooldown = n));
		} catch (err) {
			error = errorMessage(err, 'send the code');
		} finally {
			emailSending = false;
		}
	}

	async function startEnrollEmail() {
		enrollEmailSending = true;
		try {
			await enrollMfaEmailSend(enrollmentToken);
			startCooldown((n) => (enrollResendCooldown = n));
		} catch (err) {
			error = errorMessage(err, 'send the code');
		} finally {
			enrollEmailSending = false;
		}
	}

	onMount(async () => {
		try {
			const s = await adminSetupStatus();
			if (s.needs_setup) {
				goto('/superadmin/setup', { replaceState: true });
				return;
			}
		} catch {
			/* show login; setup check failed */
		}
		if (!getAccessToken()) {
			checking = false;
			return;
		}
		try {
			const user = await me();
			if (user.role === 'SUPER_ADMIN') {
				goto('/superadmin');
				return;
			}
		} catch {
			/* stay on login */
		}
		checking = false;
	});

	function clearError() {
		if (error) error = '';
	}

	async function submit(e: Event) {
		e.preventDefault();
		error = '';
		loading = true;
		try {
			const result = await adminLogin(email.trim(), password);
			// The role check already happened server-side before either MFA
			// response was returned, so a SUPER_ADMIN is the only account that
			// can ever reach either step on this portal.
			if ('mfaRequired' in result) {
				challengeToken = result.challengeToken;
				challengeMethod = pickMethod(result.methods.length ? result.methods : ['TOTP']);
				mfaCode = '';
				useRecoveryCode = false;
				mfaStep = true;
				if (challengeMethod === 'EMAIL_OTP') await sendChallengeEmail();
				return;
			}
			if ('mfaEnrollRequired' in result) {
				enrollmentToken = result.enrollmentToken;
				enrollMethod = pickMethod(result.methods.length ? result.methods : ['TOTP']);
				enrollStep = true;
				if (enrollMethod === 'TOTP') {
					enrollSetup = await enrollMfaStart(enrollmentToken);
				} else {
					await startEnrollEmail();
				}
				return;
			}
			if (result.role !== 'SUPER_ADMIN') {
				error = 'This portal is for Super Admin only';
				return;
			}
			goto(homeForRole(result.role, 'admin'));
		} catch (err) {
			error = authErrorMessage(err, 'sign in');
		} finally {
			loading = false;
		}
	}

	async function submitMfaCode(e: Event) {
		e.preventDefault();
		error = '';
		loading = true;
		try {
			const user = await verifyMfa(
				challengeToken,
				mfaCode.trim(),
				useRecoveryCode,
				useRecoveryCode ? undefined : challengeMethod
			);
			goto(homeForRole(user.role, 'admin'));
		} catch (err) {
			error = authErrorMessage(err, 'sign in');
		} finally {
			loading = false;
		}
	}

	async function submitEnroll(e: Event) {
		e.preventDefault();
		error = '';
		loading = true;
		try {
			const user =
				enrollMethod === 'TOTP'
					? await enrollMfaConfirm(enrollmentToken, enrollSetup!.setup_token, enrollCode.trim())
					: await enrollMfaEmailConfirm(enrollmentToken, enrollCode.trim());
			goto(homeForRole(user.role, 'admin'));
		} catch (err) {
			error = authErrorMessage(err, 'sign in');
		} finally {
			loading = false;
		}
	}

	function backToPassword() {
		mfaStep = false;
		enrollStep = false;
		challengeToken = '';
		mfaCode = '';
		enrollmentToken = '';
		enrollSetup = null;
		enrollCode = '';
		clearInterval(cooldownHandle);
		resendCooldown = 0;
		enrollResendCooldown = 0;
		error = '';
	}
</script>

{#if checking}
	<AuthLayout title="Signing you in" subtitle="Checking your session and platform status…">
		<div class="auth-loading">
			<LoaderCircle class="auth-spinner" size={22} strokeWidth={2} />
			<p class="muted text-sm">Loading…</p>
		</div>
	</AuthLayout>
{:else}
	<AuthLayout
		title="Run every shop from one console"
		subtitle="Onboard tenants, assign plans, and watch platform-wide orders and revenue — with every shop's data strictly separated."
	>
		<span class="auth-eyebrow"><ShieldCheck size={13} strokeWidth={2.2} /> Super Admin access</span>

		{#if enrollStep}
			<h2 class="auth-title">Set up two-factor authentication</h2>
			<p class="auth-sub">The platform requires it before you can continue.</p>

			<form onsubmit={submitEnroll} novalidate>
				{#if enrollMethod === 'TOTP' && enrollSetup}
					<p class="auth-sub">
						Scan this with an authenticator app, or enter the code manually:
						<code>{enrollSetup.secret}</code>
					</p>
					<img
						src={enrollSetup.qr_code_data_uri}
						alt="QR code for authenticator app setup"
						width="160"
						height="160"
						style="display:block;margin:0 auto 1.25rem;border-radius:var(--radius-md);"
					/>
				{:else if enrollMethod === 'EMAIL_OTP'}
					<p class="auth-sub">
						We sent a code to your email.
						<button
							type="button"
							class="btn btn-ghost"
							disabled={enrollEmailSending || enrollResendCooldown > 0}
							onclick={startEnrollEmail}
						>
							{enrollResendCooldown > 0 ? `Resend in ${enrollResendCooldown}s` : 'Resend code'}
						</button>
					</p>
				{/if}

				<div class="auth-field">
					<label class="auth-label" for="sa-enroll-code">6-digit code</label>
					<div class="auth-input-wrap">
						<span class="auth-input-icon"><ShieldCheck size={16} strokeWidth={1.9} /></span>
						<input
							id="sa-enroll-code"
							class="input auth-input"
							type="text"
							bind:value={enrollCode}
							oninput={clearError}
							placeholder="123456"
							inputmode="numeric"
							autocomplete="one-time-code"
							required
						/>
					</div>
				</div>

				{#if error}
					<p class="auth-alert" id="sa-error" role="alert">
						<TriangleAlert size={16} strokeWidth={2} />
						<span>{error}</span>
					</p>
				{/if}

				<button class="btn btn-primary auth-submit" type="submit" disabled={loading}>
					{#if loading}
						<LoaderCircle class="auth-spinner" size={17} strokeWidth={2.2} />
						Confirming…
					{:else}
						Confirm and sign in
						<ArrowRight size={16} strokeWidth={2.2} />
					{/if}
				</button>
				<button type="button" class="btn btn-ghost auth-submit" onclick={backToPassword}>
					Back
				</button>
			</form>
		{:else if mfaStep}
			<h2 class="auth-title">Enter your code</h2>
			<p class="auth-sub">
				{#if useRecoveryCode}
					Enter one of your recovery codes.
				{:else if challengeMethod === 'EMAIL_OTP'}
					Enter the code we emailed you.
				{:else}
					Enter the 6-digit code from your authenticator app.
				{/if}
			</p>

			<form onsubmit={submitMfaCode} novalidate>
				{#if !useRecoveryCode && challengeMethod === 'EMAIL_OTP'}
					<p class="auth-sub">
						<button
							type="button"
							class="btn btn-ghost"
							disabled={emailSending || resendCooldown > 0}
							onclick={sendChallengeEmail}
						>
							{resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend code'}
						</button>
					</p>
				{/if}

				<div class="auth-field">
					<label class="auth-label" for="sa-mfa-code">
						{useRecoveryCode ? 'Recovery code' : 'Authentication code'}
					</label>
					<div class="auth-input-wrap">
						<span class="auth-input-icon"><ShieldCheck size={16} strokeWidth={1.9} /></span>
						<input
							id="sa-mfa-code"
							class="input auth-input"
							type="text"
							bind:value={mfaCode}
							oninput={clearError}
							placeholder={useRecoveryCode ? 'xxxx-xxxx' : '123456'}
							inputmode={useRecoveryCode ? 'text' : 'numeric'}
							autocomplete="one-time-code"
							aria-invalid={error ? 'true' : undefined}
							aria-describedby={error ? 'sa-error' : undefined}
							required
						/>
					</div>
				</div>

				{#if error}
					<p class="auth-alert" id="sa-error" role="alert">
						<TriangleAlert size={16} strokeWidth={2} />
						<span>{error}</span>
					</p>
				{/if}

				<button class="btn btn-primary auth-submit" type="submit" disabled={loading}>
					{#if loading}
						<LoaderCircle class="auth-spinner" size={17} strokeWidth={2.2} />
						Verifying…
					{:else}
						Verify and sign in
						<ArrowRight size={16} strokeWidth={2.2} />
					{/if}
				</button>

				<button
					type="button"
					class="btn btn-ghost auth-submit"
					onclick={() => (useRecoveryCode = !useRecoveryCode)}
				>
					{useRecoveryCode
						? challengeMethod === 'EMAIL_OTP'
							? 'Use my email code instead'
							: 'Use my authenticator app instead'
						: 'Use a recovery code instead'}
				</button>
				<button type="button" class="btn btn-ghost auth-submit" onclick={backToPassword}>
					Back
				</button>
			</form>
		{:else}
		<h2 class="auth-title">Welcome back</h2>
		<p class="auth-sub">Sign in with your platform administrator credentials.</p>

		<form onsubmit={submit} novalidate>
			<div class="auth-field">
				<label class="auth-label" for="sa-email">Email address</label>
				<div class="auth-input-wrap">
					<span class="auth-input-icon"><Mail size={16} strokeWidth={1.9} /></span>
					<input
						id="sa-email"
						class="input auth-input"
						type="email"
						bind:value={email}
						oninput={clearError}
						placeholder="you@company.com"
						autocomplete="username"
						autocapitalize="none"
						spellcheck="false"
						aria-invalid={error ? 'true' : undefined}
						aria-describedby={error ? 'sa-error' : undefined}
						required
					/>
				</div>
			</div>

			<div class="auth-field">
				<label class="auth-label" for="sa-password">Password</label>
				<div class="auth-input-wrap">
					<span class="auth-input-icon"><Lock size={16} strokeWidth={1.9} /></span>
					<input
						id="sa-password"
						class="input auth-input"
						type={showPassword ? 'text' : 'password'}
						bind:value={password}
						oninput={clearError}
						placeholder="Enter your password"
						autocomplete="current-password"
						aria-invalid={error ? 'true' : undefined}
						aria-describedby={error ? 'sa-error' : undefined}
						required
					/>
					<button
						type="button"
						class="auth-eye"
						onclick={() => (showPassword = !showPassword)}
						aria-label={showPassword ? 'Hide password' : 'Show password'}
						title={showPassword ? 'Hide password' : 'Show password'}
						tabindex="-1"
					>
						{#if showPassword}
							<EyeOff size={16} strokeWidth={1.9} />
						{:else}
							<Eye size={16} strokeWidth={1.9} />
						{/if}
					</button>
				</div>
			</div>

			{#if error}
				<p class="auth-alert" id="sa-error" role="alert">
					<TriangleAlert size={16} strokeWidth={2} />
					<span>{error}</span>
				</p>
			{/if}

			<button class="btn btn-primary auth-submit" type="submit" disabled={loading}>
				{#if loading}
					<LoaderCircle class="auth-spinner" size={17} strokeWidth={2.2} />
					Signing in…
				{:else}
					Sign in
					<ArrowRight size={16} strokeWidth={2.2} />
				{/if}
			</button>
		</form>
		{/if}

		<p class="auth-foot">
			<KeyRound size={13} strokeWidth={2} />
			Restricted to platform administrators
		</p>
	</AuthLayout>
{/if}
