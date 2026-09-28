<script lang="ts">
	import { onMount } from 'svelte';
	import { authErrorMessage, errorLines } from '$lib/admin/errors';
	import { goto } from '$app/navigation';
	import { adminSetup, adminSetupStatus } from '$lib/auth';
	import AuthLayout from './AuthLayout.svelte';
	import { toast } from './toast';

	let email = $state('');
	let name = $state('');
	let password = $state('');
	let confirm = $state('');
	let error = $state('');
	let loading = $state(false);
	let checking = $state(true);

	onMount(async () => {
		try {
			const s = await adminSetupStatus();
			if (!s.needs_setup) {
				goto('/superadmin/login', { replaceState: true });
				return;
			}
		} catch (err) {
			error = `${errorLines(err, 'check whether this platform needs setting up').detail} If the API is not running, start it with \`make run\` in orderly-backend.`;
		} finally {
			checking = false;
		}
	});

	async function submit(e: Event) {
		e.preventDefault();
		error = '';
		if (password.length < 8) {
			error = 'Password must be at least 8 characters.';
			return;
		}
		if (password !== confirm) {
			error = 'Passwords do not match.';
			return;
		}
		loading = true;
		try {
			await adminSetup(email.trim(), password, name.trim() || undefined);
			toast.success('Super admin account created. Sign in to continue.');
			goto('/superadmin/login', { replaceState: true });
		} catch (err) {
			error = authErrorMessage(err, 'create the account');
		} finally {
			loading = false;
		}
	}
</script>

{#if checking}
	<AuthLayout title="Super Admin" subtitle="Checking setup status…">
		<p class="muted text-sm">Loading…</p>
	</AuthLayout>
{:else}
	<AuthLayout
		title="Create super admin"
		subtitle="Set up the first administrator account for your Orderly platform."
	>
		<p class="brand mb-1">Orderly</p>
		<h2 class="text-xl font-bold mb-1" style="font-family: var(--font-display);">First-time setup</h2>
		<p class="muted mb-6 text-sm">This runs once per fresh database.</p>

		<form onsubmit={submit}>
			<label class="block text-sm font-medium mb-1" for="sa-setup-name">Display name (optional)</label>
			<input
				id="sa-setup-name"
				class="input mb-3"
				type="text"
				bind:value={name}
				autocomplete="name"
				placeholder="Super Admin"
			/>

			<label class="block text-sm font-medium mb-1" for="sa-setup-email">Work email</label>
			<input
				id="sa-setup-email"
				class="input mb-3"
				type="email"
				bind:value={email}
				required
				autocomplete="username"
			/>

			<label class="block text-sm font-medium mb-1" for="sa-setup-password">Password</label>
			<input
				id="sa-setup-password"
				class="input mb-3"
				type="password"
				bind:value={password}
				required
				autocomplete="new-password"
			/>

			<label class="block text-sm font-medium mb-1" for="sa-setup-confirm">Confirm password</label>
			<input
				id="sa-setup-confirm"
				class="input mb-4"
				type="password"
				bind:value={confirm}
				required
				autocomplete="new-password"
			/>

			{#if error}
				<p class="err mb-3">{error}</p>
			{/if}

			<button class="btn btn-primary w-full" type="submit" disabled={loading}>
				{loading ? 'Creating account…' : 'Create super admin'}
			</button>
		</form>

		<p class="muted text-xs mt-4 text-center">
			Already set up?
			<a href="/superadmin/login" class="font-semibold" style="color: var(--accent);">Sign in</a>
		</p>
	</AuthLayout>
{/if}
