<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import { beforeNavigate } from '$app/navigation';
	import {
		checkSlugAvailable,
		createTenant,
		fetchPlans,
		fetchSettings,
		fetchTenantTypes,
		fetchThemePresets
	} from '$lib/admin/api';
	import {
		clearOnboardDraft,
		clearOnboardSuccess,
		defaultDraft,
		loadOnboardDraft,
		saveOnboardDraft,
		saveOnboardSuccess
	} from '$lib/admin/onboardStore';
	import { joinTenantSetupUrl, rewriteFrontendPort, slugify } from '$lib/admin/format';
	import type { CreatedTenant, PlanOption, TenantType } from '$lib/admin/types';
	import type { ThemePreset } from '$lib/brandTheme';
	import BrandPicker from '$lib/components/admin/BrandPicker.svelte';
	import Building2 from '@lucide/svelte/icons/building-2';
	import CircleCheck from '@lucide/svelte/icons/circle-check';
	import Palette from '@lucide/svelte/icons/palette';
	import Rocket from '@lucide/svelte/icons/rocket';
	import Store from '@lucide/svelte/icons/store';
	import StatusBadge from '$lib/components/admin/StatusBadge.svelte';
	import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
	import UserRound from '@lucide/svelte/icons/user-round';
	import CredentialCard from '$lib/components/admin/CredentialCard.svelte';
	import FormField from '$lib/components/admin/FormField.svelte';
	import OnboardLayout from '$lib/components/admin/OnboardLayout.svelte';
	import PlanPicker from '$lib/components/admin/PlanPicker.svelte';
	import SelectField from '$lib/components/admin/SelectField.svelte';
	import SlugField from '$lib/components/admin/SlugField.svelte';
	import TextArea from '$lib/components/admin/TextArea.svelte';
	import TextInput from '$lib/components/admin/TextInput.svelte';
	import { toast } from '$lib/components/admin/toast';

	/* ------------------------------------------------------------------
	 * Six sections, in the order the Super Admin works through them.
	 * Menu / products / staff / QR / homepage are deliberately NOT asked for
	 * here — the tenant admin completes those in their own setup wizard.
	 * ------------------------------------------------------------------ */
	const steps = [
		{ id: 'org', label: 'Organization', description: 'Name, type, subdomain' },
		{ id: 'admin', label: 'Owner / Admin', description: 'Who signs in first' },
		{ id: 'sub', label: 'Subscription', description: 'Plan and trial' },
		{ id: 'brand', label: 'Branding', description: 'Colours, logo, theme' },
		{ id: 'store', label: 'Storefront', description: 'Locale and status' },
		{ id: 'review', label: 'Review', description: 'Create organization' }
	];

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

	const LANGUAGES = [
		{ value: 'en', label: 'English' },
		{ value: 'hi', label: 'हिन्दी (Hindi)' },
		{ value: 'ar', label: 'العربية (Arabic)' },
		{ value: 'ne', label: 'नेपाली (Nepali)' },
		{ value: 'zh', label: '中文 (Chinese)' }
	];

	type SlugStatus = 'idle' | 'checking' | 'available' | 'taken' | 'reserved' | 'invalid';
	let slugStatus = $state<SlugStatus>('idle');
	let slugTimer: ReturnType<typeof setTimeout> | undefined;

	let step = $state(0);
	let presets = $state<ThemePreset[]>([]);
	let types = $state<TenantType[]>([]);
	let plans = $state<PlanOption[]>([]);
	let defaultPlan = $state('');
	let baseDomain = $state('localhost');
	let optionsLoading = $state(true);
	let submitting = $state(false);
	let error = $state('');
	let created = $state<CreatedTenant | null>(null);
	let dirty = $state(false);

	let org = $state(defaultDraft().org);
	let admin = $state(defaultDraft().admin);
	let plan = $state(defaultDraft().plan);
	let brand = $state(defaultDraft().brand);
	let store = $state(defaultDraft().store);
	let errors = $state<Record<string, string>>({});
	let touched = $state<Record<string, boolean>>({});

	const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
	const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
	const HEX_RE = /^#[0-9a-fA-F]{6}$/;
	const TRIAL_DAYS = 14;

	/* ---------- settings-driven options ---------- */
	onMount(async () => {
		const draft = loadOnboardDraft();
		if (draft) {
			org = draft.org;
			admin = draft.admin;
			brand = draft.brand;
			store = draft.store;
			plan = draft.plan;
			step = Math.min(draft.step, steps.length - 1);
			dirty = true;
		}
		try {
			const [loadedTypes, loadedPresets, loadedPlans, settings] = await Promise.all([
				fetchTenantTypes(),
				fetchThemePresets(),
				fetchPlans(),
				fetchSettings()
			]);
			types = loadedTypes.filter((t) => t.active);
			presets = loadedPresets;
			plans = loadedPlans;
			defaultPlan = settings.platform.default_plan?.toUpperCase() ?? '';
			baseDomain = settings.platform.base_domain || 'localhost';

			if (!types.some((t) => t.code === org.business_type) && types[0]) {
				org.business_type = types[0].code;
			}
			if (!brand.preset_id && presets[0]) brand.preset_id = presets[0].id;
			if (!plans.some((p) => p.code === plan)) {
				plan = plans.find((p) => p.code === defaultPlan)?.code ?? plans[0]?.code ?? '';
			}
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to load onboarding options';
		} finally {
			optionsLoading = false;
		}
	});

	$effect(() => {
		org;
		admin;
		brand;
		store;
		plan;
		step;
		if (dirty && !created) saveOnboardDraft({ org, admin, brand, store, plan, step });
	});

	/* ---------- realtime slug availability ---------- */
	$effect(() => {
		const slug = org.slug.trim().toLowerCase();
		clearTimeout(slugTimer);
		if (!slug) {
			slugStatus = 'idle';
			return;
		}
		if (!SLUG_RE.test(slug)) {
			slugStatus = 'invalid';
			return;
		}
		slugStatus = 'checking';
		slugTimer = setTimeout(async () => {
			try {
				const r = await checkSlugAvailable(slug);
				if (r.available) slugStatus = 'available';
				else if (r.reason === 'slug_reserved') slugStatus = 'reserved';
				else if (r.reason === 'invalid_slug') slugStatus = 'invalid';
				else slugStatus = 'taken';
			} catch {
				slugStatus = 'idle';
			}
		}, 350);
		return () => clearTimeout(slugTimer);
	});

	onMount(() => {
		const handler = (e: BeforeUnloadEvent) => {
			if (dirty && !created) {
				e.preventDefault();
				e.returnValue = '';
			}
		};
		window.addEventListener('beforeunload', handler);
		return () => window.removeEventListener('beforeunload', handler);
	});

	beforeNavigate((nav) => {
		if (dirty && !created && step < steps.length) {
			if (!confirm('You have unsaved onboarding data. Leave this page?')) nav.cancel();
		}
	});

	/* ---------- validation ---------- */
	function validateField(key: string): string {
		switch (key) {
			case 'name':
				return org.name.trim() ? '' : 'Organization name is required';
			case 'business_type':
				return org.business_type ? '' : 'Choose a business type';
			case 'slug': {
				const slug = org.slug.trim().toLowerCase();
				if (!slug) return 'Subdomain slug is required';
				if (!SLUG_RE.test(slug)) return 'Use lowercase letters, numbers and hyphens';
				if (slugStatus === 'taken') return 'This slug is already in use';
				if (slugStatus === 'reserved') return 'This slug is reserved by the platform';
				if (slugStatus === 'checking') return 'Waiting for availability check…';
				if (slugStatus !== 'available') return 'This slug is not available';
				return '';
			}
			case 'email':
				if (!org.email.trim()) return '';
				return EMAIL_RE.test(org.email.trim()) ? '' : 'Enter a valid email address';
			case 'phone':
				if (!org.phone.trim()) return '';
				return /^[+\d][\d\s()-]{5,19}$/.test(org.phone.trim())
					? ''
					: 'Enter a valid phone number';
			case 'admin_name':
				return admin.admin_name.trim() ? '' : 'Administrator name is required';
			case 'admin_email': {
				const v = admin.admin_email.trim();
				if (!v) return 'Administrator email is required';
				return EMAIL_RE.test(v) ? '' : 'Enter a valid email address';
			}
			case 'admin_phone':
				if (!admin.admin_phone.trim()) return '';
				return /^[+\d][\d\s()-]{5,19}$/.test(admin.admin_phone.trim())
					? ''
					: 'Enter a valid phone number';
			case 'plan':
				return plan ? '' : 'Choose a plan';
			case 'primary':
				// Blank means "use the selected preset's colour" — launch() omits
				// empty overrides so the preset tokens apply. Requiring a literal
				// hex here dead-ended the wizard, because BrandPicker shows the
				// inherited colour while leaving these fields empty.
				if (!brand.primary.trim()) return '';
				return HEX_RE.test(brand.primary.trim()) ? '' : 'Enter a 6-digit hex colour';
			case 'secondary':
				if (!brand.secondary.trim()) return '';
				return HEX_RE.test(brand.secondary.trim()) ? '' : 'Enter a 6-digit hex colour';
			case 'logo_url':
			case 'favicon_url':
				return isUrl(org.logo_url) || isUrl(brand.logo_url) || isUrl(brand.favicon_url)
					? ''
					: 'Enter a valid http(s) URL';
			case 'store_name':
				return store.store_name.trim() ? '' : 'Store name is required';
			case 'short_description':
				if (!store.short_description.trim()) return '';
				return store.short_description.length > 160
					? 'Keep the description under 160 characters'
					: '';
			case 'currency':
				return store.currency ? '' : 'Choose a currency';
			case 'timezone':
				return store.timezone ? '' : 'Choose a timezone';
			case 'language':
				return store.language ? '' : 'Choose a language';
			default:
				return '';
		}
	}

	function isUrl(v: string | undefined): boolean {
		if (!v || !v.trim()) return true;
		try {
			const u = new URL(v.trim());
			return u.protocol === 'http:' || u.protocol === 'https:';
		} catch {
			return false;
		}
	}

	const STEP_FIELDS: Record<number, string[]> = {
		0: ['name', 'business_type', 'slug', 'phone', 'email', 'logo_url'],
		1: ['admin_name', 'admin_email', 'admin_phone'],
		2: ['plan'],
		3: ['primary', 'secondary', 'logo_url', 'favicon_url'],
		4: ['store_name', 'short_description', 'currency', 'timezone', 'language'],
		5: []
	};

	function validateStep(i: number, force = false): boolean {
		const next = { ...errors };
		for (const key of STEP_FIELDS[i] ?? []) {
			if (!force && !touched[key]) continue;
			const msg = validateField(key);
			if (msg) next[key] = msg;
			else delete next[key];
		}
		errors = next;
		return (STEP_FIELDS[i] ?? []).every((k) => !validateField(k));
	}

	function onBlurField(key: string) {
		dirty = true;
		touched[key] = true;
		validateStep(step);
	}

	$effect(() => {
		org.name;
		org.business_type;
		org.slug;
		org.phone;
		org.email;
		org.logo_url;
		admin.admin_name;
		admin.admin_email;
		admin.admin_phone;
		brand.primary;
		brand.secondary;
		brand.logo_url;
		brand.favicon_url;
		store.store_name;
		store.short_description;
		store.currency;
		store.timezone;
		store.language;
		slugStatus;

		if (!dirty || created) return;
		untrack(() => validateStep(step));
	});

	const stepValid = $derived((STEP_FIELDS[step] ?? []).every((k) => !validateField(k)));

	/* ---------- navigation ---------- */
	function autoSlug() {
		org.slug = slugify(org.name);
		if (!store.store_name.trim()) store.store_name = org.name.trim();
	}

	function goBack() {
		if (step > 0) {
			step -= 1;
			errors = {};
		}
	}

	function goNext() {
		for (const k of STEP_FIELDS[step] ?? []) touched[k] = true;
		if (!validateStep(step, true)) {
			toast.error('Fix the highlighted fields');
			return;
		}
		errors = {};
		if (step < steps.length - 1) step += 1;
	}

	function jumpTo(i: number) {
		if (created) return;
		if (i <= step) {
			step = i;
			errors = {};
		}
	}

	async function launch() {
		for (let i = 0; i < steps.length - 1; i++) {
			for (const k of STEP_FIELDS[i]) touched[k] = true;
			if (!validateStep(i, true)) {
				step = i;
				toast.error('Fix the highlighted fields before creating');
				return;
			}
		}

		submitting = true;
		error = '';
		try {
			const primary = brand.primary.trim();
			const secondary = brand.secondary.trim();
			const overrides: { accent?: string; accent2?: string } = {};
			if (primary) overrides.accent = primary;
			if (secondary) overrides.accent2 = secondary;

			created = await createTenant({
				name: store.store_name.trim() || org.name.trim(),
				slug: org.slug.trim().toLowerCase(),
				business_type: org.business_type,
				owner_name: admin.admin_name.trim(),
				phone: org.phone.trim(),
				email: org.email.trim() || admin.admin_email.trim(),
				address: org.address.trim(),
				plan,
				theme_preset_id: brand.preset_id,
				theme_color_mode: brand.color_mode,
				theme_overrides: overrides,
				admin_name: admin.admin_name.trim(),
				admin_email: admin.admin_email.trim(),
				admin_phone: admin.admin_phone.trim(),
				logo_url: (brand.logo_url || org.logo_url).trim(),
				favicon_url: brand.favicon_url.trim(),
				short_description: store.short_description.trim(),
				currency: store.currency,
				timezone: store.timezone,
				language: store.language,
				store_status: store.store_status,
				store_name: store.store_name.trim()
			});
			saveOnboardSuccess(created);
			clearOnboardDraft();
			dirty = false;
			toast.success('Organization created');
		} catch (err) {
			error = err instanceof Error ? err.message : 'Could not create the organization';
			toast.error(error);
		} finally {
			submitting = false;
		}
	}

	function createAnother() {
		clearOnboardSuccess();
		created = null;
		step = 0;
		org = defaultDraft().org;
		admin = defaultDraft().admin;
		brand = defaultDraft().brand;
		store = defaultDraft().store;
		plan = plans.find((p) => p.code === defaultPlan)?.code ?? plans[0]?.code ?? '';
		errors = {};
		touched = {};
		slugStatus = 'idle';
		dirty = false;
	}

	/* ---------- derived ---------- */
	const selectedPreset = $derived(presets.find((p) => p.id === brand.preset_id));
	const selectedPlan = $derived(plans.find((p) => p.code === plan));
	const primary = $derived(brand.primary.trim() || selectedPreset?.tokens.accent || '#4f46e5');
	const secondary = $derived(
		brand.secondary.trim() || selectedPreset?.tokens.accent2 || selectedPreset?.tokens.accent || '#1d3557'
	);
	const storefrontUrl = $derived(`http://${org.slug || 'your-slug'}.${baseDomain}:5173`);
	const loginUrl = $derived(`${storefrontUrl.replace(/\/$/, '')}/login`);
	const typeLabel = $derived(types.find((t) => t.code === org.business_type)?.label ?? org.business_type);
	const isTrial = $derived(plan === 'TRIAL');
	const subStatus = $derived(isTrial ? 'TRIAL' : 'ACTIVE');
</script>

{#if created}
	{@const tenantUrl = rewriteFrontendPort(created.tenant_url)}
	{@const setupUrl = joinTenantSetupUrl(created.tenant_url, created.setup_path)}
	<div class="max-w-2xl mx-auto fade-in">
		<div class="panel" style="margin-bottom:0.85rem;">
			<h2 class="panel-h" style="font-size:1.05rem;margin:0 0 0.3rem;">
				<span style="display:flex;align-items:center;gap:0.5rem;">
					<CircleCheck size={18} strokeWidth={2} style="color:var(--success);" />
					Organization created
				</span>
			</h2>
			<p class="muted" style="margin:0;font-size:0.85rem;">
				Share the setup link with the tenant administrator. They complete their own setup wizard —
				business details, menu, storefront, then QR.
			</p>
		</div>

		<CredentialCard
			tenantName={created.tenant.name}
			slug={created.tenant.slug}
			adminEmail={created.admin_email}
			{setupUrl}
			loginUrl={rewriteFrontendPort(created.login_url)}
			storefrontUrl={tenantUrl}
			emailSent={created.email_sent}
			emailError={created.email_error || ''}
			setupStatus="PENDING"
		/>

		<div style="display:flex;flex-wrap:wrap;gap:0.5rem;margin-top:0.85rem;">
			<a class="btn btn-primary" href={`/superadmin/tenants/${created.tenant.id}`}>Open tenant</a>
			<button type="button" class="btn btn-ghost" onclick={createAnother}>Create another</button>
			<a class="btn btn-ghost" href="/superadmin/tenants">All tenants</a>
		</div>
	</div>
{:else}
	{#if error}
		<div class="alert alert-danger" style="margin-bottom:0.85rem;">
			<TriangleAlert size={16} strokeWidth={1.9} />
			<span>{error}</span>
		</div>
	{/if}

	<OnboardLayout {steps} current={step} onStepSelect={jumpTo}>
		{#snippet form()}
			{#if optionsLoading}
				<div style="display:flex;flex-direction:column;gap:0.9rem;">
					{#each [1, 2, 3, 4] as _, i (i)}
						<div class="skeleton" style="height:2.5rem;"></div>
					{/each}
				</div>

			<!-- 1. ORGANIZATION -->
			{:else if step === 0}
				<h3 class="panel-h">
					<span style="display:flex;align-items:center;gap:0.5rem;">
						<Building2 size={16} strokeWidth={1.9} />
						Organization
					</span>
				</h3>
				<p class="panel-note">The business entity and the subdomain its shop will live on.</p>

				<div style="display:flex;flex-direction:column;gap:0.9rem;">
					<FormField label="Organization / Business name" htmlFor="org-name" required error={errors.name}>
						<TextInput
							id="org-name"
							bind:value={org.name}
							placeholder="Momo Magic"
							onblur={() => {
								if (org.name.trim() && !org.slug) autoSlug();
								onBlurField('name');
							}}
						/>
					</FormField>

					<FormField
						label="Business type"
						htmlFor="org-type"
						required
						error={errors.business_type}
						hint={types.length === 0 ? 'No active business types configured.' : undefined}
					>
						<SelectField
							id="org-type"
							bind:value={org.business_type}
							options={types.map((t) => ({ value: t.code, label: t.label }))}
						/>
					</FormField>

					<SlugField
						bind:value={org.slug}
						{baseDomain}
						status={slugStatus}
						error={errors.slug ?? ''}
					/>

					<FormField
						label="Logo"
						htmlFor="org-logo"
						error={errors.logo_url}
						hint="Optional. Paste an image URL — the tenant can upload a file later."
					>
						<TextInput id="org-logo" type="url" bind:value={org.logo_url} placeholder="https://…" />
					</FormField>

					<div style="display:grid;gap:0.9rem;grid-template-columns:repeat(auto-fit,minmax(11rem,1fr));">
						<FormField label="Phone" htmlFor="org-phone" error={errors.phone}>
							<TextInput
								id="org-phone"
								type="tel"
								bind:value={org.phone}
								placeholder="9876543210"
								onblur={() => onBlurField('phone')}
							/>
						</FormField>
						<FormField label="Email" htmlFor="org-email" error={errors.email}>
							<TextInput
								id="org-email"
								type="email"
								bind:value={org.email}
								placeholder="owner@example.com"
								onblur={() => onBlurField('email')}
							/>
						</FormField>
					</div>

					<FormField label="Address" htmlFor="org-address">
						<TextArea id="org-address" bind:value={org.address} rows={2} />
					</FormField>
				</div>

			<!-- 2. OWNER / ADMIN -->
			{:else if step === 1}
				<h3 class="panel-h">
					<span style="display:flex;align-items:center;gap:0.5rem;">
						<UserRound size={16} strokeWidth={1.9} />
						Owner / Admin
					</span>
				</h3>
				<p class="panel-note">
					This person signs in at <strong>{loginUrl}</strong> and receives a one-time setup link to
					choose a password. No password is ever stored in plain text.
				</p>

				<div style="display:flex;flex-direction:column;gap:0.9rem;">
					<FormField label="Admin name" htmlFor="adm-name" required error={errors.admin_name}>
						<TextInput
							id="adm-name"
							bind:value={admin.admin_name}
							placeholder="Rahul Sharma"
							autocomplete="off"
							onblur={() => onBlurField('admin_name')}
						/>
					</FormField>

					<FormField label="Admin email" htmlFor="adm-email" required error={errors.admin_email}>
						<TextInput
							id="adm-email"
							type="email"
							bind:value={admin.admin_email}
							placeholder="rahul@example.com"
							autocomplete="off"
							onblur={() => onBlurField('admin_email')}
						/>
					</FormField>

					<FormField label="Admin phone" htmlFor="adm-phone" error={errors.admin_phone}>
						<TextInput
							id="adm-phone"
							type="tel"
							bind:value={admin.admin_phone}
							placeholder="9876543210"
							onblur={() => onBlurField('admin_phone')}
						/>
					</FormField>

					<FormField label="Role" htmlFor="adm-role" hint="Fixed during onboarding.">
						<input id="adm-role" class="input" value="Tenant Admin" disabled />
					</FormField>
				</div>

			<!-- 3. SUBSCRIPTION -->
			{:else if step === 2}
				<h3 class="panel-h">
					<span style="display:flex;align-items:center;gap:0.5rem;">
						<Rocket size={16} strokeWidth={1.9} />
						Subscription
					</span>
				</h3>
				<p class="panel-note">
					Billing isn't charged yet — this records which plan the tenant is provisioned on.
				</p>

				<PlanPicker {plans} bind:value={plan} defaultCode={defaultPlan} />

				<dl class="dl" style="margin-top:1rem;max-width:26rem;">
					<div>
						<dt>Trial period</dt>
						<dd>{isTrial ? `${TRIAL_DAYS} days` : '—'}</dd>
					</div>
					<div>
						<dt>Subscription status</dt>
						<dd><StatusBadge status={subStatus} /></dd>
					</div>
					<div>
						<dt>Renews</dt>
						<dd>{isTrial ? `${TRIAL_DAYS} days from creation` : 'On billing'}</dd>
					</div>
				</dl>

			<!-- 4. BRANDING -->
			{:else if step === 3}
				<h3 class="panel-h">
					<span style="display:flex;align-items:center;gap:0.5rem;">
						<Palette size={16} strokeWidth={1.9} />
						Branding
					</span>
				</h3>
				<p class="panel-note">
					Logo, both brand colours, and the theme mode. Everything else is configured by the tenant
					admin later.
				</p>

				<BrandPicker
					{presets}
					bind:presetId={brand.preset_id}
					bind:colorMode={brand.color_mode}
					bind:accent={brand.primary}
					bind:accent2={brand.secondary}
					accentError={errors.primary ?? ''}
					accent2Error={errors.secondary ?? ''}
				/>

				<div style="display:grid;gap:0.9rem;grid-template-columns:repeat(auto-fit,minmax(13rem,1fr));margin-top:1.1rem;">
					<FormField label="Logo" htmlFor="brand-logo" error={errors.logo_url}>
						<TextInput
							id="brand-logo"
							type="url"
							bind:value={brand.logo_url}
							placeholder="https://…"
							onblur={() => onBlurField('logo_url')}
						/>
					</FormField>
					<FormField label="Favicon" htmlFor="brand-favicon" error={errors.favicon_url}>
						<TextInput
							id="brand-favicon"
							type="url"
							bind:value={brand.favicon_url}
							placeholder="https://…"
							onblur={() => onBlurField('favicon_url')}
						/>
					</FormField>
				</div>

			<!-- 5. STOREFRONT DEFAULTS -->
			{:else if step === 4}
				<h3 class="panel-h">
					<span style="display:flex;align-items:center;gap:0.5rem;">
						<Store size={16} strokeWidth={1.9} />
						Storefront defaults
					</span>
				</h3>
				<p class="panel-note">Starting values. The tenant admin can change any of them later.</p>

				<div style="display:flex;flex-direction:column;gap:0.9rem;">
					<FormField label="Store name" htmlFor="st-name" required error={errors.store_name}>
						<TextInput
							id="st-name"
							bind:value={store.store_name}
							placeholder={org.name || 'Momo Magic'}
							onblur={() => onBlurField('store_name')}
						/>
					</FormField>

					<FormField
						label="Short description"
						htmlFor="st-desc"
						error={errors.short_description}
						hint={`${store.short_description.length}/160 — shown under the store name.`}
					>
						<TextArea
							id="st-desc"
							bind:value={store.short_description}
							rows={2}
							placeholder="Fast, fresh momo made to order."
						/>
					</FormField>

					<div style="display:grid;gap:0.9rem;grid-template-columns:repeat(auto-fit,minmax(10rem,1fr));">
						<FormField label="Currency" htmlFor="st-currency" required error={errors.currency}>
							<SelectField id="st-currency" bind:value={store.currency} options={CURRENCIES} />
						</FormField>
						<FormField label="Timezone" htmlFor="st-tz" required error={errors.timezone}>
							<SelectField id="st-tz" bind:value={store.timezone} options={TIMEZONES} />
						</FormField>
						<FormField label="Language" htmlFor="st-lang" required error={errors.language}>
							<SelectField id="st-lang" bind:value={store.language} options={LANGUAGES} />
						</FormField>
					</div>

					<FormField label="Store status" htmlFor="st-status" hint="Closed shops hide the menu from customers.">
						<div class="mode-seg" id="st-status" role="radiogroup" aria-label="Store status">
							{#each [{ id: 'OPEN', label: 'Open' }, { id: 'CLOSED', label: 'Closed' }] as o (o.id)}
								<button
									type="button"
									class={store.store_status === o.id ? 'active' : ''}
									role="radio"
									aria-checked={store.store_status === o.id}
									onclick={() => (store.store_status = o.id as 'OPEN' | 'CLOSED')}
								>
									{o.label}
								</button>
							{/each}
						</div>
					</FormField>
				</div>

			<!-- 6. REVIEW -->
			{:else}
				<h3 class="panel-h">
					<span style="display:flex;align-items:center;gap:0.5rem;">
						<CircleCheck size={16} strokeWidth={1.9} />
						Review &amp; create
					</span>
				</h3>
				<p class="panel-note">
					Organization, subscription, and branding are created in one transaction. Menu, products,
					staff, and QR are left to the tenant's own setup wizard.
				</p>

				<div class="review-grid">
					<section class="review-block">
						<h4>Organization</h4>
						<dl class="dl">
							<div><dt>Name</dt><dd>{org.name || '—'}</dd></div>
							<div><dt>Type</dt><dd>{typeLabel || '—'}</dd></div>
							<div><dt>Subdomain</dt><dd class="mono">{org.slug || '—'}</dd></div>
							<div><dt>Phone</dt><dd>{org.phone || '—'}</dd></div>
							<div><dt>Email</dt><dd>{org.email || '—'}</dd></div>
							{#if org.address}<div><dt>Address</dt><dd>{org.address}</dd></div>{/if}
						</dl>
						<button type="button" class="btn btn-quiet btn-sm" onclick={() => (step = 0)}>Edit</button>
					</section>

					<section class="review-block">
						<h4>Admin</h4>
						<dl class="dl">
							<div><dt>Name</dt><dd>{admin.admin_name || '—'}</dd></div>
							<div><dt>Email</dt><dd>{admin.admin_email || '—'}</dd></div>
							<div><dt>Phone</dt><dd>{admin.admin_phone || '—'}</dd></div>
							<div><dt>Role</dt><dd>Tenant Admin</dd></div>
						</dl>
						<button type="button" class="btn btn-quiet btn-sm" onclick={() => (step = 1)}>Edit</button>
					</section>

					<section class="review-block">
						<h4>Plan</h4>
						<dl class="dl">
							<div><dt>Plan</dt><dd>{selectedPlan?.label ?? plan ?? '—'}</dd></div>
							<div>
								<dt>Price</dt>
								<dd>
									{selectedPlan
										? selectedPlan.price === 0
											? 'Free'
											: `${selectedPlan.price.toLocaleString('en-IN')}`
										: '—'}
								</dd>
							</div>
							<div><dt>Trial</dt><dd>{isTrial ? `${TRIAL_DAYS} days` : '—'}</dd></div>
							<div><dt>Status</dt><dd><StatusBadge status={subStatus} /></dd></div>
						</dl>
						<button type="button" class="btn btn-quiet btn-sm" onclick={() => (step = 2)}>Edit</button>
					</section>

					<section class="review-block">
						<h4>Brand</h4>
						<div class="swatch-row">
							<span class="swatch" style:background={primary}></span>
							<span class="mono">{primary.toUpperCase()}</span>
							<span class="muted" style="font-size:0.7rem;">primary</span>
						</div>
						<div class="swatch-row">
							<span class="swatch" style:background={secondary}></span>
							<span class="mono">{secondary.toUpperCase()}</span>
							<span class="muted" style="font-size:0.7rem;">secondary</span>
						</div>
						<dl class="dl" style="margin-top:0.35rem;">
							<div><dt>Preset</dt><dd>{selectedPreset?.name ?? brand.preset_id}</dd></div>
							<div><dt>Mode</dt><dd>{brand.color_mode}</dd></div>
						</dl>
						<button type="button" class="btn btn-quiet btn-sm" onclick={() => (step = 3)}>Edit</button>
					</section>

					<section class="review-block">
						<h4>Storefront</h4>
						<dl class="dl">
							<div><dt>Name</dt><dd>{store.store_name || '—'}</dd></div>
							<div><dt>Currency</dt><dd>{store.currency}</dd></div>
							<div><dt>Timezone</dt><dd>{store.timezone}</dd></div>
							<div><dt>Language</dt><dd>{store.language}</dd></div>
							<div><dt>Status</dt><dd>{store.store_status}</dd></div>
						</dl>
						<button type="button" class="btn btn-quiet btn-sm" onclick={() => (step = 4)}>Edit</button>
					</section>
				</div>

				<!-- Live preview lives here, in review -->
				<div class="review-preview">
					<h4 class="review-preview-h">Live preview</h4>
					<div class="prev-shop" style:--a={primary} style:--a2={secondary}>
						<div class="prev-bar">
							<span class="prev-name">{store.store_name || org.name || 'Your shop'}</span>
							<span class="prev-nav">Menu</span>
						</div>
						<div class="prev-body">
							{#if store.short_description}
								<p class="prev-desc">{store.short_description}</p>
							{/if}
							<div class="prev-row">
								<i></i><i></i><i></i>
							</div>
							<div class="prev-cta" style:background="linear-gradient(90deg, var(--a), var(--a2))">
								Order now
							</div>
						</div>
					</div>

					<dl class="prev-meta">
						<div><dt>Storefront</dt><dd class="mono">{storefrontUrl}</dd></div>
						<div><dt>Login</dt><dd class="mono">{loginUrl}</dd></div>
						<div>
							<dt>Slug</dt>
							<dd>
								{#if slugStatus === 'available'}
									<span style="color:var(--success);font-weight:600;">Available</span>
								{:else if slugStatus === 'checking'}
									<span class="muted">Checking…</span>
								{:else if slugStatus === 'taken' || slugStatus === 'reserved'}
									<span style="color:var(--danger);font-weight:600;">Unavailable</span>
								{:else if slugStatus === 'invalid'}
									<span style="color:var(--danger);font-weight:600;">Invalid</span>
								{:else}
									<span class="muted">Not set</span>
								{/if}
							</dd>
						</div>
					</dl>
				</div>

				<div class="handoff">
					<strong>After creation</strong>
					<ol>
						<li>Organization, subscription, and admin user are created in one transaction.</li>
						<li>A one-time password setup link is generated for the admin.</li>
						<li>
							The tenant admin runs their own wizard: Business → Menu → Branding → Storefront → QR
							→ Launch.
						</li>
					</ol>
				</div>
			{/if}
		{/snippet}

		{#snippet footer()}
			<span class="wizard-progress">
				Step {step + 1} of {steps.length} · {steps[step].label}
			</span>
			<div class="wizard-foot-actions">
				<button type="button" class="btn btn-ghost" disabled={step === 0 || submitting} onclick={goBack}>
					Back
				</button>
				{#if step < steps.length - 1}
					<button
						type="button"
						class="btn btn-primary"
						disabled={optionsLoading || !stepValid}
						onclick={goNext}
					>
						Continue
					</button>
				{:else}
					<button
						type="button"
						class="btn btn-primary"
						disabled={submitting || optionsLoading}
						onclick={launch}
					>
						{#if submitting}
							Creating organization…
						{:else}
							<Building2 size={15} strokeWidth={2.2} />
							Create organization
						{/if}
					</button>
				{/if}
			</div>
		{/snippet}
	</OnboardLayout>
{/if}

<style>
	.review-grid {
		display: grid;
		gap: 0.75rem;
		grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));
	}

	.review-block {
		border: 1px solid var(--border);
		border-radius: var(--radius);
		padding: 0.8rem 0.85rem;
		background: var(--surface-2);
		display: flex;
		flex-direction: column;
		gap: 0.45rem;
		align-items: flex-start;
	}

	.review-block h4 {
		margin: 0;
		font-size: 0.7rem;
		font-weight: 650;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--text-3);
	}

	.review-block .dl {
		width: 100%;
		flex: 1;
	}

	.swatch-row {
		display: flex;
		align-items: center;
		gap: 0.45rem;
		font-size: 0.78rem;
	}

	.swatch {
		width: 1.1rem;
		height: 1.1rem;
		border-radius: 5px;
		border: 1px solid var(--border);
		flex-shrink: 0;
	}

	.review-preview {
		margin-top: 1.1rem;
		padding-top: 1.1rem;
		border-top: 1px solid var(--border);
	}

	.review-preview-h {
		margin: 0 0 0.6rem;
		font-size: 0.7rem;
		font-weight: 650;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--text-3);
	}

	.prev-shop {
		border: 1px solid var(--border);
		border-radius: var(--radius);
		overflow: hidden;
		background: var(--surface-2);
		margin-bottom: 0.85rem;
	}

	.prev-bar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		padding: 0.5rem 0.65rem;
		background: linear-gradient(90deg, var(--a), var(--a2));
		color: #fff;
	}

	.prev-name {
		font-size: 0.8rem;
		font-weight: 650;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.prev-nav {
		font-size: 0.68rem;
		opacity: 0.85;
		flex-shrink: 0;
	}

	.prev-body {
		padding: 0.65rem;
	}

	.prev-desc {
		margin: 0 0 0.55rem;
		font-size: 0.76rem;
		line-height: 1.45;
		color: var(--text-2);
	}

	.prev-row {
		display: flex;
		gap: 0.35rem;
	}

	.prev-row i {
		flex: 1;
		height: 2.4rem;
		border-radius: 5px;
		background: var(--surface-3);
		border: 1px solid var(--border-subtle);
	}

	.prev-cta {
		margin-top: 0.6rem;
		height: 1.5rem;
		border-radius: 5px;
		display: grid;
		place-items: center;
		color: #fff;
		font-size: 0.72rem;
		font-weight: 650;
	}

	.prev-meta {
		margin: 0;
		display: grid;
		gap: 0.4rem;
	}

	.prev-meta > div {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 0.6rem;
	}

	.prev-meta dt {
		font-size: 0.72rem;
		color: var(--text-3);
		flex-shrink: 0;
	}

	.prev-meta dd {
		margin: 0;
		font-size: 0.76rem;
		text-align: right;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.handoff {
		margin-top: 1.1rem;
		padding: 0.8rem 0.9rem;
		border: 1px solid var(--border);
		border-radius: var(--radius);
		background: var(--surface-2);
	}

	.handoff strong {
		font-size: 0.7rem;
		font-weight: 650;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--text-3);
	}

	.handoff ol {
		margin: 0.5rem 0 0;
		padding-left: 1.1rem;
		display: grid;
		gap: 0.28rem;
	}

	.handoff li {
		font-size: 0.78rem;
		line-height: 1.45;
		color: var(--text-2);
	}
</style>
