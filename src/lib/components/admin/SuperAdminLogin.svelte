<script lang="ts">
	import { onMount } from 'svelte';
	import { authErrorMessage, errorMessage } from '$lib/admin/errors';
	import { goto } from '$app/navigation';
	import ArrowRight from '@tabler/icons-svelte/icons/arrow-right';
	import Eye from '@tabler/icons-svelte/icons/eye';
	import EyeOff from '@tabler/icons-svelte/icons/eye-off';
	import KeyRound from '@tabler/icons-svelte/icons/key';
	import LoaderCircle from '@tabler/icons-svelte/icons/loader-2';
	import Lock from '@tabler/icons-svelte/icons/lock';
	import Mail from '@tabler/icons-svelte/icons/mail';
	import ShieldCheck from '@tabler/icons-svelte/icons/shield-check';
	import TriangleAlert from '@tabler/icons-svelte/icons/alert-triangle';
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
	import MfaPanel from '$lib/components/auth/MfaPanel.svelte';

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
	type Method = 'TOTP' | 'EMAIL_OTP';
	/** The methods this account has set up; several are offered as a choice. */
	let challengeMethods = $state<string[]>([]);
	let challengeMethod = $state<Method | ''>('');
	let emailSending = $state(false);
	let resendCooldown = $state(0);

	let enrollStep = $state(false);
	let enrollmentToken = $state('');
	let enrollMethods = $state<string[]>([]);
	let enrollMethod = $state<Method | ''>('');
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

	// One method goes straight to it; several are offered as a choice.
	function only(methods: string[]): Method | '' {
		return methods.length === 1 ? (methods[0] as Method) : '';
	}

	async function chooseChallenge(m: Method | '') {
		challengeMethod = m;
		if (m === 'EMAIL_OTP') await sendChallengeEmail();
	}

	async function chooseEnroll(m: Method | '') {
		enrollMethod = m;
		enrollSetup = null;
		if (m === 'TOTP') {
			try {
				enrollSetup = await enrollMfaStart(enrollmentToken);
			} catch (err) {
				error = errorMessage(err, 'start setup');
			}
		} else if (m === 'EMAIL_OTP') {
			await startEnrollEmail();
		}
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
				challengeMethods = result.methods.length ? result.methods : ['TOTP'];
				mfaCode = '';
				useRecoveryCode = false;
				mfaStep = true;
				await chooseChallenge(only(challengeMethods));
				return;
			}
			if ('mfaEnrollRequired' in result) {
				enrollmentToken = result.enrollmentToken;
				enrollMethods = result.methods.length ? result.methods : ['TOTP'];
				enrollStep = true;
				await chooseEnroll(only(enrollMethods));
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
				useRecoveryCode ? undefined : challengeMethod || undefined
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
		challengeMethods = [];
		enrollMethods = [];
		challengeMethod = '';
		enrollMethod = '';
		clearInterval(cooldownHandle);
		resendCooldown = 0;
		enrollResendCooldown = 0;
		error = '';
	}
</script>

{#if checking}
	<AuthLayout title="Signing you in" subtitle="Checking your session and platform status...">
		<div class="auth-loading">
			<LoaderCircle class="auth-spinner" size={22} stroke={1.6} />
			<p class="muted text-sm">Loading...</p>
		</div>
	</AuthLayout>
{:else}
	<AuthLayout
		title="Run every shop from one console"
		subtitle="Onboard tenants, assign plans, and watch platform-wide orders and revenue, with every shop's data kept strictly separate."
	>
		<span class="auth-eyebrow"><ShieldCheck size={13} stroke={1.6} /> Super Admin access</span>

		{#if enrollStep}
			<form onsubmit={submitEnroll} novalidate>
				<MfaPanel
					kind="enroll"
					method={enrollMethod}
					methods={enrollMethods}
					onchoose={chooseEnroll}
					{email}
					setup={enrollSetup}
					bind:code={enrollCode}
					cooldown={enrollResendCooldown}
					sending={enrollEmailSending}
					{loading}
					{error}
					requiredBy="The platform"
					onresend={startEnrollEmail}
					onback={backToPassword}
					onedit={clearError}
				/>
			</form>
		{:else if mfaStep}
			<form onsubmit={submitMfaCode} novalidate>
				<MfaPanel
					kind="challenge"
					method={challengeMethod}
					methods={challengeMethods}
					onchoose={chooseChallenge}
					{email}
					bind:code={mfaCode}
					bind:useRecovery={useRecoveryCode}
					cooldown={resendCooldown}
					sending={emailSending}
					{loading}
					{error}
					onresend={sendChallengeEmail}
					onback={backToPassword}
					onedit={clearError}
				/>
			</form>
		{:else}
		<h2 class="auth-title">Welcome back</h2>
		<p class="auth-sub">Sign in with your platform administrator credentials.</p>

		<form onsubmit={submit} novalidate>
			<div class="auth-field">
				<label class="auth-label" for="sa-email">Email address</label>
				<div class="auth-input-wrap">
					<span class="auth-input-icon"><Mail size={16} stroke={1.6} /></span>
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
					<span class="auth-input-icon"><Lock size={16} stroke={1.6} /></span>
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
							<EyeOff size={16} stroke={1.6} />
						{:else}
							<Eye size={16} stroke={1.6} />
						{/if}
					</button>
				</div>
			</div>

			{#if error}
				<p class="auth-alert" id="sa-error" role="alert">
					<TriangleAlert size={16} stroke={1.6} />
					<span>{error}</span>
				</p>
			{/if}

			<button class="btn btn-primary auth-submit" type="submit" disabled={loading}>
				{#if loading}
					<LoaderCircle class="auth-spinner" size={17} stroke={1.6} />
					Signing in...
				{:else}
					Sign in
					<ArrowRight size={16} stroke={1.6} />
				{/if}
			</button>
			<p class="auth-forgot">Forgot your password? Another platform admin can reset your access.</p>
		</form>
		{/if}

		<p class="auth-foot">
			<KeyRound size={13} stroke={1.6} />
			Restricted to platform administrators
		</p>
	</AuthLayout>
{/if}
