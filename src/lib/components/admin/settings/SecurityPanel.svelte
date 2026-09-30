<script lang="ts">
	import { onMount } from 'svelte';
	import KeyRound from '@lucide/svelte/icons/key-round';
	import Mail from '@lucide/svelte/icons/mail';
	import ShieldCheck from '@lucide/svelte/icons/shield-check';
	import Timer from '@lucide/svelte/icons/timer';
	import { fetchSettings, updateSettings } from '$lib/admin/api';
	import { errorMessage } from '$lib/admin/errors';
	import type { PlatformSettings } from '$lib/admin/types';
	import ErrorState from '$lib/components/admin/ErrorState.svelte';
	import FormField from '$lib/components/admin/FormField.svelte';
	import SettingsSection from '$lib/components/admin/SettingsSection.svelte';
	import Skeleton from '$lib/components/admin/Skeleton.svelte';
	import Switch from '$lib/components/admin/Switch.svelte';
	import TextInput from '$lib/components/admin/TextInput.svelte';
	import { toast } from '$lib/components/admin/toast';

	/**
	 * Security policy.
	 *
	 * Split by what each setting governs rather than by which API field it
	 * writes: passwords, invites and sessions fail in different ways and are
	 * tuned for different reasons. The last section is not editable at all — it
	 * states what the platform already enforces, because the most common
	 * security question is "what do I get without configuring anything".
	 */

	type Policy = {
		password_min_length: number;
		invite_expiry_hours: number;
		session_timeout_minutes: number;
		require_mfa_for_admins: boolean;
	};

	let settings = $state<PlatformSettings | null>(null);
	let policy = $state<Policy>({
		password_min_length: 8,
		invite_expiry_hours: 168,
		session_timeout_minutes: 15,
		require_mfa_for_admins: false
	});
	// Seeded with the same defaults rather than a copy of `policy`: reading one
	// piece of state to initialise another captures its first value only.
	let base = $state<Policy>({
		password_min_length: 8,
		invite_expiry_hours: 168,
		session_timeout_minutes: 15,
		require_mfa_for_admins: false
	});
	let loading = $state(true);
	let error = $state('');
	let errors = $state<Record<string, string>>({});

	let passwordSaving = $state(false);
	let passwordSaved = $state(false);
	let inviteSaving = $state(false);
	let inviteSaved = $state(false);
	let sessionSaving = $state(false);
	let sessionSaved = $state(false);

	function hydrate(next: PlatformSettings) {
		settings = next;
		policy = {
			password_min_length: next.security.password_min_length,
			invite_expiry_hours: next.security.invite_expiry_hours,
			session_timeout_minutes: next.security.session_timeout_minutes,
			require_mfa_for_admins: next.security.require_mfa_for_admins
		};
		base = { ...policy };
	}

	async function load() {
		loading = true;
		error = '';
		try {
			hydrate(await fetchSettings());
		} catch (err) {
			error = errorMessage(err, 'load security settings');
		} finally {
			loading = false;
		}
	}

	onMount(load);

	const passwordDirty = $derived(policy.password_min_length !== base.password_min_length);
	const inviteDirty = $derived(policy.invite_expiry_hours !== base.invite_expiry_hours);
	const sessionDirty = $derived(
		policy.session_timeout_minutes !== base.session_timeout_minutes ||
			policy.require_mfa_for_admins !== base.require_mfa_for_admins
	);

	function num(e: Event): number {
		return Number((e.currentTarget as HTMLInputElement).value);
	}

	async function save(field: keyof Policy | 'session', flash: (v: boolean) => void, setSaving: (v: boolean) => void) {
		const next: Record<string, string> = {};
		if (policy.password_min_length < 6 || policy.password_min_length > 64) {
			next.password_min_length = 'Between 6 and 64 characters';
		}
		if (policy.invite_expiry_hours < 1 || policy.invite_expiry_hours > 720) {
			next.invite_expiry_hours = 'Between 1 hour and 30 days';
		}
		if (policy.session_timeout_minutes < 5 || policy.session_timeout_minutes > 10080) {
			next.session_timeout_minutes = 'Between 5 minutes and one week';
		}
		errors = next;
		// Only block on the field this section owns; a bad value elsewhere on
		// the page is that section's problem to report.
		const own =
			field === 'session'
				? next.session_timeout_minutes
				: next[field as string];
		if (own) return;

		setSaving(true);
		try {
			hydrate(await updateSettings({ security: { ...policy } }));
			toast.success('Security policy saved');
			flash(true);
			setTimeout(() => flash(false), 2400);
		} catch (err) {
			toast.error(errorMessage(err, 'save the security policy'));
		} finally {
			setSaving(false);
		}
	}

	/** Plain-language reading of the invite window. */
	const inviteReadable = $derived.by(() => {
		const hours = policy.invite_expiry_hours;
		if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'}`;
		const days = Math.round(hours / 24);
		return `${days} day${days === 1 ? '' : 's'}`;
	});

	const sessionReadable = $derived.by(() => {
		const minutes = policy.session_timeout_minutes;
		if (minutes < 60) return `${minutes} minutes`;
		const hours = Math.round(minutes / 60);
		return `${hours} hour${hours === 1 ? '' : 's'}`;
	});
</script>

{#if error}
	<div class="panel" style="margin-bottom:1rem;"><ErrorState message={error} onretry={load} /></div>
{/if}

{#if loading || !settings}
	<div style="display:flex;flex-direction:column;gap:1.5rem;">
		{#each [1, 2, 3] as _, i (i)}
			<Skeleton height="10rem" />
		{/each}
	</div>
{:else}
	<SettingsSection
		title="Passwords"
		description="Checked whenever anyone in any business sets or resets a password, including you."
		icon={KeyRound}
		dirty={passwordDirty}
		saving={passwordSaving}
		saved={passwordSaved}
		onsave={() => save('password_min_length', (v) => (passwordSaved = v), (v) => (passwordSaving = v))}
		onreset={() => (policy.password_min_length = base.password_min_length)}
	>
		<FormField
			label="Minimum length"
			htmlFor="sec-pw"
			error={errors.password_min_length}
			hint="Longer beats complicated. Eight is the floor; twelve is a better default for a platform account."
		>
			<TextInput
				id="sec-pw"
				type="number"
				min={6}
				max={64}
				suffix="chars"
				value={String(policy.password_min_length)}
				oninput={(e) => (policy.password_min_length = num(e))}
			/>
		</FormField>
	</SettingsSection>

	<SettingsSection
		title="Invitations"
		description="How long a setup link stays usable. Links are single-use whatever this says, so a short window mainly limits the damage of a forwarded email."
		icon={Mail}
		dirty={inviteDirty}
		saving={inviteSaving}
		saved={inviteSaved}
		onsave={() => save('invite_expiry_hours', (v) => (inviteSaved = v), (v) => (inviteSaving = v))}
		onreset={() => (policy.invite_expiry_hours = base.invite_expiry_hours)}
	>
		<FormField
			label="Setup link expiry"
			htmlFor="sec-invite"
			error={errors.invite_expiry_hours}
			hint={`A new administrator has ${inviteReadable} to set their password before you have to send another link.`}
		>
			<TextInput
				id="sec-invite"
				type="number"
				min={1}
				max={720}
				suffix="hours"
				value={String(policy.invite_expiry_hours)}
				oninput={(e) => (policy.invite_expiry_hours = num(e))}
			/>
		</FormField>
	</SettingsSection>

	<SettingsSection
		title="Sessions"
		description="How long someone stays signed in, and whether a second factor is required of administrators."
		icon={Timer}
		dirty={sessionDirty}
		saving={sessionSaving}
		saved={sessionSaved}
		onsave={() => save('session', (v) => (sessionSaved = v), (v) => (sessionSaving = v))}
		onreset={() => {
			policy.session_timeout_minutes = base.session_timeout_minutes;
			policy.require_mfa_for_admins = base.require_mfa_for_admins;
		}}
	>
		<FormField
			label="Idle timeout"
			htmlFor="sec-session"
			error={errors.session_timeout_minutes}
			hint={`A session is refreshed silently until ${sessionReadable} of inactivity have passed.`}
		>
			<TextInput
				id="sec-session"
				type="number"
				min={5}
				max={10080}
				suffix="min"
				value={String(policy.session_timeout_minutes)}
				oninput={(e) => (policy.session_timeout_minutes = num(e))}
			/>
		</FormField>

		<Switch
			bind:checked={policy.require_mfa_for_admins}
			label="Require a second factor for administrators"
			hint="Recorded as policy only. No second factor is enforced in this build, so turning this on does not yet block a sign-in."
		/>

		{#if policy.require_mfa_for_admins}
			<div class="alert alert-info" style="margin:0;">
				<span>
					This is stored as an intention, not a control. Until a second factor ships, treat it as
					a note to yourself rather than protection.
				</span>
			</div>
		{/if}
	</SettingsSection>

	<SettingsSection
		title="Already enforced"
		description="What the platform does without any configuration. Worth knowing before adding policy on top of it."
		icon={ShieldCheck}
	>
		{#snippet footer()}
			<a class="btn btn-quiet btn-sm" href="/superadmin/audit">Review the audit log</a>
		{/snippet}

		<ul class="posture">
			<li>Passwords are stored as bcrypt hashes and are never returned by any endpoint.</li>
			<li>Setup links are single-use, and only a hash of the token is stored.</li>
			<li>
				Provider credentials are sealed with AES-256-GCM before they are written, and the console
				is never sent them back.
			</li>
			<li>
				A business's token is refused on another business's address, and a platform token grants
				nothing inside a business.
			</li>
			<li>Every authentication attempt is recorded with its real outcome in the audit log.</li>
		</ul>
	</SettingsSection>
{/if}

<style>
	.posture {
		margin: 0;
		padding: 0;
		list-style: none;
		display: grid;
		gap: 0.6rem;
	}

	.posture li {
		position: relative;
		padding-left: 1.4rem;
		font-size: var(--fs-body);
		line-height: 1.55;
		color: var(--text-2);
	}

	.posture li::before {
		content: '';
		position: absolute;
		left: 0.35rem;
		top: 0.5rem;
		width: 0.4rem;
		height: 0.4rem;
		border-radius: var(--radius-sm);
		background: var(--success);
	}
</style>
