<script lang="ts">
	import { onMount } from 'svelte';
	import { changePassword, meWithTenant, updateMyName, type HostTenant, type User } from '$lib/auth';
	import { errorMessage } from '$lib/admin/errors';
	import { initials } from '$lib/admin/format';
	import FormField from '$lib/components/admin/FormField.svelte';
	import SettingsSection from '$lib/components/admin/SettingsSection.svelte';
	import Skeleton from '$lib/components/admin/Skeleton.svelte';
	import TextInput from '$lib/components/admin/TextInput.svelte';
	import { toast } from '$lib/components/admin/toast';

	/**
	 * Your profile: the person signed in, not the business.
	 *
	 * Who you are here, what your role lets you reach, and the two things that
	 * are yours to change: your display name and your password. Email and role
	 * are set by the owner under Staff, so they are shown, not edited.
	 */
	let user = $state<User | null>(null);
	let tenant = $state<HostTenant | null>(null);
	let loading = $state(true);

	let name = $state('');
	let savedName = $state('');
	let savingName = $state(false);
	let nameSaved = $state(false);
	const nameError = $derived(name.trim().length > 0 && name.trim().length < 2 ? 'Use at least 2 characters' : '');

	let current = $state('');
	let next = $state('');
	let confirm = $state('');
	let savingPw = $state(false);
	let pwErrors = $state<Record<string, string>>({});
	const MIN = 8;

	/** What each permission means to the person holding it. */
	const ACCESS: Record<string, string> = {
		selling: 'Take and manage orders',
		kitchen: 'Work the preparation board',
		live_activity: 'Run the pickup display',
		menu: 'Edit the catalogue',
		customers: 'See customers',
		staff: 'Manage staff',
		storefront: 'Change the storefront',
		organization: 'Configure the business',
		integrations: 'Connect integrations',
		iam: 'Review access',
		settings: 'Change settings',
		analytics: 'See the dashboard',
		activity: 'Read history and audit log'
	};

	onMount(async () => {
		try {
			const resolved = await meWithTenant();
			user = resolved.user;
			tenant = resolved.tenant;
			name = savedName = resolved.user.name ?? '';
		} catch (err) {
			toast.error(errorMessage(err, 'load your profile'));
		} finally {
			loading = false;
		}
	});

	async function saveName() {
		if (nameError || !name.trim()) return;
		savingName = true;
		try {
			const updated = await updateMyName(name.trim());
			name = savedName = updated.name;
			user = { ...user!, name: updated.name };
			nameSaved = true;
			setTimeout(() => (nameSaved = false), 2500);
		} catch (err) {
			toast.error(errorMessage(err, 'save your name'));
		} finally {
			savingName = false;
		}
	}

	async function savePassword(event?: Event) {
		event?.preventDefault();
		const found: Record<string, string> = {};
		if (!current) found.current = 'Enter your current password';
		if (next.length < MIN) found.next = `Use at least ${MIN} characters`;
		if (next && next === current) found.next = 'Choose a password you are not already using';
		if (next !== confirm) found.confirm = 'The two passwords do not match';
		pwErrors = found;
		if (Object.keys(found).length > 0) return;
		savingPw = true;
		try {
			await changePassword(current, next);
			current = next = confirm = '';
			toast.success('Password updated');
		} catch (err) {
			toast.error(errorMessage(err, 'change your password'));
		} finally {
			savingPw = false;
		}
	}
</script>

{#if loading}
	<div class="yp">
		<Skeleton height="9rem" />
		<Skeleton height="12rem" />
	</div>
{:else if user}
	<div class="yp">
		<SettingsSection
			title="Account"
			description="Who is signed in to this console. Your email and role are set by the business owner under Staff."
			dirty={name.trim() !== savedName}
			saving={savingName}
			saved={nameSaved}
			saveLabel="Save name"
			onsave={saveName}
			onreset={() => (name = savedName)}
		>
			<div class="yp-who">
				<span class="yp-avatar" aria-hidden="true">{initials(user.name || user.email)}</span>
				<div class="yp-who-text">
					<strong>{user.name || user.email}</strong>
					<span>{user.role_label ?? user.role} at {tenant?.name ?? 'this business'}</span>
				</div>
			</div>
			<FormField label="Display name" htmlFor="yp-name" error={nameError} hint="How you appear to the rest of the team.">
				<TextInput id="yp-name" bind:value={name} maxlength={80} autocomplete="name" />
			</FormField>
			<dl class="dl">
				<div><dt>Email</dt><dd class="mono">{user.email}</dd></div>
				<div><dt>Role</dt><dd>{user.role_label ?? user.role}</dd></div>
				<div><dt>Business</dt><dd>{tenant?.name ?? '-'}</dd></div>
				<div><dt>Status</dt><dd>{user.status === 'ACTIVE' ? 'Active' : user.status}</dd></div>
			</dl>
		</SettingsSection>

		{#if (user.permissions ?? []).length > 0}
			<SettingsSection
				title="What you can do here"
				description="Decided by your role. Ask the business owner if you need more."
			>
				<ul class="yp-access">
					{#each user.permissions ?? [] as p (p)}
						<li>{ACCESS[p] ?? p}</li>
					{/each}
				</ul>
			</SettingsSection>
		{/if}

		<SettingsSection
			title="Password"
			description={`At least ${MIN} characters. Changing it does not sign you out of this session. Two-factor sign-in is under Security.`}
		>
			{#snippet footer()}
				<button
					type="submit"
					form="yp-pw"
					class="btn btn-primary btn-sm"
					disabled={savingPw || !(current && next && confirm)}
				>
					{savingPw ? 'Updating…' : 'Update password'}
				</button>
			{/snippet}
			<form id="yp-pw" class="yp-pw" onsubmit={savePassword}>
				<FormField label="Current password" htmlFor="yp-cur" error={pwErrors.current}>
					<TextInput id="yp-cur" type="password" bind:value={current} autocomplete="current-password" />
				</FormField>
				<FormField label="New password" htmlFor="yp-new" error={pwErrors.next}>
					<TextInput id="yp-new" type="password" bind:value={next} autocomplete="new-password" />
				</FormField>
				<FormField label="Confirm new password" htmlFor="yp-conf" error={pwErrors.confirm}>
					<TextInput id="yp-conf" type="password" bind:value={confirm} autocomplete="new-password" />
				</FormField>
			</form>
		</SettingsSection>
	</div>
{/if}

<style>
	.yp {
		display: flex;
		flex-direction: column;
		gap: var(--sp-11);
	}

	.yp-who {
		display: flex;
		align-items: center;
		gap: 0.85rem;
	}

	.yp-avatar {
		display: grid;
		place-items: center;
		width: 2.75rem;
		height: 2.75rem;
		flex: none;
		border-radius: 999px;
		background: color-mix(in srgb, var(--accent) 16%, var(--surface));
		color: var(--accent-dark, var(--accent));
		font-weight: 700;
		font-size: 1rem;
	}

	.yp-who-text {
		display: grid;
		gap: 0.1rem;
		min-width: 0;
	}

	.yp-who-text strong {
		color: var(--text);
		font-size: var(--fs-title);
	}

	.yp-who-text span {
		color: var(--text-3);
		font-size: var(--fs-tab);
	}

	.yp-access {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(13rem, 1fr));
		gap: 0.4rem 1rem;
		margin: 0;
		padding: 0;
		list-style: none;
		font-size: var(--fs-body);
		color: var(--text-2);
	}

	.yp-access li::before {
		content: '';
		display: inline-block;
		width: 6px;
		height: 6px;
		margin-right: 0.5rem;
		border-radius: 999px;
		background: var(--success);
		vertical-align: middle;
	}

	.yp-pw {
		display: flex;
		flex-direction: column;
		gap: 1.1rem;
		max-width: 28rem;
	}
</style>
