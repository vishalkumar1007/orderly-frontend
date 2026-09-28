<script lang="ts">
	import { onMount } from 'svelte';
	import { authErrorMessage } from '$lib/admin/errors';
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
	import { adminLogin, adminSetupStatus, homeForRole, me } from '$lib/auth';
	import AuthLayout from './AuthLayout.svelte';

	let email = $state('');
	let password = $state('');
	let showPassword = $state(false);
	let error = $state('');
	let loading = $state(false);
	let checking = $state(true);

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
			const user = await adminLogin(email.trim(), password);
			if (user.role !== 'SUPER_ADMIN') {
				error = 'This portal is for Super Admin only';
				return;
			}
			goto(homeForRole(user.role, 'admin'));
		} catch (err) {
			error = authErrorMessage(err, 'sign in');
		} finally {
			loading = false;
		}
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

		<p class="auth-foot">
			<KeyRound size={13} strokeWidth={2} />
			Restricted to platform administrators
		</p>
	</AuthLayout>
{/if}
