<script lang="ts">
	import { onMount } from 'svelte';
	import KeyRound from '@lucide/svelte/icons/key-round';
	import ShieldCheck from '@lucide/svelte/icons/shield-check';
	import UserRound from '@lucide/svelte/icons/user-round';
	import { changePassword, me, type User } from '$lib/auth';
	import { fetchSettings } from '$lib/admin/api';
	import { errorMessage } from '$lib/admin/errors';
	import type { PlatformSettings } from '$lib/admin/types';
	import FormField from '$lib/components/admin/FormField.svelte';
	import SettingsSection from '$lib/components/admin/SettingsSection.svelte';
	import Skeleton from '$lib/components/admin/Skeleton.svelte';
	import TextInput from '$lib/components/admin/TextInput.svelte';
	import { toast } from '$lib/components/admin/toast';

	/**
	 * Your own account.
	 *
	 * Reached from the account menu rather than from the settings rail, because
	 * it is not a platform setting — it is one person's credentials. The roles
	 * table below is here rather than on a screen of its own: it is reference
	 * material you want while thinking about access, not something to configure.
	 */

	let profile = $state<User | null>(null);
	let settings = $state<PlatformSettings | null>(null);
	let loading = $state(true);

	let current = $state('');
	let next = $state('');
	let confirm = $state('');
	let saving = $state(false);
	let errors = $state<Record<string, string>>({});

	async function load() {
		loading = true;
		try {
			[profile, settings] = await Promise.all([me(), fetchSettings()]);
		} catch (err) {
			toast.error(errorMessage(err, 'load your profile'));
		} finally {
			loading = false;
		}
	}

	onMount(load);

	const minLength = $derived(settings?.security.password_min_length ?? 8);
	const filled = $derived(Boolean(current && next && confirm));

	/** A rough strength read, to steer rather than to gate. */
	const strength = $derived.by(() => {
		const value = next;
		if (!value) return null;
		let score = 0;
		if (value.length >= minLength) score++;
		if (value.length >= minLength + 4) score++;
		if (/[a-z]/.test(value) && /[A-Z]/.test(value)) score++;
		if (/\d/.test(value) || /[^\w\s]/.test(value)) score++;
		const labels = ['Too short', 'Weak', 'Reasonable', 'Strong'];
		return { score, label: labels[Math.min(score, 3)] };
	});

	async function submit(event: Event) {
		event.preventDefault();
		const found: Record<string, string> = {};
		if (!current) found.current = 'Enter your current password';
		if (next.length < minLength) found.next = `Use at least ${minLength} characters`;
		if (next && next === current) found.next = 'Choose a password you are not already using';
		if (next !== confirm) found.confirm = 'The two passwords do not match';
		errors = found;
		if (Object.keys(found).length > 0) return;

		saving = true;
		try {
			await changePassword(current, next);
			current = '';
			next = '';
			confirm = '';
			errors = {};
			toast.success('Password updated');
		} catch (err) {
			toast.error(errorMessage(err, 'change your password'));
		} finally {
			saving = false;
		}
	}
</script>

{#if loading}
	<div style="display:flex;flex-direction:column;gap:1.5rem;">
		{#each [1, 2] as _, i (i)}
			<Skeleton height="11rem" />
		{/each}
	</div>
{:else}
	<SettingsSection
		title="Account"
		description="The platform owner account. The database permits exactly one, and it has no access inside any business."
		icon={UserRound}
	>
		{#snippet footer()}
			<a class="btn btn-quiet btn-sm" href="/superadmin/iam">Manage business users</a>
		{/snippet}

		<dl class="dl">
			<div><dt>Name</dt><dd>{profile?.name ?? '—'}</dd></div>
			<div><dt>Email</dt><dd class="mono">{profile?.email ?? '—'}</dd></div>
			<div><dt>Role</dt><dd>Platform owner</dd></div>
			<div><dt>Scope</dt><dd>This console only</dd></div>
		</dl>
	</SettingsSection>

	<SettingsSection
		title="Password"
		description={`At least ${minLength} characters, as set under Security. Changing it does not sign you out of this session.`}
		icon={KeyRound}
	>
		{#snippet footer()}
			<button
				type="submit"
				form="pw-form"
				class="btn btn-primary btn-sm"
				disabled={saving || !filled}
			>
				{saving ? 'Updating…' : 'Update password'}
			</button>
		{/snippet}

		<form id="pw-form" class="pw-form" onsubmit={submit}>
			<FormField label="Current password" htmlFor="cur-pw" error={errors.current}>
				<TextInput
					id="cur-pw"
					type="password"
					bind:value={current}
					autocomplete="current-password"
				/>
			</FormField>
			<FormField label="New password" htmlFor="new-pw" error={errors.next}>
				<TextInput id="new-pw" type="password" bind:value={next} autocomplete="new-password" />
			</FormField>

			{#if strength}
				<div class="pw-strength" aria-live="polite">
					<div class="pw-bars">
						{#each [0, 1, 2, 3] as i (i)}
							<span class={i < strength.score ? `on s${strength.score}` : ''}></span>
						{/each}
					</div>
					<span class="pw-label">{strength.label}</span>
				</div>
			{/if}

			<FormField label="Confirm new password" htmlFor="conf-pw" error={errors.confirm}>
				<TextInput
					id="conf-pw"
					type="password"
					bind:value={confirm}
					autocomplete="new-password"
				/>
			</FormField>
		</form>
	</SettingsSection>

	<SettingsSection
		title="Roles on this platform"
		description="Three roles, no overlap. Changing someone's role in a business never grants them anything on the platform, and this account grants nothing inside a business."
		icon={ShieldCheck}
	>
		<dl class="roles">
			<div>
				<dt>Platform owner</dt>
				<dd>This console: onboarding, plans, providers, monitoring. One account only.</dd>
			</div>
			<div>
				<dt>Business owner</dt>
				<dd>One business: its menu, staff, storefront, orders and integrations.</dd>
			</div>
			<div>
				<dt>Manager</dt>
				<dd>One business, day to day: orders, kitchen, menu, customers and staff — not its configuration.</dd>
			</div>
			<div>
				<dt>Staff</dt>
				<dd>One business: taking orders and working the kitchen board.</dd>
			</div>
		</dl>
	</SettingsSection>
{/if}

<style>
	.pw-form {
		display: flex;
		flex-direction: column;
		gap: 1.1rem;
		max-width: 28rem;
	}

	.pw-strength {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		margin-top: -0.45rem;
	}

	.pw-bars {
		display: flex;
		gap: 0.2rem;
		flex: 1;
	}

	.pw-bars span {
		height: 0.25rem;
		flex: 1;
		border-radius: var(--radius-sm);
		background: var(--surface-3);
		transition: background var(--tr);
	}

	.pw-bars span.on {
		background: var(--warn);
	}

	.pw-bars span.on.s3 {
		background: var(--success);
	}

	.pw-bars span.on.s4 {
		background: var(--success);
	}

	.pw-label {
		font-size: var(--fs-meta);
		font-weight: 600;
		color: var(--text-3);
		min-width: 5rem;
	}

	.roles {
		display: grid;
		gap: 0.85rem;
		margin: 0;
		grid-template-columns: repeat(2, minmax(0, 1fr));
	}

	@media (max-width: 720px) {
		.roles {
			grid-template-columns: 1fr;
		}
	}

	.roles > div {
		display: grid;
		gap: 0.2rem;
		padding: 0.75rem 0.85rem;
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-sm);
		background: var(--surface-2);
	}

	.roles dt {
		font-size: var(--fs-body);
		font-weight: 600;
		color: var(--text);
	}

	.roles dd {
		margin: 0;
		font-size: var(--fs-tab);
		line-height: 1.55;
		color: var(--text-3);
	}
</style>
