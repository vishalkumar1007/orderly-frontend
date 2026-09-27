<script lang="ts">
	import { onMount } from 'svelte';
	import {
		createTenantType,
		fetchSettings,
		fetchTenantTypes,
		updateSettings,
		updateTenantType,
		type SettingsPatch
	} from '$lib/admin/api';
	import type { PlatformSettings, TenantType } from '$lib/admin/types';
	import { changePassword, me, type User } from '$lib/auth';
	import { getConfig, preloadAllConfigs } from '$lib/admin/configCache.svelte';
	import FormField from '$lib/components/admin/FormField.svelte';
	import ServiceConfigPanel from './ServiceConfigPanel.svelte';
	import TenantConfigTable from './tenant-access/+page.svelte';
	import SettingsNav from '$lib/components/admin/SettingsNav.svelte';
	import SettingsPanel from '$lib/components/admin/SettingsPanel.svelte';
	import Skeleton from '$lib/components/admin/Skeleton.svelte';
	import StatusBadge from '$lib/components/admin/StatusBadge.svelte';
	import Switch from '$lib/components/admin/Switch.svelte';
	import TextInput from '$lib/components/admin/TextInput.svelte';
	import { toast } from '$lib/components/admin/toast';

	const tabs = [
		{ id: 'general', label: 'General' },
		{ id: 'email', label: 'Email' },
		{ id: 'storage', label: 'Storage' },
		{ id: 'ai', label: 'AI' },
		{ id: 'tenant-access', label: 'Organizations' },
		{ id: 'types', label: 'Tenant types' },
		{ id: 'security', label: 'Security' },
		{ id: 'platform', label: 'Platform' },
		{ id: 'profile', label: 'Admin profile' }
	];

	let settings = $state<PlatformSettings | null>(null);
	let profile = $state<User | null>(null);
	let types = $state<TenantType[]>([]);
	let loading = $state(true);
	let saving = $state(false);
	let error = $state('');
	let tab = $state('general');

	let newCode = $state('');
	let newLabel = $state('');

	let currentPassword = $state('');
	let newPassword = $state('');
	let confirmPassword = $state('');
	let passwordSaving = $state(false);

	async function load() {
		loading = true;
		error = '';
		try {
			[settings, profile, types] = await Promise.all([fetchSettings(), me(), fetchTenantTypes()]);
			// Pre-fetch all service configs in the background so tab switches are instant.
			preloadAllConfigs();
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to load settings';
		} finally {
			loading = false;
		}
	}

	onMount(load);

	async function save(patch: SettingsPatch) {
		if (!settings) return;
		saving = true;
		try {
			settings = await updateSettings(patch);
			toast.success('Settings saved');
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Save failed');
		} finally {
			saving = false;
		}
	}

	const saveGeneral = () =>
		settings &&
		save({
			general: {
				platform_name: settings.general.platform_name,
				support_email: settings.general.support_email,
				timezone: settings.general.timezone,
				default_locale: settings.general.default_locale
			}
		});

	const saveSecurity = () =>
		settings &&
		save({
			security: {
				session_timeout_minutes: settings.security.session_timeout_minutes,
				password_min_length: settings.security.password_min_length,
				invite_expiry_hours: settings.security.invite_expiry_hours,
				require_mfa_for_admins: settings.security.require_mfa_for_admins
			}
		});

	const savePlatform = () =>
		settings &&
		save({
			platform: {
				allow_self_serve: settings.platform.allow_self_serve,
				maintenance_mode: settings.platform.maintenance_mode
			}
		});



	async function addType() {
		saving = true;
		try {
			const created = await createTenantType({ code: newCode, label: newLabel, active: true });
			types = [...types, created].sort(
				(a, b) => a.sort_order - b.sort_order || a.label.localeCompare(b.label)
			);
			newCode = '';
			newLabel = '';
			toast.success('Type added');
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Could not add type');
		} finally {
			saving = false;
		}
	}

	async function saveType(row: TenantType) {
		try {
			const updated = await updateTenantType(row.code, {
				label: row.label,
				active: row.active,
				sort_order: row.sort_order
			});
			types = types.map((t) => (t.code === updated.code ? updated : t));
			toast.success(`${updated.label} saved`);
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Could not update type');
		}
	}

	async function submitPassword(e: Event) {
		e.preventDefault();
		if (newPassword !== confirmPassword) {
			toast.error('Passwords do not match');
			return;
		}
		passwordSaving = true;
		try {
			await changePassword(currentPassword, newPassword);
			currentPassword = '';
			newPassword = '';
			confirmPassword = '';
			toast.success('Password updated');
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Password change failed');
		} finally {
			passwordSaving = false;
		}
	}
</script>

<div class="settings">
	<SettingsNav {tabs} active={tab} onSelect={(id) => (tab = id)} />

	<div>
		{#if error}
			<div class="alert alert-danger" style="margin-bottom:0.85rem;">{error}</div>
		{/if}

		{#if loading || !settings}
			<div style="display:flex;flex-direction:column;gap:0.85rem;">
				<Skeleton height="12rem" />
				<Skeleton height="24rem" />
			</div>
		{:else if tab === 'general'}
			<SettingsPanel title="General" description="Name and support details shown across the console.">
				<div style="display:flex;flex-direction:column;gap:0.9rem;max-width:32rem;">
					<FormField label="Platform name" htmlFor="set-name">
						<TextInput id="set-name" bind:value={settings.general.platform_name} />
					</FormField>
					<FormField label="Support email" htmlFor="set-email">
						<TextInput id="set-email" type="email" bind:value={settings.general.support_email} />
					</FormField>
					<FormField label="Timezone" htmlFor="set-tz" hint="Used for daily order and revenue cut-offs.">
						<TextInput id="set-tz" bind:value={settings.general.timezone} />
					</FormField>
					<FormField label="Default locale" htmlFor="set-locale">
						<TextInput id="set-locale" bind:value={settings.general.default_locale} />
					</FormField>
				</div>
				{#snippet footer()}
					<button type="button" class="btn btn-primary" disabled={saving} onclick={saveGeneral}>
						{saving ? 'Saving…' : 'Save changes'}
					</button>
				{/snippet}
			</SettingsPanel>
		{:else if tab === 'email'}
			<ServiceConfigPanel service="SMTP" initialView={getConfig('SMTP')} />
		{:else if tab === 'storage'}
			<ServiceConfigPanel service="STORAGE" initialView={getConfig('STORAGE')} />
		{:else if tab === 'ai'}
			<ServiceConfigPanel service="AI" initialView={getConfig('AI')} />
		{:else if tab === 'tenant-access'}
			<TenantConfigTable />
		{:else if tab === 'types'}
			<SettingsPanel
				title="Tenant types"
				description="Business categories offered when onboarding. Deactivated types stay on existing tenants."
			>
				<div class="table-wrap">
					<table class="table">
						<thead>
							<tr>
								<th>Code</th>
								<th>Label</th>
								<th>Order</th>
								<th>Status</th>
								<th style="width:1%;"></th>
							</tr>
						</thead>
						<tbody>
							{#each types as row (row.code)}
								<tr>
									<td><code class="mono">{row.code}</code></td>
									<td>
										<input
											class="input"
											style="max-width:14rem;"
											bind:value={row.label}
											aria-label="Label for {row.code}"
										/>
									</td>
									<td class="num muted">{row.sort_order}</td>
									<td>
										<StatusBadge status={row.active ? 'ACTIVE' : 'INACTIVE'} />
									</td>
									<td>
										<div style="display:flex;align-items:center;gap:0.5rem;">
											<Switch bind:checked={row.active} label="" />
											<button
												type="button"
												class="btn btn-ghost btn-sm"
												onclick={() => saveType(row)}
											>
												Save
											</button>
										</div>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>

				<div
					style="display:grid;gap:0.6rem;grid-template-columns:minmax(6rem,9rem) minmax(0,1fr) auto;align-items:end;margin-top:1.1rem;padding-top:1.1rem;border-top:1px solid var(--border);"
				>
					<FormField label="Code" htmlFor="nt-code">
						<TextInput id="nt-code" bind:value={newCode} placeholder="MOMO" />
					</FormField>
					<FormField label="Label" htmlFor="nt-label">
						<TextInput id="nt-label" bind:value={newLabel} placeholder="Momo" />
					</FormField>
					<button
						type="button"
						class="btn btn-primary"
						disabled={saving || !newCode.trim() || !newLabel.trim()}
						onclick={addType}
					>
						Add type
					</button>
				</div>
			</SettingsPanel>
		{:else if tab === 'security'}
			<SettingsPanel title="Security" description="Password policy and session defaults for the whole platform.">
				<div style="display:flex;flex-direction:column;gap:0.9rem;max-width:30rem;">
					<FormField
						label="Minimum password length"
						htmlFor="set-pw-min"
						hint="Applies to tenant admins and staff when they set a password."
					>
						<input
							id="set-pw-min"
							class="input"
							type="number"
							min="6"
							bind:value={settings.security.password_min_length}
						/>
					</FormField>
					<FormField
						label="Invite link expiry (hours)"
						htmlFor="set-invite"
						hint="Setup links stop working after this period."
					>
						<input
							id="set-invite"
							class="input"
							type="number"
							min="1"
							bind:value={settings.security.invite_expiry_hours}
						/>
					</FormField>
					<FormField label="Session timeout (minutes)" htmlFor="set-session">
						<input
							id="set-session"
							class="input"
							type="number"
							min="5"
							bind:value={settings.security.session_timeout_minutes}
						/>
					</FormField>
					<Switch
						bind:checked={settings.security.require_mfa_for_admins}
						label="Require MFA for admins"
						hint="Enforcement is not wired up yet — this records the intent only."
					/>
				</div>
				{#snippet footer()}
					<button type="button" class="btn btn-primary" disabled={saving} onclick={saveSecurity}>
						{saving ? 'Saving…' : 'Save changes'}
					</button>
				{/snippet}
			</SettingsPanel>
		{:else if tab === 'platform'}
			<SettingsPanel
				title="Platform"
				description="Runtime flags. Domain and port are read from the environment."
			>
				<dl class="dl" style="max-width:32rem;margin-bottom:1.1rem;">
					<div><dt>Base domain</dt><dd class="mono">{settings.platform.base_domain}</dd></div>
					<div><dt>Frontend port</dt><dd class="mono">{settings.platform.frontend_port ?? '—'}</dd></div>
					<div><dt>Environment</dt><dd>{settings.app_env || '—'}</dd></div>
				</dl>

				<div style="display:flex;flex-direction:column;gap:0.85rem;max-width:32rem;">
					<Switch
						bind:checked={settings.platform.allow_self_serve}
						label="Allow self-serve tenant signup"
						hint="Lets businesses create their own account without a Super Admin."
					/>
					<Switch
						bind:checked={settings.platform.maintenance_mode}
						label="Maintenance mode"
						hint="Hides tenant storefronts while you make platform changes."
					/>
				</div>
				{#snippet footer()}
					<button type="button" class="btn btn-primary" disabled={saving} onclick={savePlatform}>
						{saving ? 'Saving…' : 'Save changes'}
					</button>
				{/snippet}
			</SettingsPanel>
		{:else}
			<SettingsPanel title="Admin profile" description="Your Super Admin account and credentials.">
				<dl class="dl" style="max-width:32rem;margin-bottom:1.25rem;">
					<div><dt>Name</dt><dd>{profile?.name ?? '—'}</dd></div>
					<div><dt>Email</dt><dd>{profile?.email ?? '—'}</dd></div>
					<div><dt>Role</dt><dd>Super Admin</dd></div>
				</dl>

				<form style="max-width:22rem;" onsubmit={submitPassword}>
					<p class="field-label" style="margin:0 0 0.6rem;">Change password</p>
					<div style="display:flex;flex-direction:column;gap:0.85rem;">
						<FormField label="Current password" htmlFor="cur-pw">
							<TextInput id="cur-pw" type="password" bind:value={currentPassword} required />
						</FormField>
						<FormField label="New password" htmlFor="new-pw">
							<TextInput id="new-pw" type="password" bind:value={newPassword} required />
						</FormField>
						<FormField label="Confirm new password" htmlFor="conf-pw">
							<TextInput id="conf-pw" type="password" bind:value={confirmPassword} required />
						</FormField>
						<div>
							<button type="submit" class="btn btn-primary" disabled={passwordSaving}>
								{passwordSaving ? 'Updating…' : 'Update password'}
							</button>
						</div>
					</div>
				</form>
			</SettingsPanel>
		{/if}
	</div>
</div>
