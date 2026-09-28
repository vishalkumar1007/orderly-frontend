<script lang="ts">
	import { onMount } from 'svelte';
	import Building2 from '@lucide/svelte/icons/building-2';
	import Globe from '@lucide/svelte/icons/globe';
	import SlidersHorizontal from '@lucide/svelte/icons/sliders-horizontal';
	import { fetchSettings, updateSettings, type SettingsPatch } from '$lib/admin/api';
	import { errorMessage } from '$lib/admin/errors';
	import type { PlatformSettings } from '$lib/admin/types';
	import ErrorState from '$lib/components/admin/ErrorState.svelte';
	import FormField from '$lib/components/admin/FormField.svelte';
	import SelectField from '$lib/components/admin/SelectField.svelte';
	import SettingsSection from '$lib/components/admin/SettingsSection.svelte';
	import Skeleton from '$lib/components/admin/Skeleton.svelte';
	import Switch from '$lib/components/admin/Switch.svelte';
	import TextInput from '$lib/components/admin/TextInput.svelte';
	import { toast } from '$lib/components/admin/toast';

	/**
	 * General settings.
	 *
	 * Three sections, three scopes, three independent saves. They are separate
	 * because they write to different parts of the settings document and carry
	 * different risk: renaming the platform is cosmetic, turning on maintenance
	 * mode takes every storefront offline. A single Save for all of it would
	 * hide that difference.
	 */

	const CURRENCIES = [
		{ value: 'INR', label: 'INR — Indian Rupee' },
		{ value: 'USD', label: 'USD — US Dollar' },
		{ value: 'AED', label: 'AED — UAE Dirham' },
		{ value: 'GBP', label: 'GBP — Pound Sterling' },
		{ value: 'EUR', label: 'EUR — Euro' },
		{ value: 'SGD', label: 'SGD — Singapore Dollar' }
	];

	const TIMEZONES = [
		{ value: 'Asia/Kolkata', label: 'Asia/Kolkata (IST)' },
		{ value: 'Asia/Dubai', label: 'Asia/Dubai (GST)' },
		{ value: 'Asia/Kathmandu', label: 'Asia/Kathmandu (NPT)' },
		{ value: 'Asia/Singapore', label: 'Asia/Singapore (SGT)' },
		{ value: 'Europe/London', label: 'Europe/London (GMT)' },
		{ value: 'America/New_York', label: 'America/New_York (ET)' },
		{ value: 'UTC', label: 'UTC' }
	];

	const LOCALES = [
		{ value: 'en-IN', label: 'English (India)' },
		{ value: 'en-GB', label: 'English (UK)' },
		{ value: 'en-US', label: 'English (US)' },
		{ value: 'hi-IN', label: 'Hindi (India)' },
		{ value: 'ar-AE', label: 'Arabic (UAE)' }
	];

	type Identity = { platform_name: string; support_email: string };
	type Defaults = { default_currency: string; timezone: string; default_locale: string };
	type Behaviour = { allow_self_serve: boolean; maintenance_mode: boolean };

	let settings = $state<PlatformSettings | null>(null);
	let loading = $state(true);
	let error = $state('');

	/**
	 * Each section keeps its own draft and its own saved baseline. Comparing the
	 * two is what makes "unsaved changes" true rather than a guess, and it is
	 * why a Discard can put a section back without reloading the page.
	 */
	let identity = $state<Identity>({ platform_name: '', support_email: '' });
	let identityBase = $state<Identity>({ platform_name: '', support_email: '' });
	let identitySaving = $state(false);
	let identitySaved = $state(false);

	let defaults = $state<Defaults>({ default_currency: '', timezone: '', default_locale: '' });
	let defaultsBase = $state<Defaults>({ default_currency: '', timezone: '', default_locale: '' });
	let defaultsSaving = $state(false);
	let defaultsSaved = $state(false);

	let behaviour = $state<Behaviour>({ allow_self_serve: false, maintenance_mode: false });
	let behaviourBase = $state<Behaviour>({ allow_self_serve: false, maintenance_mode: false });
	let behaviourSaving = $state(false);
	let behaviourSaved = $state(false);

	let errors = $state<Record<string, string>>({});

	const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

	function hydrate(next: PlatformSettings) {
		settings = next;
		identity = {
			platform_name: next.general.platform_name,
			support_email: next.general.support_email
		};
		identityBase = { ...identity };
		defaults = {
			default_currency: next.general.default_currency,
			timezone: next.general.timezone,
			default_locale: next.general.default_locale
		};
		defaultsBase = { ...defaults };
		behaviour = {
			allow_self_serve: next.platform.allow_self_serve,
			maintenance_mode: next.platform.maintenance_mode
		};
		behaviourBase = { ...behaviour };
	}

	async function load() {
		loading = true;
		error = '';
		try {
			hydrate(await fetchSettings());
		} catch (err) {
			error = errorMessage(err, 'load settings');
		} finally {
			loading = false;
		}
	}

	onMount(load);

	const identityDirty = $derived(
		identity.platform_name !== identityBase.platform_name ||
			identity.support_email !== identityBase.support_email
	);
	const defaultsDirty = $derived(
		defaults.default_currency !== defaultsBase.default_currency ||
			defaults.timezone !== defaultsBase.timezone ||
			defaults.default_locale !== defaultsBase.default_locale
	);
	const behaviourDirty = $derived(
		behaviour.allow_self_serve !== behaviourBase.allow_self_serve ||
			behaviour.maintenance_mode !== behaviourBase.maintenance_mode
	);

	/** Save one section, then re-seed every baseline from the server's answer. */
	async function save(patch: SettingsPatch, what: string, done: (ok: boolean) => void) {
		try {
			hydrate(await updateSettings(patch));
			toast.success(`${what} saved`);
			done(true);
		} catch (err) {
			toast.error(errorMessage(err, `save ${what.toLowerCase()}`));
			done(false);
		}
	}

	/** Show a tick for a moment, so a save that changes nothing visible still lands. */
	function flash(set: (v: boolean) => void) {
		set(true);
		setTimeout(() => set(false), 2400);
	}

	async function saveIdentity() {
		const next: Record<string, string> = {};
		if (!identity.platform_name.trim()) next.platform_name = 'The platform needs a name';
		if (identity.support_email.trim() && !EMAIL_RE.test(identity.support_email.trim())) {
			next.support_email = 'Enter a valid email address';
		}
		errors = next;
		if (Object.keys(next).length > 0) return;

		identitySaving = true;
		await save(
			{
				general: {
					platform_name: identity.platform_name.trim(),
					support_email: identity.support_email.trim()
				}
			},
			'Platform identity',
			(ok) => {
				identitySaving = false;
				if (ok) flash((v) => (identitySaved = v));
			}
		);
	}

	async function saveDefaults() {
		defaultsSaving = true;
		await save({ general: { ...defaults } }, 'Business defaults', (ok) => {
			defaultsSaving = false;
			if (ok) flash((v) => (defaultsSaved = v));
		});
	}

	async function saveBehaviour() {
		behaviourSaving = true;
		await save({ platform: { ...behaviour } }, 'Platform behaviour', (ok) => {
			behaviourSaving = false;
			if (ok) flash((v) => (behaviourSaved = v));
		});
	}
</script>

{#if error}
	<div class="panel" style="margin-bottom:1rem;"><ErrorState message={error} onretry={load} /></div>
{/if}

{#if loading || !settings}
	<div style="display:flex;flex-direction:column;gap:1.5rem;">
		{#each [1, 2, 3] as _, i (i)}
			<Skeleton height="12rem" />
		{/each}
	</div>
{:else}
	<SettingsSection
		title="Platform identity"
		description="The name in the console rail and on platform email, and where a business owner writes when something is wrong."
		icon={Building2}
		dirty={identityDirty}
		saving={identitySaving}
		saved={identitySaved}
		onsave={saveIdentity}
		onreset={() => {
			identity = { ...identityBase };
			errors = {};
		}}
	>
		<div class="set-field-grid">
			<FormField label="Platform name" htmlFor="set-name" required error={errors.platform_name}>
				<TextInput id="set-name" bind:value={identity.platform_name} placeholder="Orderly" />
			</FormField>
			<FormField
				label="Support email"
				htmlFor="set-email"
				error={errors.support_email}
				hint="Shown to business owners as the address to contact for help."
			>
				<TextInput
					id="set-email"
					type="email"
					bind:value={identity.support_email}
					placeholder="support@example.com"
				/>
			</FormField>
		</div>
	</SettingsSection>

	<SettingsSection
		title="Business defaults"
		description="What the onboarding wizard offers first. Each business keeps its own copy, so changing these never rewrites a business that already exists."
		icon={Globe}
		dirty={defaultsDirty}
		saving={defaultsSaving}
		saved={defaultsSaved}
		onsave={saveDefaults}
		onreset={() => (defaults = { ...defaultsBase })}
	>
		<div class="set-field-grid">
			<FormField label="Default currency" htmlFor="set-currency">
				<SelectField
					id="set-currency"
					bind:value={defaults.default_currency}
					options={CURRENCIES}
				/>
			</FormField>
			<FormField
				label="Default timezone"
				htmlFor="set-tz"
				hint="Also decides when “today” rolls over for platform-wide order and revenue totals."
			>
				<SelectField id="set-tz" bind:value={defaults.timezone} options={TIMEZONES} />
			</FormField>
			<FormField label="Default language" htmlFor="set-locale">
				<SelectField id="set-locale" bind:value={defaults.default_locale} options={LOCALES} />
			</FormField>
		</div>
	</SettingsSection>

	<SettingsSection
		title="Platform behaviour"
		description="Runtime switches. Maintenance mode is the one with teeth — it takes every storefront offline at once."
		icon={SlidersHorizontal}
		dirty={behaviourDirty}
		saving={behaviourSaving}
		saved={behaviourSaved}
		onsave={saveBehaviour}
		onreset={() => (behaviour = { ...behaviourBase })}
	>
		<Switch
			bind:checked={behaviour.allow_self_serve}
			label="Allow self-serve signup"
			hint="Lets a business create its own account without you onboarding it."
		/>
		<Switch
			bind:checked={behaviour.maintenance_mode}
			label="Maintenance mode"
			hint="Hides every storefront while you make platform changes. Orders already placed are unaffected."
		/>

		{#if behaviour.maintenance_mode && !behaviourBase.maintenance_mode}
			<div class="alert alert-warn" style="margin:0;">
				<span>
					Saving this takes every storefront offline until you turn it back off. Customers see a
					maintenance notice instead of the menu.
				</span>
			</div>
		{/if}
	</SettingsSection>

	<SettingsSection
		title="Environment"
		description="Read from the API's own environment. Shown here because an address that does not match what you expect explains most “the link does not work” reports."
	>
		{#snippet footer()}
			<span class="set-env-note">
				Change these with the API's environment variables, then restart it.
			</span>
		{/snippet}

		<dl class="dl">
			<div><dt>Base domain</dt><dd class="mono">{settings.platform.base_domain}</dd></div>
			<div>
				<dt>Frontend port</dt>
				<dd class="mono">{settings.platform.frontend_port ?? '—'}</dd>
			</div>
			<div><dt>Environment</dt><dd>{settings.app_env || '—'}</dd></div>
			<div><dt>Default plan</dt><dd>{settings.platform.default_plan || '—'}</dd></div>
		</dl>
	</SettingsSection>
{/if}

<style>
	.set-field-grid {
		display: grid;
		gap: 1.1rem;
		grid-template-columns: repeat(2, minmax(0, 1fr));
	}

	@media (max-width: 720px) {
		.set-field-grid {
			grid-template-columns: 1fr;
		}
	}

	.set-env-note {
		font-size: 0.76rem;
		color: var(--text-3);
	}
</style>
