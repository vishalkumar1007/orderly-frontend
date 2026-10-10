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
	import Select from '$lib/components/admin/Select.svelte';
	import SettingsSection from '$lib/components/admin/SettingsSection.svelte';
	import Skeleton from '$lib/components/admin/Skeleton.svelte';
	import Switch from '$lib/components/admin/Switch.svelte';
	import TextInput from '$lib/components/admin/TextInput.svelte';
	import { toast } from '$lib/components/admin/toast';

	/** The console's own small, fixed role set — mirrors pkg/identity.PlatformRoles(), excluding the sole owner. */
	const PLATFORM_ROLES = [
		{ key: 'PLATFORM_ADMIN', label: 'Platform admin' },
		{ key: 'SUPPORT', label: 'Support' }
	];
	const MFA_MODE_OPTIONS = [
		{ value: 'DISABLED', label: 'Disabled — nobody can use it' },
		{ value: 'OPTIONAL', label: 'Optional — anyone may turn it on for themselves' },
		{ value: 'REQUIRED', label: 'Required — enforced for the roles below' }
	];
	const MFA_SCOPE_OPTIONS = [
		{ value: 'ALL_ADMINS', label: 'All console accounts' },
		{ value: 'SELECTED_ROLES', label: 'Selected roles only' }
	];

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
		mfa_mode: 'DISABLED' | 'OPTIONAL' | 'REQUIRED';
		mfa_totp: boolean;
		mfa_email_otp: boolean;
		mfa_enforce_scope: 'ALL_ADMINS' | 'SELECTED_ROLES';
		mfa_enforce_roles: string[];
		mfa_grace_period_days: number;
	};

	const DEFAULT_POLICY: Policy = {
		password_min_length: 8,
		invite_expiry_hours: 168,
		session_timeout_minutes: 15,
		mfa_mode: 'DISABLED',
		mfa_totp: true,
		mfa_email_otp: false,
		mfa_enforce_scope: 'ALL_ADMINS',
		mfa_enforce_roles: [],
		mfa_grace_period_days: 7
	};

	let settings = $state<PlatformSettings | null>(null);
	let policy = $state<Policy>({ ...DEFAULT_POLICY });
	// Seeded with the same defaults rather than a copy of `policy`: reading one
	// piece of state to initialise another captures its first value only.
	let base = $state<Policy>({ ...DEFAULT_POLICY });
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
			mfa_mode: next.security.mfa_mode,
			mfa_totp: next.security.mfa_allowed_methods.includes('TOTP'),
			mfa_email_otp: next.security.mfa_allowed_methods.includes('EMAIL_OTP'),
			mfa_enforce_scope: next.security.mfa_enforce_scope,
			mfa_enforce_roles: next.security.mfa_enforce_roles ?? [],
			mfa_grace_period_days: next.security.mfa_grace_period_days
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
			policy.mfa_mode !== base.mfa_mode ||
			policy.mfa_totp !== base.mfa_totp ||
			policy.mfa_email_otp !== base.mfa_email_otp ||
			policy.mfa_enforce_scope !== base.mfa_enforce_scope ||
			JSON.stringify(policy.mfa_enforce_roles) !== JSON.stringify(base.mfa_enforce_roles) ||
			policy.mfa_grace_period_days !== base.mfa_grace_period_days
	);

	function toggleEnforceRole(key: string) {
		policy.mfa_enforce_roles = policy.mfa_enforce_roles.includes(key)
			? policy.mfa_enforce_roles.filter((r) => r !== key)
			: [...policy.mfa_enforce_roles, key];
	}

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

		if (field === 'session' && !policy.mfa_totp && !policy.mfa_email_otp) {
			next.session_timeout_minutes = 'At least one MFA method must be allowed';
			errors = next;
			return;
		}

		setSaving(true);
		try {
			const methods = [
				...(policy.mfa_totp ? (['TOTP'] as const) : []),
				...(policy.mfa_email_otp ? (['EMAIL_OTP'] as const) : [])
			];
			hydrate(
				await updateSettings({
					security: {
						password_min_length: policy.password_min_length,
						invite_expiry_hours: policy.invite_expiry_hours,
						session_timeout_minutes: policy.session_timeout_minutes,
						mfa_mode: policy.mfa_mode,
						mfa_allowed_methods: methods,
						mfa_enforce_scope: policy.mfa_enforce_scope,
						mfa_enforce_roles: policy.mfa_enforce_scope === 'SELECTED_ROLES' ? policy.mfa_enforce_roles : null,
						mfa_grace_period_days: policy.mfa_grace_period_days
					}
				})
			);
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
		description="How long someone stays signed in, and whether a second factor is required of console accounts."
		icon={Timer}
		dirty={sessionDirty}
		saving={sessionSaving}
		saved={sessionSaved}
		onsave={() => save('session', (v) => (sessionSaved = v), (v) => (sessionSaving = v))}
		onreset={() => {
			policy.session_timeout_minutes = base.session_timeout_minutes;
			policy.mfa_mode = base.mfa_mode;
			policy.mfa_totp = base.mfa_totp;
			policy.mfa_email_otp = base.mfa_email_otp;
			policy.mfa_enforce_scope = base.mfa_enforce_scope;
			policy.mfa_enforce_roles = [...base.mfa_enforce_roles];
			policy.mfa_grace_period_days = base.mfa_grace_period_days;
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

		<Select
			label="Two-factor authentication"
			id="sec-mfa-mode"
			value={policy.mfa_mode}
			options={MFA_MODE_OPTIONS}
			onchange={(v) => (policy.mfa_mode = v as Policy['mfa_mode'])}
		/>

		<Switch bind:checked={policy.mfa_totp} label="Authenticator app (TOTP)" hint="QR-code setup with an app like Google or Microsoft Authenticator." />
		<Switch bind:checked={policy.mfa_email_otp} label="Email code" hint="A one-time code sent to the account's verified email." />

		{#if policy.mfa_mode === 'REQUIRED'}
			<Select
				label="Enforce for"
				id="sec-mfa-scope"
				value={policy.mfa_enforce_scope}
				options={MFA_SCOPE_OPTIONS}
				onchange={(v) => (policy.mfa_enforce_scope = v as Policy['mfa_enforce_scope'])}
			/>

			{#if policy.mfa_enforce_scope === 'SELECTED_ROLES'}
				<div class="mfa-roles">
					{#each PLATFORM_ROLES as role (role.key)}
						<Switch
							checked={policy.mfa_enforce_roles.includes(role.key)}
							onchange={() => toggleEnforceRole(role.key)}
							label={role.label}
						/>
					{/each}
				</div>
			{/if}

			<FormField
				label="Enrollment grace period"
				htmlFor="sec-mfa-grace"
				hint="How long a console account has to set up a method before being blocked at sign-in."
			>
				<TextInput
					id="sec-mfa-grace"
					type="number"
					min={0}
					max={90}
					suffix="days"
					value={String(policy.mfa_grace_period_days)}
					oninput={(e) => (policy.mfa_grace_period_days = num(e))}
				/>
			</FormField>
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
	.mfa-roles {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		padding: 0.75rem;
		background: var(--surface-2);
		border-radius: var(--radius-sm);
	}

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
