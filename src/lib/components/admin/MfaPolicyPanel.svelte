<script lang="ts">
	import { onMount } from 'svelte';
	import ShieldCheck from '@lucide/svelte/icons/shield-check';
	import {
		fetchTenantMfaPolicy,
		updateTenantMfaPolicy,
		type MfaEnforceScope,
		type MfaPolicyMode,
		type TenantMfaPolicy
	} from '$lib/mfaApi';
	import { fetchIam, type RoleInfo } from '$lib/tenant/iamApi';
	import { errorMessage } from '$lib/admin/errors';
	import FormField from '$lib/components/admin/FormField.svelte';
	import Select from '$lib/components/admin/Select.svelte';
	import SettingsSection from '$lib/components/admin/SettingsSection.svelte';
	import Skeleton from '$lib/components/admin/Skeleton.svelte';
	import Switch from '$lib/components/admin/Switch.svelte';
	import TextInput from '$lib/components/admin/TextInput.svelte';
	import { toast } from '$lib/components/admin/toast';

	/**
	 * This business's own MFA policy — mode, methods, who it's enforced for,
	 * and the enrollment grace period. Owned by the Tenant Admin, within
	 * whatever the Super Admin's business-profile permission allows (the
	 * `allowed` flag below); Super Admin only seeds the initial policy at
	 * onboarding and sees this same data read-only from the business profile.
	 */

	const MODE_OPTIONS = [
		{ value: 'DISABLED', label: 'Disabled — nobody can use it' },
		{ value: 'OPTIONAL', label: 'Optional — anyone may turn it on for themselves' },
		{ value: 'REQUIRED', label: 'Required — enforced for the roles below' }
	];
	const SCOPE_OPTIONS = [
		{ value: 'ALL_ADMINS', label: 'All administrators' },
		{ value: 'SELECTED_ROLES', label: 'Selected roles only' }
	];

	let loading = $state(true);
	let allowed = $state(false);
	let roles = $state<RoleInfo[]>([]);

	let policy = $state({
		mode: 'DISABLED' as MfaPolicyMode,
		totp: true,
		emailOtp: false,
		enforceScope: 'ALL_ADMINS' as MfaEnforceScope,
		enforceRoles: [] as string[],
		gracePeriodDays: 7
	});
	let base = $state({ ...policy });

	const dirty = $derived(JSON.stringify(policy) !== JSON.stringify(base));
	let saving = $state(false);
	let saved = $state(false);

	function fromApi(p: TenantMfaPolicy) {
		return {
			mode: p.mode,
			totp: p.allowed_methods.includes('TOTP'),
			emailOtp: p.allowed_methods.includes('EMAIL_OTP'),
			enforceScope: p.enforce_scope,
			enforceRoles: p.enforce_roles ?? [],
			gracePeriodDays: p.grace_period_days
		};
	}

	async function load() {
		loading = true;
		try {
			const [p, iam] = await Promise.all([fetchTenantMfaPolicy(), fetchIam().catch(() => null)]);
			allowed = p.allowed;
			policy = fromApi(p);
			base = { ...policy };
			if (iam) roles = iam.roles;
		} catch (err) {
			toast.error(errorMessage(err, 'load the mfa policy'));
		} finally {
			loading = false;
		}
	}

	onMount(load);

	function toggleRole(key: string) {
		policy.enforceRoles = policy.enforceRoles.includes(key)
			? policy.enforceRoles.filter((r) => r !== key)
			: [...policy.enforceRoles, key];
	}

	async function save() {
		if (!policy.totp && !policy.emailOtp) {
			toast.error('At least one method must be allowed');
			return;
		}
		saving = true;
		try {
			const methods = [...(policy.totp ? ['TOTP' as const] : []), ...(policy.emailOtp ? ['EMAIL_OTP' as const] : [])];
			const updated = await updateTenantMfaPolicy({
				mode: policy.mode,
				allowed_methods: methods,
				enforce_scope: policy.enforceScope,
				enforce_roles: policy.enforceScope === 'SELECTED_ROLES' ? policy.enforceRoles : null,
				grace_period_days: policy.gracePeriodDays
			});
			policy = fromApi(updated);
			base = { ...policy };
			toast.success('MFA policy saved');
			saved = true;
			setTimeout(() => (saved = false), 2400);
		} catch (err) {
			toast.error(errorMessage(err, 'save the mfa policy'));
		} finally {
			saving = false;
		}
	}

	function reset() {
		policy = { ...base };
	}
</script>

<SettingsSection
	title="Two-factor authentication policy"
	description="Whether staff can — or must — use a second factor at sign-in, and which methods are allowed."
	icon={ShieldCheck}
	{dirty}
	{saving}
	{saved}
	onsave={save}
	onreset={reset}
>
	{#if loading}
		<Skeleton height="8rem" />
	{:else if !allowed}
		<p class="muted">
			Your platform administrator hasn't turned on two-factor authentication for this business
			yet — ask them to allow it from your business profile before you can configure a policy.
		</p>
	{:else}
		<Select
			label="Mode"
			id="mfa-mode"
			value={policy.mode}
			options={MODE_OPTIONS}
			onchange={(v) => (policy.mode = v as MfaPolicyMode)}
		/>

		<Switch bind:checked={policy.totp} label="Authenticator app (TOTP)" hint="QR-code setup with an app like Google or Microsoft Authenticator." />
		<Switch bind:checked={policy.emailOtp} label="Email code" hint="A one-time code sent to the person's verified email." />

		{#if policy.mode === 'REQUIRED'}
			<Select
				label="Enforce for"
				id="mfa-scope"
				value={policy.enforceScope}
				options={SCOPE_OPTIONS}
				onchange={(v) => (policy.enforceScope = v as MfaEnforceScope)}
			/>

			{#if policy.enforceScope === 'SELECTED_ROLES' && roles.length > 0}
				<div class="mfa-policy-roles">
					{#each roles as role (role.key)}
						<Switch
							checked={policy.enforceRoles.includes(role.key)}
							onchange={() => toggleRole(role.key)}
							label={role.label}
						/>
					{/each}
				</div>
			{/if}

			<FormField
				label="Enrollment grace period"
				htmlFor="mfa-grace"
				hint="How long a new or existing staff member has to set up a method before being blocked at sign-in."
			>
				<TextInput
					id="mfa-grace"
					type="number"
					min={0}
					max={90}
					suffix="days"
					value={String(policy.gracePeriodDays)}
					oninput={(e) => (policy.gracePeriodDays = Number((e.currentTarget as HTMLInputElement).value))}
				/>
			</FormField>
		{/if}
	{/if}
</SettingsSection>

<style>
	.mfa-policy-roles {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		padding: 0.75rem;
		background: var(--surface-2);
		border-radius: var(--radius-sm);
	}
</style>
