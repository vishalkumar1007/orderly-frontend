<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import { beforeNavigate } from '$app/navigation';
	import {
		checkSlugAvailable,
		createTenant,
		fetchPlans,
		fetchSettings,
		fetchTenantTypes,
		offeredTo,
		toPlanOption
	} from '$lib/admin/api';
	import {
		CONTROL_LABELS,
		onboardingTypes,
		templateFor,
		type BusinessTypeTemplate
	} from '$lib/admin/businessTypes';
	import { consoleThemeSeed } from '$lib/admin/consoleTheme';
	import { errorLines } from '$lib/admin/errors';
	import {
		themeFromTemplate,
		clearOnboardDraft,
		clearOnboardSuccess,
		configFromTemplate,
		defaultDraft,
		loadOnboardDraft,
		saveOnboardDraft,
		saveOnboardSuccess
	} from '$lib/admin/onboardStore';
	import { joinTenantSetupUrl, rewriteFrontendPort, slugify } from '$lib/admin/format';
	import type { CreatedTenant, Plan, PlanOption, TenantType } from '$lib/admin/types';
	import { THEME_PRESETS } from '$lib/storefront/admin';
	import { api } from '$lib/api/client';
	import type { ThemePreset as ConsolePreset } from '$lib/brandTheme';
	import Building2 from '@lucide/svelte/icons/building-2';
	import CircleCheck from '@lucide/svelte/icons/circle-check';
	import ExternalLink from '@lucide/svelte/icons/external-link';
	import Palette from '@lucide/svelte/icons/palette';
	import Rocket from '@lucide/svelte/icons/rocket';
	import Shapes from '@lucide/svelte/icons/shapes';
	import SlidersHorizontal from '@lucide/svelte/icons/sliders-horizontal';
	import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
	import UserRound from '@lucide/svelte/icons/user-round';
	import StorefrontThemePicker from '$lib/components/admin/StorefrontThemePicker.svelte';
	import BusinessTypeCard from '$lib/components/admin/BusinessTypeCard.svelte';
	import CredentialCard from '$lib/components/admin/CredentialCard.svelte';
	import FormField from '$lib/components/admin/FormField.svelte';
	import OnboardLayout from '$lib/components/admin/OnboardLayout.svelte';
	import PlanPicker from '$lib/components/admin/PlanPicker.svelte';
	import SelectField from '$lib/components/admin/SelectField.svelte';
	import SlugField from '$lib/components/admin/SlugField.svelte';
	import StatusBadge from '$lib/components/admin/StatusBadge.svelte';
	import Switch from '$lib/components/admin/Switch.svelte';
	import TextArea from '$lib/components/admin/TextArea.svelte';
	import TextInput from '$lib/components/admin/TextInput.svelte';
	import { toast } from '$lib/components/admin/toast';

	/**
	 * Onboarding.
	 *
	 * Seven screens and one transaction. The order is deliberate: the business
	 * type comes first because it decides the defaults every later step starts
	 * from, and review comes last because by then there is nothing left to
	 * guess. Creation is a single call — the business, its subscription, its
	 * administrator and its configured storefront either all exist or none of
	 * them do.
	 *
	 * Nothing here ever shows or sends a password. The administrator receives a
	 * one-time link and chooses their own.
	 */

	const steps = [
		{ id: 'type', label: 'Business type', description: 'Sets every default' },
		{ id: 'business', label: 'Business details', description: 'Name and subdomain' },
		{ id: 'owner', label: 'Owner & admin', description: 'Who signs in first' },
		{ id: 'plan', label: 'Plan', description: 'Limits and trial' },
		{ id: 'theme', label: 'Storefront theme', description: 'How the shop looks' },
		{ id: 'config', label: 'Configuration', description: 'How it operates' },
		{ id: 'review', label: 'Review', description: 'Confirm and create' }
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
	let types = $state<TenantType[]>([]);
	let allPlans = $state<Plan[]>([]);
	let defaultPlan = $state('');
	let baseDomain = $state('localhost');
	let optionsLoading = $state(true);
	let submitting = $state(false);
	let failure = $state<{ title: string; detail: string } | null>(null);
	let created = $state<CreatedTenant | null>(null);
	let dirty = $state(false);

	const initial = defaultDraft();
	let type = $state(initial.type);
	let org = $state(initial.org);
	let admin = $state(initial.admin);
	let plan = $state(initial.plan);
	let theme = $state(initial.theme);
	/** The console theme catalogue, for seeding the business's own console. */
	let consolePresets = $state<ConsolePreset[]>([]);
	let config = $state(initial.config);
	let errors = $state<Record<string, string>>({});
	let touched = $state<Record<string, boolean>>({});

	const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
	const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
	const PHONE_RE = /^[+\d][\d\s()-]{5,19}$/;

	/* ---------- catalogue ---------- */

	onMount(async () => {
		const draft = loadOnboardDraft();
		if (draft) {
			type = draft.type;
			org = draft.org;
			admin = draft.admin;
			theme = draft.theme;
			config = draft.config;
			plan = draft.plan;
			step = Math.min(draft.step, steps.length - 1);
			dirty = true;
		}
		try {
			const [loadedTypes, loadedPlans, settings, presets] = await Promise.all([
				fetchTenantTypes(),
				fetchPlans(),
				fetchSettings(),
				// The console catalogue, so the look chosen below can be mapped
				// onto the theme the new owner's own console will open with.
				api<{ presets: ConsolePreset[] }>('/api/v1/admin/theme-presets').catch(() => ({
					presets: [] as ConsolePreset[]
				}))
			]);
			consolePresets = presets.presets ?? [];
			types = loadedTypes;
			allPlans = loadedPlans;
			defaultPlan = settings.platform.default_plan?.toUpperCase() ?? '';
			baseDomain = settings.platform.base_domain || 'localhost';
			if (!org.currency) org.currency = settings.general.default_currency || 'INR';
			if (!org.timezone) org.timezone = settings.general.timezone || 'Asia/Kolkata';
		} catch (err) {
			failure = errorLines(err, 'load the onboarding options');
		} finally {
			optionsLoading = false;
		}
	});

	const typeOptions = $derived(onboardingTypes(types));
	const template = $derived<BusinessTypeTemplate>(templateFor(type));
	const terms = $derived(template.terminology);

	/** Plans on offer for the chosen type, cheapest first. */
	const plans = $derived<PlanOption[]>(
		allPlans.filter((p) => p.is_active && offeredTo(p, type)).map(toPlanOption)
	);
	const selectedPlan = $derived(plans.find((p) => p.code === plan));

	/**
	 * Choosing a type resets the branding and configuration defaults.
	 *
	 * Resetting rather than merging is the point: the defaults are the type's
	 * opinion, and carrying a grocery's 45-minute pick-up window into a cafe
	 * would be worse than either default on its own. Anything already typed by
	 * hand (name, owner, subdomain) is untouched.
	 */
	function chooseType(code: string) {
		if (code === type) return;
		dirty = true;
		type = code;
		const next = templateFor(code);
		theme = {
			...themeFromTemplate(next, THEME_PRESETS),
			// Anything the operator typed by hand survives a type change.
			logo_url: theme.logo_url,
			favicon_url: theme.favicon_url
		};
		config = configFromTemplate(next);
		// A plan restricted to other business types is no longer a valid choice.
		if (plan && !plans.some((p) => p.code === plan)) plan = '';
	}

	/** Fall back to the platform default plan once the catalogue is known. */
	$effect(() => {
		if (optionsLoading || plan || plans.length === 0) return;
		untrack(() => {
			plan = plans.find((p) => p.code === defaultPlan)?.code ?? plans[0]?.code ?? '';
		});
	});

	/* ---------- draft persistence ---------- */

	$effect(() => {
		type;
		org;
		admin;
		theme;
		config;
		plan;
		step;
		if (dirty && !created) saveOnboardDraft({ type, org, admin, theme, config, plan, step });
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
		if (dirty && !created) {
			if (!confirm('This business has not been created yet. Leave and lose the draft?')) nav.cancel();
		}
	});

	/* ---------- slug availability ---------- */

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
		// Debounced: one request per pause in typing, not one per keystroke.
		slugTimer = setTimeout(async () => {
			try {
				const r = await checkSlugAvailable(slug);
				if (r.available) slugStatus = 'available';
				else if (r.reason === 'slug_reserved') slugStatus = 'reserved';
				else if (r.reason === 'invalid_slug') slugStatus = 'invalid';
				else slugStatus = 'taken';
			} catch {
				// A failed check must not read as "taken" — leave it unresolved
				// and let the create call be the authority.
				slugStatus = 'idle';
			}
		}, 350);
		return () => clearTimeout(slugTimer);
	});

	/* ---------- validation ---------- */

	function validateField(key: string): string {
		switch (key) {
			case 'type':
				return type ? '' : 'Choose the kind of business this is';
			case 'name':
				return org.name.trim() ? '' : 'Business name is required';
			case 'slug': {
				const slug = org.slug.trim().toLowerCase();
				if (!slug) return 'A subdomain is required';
				if (!SLUG_RE.test(slug)) return 'Use lowercase letters, numbers and hyphens';
				if (slugStatus === 'taken') return 'Another business already uses this subdomain';
				if (slugStatus === 'reserved') return 'This subdomain is reserved by the platform';
				if (slugStatus === 'checking') return 'Checking whether this subdomain is free…';
				if (slugStatus !== 'available') return 'This subdomain is not available';
				return '';
			}
			case 'email':
				if (!org.email.trim()) return '';
				return EMAIL_RE.test(org.email.trim()) ? '' : 'Enter a valid email address';
			case 'phone':
				if (!org.phone.trim()) return '';
				return PHONE_RE.test(org.phone.trim()) ? '' : 'Enter a valid phone number';
			case 'short_description':
				return org.short_description.length > 160
					? 'Keep the description under 160 characters'
					: '';
			case 'currency':
				return org.currency ? '' : 'Choose a currency';
			case 'timezone':
				return org.timezone ? '' : 'Choose a timezone';
			case 'language':
				return org.language ? '' : 'Choose a language';
			case 'owner_name':
				return admin.owner_name.trim() ? '' : "The owner's name is required";
			case 'admin_name':
				return admin.admin_name.trim() ? '' : "The administrator's name is required";
			case 'admin_email': {
				const v = admin.admin_email.trim();
				if (!v) return "The administrator's email is required";
				return EMAIL_RE.test(v) ? '' : 'Enter a valid email address';
			}
			case 'admin_phone':
				if (!admin.admin_phone.trim()) return '';
				return PHONE_RE.test(admin.admin_phone.trim()) ? '' : 'Enter a valid phone number';
			case 'plan':
				return plan ? '' : 'Choose a plan';
			case 'logo_url':
				return isUrl(theme.logo_url) ? '' : 'Enter a valid http(s) URL';
			case 'favicon_url':
				return isUrl(theme.favicon_url) ? '' : 'Enter a valid http(s) URL';
			case 'prep_time':
				return config.prep_time_minutes >= 1 && config.prep_time_minutes <= 240
					? ''
					: 'Choose between 1 and 240 minutes';
			case 'payment_methods':
				return config.online_payment_enabled || config.cash_enabled
					? ''
					: 'Enable at least one way for customers to pay';
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
		0: ['type'],
		1: ['name', 'slug', 'phone', 'email', 'short_description', 'currency', 'timezone', 'language'],
		2: ['owner_name', 'admin_name', 'admin_email', 'admin_phone'],
		3: ['plan'],
		4: ['logo_url', 'favicon_url'],
		5: ['prep_time', 'payment_methods'],
		6: []
	};

	function validateStep(i: number, force = false): boolean {
		const next = { ...errors };
		for (const key of STEP_FIELDS[i] ?? []) {
			// Untouched fields stay quiet until the operator leaves them or
			// tries to continue; a form that turns red as you arrive is hostile.
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
		// Re-run the current step's validation as its inputs change, so a fixed
		// field clears its error without waiting for another blur.
		type;
		org.name;
		org.slug;
		org.phone;
		org.email;
		org.short_description;
		admin.owner_name;
		admin.admin_name;
		admin.admin_email;
		admin.admin_phone;
		theme.logo_url;
		theme.favicon_url;
		config.prep_time_minutes;
		config.online_payment_enabled;
		config.cash_enabled;
		plan;
		slugStatus;

		if (!dirty || created) return;
		untrack(() => validateStep(step));
	});

	const stepValid = $derived((STEP_FIELDS[step] ?? []).every((k) => !validateField(k)));

	/* ---------- navigation ---------- */

	function autoSlug() {
		if (!org.slug.trim() && org.name.trim()) org.slug = slugify(org.name);
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
			toast.error('Fix the highlighted fields to continue');
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

	/* ---------- create ---------- */

	async function create() {
		for (let i = 0; i < steps.length - 1; i++) {
			for (const k of STEP_FIELDS[i]) touched[k] = true;
			if (!validateStep(i, true)) {
				step = i;
				toast.error('Fix the highlighted fields before creating the business');
				return;
			}
		}

		submitting = true;
		failure = null;
		try {
			created = await createTenant({
				name: org.name.trim(),
				slug: org.slug.trim().toLowerCase(),
				business_type: type,
				owner_name: admin.owner_name.trim(),
				phone: org.phone.trim(),
				email: org.email.trim() || admin.admin_email.trim(),
				address: org.address.trim(),
				plan,
				/*
				 * The chosen look is the *business's*, not just its shop window.
				 * It seeds the owner's console as well as the storefront, so the
				 * setup-password link and the first sign-in already carry the
				 * brand this operator picked. Either side can be changed
				 * afterwards — the console under Settings → Appearance, the
				 * storefront under Customize → Theme.
				 */
				...(consoleThemeSeed(theme, consolePresets) ?? {}),
				admin_name: admin.admin_name.trim(),
				admin_email: admin.admin_email.trim(),
				admin_phone: admin.admin_phone.trim(),
				logo_url: theme.logo_url.trim(),
				favicon_url: theme.favicon_url.trim(),
				short_description: org.short_description.trim(),
				currency: org.currency,
				timezone: org.timezone,
				language: org.language,
				store_status: config.ordering_enabled ? 'OPEN' : 'CLOSED',
				// The storefront template, applied in the same transaction.
				configuration: {
					...template.storefront,
					theme_preset: theme.preset,
					theme_mode: theme.mode,
					primary_color: theme.primary,
					secondary_color: theme.secondary,
					accent_color: theme.accent,
					font_family: theme.font,
					radius: theme.radius,
					button_style: theme.button,
					card_style: theme.card,
					hero_style: theme.hero,
					product_layout: theme.product_layout,
					filter_style: theme.filter_style,
					ordering_enabled: config.ordering_enabled,
					customer_login_mode: config.customer_login_mode,
					prep_time_minutes: config.prep_time_minutes,
					payments: {
						online_payment_enabled: config.online_payment_enabled,
						cash_enabled: config.cash_enabled,
						pay_at_pickup_enabled: config.payment_requirement === 'AT_PICKUP',
						default_payment_method: config.default_payment_method
					},
					workflow: {
						acceptance_mode: config.acceptance_mode,
						payment_requirement: config.payment_requirement,
						ready_notification: config.ready_notification,
						auto_complete: config.auto_complete
					}
				}
			});
			saveOnboardSuccess(created);
			clearOnboardDraft();
			dirty = false;
			toast.success(`${created.tenant.name} created`);
		} catch (err) {
			failure = errorLines(err, 'create the business');
			toast.error(failure.title);
			// A slug conflict is the one failure worth sending them back for:
			// nothing else on the form needs to change.
			if (failure.detail.toLowerCase().includes('subdomain')) {
				slugStatus = 'taken';
				step = 1;
			}
		} finally {
			submitting = false;
		}
	}

	function createAnother() {
		clearOnboardSuccess();
		const fresh = defaultDraft();
		created = null;
		step = 0;
		type = fresh.type;
		org = fresh.org;
		admin = fresh.admin;
		theme = fresh.theme;
		config = fresh.config;
		plan = plans.find((p) => p.code === defaultPlan)?.code ?? plans[0]?.code ?? '';
		errors = {};
		touched = {};
		slugStatus = 'idle';
		failure = null;
		dirty = false;
	}

	/* ---------- derived display ---------- */

	const selectedPreset = $derived(THEME_PRESETS.find((p) => p.id === theme.preset));
	const primary = $derived(theme.primary);
	const secondary = $derived(theme.secondary);
	const storefrontUrl = $derived(`http://${org.slug || 'subdomain'}.${baseDomain}:5173`);
	const loginUrl = $derived(`${storefrontUrl}/shop/login`);
	const isTrial = $derived(selectedPlan?.billingPeriod === 'trial' || plan === 'TRIAL');
	const trialDays = $derived(selectedPlan?.trialDays ?? 0);
	const subscriptionStatus = $derived(isTrial ? 'TRIAL' : 'ACTIVE');
	const shows = (control: string) => template.controls.includes(control as never);

	/** Human label for a plan's billing period. */
	function billingLabel(period: string): string {
		switch (period) {
			case 'trial':
				return 'Trial only';
			case 'monthly':
				return 'Monthly';
			case 'yearly':
				return 'Yearly';
			case 'one_time':
				return 'One-time';
			default:
				return period;
		}
	}

	/** One line describing how customers pay, for the review card. */
	function paymentSummary(): string {
		const methods: string[] = [];
		if (config.online_payment_enabled) methods.push('online');
		if (config.cash_enabled) methods.push('cash');
		if (methods.length === 0) return 'No payment method enabled';
		const when =
			config.payment_requirement === 'AT_PICKUP' ? 'at pickup' : 'before preparation';
		return `${methods.join(' or ')}, ${when}`;
	}
</script>

{#if created}
	{@const tenantUrl = rewriteFrontendPort(created.tenant_url)}
	{@const setupUrl = joinTenantSetupUrl(created.tenant_url, created.setup_path)}
	<div class="done fade-in">
		<section class="panel done-head">
			<span class="done-mark"><CircleCheck size={24} strokeWidth={2} /></span>
			<div>
				<h2>Business created successfully</h2>
				<p>
					{created.tenant.name} exists, is configured for a {template.label.toLowerCase()}, and its
					administrator can set a password with the link below. No password was ever generated or
					stored in plain text.
				</p>
			</div>
		</section>

		<section class="panel">
			<h3 class="panel-h">Summary</h3>
			<dl class="dl">
				<div><dt>Business</dt><dd>{created.tenant.name}</dd></div>
				<div><dt>Business type</dt><dd>{template.label}</dd></div>
				<div>
					<dt>Store URL</dt>
					<dd>
						<a href={tenantUrl} target="_blank" rel="noopener" class="mono">{tenantUrl}</a>
					</dd>
				</div>
				<div><dt>Administrator</dt><dd class="mono">{created.admin_email}</dd></div>
				<div><dt>Plan</dt><dd>{selectedPlan?.label ?? plan}</dd></div>
				<div>
					<dt>Status</dt>
					<dd>
						<span class="badge-cluster">
							<StatusBadge status={created.tenant.status ?? 'ACTIVE'} />
							<StatusBadge status={subscriptionStatus} dot={false} />
						</span>
					</dd>
				</div>
			</dl>
		</section>

		<CredentialCard
			tenantName={created.tenant.name}
			slug={created.tenant.slug}
			adminEmail={created.admin_email}
			{setupUrl}
			loginUrl={rewriteFrontendPort(created.login_url)}
			storefrontUrl={tenantUrl}
			plan={selectedPlan?.label ?? plan}
			emailSent={created.email_sent}
			emailError={created.email_error || ''}
			setupStatus="PENDING"
		/>

		<div class="done-actions">
			<a class="btn btn-primary" href={`/superadmin/businesses/${created.tenant.id}`}>
				Open business
			</a>
			<a class="btn btn-ghost" href={tenantUrl} target="_blank" rel="noopener">
				<ExternalLink size={14} strokeWidth={2} />
				Open store
			</a>
			<a class="btn btn-ghost" href="/superadmin/businesses">Back to businesses</a>
			<button type="button" class="btn btn-quiet" onclick={createAnother}>
				Onboard another
			</button>
		</div>
	</div>
{:else}
	{#if failure}
		<div class="alert alert-danger" style="margin-bottom:0.85rem;align-items:flex-start;">
			<TriangleAlert size={16} strokeWidth={1.9} />
			<span>
				<strong style="color:var(--text);">{failure.title}</strong>
				<span style="display:block;margin-top:0.15rem;">{failure.detail}</span>
			</span>
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

				<!-- 1. BUSINESS TYPE -->
			{:else if step === 0}
				<h3 class="panel-h">
					<span style="display:flex;align-items:center;gap:0.5rem;">
						<Shapes size={16} strokeWidth={1.9} />
						What kind of business is this?
					</span>
				</h3>
				<p class="panel-note">
					This is the one choice that configures everything else. It sets the theme, the
					storefront layout, what products and categories are called, the starting order
					workflow and how customers pay. The owner can change any of it later.
				</p>

				<div class="bt-grid" role="radiogroup" aria-label="Business type">
					{#each typeOptions as option (option.code)}
						<BusinessTypeCard
							template={option}
							selected={type === option.code}
							onselect={chooseType}
						/>
					{/each}
				</div>

				{#if errors.type}<p class="field-error" style="margin-top:0.6rem;">{errors.type}</p>{/if}

				{#if type}
					<div class="tpl-summary">
						<strong>What {template.label.toLowerCase()} sets up</strong>
						<dl class="dl">
							<div><dt>Catalogue</dt><dd>{terms.catalog}, grouped into {terms.groups.toLowerCase()}</dd></div>
							<div><dt>Storefront</dt><dd>{template.storefront.theme_preset} theme, {template.storefront.product_layout} layout</dd></div>
							<div>
								<dt>Orders</dt>
								<dd>{CONTROL_LABELS.acceptance_mode[template.workflow.acceptance_mode]}</dd>
							</div>
							<div>
								<dt>Customers</dt>
								<dd>{CONTROL_LABELS.customer_login_mode[template.behaviour.customer_login_mode]}</dd>
							</div>
						</dl>
						{#if template.starterCategories.length > 0}
							<p class="tpl-cats">
								Suggested {terms.groups.toLowerCase()}:
								{#each template.starterCategories as c, i (c)}<span class="bt-chip">{c}</span>{/each}
							</p>
						{/if}
					</div>
				{/if}

				<!-- 2. BUSINESS INFORMATION -->
			{:else if step === 1}
				<h3 class="panel-h">
					<span style="display:flex;align-items:center;gap:0.5rem;">
						<Building2 size={16} strokeWidth={1.9} />
						Business details
					</span>
				</h3>
				<p class="panel-note">
					The business itself, and the subdomain its storefront will live on. The subdomain is
					permanent — every customer link, QR code and staff bookmark is built from it.
				</p>

				<div style="display:flex;flex-direction:column;gap:0.9rem;">
					<FormField label="Business name" htmlFor="org-name" required error={errors.name}>
						<TextInput
							id="org-name"
							bind:value={org.name}
							placeholder="Momo Magic"
							onblur={() => {
								autoSlug();
								onBlurField('name');
							}}
						/>
					</FormField>

					<SlugField
						bind:value={org.slug}
						{baseDomain}
						status={slugStatus}
						error={errors.slug ?? ''}
					/>

					<div
						style="display:grid;gap:0.9rem;grid-template-columns:repeat(auto-fit,minmax(11rem,1fr));"
					>
						<FormField label="Phone" htmlFor="org-phone" error={errors.phone}>
							<TextInput
								id="org-phone"
								type="tel"
								bind:value={org.phone}
								placeholder="9876543210"
								onblur={() => onBlurField('phone')}
							/>
						</FormField>
						<FormField
							label="Business email"
							htmlFor="org-email"
							error={errors.email}
							hint="Shown to customers. Defaults to the administrator's address."
						>
							<TextInput
								id="org-email"
								type="email"
								bind:value={org.email}
								placeholder="hello@example.com"
								onblur={() => onBlurField('email')}
							/>
						</FormField>
					</div>

					<FormField label="Address" htmlFor="org-address">
						<TextArea id="org-address" bind:value={org.address} rows={2} />
					</FormField>

					<FormField
						label="Short description"
						htmlFor="org-desc"
						error={errors.short_description}
						hint={`${org.short_description.length}/160 — shown under the name on the storefront.`}
					>
						<TextArea
							id="org-desc"
							bind:value={org.short_description}
							rows={2}
							placeholder="Fast, fresh momo made to order."
						/>
					</FormField>

					<div
						style="display:grid;gap:0.9rem;grid-template-columns:repeat(auto-fit,minmax(10rem,1fr));"
					>
						<FormField label="Currency" htmlFor="org-currency" required error={errors.currency}>
							<SelectField id="org-currency" bind:value={org.currency} options={CURRENCIES} />
						</FormField>
						<FormField label="Timezone" htmlFor="org-tz" required error={errors.timezone}>
							<SelectField id="org-tz" bind:value={org.timezone} options={TIMEZONES} />
						</FormField>
						<FormField label="Language" htmlFor="org-lang" required error={errors.language}>
							<SelectField id="org-lang" bind:value={org.language} options={LANGUAGES} />
						</FormField>
					</div>
				</div>

				<!-- 3. OWNER / ADMIN -->
			{:else if step === 2}
				<h3 class="panel-h">
					<span style="display:flex;align-items:center;gap:0.5rem;">
						<UserRound size={16} strokeWidth={1.9} />
						Owner and administrator
					</span>
				</h3>
				<p class="panel-note">
					The owner is who the business belongs to. The administrator is the first person who can
					sign in at <strong class="mono">{loginUrl}</strong>; they receive a one-time link and
					choose their own password. No password is ever created, shown or stored here.
				</p>

				<div style="display:flex;flex-direction:column;gap:0.9rem;">
					<FormField label="Owner name" htmlFor="own-name" required error={errors.owner_name}>
						<TextInput
							id="own-name"
							bind:value={admin.owner_name}
							placeholder="Rahul Sharma"
							onblur={() => {
								// Most small businesses are run by their owner, so the
								// administrator defaults to the same person rather than
								// asking the same question twice.
								if (!admin.admin_name.trim()) admin.admin_name = admin.owner_name;
								onBlurField('owner_name');
							}}
						/>
					</FormField>

					<div
						style="display:grid;gap:0.9rem;grid-template-columns:repeat(auto-fit,minmax(13rem,1fr));"
					>
						<FormField
							label="Administrator name"
							htmlFor="adm-name"
							required
							error={errors.admin_name}
						>
							<TextInput
								id="adm-name"
								bind:value={admin.admin_name}
								autocomplete="off"
								onblur={() => onBlurField('admin_name')}
							/>
						</FormField>
						<FormField
							label="Administrator email"
							htmlFor="adm-email"
							required
							error={errors.admin_email}
							hint="The setup link is sent here."
						>
							<TextInput
								id="adm-email"
								type="email"
								bind:value={admin.admin_email}
								placeholder="rahul@example.com"
								autocomplete="off"
								onblur={() => onBlurField('admin_email')}
							/>
						</FormField>
					</div>

					<div
						style="display:grid;gap:0.9rem;grid-template-columns:repeat(auto-fit,minmax(13rem,1fr));"
					>
						<FormField label="Administrator phone" htmlFor="adm-phone" error={errors.admin_phone}>
							<TextInput
								id="adm-phone"
								type="tel"
								bind:value={admin.admin_phone}
								placeholder="9876543210"
								onblur={() => onBlurField('admin_phone')}
							/>
						</FormField>
						<FormField label="Role" htmlFor="adm-role" hint="Fixed during onboarding.">
							<input id="adm-role" class="input" value="Business administrator" disabled />
						</FormField>
					</div>
				</div>

				<!-- 4. PLAN -->
			{:else if step === 3}
				<h3 class="panel-h">
					<span style="display:flex;align-items:center;gap:0.5rem;">
						<Rocket size={16} strokeWidth={1.9} />
						Plan
					</span>
				</h3>
				<p class="panel-note">
					Nothing is charged — the plan records what this business is provisioned for, and its
					limits are enforced as staff and {terms.items.toLowerCase()} are added.
				</p>

				{#if plans.length === 0}
					<div class="alert alert-warn">
						<TriangleAlert size={16} strokeWidth={1.9} />
						<span>
							No active plan is offered to a {template.label.toLowerCase()}. Add or enable one
							under <a href="/superadmin/plans">Plans &amp; subscriptions</a>.
						</span>
					</div>
				{:else}
					<PlanPicker {plans} bind:value={plan} defaultCode={defaultPlan} />
					{#if errors.plan}<p class="field-error">{errors.plan}</p>{/if}

					{#if selectedPlan}
						<div class="plan-detail">
							<dl class="dl">
								<div><dt>Billing</dt><dd>{billingLabel(selectedPlan.billingPeriod)}</dd></div>
								<div>
									<dt>Trial</dt>
									<dd>{trialDays > 0 ? `${trialDays} days` : 'No trial'}</dd>
								</div>
								<div>
									<dt>Subscription starts as</dt>
									<dd><StatusBadge status={subscriptionStatus} /></dd>
								</div>
								<div>
									<dt>Limits</dt>
									<dd>
										{selectedPlan.maxStaff ?? '—'} staff · {selectedPlan.maxProducts ?? '—'}
										{terms.items.toLowerCase()}
									</dd>
								</div>
							</dl>
							{#if selectedPlan.features.length > 0}
								<ul class="plan-features">
									{#each selectedPlan.features as feature (feature)}
										<li>{feature}</li>
									{/each}
								</ul>
							{/if}
						</div>
					{/if}
				{/if}

				<!-- 5. STOREFRONT THEME -->
			{:else if step === 4}
				<h3 class="panel-h">
					<span style="display:flex;align-items:center;gap:0.5rem;">
						<Palette size={16} strokeWidth={1.9} />
						Storefront theme
					</span>
				</h3>
				<p class="panel-note">
					How the shop looks to customers, pre-set from the {template.label.toLowerCase()}
					template. This is the same picker the owner gets under Customize → Theme, so what
					you choose here is exactly what they will find.
				</p>

				<StorefrontThemePicker
					compact
					storeName={org.name || 'Your shop'}
					bind:preset={theme.preset}
					bind:mode={theme.mode}
					bind:primary={theme.primary}
					bind:secondary={theme.secondary}
					bind:accent={theme.accent}
					bind:font={theme.font}
					bind:radius={theme.radius}
					bind:button={theme.button}
					bind:card={theme.card}
					bind:hero={theme.hero}
					bind:layout={theme.product_layout}
					bind:filterStyle={theme.filter_style}
				/>

				<div class="theme-assets">
					<FormField
						label="Logo URL"
						htmlFor="brand-logo"
						error={errors.logo_url}
						hint="Optional. The owner can upload a file once they sign in."
					>
						<TextInput
							id="brand-logo"
							type="url"
							bind:value={theme.logo_url}
							placeholder="https://…"
							onblur={() => onBlurField('logo_url')}
						/>
					</FormField>
					<FormField label="Favicon URL" htmlFor="brand-favicon" error={errors.favicon_url}>
						<TextInput
							id="brand-favicon"
							type="url"
							bind:value={theme.favicon_url}
							placeholder="https://…"
							onblur={() => onBlurField('favicon_url')}
						/>
					</FormField>
				</div>

				<!-- 6. CONFIGURATION -->
			{:else if step === 5}
				<h3 class="panel-h">
					<span style="display:flex;align-items:center;gap:0.5rem;">
						<SlidersHorizontal size={16} strokeWidth={1.9} />
						How this business operates
					</span>
				</h3>
				<p class="panel-note">
					Pre-set for a {template.label.toLowerCase()}. Only the settings that matter for this
					business type are shown; everything else keeps its default and stays editable by the
					owner.
				</p>

				<div class="cfg">
					{#if shows('ordering')}
						<div class="cfg-row">
							<Switch
								bind:checked={config.ordering_enabled}
								label="Accept orders from customers"
								hint="Turn off to launch with a browse-only storefront."
							/>
						</div>
					{/if}

					{#if shows('customer_login')}
						<div class="cfg-row">
							<FormField
								label="Customer accounts"
								htmlFor="cfg-login"
								hint="Required accounts identify the customer before they can order."
							>
								<SelectField
									id="cfg-login"
									bind:value={config.customer_login_mode}
									options={[
										{ value: 'off', label: CONTROL_LABELS.customer_login_mode.off },
										{ value: 'optional', label: CONTROL_LABELS.customer_login_mode.optional },
										{ value: 'required', label: CONTROL_LABELS.customer_login_mode.required }
									]}
								/>
							</FormField>
						</div>
					{/if}

					{#if shows('prep_time')}
						<div class="cfg-row">
							<FormField
								label="Typical preparation time"
								htmlFor="cfg-prep"
								error={errors.prep_time}
								hint="Shown to customers as the wait after an order is accepted."
							>
								<TextInput
									id="cfg-prep"
									type="number"
									min={1}
									max={240}
									suffix="min"
									value={String(config.prep_time_minutes)}
									oninput={(e) => {
										config.prep_time_minutes = Number(
											(e.currentTarget as HTMLInputElement).value
										);
										touched.prep_time = true;
									}}
								/>
							</FormField>
						</div>
					{/if}

					{#if shows('acceptance')}
						<div class="cfg-row">
							<FormField
								label="Order acceptance"
								htmlFor="cfg-accept"
								hint="Automatic acceptance suits a counter that never refuses an order."
							>
								<SelectField
									id="cfg-accept"
									bind:value={config.acceptance_mode}
									options={[
										{ value: 'MANUAL', label: CONTROL_LABELS.acceptance_mode.MANUAL },
										{ value: 'AUTO', label: CONTROL_LABELS.acceptance_mode.AUTO }
									]}
								/>
							</FormField>
						</div>
					{/if}

					{#if shows('payment_methods')}
						<div class="cfg-row">
							<p class="field-label" style="margin-bottom:0.5rem;">Payment methods</p>
							<div style="display:flex;flex-direction:column;gap:0.6rem;">
								<Switch bind:checked={config.online_payment_enabled} label="Online payment" />
								<Switch bind:checked={config.cash_enabled} label="Cash" />
							</div>
							{#if errors.payment_methods}
								<p class="field-error">{errors.payment_methods}</p>
							{/if}
							{#if config.online_payment_enabled && config.cash_enabled}
								<div style="margin-top:0.7rem;max-width:16rem;">
									<FormField label="Default method" htmlFor="cfg-default-pay">
										<SelectField
											id="cfg-default-pay"
											bind:value={config.default_payment_method}
											options={[
												{ value: 'ONLINE', label: 'Online' },
												{ value: 'CASH', label: 'Cash' }
											]}
										/>
									</FormField>
								</div>
							{/if}
						</div>
					{/if}

					{#if shows('payment_timing')}
						<div class="cfg-row">
							<FormField label="When customers pay" htmlFor="cfg-timing">
								<SelectField
									id="cfg-timing"
									bind:value={config.payment_requirement}
									options={[
										{
											value: 'BEFORE_PREPARATION',
											label: CONTROL_LABELS.payment_requirement.BEFORE_PREPARATION
										},
										{ value: 'AT_PICKUP', label: CONTROL_LABELS.payment_requirement.AT_PICKUP }
									]}
								/>
							</FormField>
						</div>
					{/if}

					{#if shows('ready_notification')}
						<div class="cfg-row">
							<Switch
								bind:checked={config.ready_notification}
								label="Notify the customer when the order is ready"
							/>
						</div>
					{/if}

					{#if shows('auto_complete')}
						<div class="cfg-row">
							<Switch
								bind:checked={config.auto_complete}
								label="Complete orders automatically once ready"
								hint="Suits a counter where nobody marks collection."
							/>
						</div>
					{/if}
				</div>

				<!-- 7. REVIEW -->
			{:else}
				<h3 class="panel-h">
					<span style="display:flex;align-items:center;gap:0.5rem;">
						<CircleCheck size={16} strokeWidth={1.9} />
						Review and create
					</span>
				</h3>
				<p class="panel-note">
					The business, its subscription, its administrator and its configured storefront are
					created together. If anything fails, nothing is created.
				</p>

				<div class="review-grid">
					<section class="review-block">
						<h4>Business type</h4>
						<dl class="dl">
							<div><dt>Type</dt><dd>{template.label}</dd></div>
							<div><dt>Catalogue</dt><dd>{terms.catalog}</dd></div>
							<div><dt>Layout</dt><dd>{template.storefront.product_layout}</dd></div>
						</dl>
						<button type="button" class="btn btn-quiet btn-sm" onclick={() => (step = 0)}>
							Edit
						</button>
					</section>

					<section class="review-block">
						<h4>Business</h4>
						<dl class="dl">
							<div><dt>Name</dt><dd>{org.name || '—'}</dd></div>
							<div><dt>Subdomain</dt><dd class="mono">{org.slug || '—'}</dd></div>
							<div><dt>Phone</dt><dd>{org.phone || '—'}</dd></div>
							<div><dt>Email</dt><dd>{org.email || admin.admin_email || '—'}</dd></div>
							<div><dt>Currency</dt><dd>{org.currency}</dd></div>
							<div><dt>Timezone</dt><dd>{org.timezone}</dd></div>
						</dl>
						<button type="button" class="btn btn-quiet btn-sm" onclick={() => (step = 1)}>
							Edit
						</button>
					</section>

					<section class="review-block">
						<h4>Owner &amp; admin</h4>
						<dl class="dl">
							<div><dt>Owner</dt><dd>{admin.owner_name || '—'}</dd></div>
							<div><dt>Administrator</dt><dd>{admin.admin_name || '—'}</dd></div>
							<div><dt>Email</dt><dd class="mono">{admin.admin_email || '—'}</dd></div>
							<div><dt>Phone</dt><dd>{admin.admin_phone || '—'}</dd></div>
						</dl>
						<button type="button" class="btn btn-quiet btn-sm" onclick={() => (step = 2)}>
							Edit
						</button>
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
											: `₹${selectedPlan.price.toLocaleString('en-IN')}`
										: '—'}
								</dd>
							</div>
							<div><dt>Trial</dt><dd>{trialDays > 0 ? `${trialDays} days` : 'None'}</dd></div>
							<div><dt>Status</dt><dd><StatusBadge status={subscriptionStatus} /></dd></div>
						</dl>
						<button type="button" class="btn btn-quiet btn-sm" onclick={() => (step = 3)}>
							Edit
						</button>
					</section>

					<section class="review-block">
						<h4>Storefront theme</h4>
						<div class="swatch-row">
							<span class="swatch" style:background={primary}></span>
							<span class="swatch" style:background={secondary}></span>
							<span class="swatch" style:background={theme.accent}></span>
							<span class="muted" style="font-size:0.72rem;">
								{selectedPreset?.name ?? theme.preset}
							</span>
						</div>
						<dl class="dl" style="margin-top:0.35rem;">
							<div><dt>Mode</dt><dd style="text-transform:capitalize;">{theme.mode}</dd></div>
							<div>
								<dt>Menu</dt>
								<dd style="text-transform:capitalize;">{theme.product_layout}</dd>
							</div>
							<div><dt>Font</dt><dd style="text-transform:capitalize;">{theme.font}</dd></div>
						</dl>
						<button type="button" class="btn btn-quiet btn-sm" onclick={() => (step = 4)}>
							Edit
						</button>
					</section>

					<section class="review-block">
						<h4>Configuration</h4>
						<dl class="dl">
							<div>
								<dt>Ordering</dt>
								<dd>{config.ordering_enabled ? 'Enabled' : 'Browse only'}</dd>
							</div>
							<div>
								<dt>Customers</dt>
								<dd>{CONTROL_LABELS.customer_login_mode[config.customer_login_mode]}</dd>
							</div>
							<div>
								<dt>Acceptance</dt>
								<dd>{CONTROL_LABELS.acceptance_mode[config.acceptance_mode]}</dd>
							</div>
							<div>
								<dt>Payment</dt>
								<dd>{paymentSummary()}</dd>
							</div>
							<div><dt>Prep time</dt><dd>{config.prep_time_minutes} min</dd></div>
						</dl>
						<button type="button" class="btn btn-quiet btn-sm" onclick={() => (step = 5)}>
							Edit
						</button>
					</section>
				</div>

				<div class="handoff">
					<strong>What happens when you create it</strong>
					<ol>
						<li>The business, its subscription and its administrator are created in one transaction.</li>
						<li>Its storefront is configured from the {template.label.toLowerCase()} template.</li>
						<li>A one-time setup link is generated, and emailed if email is configured.</li>
						<li>
							The administrator signs in, adds the {terms.catalog.toLowerCase()}, and publishes the
							storefront.
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
				<button
					type="button"
					class="btn btn-ghost"
					disabled={step === 0 || submitting}
					onclick={goBack}
				>
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
						onclick={create}
					>
						{#if submitting}
							Creating business…
						{:else}
							<Building2 size={15} strokeWidth={2.2} />
							Create business
						{/if}
					</button>
				{/if}
			</div>
		{/snippet}
	</OnboardLayout>
{/if}


<style>
	.bt-grid {
		display: grid;
		gap: 0.65rem;
		grid-template-columns: minmax(0, 1fr);
	}

	@media (min-width: 560px) {
		.bt-grid {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}

	@media (min-width: 960px) {
		.bt-grid {
			grid-template-columns: repeat(3, minmax(0, 1fr));
		}
	}

	.tpl-summary {
		margin-top: 1.1rem;
		padding: 0.85rem 0.95rem;
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		background: var(--surface-2);
	}

	.tpl-summary strong {
		display: block;
		margin-bottom: 0.5rem;
		font-size: 0.7rem;
		font-weight: 650;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--text-3);
	}

	.tpl-cats {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.3rem;
		margin: 0.7rem 0 0;
		font-size: 0.76rem;
		color: var(--text-3);
	}

	.bt-chip {
		font-size: 0.68rem;
		font-weight: 550;
		padding: 0.15rem 0.45rem;
		border-radius: 999px;
		background: var(--surface-3);
		color: var(--text-2);
	}

	.plan-detail {
		margin-top: 1.1rem;
		padding-top: 1rem;
		border-top: 1px solid var(--border);
	}

	.plan-features {
		margin: 0.75rem 0 0;
		padding-left: 1.05rem;
		display: grid;
		gap: 0.25rem;
	}

	.plan-features li {
		font-size: 0.78rem;
		color: var(--text-2);
	}

	.cfg {
		display: flex;
		flex-direction: column;
	}

	.cfg-row {
		padding: 0.85rem 0;
		border-bottom: 1px solid var(--border-subtle);
	}

	.cfg-row:last-child {
		border-bottom: 0;
	}

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

	.theme-assets {
		display: grid;
		gap: 0.9rem;
		grid-template-columns: repeat(auto-fit, minmax(13rem, 1fr));
		margin-top: 1.5rem;
		padding-top: 1.25rem;
		border-top: 1px solid var(--border-subtle);
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

	/* ---------- success ---------- */

	.done {
		display: flex;
		flex-direction: column;
		gap: 0.85rem;
		max-width: 46rem;
		margin: 0 auto;
	}

	.done-head {
		display: flex;
		align-items: flex-start;
		gap: 0.9rem;
	}

	.done-mark {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 2.6rem;
		height: 2.6rem;
		border-radius: 999px;
		background: var(--success-bg);
		color: var(--success);
		flex-shrink: 0;
	}

	.done-head h2 {
		margin: 0 0 0.25rem;
		font-family: var(--font-display);
		font-size: 1.15rem;
		font-weight: 600;
		letter-spacing: -0.02em;
	}

	.done-head p {
		margin: 0;
		font-size: 0.84rem;
		line-height: 1.55;
		color: var(--text-3);
	}

	.done-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}
</style>
