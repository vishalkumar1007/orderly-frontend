<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { homeForRole, setupPassword } from '$lib/auth';

	let password = $state('');
	let confirm = $state('');
	let error = $state('');
	let loading = $state(false);

	const token = $derived($page.url.searchParams.get('token') || '');

	async function submit(e: Event) {
		e.preventDefault();
		error = '';
		if (password.length < 8) {
			error = 'Password must be at least 8 characters';
			return;
		}
		if (password !== confirm) {
			error = 'Passwords do not match';
			return;
		}
		if (!token) {
			error = 'Missing invite token';
			return;
		}
		loading = true;
		try {
			const user = await setupPassword(token, password);
			goto(homeForRole(user.role, 'tenant'));
		} catch (err) {
			error = err instanceof Error ? err.message : 'Setup failed';
		} finally {
			loading = false;
		}
	}
</script>

<main
	class="min-h-screen flex items-center justify-center px-4"
	style="background:
		radial-gradient(ellipse at top, #ffe8d6 0%, transparent 55%),
		linear-gradient(180deg, #f7f4ef 0%, #efe8de 100%);"
>
	<form class="card-panel w-full max-w-md" onsubmit={submit}>
		<p class="brand mb-1">Orderly</p>
		<h1 class="text-2xl font-bold mb-1">Set your password</h1>
		<p class="muted mb-6 text-sm">Complete your shop admin invite</p>

		<label class="block text-sm font-medium mb-1" for="password">New password</label>
		<input id="password" class="input mb-3" type="password" bind:value={password} required minlength="8" />

		<label class="block text-sm font-medium mb-1" for="confirm">Confirm password</label>
		<input id="confirm" class="input mb-4" type="password" bind:value={confirm} required minlength="8" />

		{#if error}<p class="err mb-3">{error}</p>{/if}

		<button class="btn btn-primary w-full" type="submit" disabled={loading || !token}>
			{loading ? 'Saving…' : 'Continue'}
		</button>
	</form>
</main>
