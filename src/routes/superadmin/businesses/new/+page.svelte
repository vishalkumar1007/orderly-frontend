<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import { beforeNavigate, goto } from '$app/navigation';
	import {
		checkEmailAvailable,
		checkSlugAvailable,
		createTenant,
		fetchBusinessTypeCapabilities,
		fetchPlans,
		fetchSettings,
		fetchTenantTypes,
		offeredTo,
		toPlanOption,
		uploadAdminAsset
	} from '$lib/admin/api';
	import { fetchPlatformConfigs } from '$lib/admin/configApi';
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
		loadOnboardSuccess,
		saveOnboardDraft,
		saveOnboardSuccess
	} from '$lib/admin/onboardStore';
	import { joinTenantSetupUrl, rewriteFrontendPort, slugify } from '$lib/admin/format';
	import type { CapabilityRow, CreatedTenant, Plan, PlanOption, TenantType } from '$lib/admin/types';
	import { tenantFrontendOrigin } from '$lib/host';
	import { THEME_PRESETS } from '$lib/storefront/admin';
	import { api } from '$lib/api/client';
	import { consoleAppearance, isDarkFamily } from '$lib/appearance.svelte';
	import { getCachedBrandTheme, type ThemePreset as ConsolePreset } from '$lib/brandTheme';
	import FormField from '$lib/components/admin/FormField.svelte';
	import PortalPreview from '$lib/components/admin/PortalPreview.svelte';
	import SelectField from '$lib/components/admin/SelectField.svelte';
	import SlugField from '$lib/components/admin/SlugField.svelte';
	import Select from '$lib/components/admin/Select.svelte';
	import Switch from '$lib/components/admin/Switch.svelte';
	import TextArea from '$lib/components/admin/TextArea.svelte';
	import TextInput from '$lib/components/admin/TextInput.svelte';
	import { toast } from '$lib/components/admin/toast';

	import OnboardAlert from '$lib/components/admin/onboard/OnboardAlert.svelte';
	import OnboardShell from '$lib/components/admin/onboard/OnboardShell.svelte';
	import OnboardPlanPicker from '$lib/components/admin/onboard/OnboardPlanPicker.svelte';
	import ThemePicker from '$lib/components/admin/onboard/ThemePicker.svelte';
	import TypePicker from '$lib/components/admin/onboard/TypePicker.svelte';
	import LeaveDraftModal from '$lib/components/admin/onboard/LeaveDraftModal.svelte';

	import IconAlertCircle from '@tabler/icons-svelte/icons/alert-circle';
	import IconAlertTriangle from '@tabler/icons-svelte/icons/alert-triangle';
	import IconArrowLeft from '@tabler/icons-svelte/icons/arrow-left';
	import IconArrowRight from '@tabler/icons-svelte/icons/arrow-right';
	import IconBuildingStore from '@tabler/icons-svelte/icons/building-store';
	import IconCheck from '@tabler/icons-svelte/icons/check';
	import IconCircleCheck from '@tabler/icons-svelte/icons/circle-check';
	import IconCopy from '@tabler/icons-svelte/icons/copy';
	import IconExternalLink from '@tabler/icons-svelte/icons/external-link';
	import IconKey from '@tabler/icons-svelte/icons/key';
	import IconLayoutDashboard from '@tabler/icons-svelte/icons/layout-dashboard';
	import IconLink from '@tabler/icons-svelte/icons/link';
	import IconPencil from '@tabler/icons-svelte/icons/pencil';
	import IconPhoto from '@tabler/icons-svelte/icons/photo';
	import IconPlus from '@tabler/icons-svelte/icons/plus';
	import IconSettings from '@tabler/icons-svelte/icons/settings';
	import IconTrash from '@tabler/icons-svelte/icons/trash';
	import IconUpload from '@tabler/icons-svelte/icons/upload';

	/*
	 * The wizard's design system, in one place.
	 *
	 * Imported here rather than left inside the page's own `<style>` because it is
	 * shared by six child components, and a `<style>` block in a Svelte component
	 * is scoped to that component's markup — the children could not have used it.
	 * The page is the only place that knows all six are in play at once, so the
	 * import belongs to the page.
	 */
	import '$lib/components/admin/onboard/onboarding.css';

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
	 * The right column is not decoration: it is the same claim the platform
	 * makes everywhere else — that business type drives the UI — made visible
	 * while you are still filling in the form, from state the wizard already
	 * holds, not a second fetch.
	 *
	 * Nothing here ever shows or sends a password. The administrator receives a
	 * one-time link and chooses their own.
	 */

	const steps = [
		{ id: 'type', label: 'Business Type' },
		{ id: 'business', label: 'Business Details' },
		{ id: 'owner', label: 'Admin Account' },
		{ id: 'plan', label: 'Subscription' },
		{ id: 'theme', label: 'Branding' },
		{ id: 'config', label: 'Operations' },
		{ id: 'review', label: 'Review' }
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

	type EmailStatus = 'idle' | 'checking' | 'available' | 'taken';
	let emailStatus = $state<EmailStatus>('idle');
	let emailTimer: ReturnType<typeof setTimeout> | undefined;

	let step = $state(0);
	let types = $state<TenantType[]>([]);
	let allPlans = $state<Plan[]>([]);
	let defaultPlan = $state('');
	let baseDomain = $state('localhost');
	let frontendPort = $state('5173');
	let appEnv = $state('development');
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
	/** Tracks if the admin has explicitly chosen a theme preset in Step 4 */
	let themeSelectedByUser = $state(false);

	// Platform configuration mappings (SMTP and Storage status)
	let smtpConfigured = $state(false);
	let storageConfigured = $state(false);
	let configsLoaded = $state(false);

	// Logo upload state
	let logoMode = $state<'upload' | 'url'>('upload');
	let isUploadingLogo = $state(false);
	let logoUploadError = $state<string | null>(null);
	let isDragOverLogo = $state(false);
	let logoFileInput = $state<HTMLInputElement | null>(null);

	async function handleLogoFile(file: File) {
		if (!file) return;
		logoUploadError = null;

		if (file.size > 5 * 1024 * 1024) {
			logoUploadError = 'File exceeds maximum size of 5MB';
			return;
		}

		const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'];
		if (!validTypes.includes(file.type) && !file.name.match(/\.(png|jpe?g|webp|svg)$/i)) {
			logoUploadError = 'Please upload a valid image file (PNG, JPG, WebP, or SVG)';
			return;
		}

		if (!storageConfigured) {
			const reader = new FileReader();
			reader.onload = (e) => {
				if (typeof e.target?.result === 'string') {
					theme.logo_url = e.target.result;
					dirty = true;
					themeSelectedByUser = true;
				}
			};
			reader.readAsDataURL(file);
			toast.info('Storage is not configured; logo loaded as direct data asset.');
			return;
		}

		isUploadingLogo = true;
		try {
			const res = await uploadAdminAsset(file);
			theme.logo_url = res.url;
			dirty = true;
			themeSelectedByUser = true;
			toast.success('Business logo uploaded successfully');
		} catch (err) {
			logoUploadError = err instanceof Error ? err.message : 'Failed to upload logo';
			toast.error(logoUploadError);
		} finally {
			isUploadingLogo = false;
		}
	}

	function onLogoFileSelected(e: Event) {
		const input = e.target as HTMLInputElement;
		if (input.files && input.files[0]) {
			void handleLogoFile(input.files[0]);
		}
	}

	function onLogoDrop(e: DragEvent) {
		e.preventDefault();
		isDragOverLogo = false;
		if (e.dataTransfer?.files && e.dataTransfer.files[0]) {
			void handleLogoFile(e.dataTransfer.files[0]);
		}
	}

	function removeLogo() {
		theme.logo_url = '';
		logoUploadError = null;
		dirty = true;
		if (logoFileInput) logoFileInput.value = '';
	}

	function getSuperAdminTheme() {
		const appearanceTheme = consoleAppearance.appearance?.theme ?? getCachedBrandTheme('platform');
		const mode: 'light' | 'dark' = isDarkFamily(consoleAppearance.mode)
			? 'dark'
			: typeof document !== 'undefined' &&
				  ['dark', 'night', 'midnight', 'graphite', 'raw'].includes(
						document.documentElement.dataset.theme ?? ''
				  )
				? 'dark'
				: 'light';

		const primary = appearanceTheme?.tokens?.accent || '#6366f1';
		const secondary = appearanceTheme?.tokens?.accent2 || '#8b5cf6';
		const accent = appearanceTheme?.tokens?.accent || '#4f46e5';
		const preset = appearanceTheme?.preset_id || 'modern';
		const matchingPreset = THEME_PRESETS.find((p) => p.id === preset) ?? THEME_PRESETS[1];

		return {
			preset,
			mode,
			primary,
			secondary,
			accent,
			font: matchingPreset.font,
			radius: matchingPreset.radius,
			button: matchingPreset.button_style,
			card: matchingPreset.card_style,
			hero: matchingPreset.hero_style
		};
	}

	const currentPortalTheme = $derived.by(() => {
		const appearanceTheme = consoleAppearance.appearance?.theme ?? getCachedBrandTheme('platform');
		const mode: 'light' | 'dark' = isDarkFamily(consoleAppearance.mode)
			? 'dark'
			: typeof document !== 'undefined' &&
				  ['dark', 'night', 'midnight', 'graphite', 'raw'].includes(
						document.documentElement.dataset.theme ?? ''
				  )
				? 'dark'
				: 'light';

		const primary = appearanceTheme?.tokens?.accent || '#6366f1';
		const secondary = appearanceTheme?.tokens?.accent2 || '#8b5cf6';
		const accent = appearanceTheme?.tokens?.accent || '#4f46e5';
		const preset = appearanceTheme?.preset_id || 'modern';

		return {
			preset,
			mode,
			primary,
			secondary,
			accent
		};
	});

	const activePreviewTheme = $derived.by(() => {
		if (themeSelectedByUser) {
			return {
				preset: theme.preset,
				mode: theme.mode,
				primary: theme.primary,
				secondary: theme.secondary,
				accent: theme.accent
			};
		}
		return currentPortalTheme;
	});

	// Keep theme state synchronized with SuperAdmin portal theme unless explicitly chosen
	$effect(() => {
		if (!themeSelectedByUser) {
			theme.mode = currentPortalTheme.mode;
			theme.primary = currentPortalTheme.primary;
			theme.secondary = currentPortalTheme.secondary;
			theme.accent = currentPortalTheme.accent;
			theme.preset = currentPortalTheme.preset;
		}
	});

	/** The console theme catalogue, for seeding the business's own console. */
	let consolePresets = $state<ConsolePreset[]>([]);
	let config = $state(initial.config);
	/** Capability-driven types only (Barber, Hotel, General) — see step 6. */
	let capabilityOverrides = $state(initial.capabilityOverrides);
	let capabilityRows = $state<CapabilityRow[]>([]);
	let capabilitiesLoading = $state(false);
	let termsAccepted = $state(initial.termsAccepted);
	/** Off by default; editable later from the business's own Configuration tab. */
	let mfaAllowed = $state(false);
	/** Seeds the initial policy only — the business's own Tenant Admin owns it from here on. */
	let mfaMode = $state<'OPTIONAL' | 'REQUIRED'>('OPTIONAL');
	let mfaTotp = $state(true);
	let mfaEmailOtp = $state(false);
	let errors = $state<Record<string, string>>({});
	let touched = $state<Record<string, boolean>>({});

	const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
	const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
	const PHONE_RE = /^[+\d][\d\s()-]{5,19}$/;

	/* ---------- catalogue ---------- */

	onMount(async () => {
		const savedSuccess = loadOnboardSuccess<CreatedTenant>();
		if (savedSuccess && savedSuccess.tenant?.id) {
			created = savedSuccess;
			dirty = false;
		}

		const draft = loadOnboardDraft();
		if (draft && !created) {
			type = draft.type;
			org = draft.org;
			admin = draft.admin;
			config = draft.config;
			capabilityOverrides = draft.capabilityOverrides;
			termsAccepted = draft.termsAccepted;
			plan = draft.plan;
			step = Math.min(draft.step, steps.length - 1);
			dirty = true;
			if (templateFor(draft.type).capabilityDriven) void loadCapabilitiesFor(draft.type);

			// Synchronize with SuperAdmin theme until admin explicitly selects a theme in Step 4
			if (draft.themeSelectedByUser) {
				theme = draft.theme;
				themeSelectedByUser = true;
			} else {
				const superadminTheme = getSuperAdminTheme();
				theme = {
					...draft.theme,
					...superadminTheme,
					product_layout: templateFor(draft.type).storefront.product_layout
				};
				themeSelectedByUser = false;
			}
		}
		try {
			const [loadedTypes, loadedPlans, settings, presets, platformConfigs] = await Promise.all([
				fetchTenantTypes(),
				fetchPlans(),
				fetchSettings(),
				// The console catalogue, so the look chosen below can be mapped
				// onto the theme the new owner's own console will open with.
				api<{ presets: ConsolePreset[] }>('/api/v1/admin/theme-presets').catch(() => ({
					presets: [] as ConsolePreset[]
				})),
				fetchPlatformConfigs().catch(() => ({
					configurations: [],
					encryption: { enabled: false }
				}))
			]);
			consolePresets = presets.presets ?? [];
			types = loadedTypes;
			allPlans = loadedPlans;
			defaultPlan = settings.platform.default_plan?.toUpperCase() ?? '';
			baseDomain = settings.platform.base_domain || 'localhost';
			frontendPort = settings.platform.frontend_port || '5173';
			appEnv = (settings.app_env || 'development').toLowerCase();
			if (!org.currency) org.currency = settings.general.default_currency || 'INR';
			if (!org.timezone) org.timezone = settings.general.timezone || 'Asia/Kolkata';

			if (platformConfigs?.configurations) {
				const smtp = platformConfigs.configurations.find((c) => c.service === 'SMTP');
				smtpConfigured =
					!!smtp &&
					(smtp.status === 'ENABLED' || smtp.status === 'CONFIGURED') &&
					smtp.enabled;

				const storage = platformConfigs.configurations.find((c) => c.service === 'STORAGE');
				storageConfigured =
					!!storage &&
					(storage.status === 'ENABLED' || storage.status === 'CONFIGURED') &&
					storage.enabled;

				if (!storageConfigured && !theme.logo_url) {
					logoMode = 'url';
				}
			}
			configsLoaded = true;
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
	 * Choosing a type configures terminology and modules for the business.
	 * The theme remains cleanly synchronized with the SuperAdmin portal theme
	 * until the admin explicitly selects a business theme in Step 4.
	 */
	function chooseType(code: string) {
		if (code === type) return;
		dirty = true;
		type = code;
		const next = templateFor(code);
		if (themeSelectedByUser) {
			theme = {
				...theme,
				product_layout: next.storefront.product_layout
			};
		} else {
			const superadminTheme = getSuperAdminTheme();
			theme = {
				...theme,
				...superadminTheme,
				product_layout: next.storefront.product_layout,
				logo_url: theme.logo_url,
				favicon_url: theme.favicon_url
			};
		}
		config = configFromTemplate(next);
		// A plan restricted to other business types is no longer a valid choice.
		if (plan && !plans.some((p) => p.code === plan)) plan = '';
		// The previous type's module choices do not carry over — a Hotel's
		// housekeeping toggle means nothing once the type becomes a Barber shop.
		capabilityOverrides = {};
		capabilityRows = [];
		if (next.capabilityDriven) void loadCapabilitiesFor(code);
	}

	/**
	 * Loads the chosen type's capability matrix and seeds capabilityOverrides
	 * with each configurable row's default, so the toggles below open already
	 * showing what a plain onboarding would produce rather than an unset state.
	 */
	async function loadCapabilitiesFor(code: string) {
		capabilitiesLoading = true;
		try {
			capabilityRows = await fetchBusinessTypeCapabilities(code);
			const next = { ...capabilityOverrides };
			for (const row of capabilityRows) {
				if (row.configurable && !(row.code in next)) next[row.code] = row.default_enabled;
			}
			capabilityOverrides = next;
		} catch (err) {
			capabilityRows = [];
			failure = errorLines(err, 'load this business type’s modules');
		} finally {
			capabilitiesLoading = false;
		}
	}

	/** Fixed capabilities a capability-driven type always includes. */
	const includedCapabilities = $derived(capabilityRows.filter((c) => !c.configurable));
	/** Capabilities the owner can choose to turn on for this type. */
	const optionalCapabilities = $derived(capabilityRows.filter((c) => c.configurable));
	/** Everything actually enabled — feeds both the review step and the live preview. */
	const enabledCapabilities = $derived(
		capabilityRows.filter((c) => !c.configurable || (capabilityOverrides[c.code] ?? c.default_enabled))
	);

	/** Fall back to the platform default plan once the catalogue is known. */
	$effect(() => {
		if (optionsLoading || plan || plans.length === 0) return;
		untrack(() => {
			plan = plans.find((p) => p.code === defaultPlan)?.code ?? plans[0]?.code ?? '';
		});
	});

	/* ---------- theme preset ---------- */

	/** Nothing is charged; the plan records what the business is provisioned for. */
	function choosePlan(code: string) {
		if (code === plan) return;
		dirty = true;
		plan = code;
	}

	function applyPreset(p: (typeof THEME_PRESETS)[number]) {
		dirty = true;
		themeSelectedByUser = true;
		theme.preset = p.id;
		theme.mode = p.mode;
		theme.primary = p.primary;
		theme.secondary = p.secondary;
		theme.accent = p.accent;
		theme.font = p.font;
		theme.radius = p.radius;
		theme.button = p.button_style;
		theme.card = p.card_style;
		theme.hero = p.hero_style;
	}

	/* ---------- draft persistence ---------- */

	$effect(() => {
		type;
		org;
		admin;
		theme;
		themeSelectedByUser;
		config;
		capabilityOverrides;
		termsAccepted;
		plan;
		step;
		if (dirty && !created) {
			saveOnboardDraft({ type, org, admin, theme, themeSelectedByUser, config, capabilityOverrides, termsAccepted, plan, step });
		}
	});

	const LEAVE_CONFIRM_KEY = 'orderly-onboard-skip-leave-confirm';
	let showLeaveModal = $state(false);
	let rememberLeaveChoice = $state(false);
	let pendingNavigationUrl = $state<string | null>(null);
	let isLeavingConfirmed = $state(false);

	onMount(() => {
		const handler = (e: BeforeUnloadEvent) => {
			if (dirty && !created) {
				if (typeof localStorage !== 'undefined' && localStorage.getItem(LEAVE_CONFIRM_KEY) === 'true') {
					return;
				}
				e.preventDefault();
				e.returnValue = '';
			}
		};
		window.addEventListener('beforeunload', handler);
		return () => window.removeEventListener('beforeunload', handler);
	});

	beforeNavigate((nav) => {
		if (isLeavingConfirmed || !dirty || created) return;

		// Check if user previously checked "Don't show popup again"
		if (typeof localStorage !== 'undefined' && localStorage.getItem(LEAVE_CONFIRM_KEY) === 'true') {
			return;
		}

		// Prevent browser navigation and open our custom confirmation modal
		nav.cancel();
		pendingNavigationUrl = nav.to?.url?.href ?? null;
		showLeaveModal = true;
	});

	function confirmLeave() {
		if (rememberLeaveChoice && typeof localStorage !== 'undefined') {
			localStorage.setItem(LEAVE_CONFIRM_KEY, 'true');
		}
		showLeaveModal = false;
		isLeavingConfirmed = true;

		if (pendingNavigationUrl) {
			void goto(pendingNavigationUrl);
		} else {
			void goto('/superadmin/businesses');
		}
	}

	function cancelLeave() {
		showLeaveModal = false;
		pendingNavigationUrl = null;
	}

	/* ---------- slug & email availability ---------- */

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

	$effect(() => {
		const email = admin.admin_email.trim().toLowerCase();
		clearTimeout(emailTimer);
		if (!email || !EMAIL_RE.test(email)) {
			emailStatus = 'idle';
			return;
		}
		emailStatus = 'checking';
		emailTimer = setTimeout(async () => {
			try {
				const r = await checkEmailAvailable(email);
				emailStatus = r.available ? 'available' : 'taken';
				if (!r.available) {
					errors.admin_email = 'This administrator email is already registered';
				} else if (errors.admin_email === 'This administrator email is already registered') {
					delete errors.admin_email;
				}
			} catch {
				emailStatus = 'idle';
			}
		}, 350);
		return () => clearTimeout(emailTimer);
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
				if (slugStatus === 'invalid') return 'Use lowercase letters, numbers and hyphens';
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
				if (!EMAIL_RE.test(v)) return 'Enter a valid email address';
				if (emailStatus === 'taken') return 'This administrator email is already registered';
				return '';
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
				if (template.capabilityDriven || !config.ordering_enabled) return '';
				return config.prep_time_minutes >= 1 && config.prep_time_minutes <= 240
					? ''
					: 'Choose between 1 and 240 minutes';
			case 'payment_methods':
				if (template.capabilityDriven || !config.ordering_enabled) return '';
				return config.online_payment_enabled || config.cash_enabled
					? ''
					: 'Enable at least one way for customers to pay';
			case 'terms':
				return termsAccepted ? '' : 'Confirm the terms to create this business';
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

	function stepFields(i: number): string[] {
		switch (i) {
			case 0:
				return ['type'];
			case 1:
				return ['name', 'slug', 'phone', 'email', 'short_description', 'currency', 'timezone', 'language'];
			case 2:
				return ['owner_name', 'admin_name', 'admin_email', 'admin_phone'];
			case 3:
				return ['plan'];
			case 4:
				return ['logo_url', 'favicon_url'];
			case 5:
				if (template.capabilityDriven || !config.ordering_enabled) return [];
				return ['prep_time', 'payment_methods'];
			case 6:
				return ['terms'];
			default:
				return [];
		}
	}

	function validateStep(i: number, force = false): boolean {
		const next = { ...errors };
		const fields = stepFields(i);
		for (const key of fields) {
			// Untouched fields stay quiet until the operator leaves them or
			// tries to continue; a form that turns red as you arrive is hostile.
			if (!force && !touched[key]) continue;
			const msg = validateField(key);
			if (msg) next[key] = msg;
			else delete next[key];
		}
		errors = next;
		return fields.every((k) => !validateField(k));
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
		termsAccepted;
		plan;
		slugStatus;
		emailStatus;

		if (!dirty || created) return;
		untrack(() => validateStep(step));
	});

	const stepValid = $derived(stepFields(step).every((k) => !validateField(k)));

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
		for (const k of stepFields(step)) touched[k] = true;
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
		for (let i = 0; i < steps.length; i++) {
			for (const k of stepFields(i)) touched[k] = true;
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
				terms_accepted: termsAccepted,
				mfa_allowed: mfaAllowed,
				...(mfaAllowed
					? {
							mfa_policy_mode: mfaMode,
							mfa_allowed_methods: [
								...(mfaTotp ? (['TOTP'] as const) : []),
								...(mfaEmailOtp ? (['EMAIL_OTP'] as const) : [])
							]
						}
					: {}),
				...(template.capabilityDriven ? { capability_overrides: capabilityOverrides } : {}),
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
			const detail = (failure.detail || '').toLowerCase();
			if (detail.includes('subdomain') || detail.includes('slug')) {
				slugStatus = 'taken';
				errors.slug = 'Another business already uses this subdomain';
				touched.slug = true;
				step = 1;
				toast.error('The subdomain is already in use. Please choose another.');
			} else if (detail.includes('admin email') || detail.includes('email already exists') || detail.includes('email')) {
				emailStatus = 'taken';
				errors.admin_email = 'This administrator email is already registered';
				touched.admin_email = true;
				step = 2;
				toast.error('This administrator email is already registered. Please use another.');
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
		themeSelectedByUser = false;
		config = fresh.config;
		capabilityOverrides = fresh.capabilityOverrides;
		capabilityRows = [];
		termsAccepted = fresh.termsAccepted;
		plan = plans.find((p) => p.code === defaultPlan)?.code ?? plans[0]?.code ?? '';
		errors = {};
		touched = {};
		slugStatus = 'idle';
		failure = null;
		dirty = false;
	}

	let copiedKey = $state<string | null>(null);

	async function copyUrl(url: string, key: string, label: string) {
		try {
			await navigator.clipboard.writeText(url);
			copiedKey = key;
			toast.success(`${label} copied`);
			setTimeout(() => {
				if (copiedKey === key) copiedKey = null;
			}, 2000);
		} catch {
			toast.error(`Could not copy ${label.toLowerCase()}`);
		}
	}

	/* ---------- derived display ---------- */

	const storefrontUrl = $derived(
		tenantFrontendOrigin(
			org.slug || 'subdomain',
			baseDomain,
			appEnv === 'production' || appEnv === 'prod' ? null : frontendPort
		)
	);
	const loginUrl = $derived(`${storefrontUrl}/login`);
	const isTrial = $derived(selectedPlan?.billingPeriod === 'trial' || plan === 'TRIAL');
	const trialDays = $derived(selectedPlan?.trialDays ?? 0);
	const shows = (control: string) => template.controls.includes(control as never);

	/** One line describing how customers pay, for the review card. */
	function paymentSummary(): string {
		const methods: string[] = [];
		if (config.online_payment_enabled) methods.push('online');
		if (config.cash_enabled) methods.push('cash');
		if (methods.length === 0) return 'No payment method enabled';
		const when = config.payment_requirement === 'AT_PICKUP' ? 'at pickup' : 'before preparation';
		return `${methods.join(' or ')}, ${when}`;
	}
</script>

{#if created}
	{@const tenantUrl = rewriteFrontendPort(created.tenant_url)}
	{@const setupUrl = joinTenantSetupUrl(created.tenant_url, created.setup_path)}
	{@const adminLoginUrl = rewriteFrontendPort(created.login_url || `${created.tenant_url}/login`)}
	{@const superadminUrl = `/superadmin/businesses/${created.tenant.id}`}
	{@const superadminFullUrl = typeof window !== 'undefined' ? `${window.location.origin}${superadminUrl}` : superadminUrl}
	
	<div class="onb-success-page">
		<!-- Page Navigation Bar -->
		<div class="onb-success-nav">
			<div class="onb-success-nav-left">
				<a href="/superadmin/businesses" class="btn btn-ghost btn-sm">
					<IconArrowLeft size={14} stroke={2} />
					<span>Back to Businesses</span>
				</a>
			</div>
			<div class="onb-success-nav-right">
				<button type="button" class="btn btn-ghost btn-sm" onclick={createAnother}>
					<IconPlus size={14} stroke={2} />
					<span>Onboard Another</span>
				</button>
				<a class="btn btn-primary btn-sm" href={superadminUrl}>
					<span>Manage Business</span>
					<IconArrowRight size={14} stroke={2} />
				</a>
			</div>
		</div>

		<!-- Page Header -->
		<div class="onb-success-header">
			<div class="onb-success-icon-badge">
				<IconCircleCheck size={26} stroke={1.8} />
			</div>
			<div class="onb-success-title-box">
				<div class="onb-success-status-pill">
					<span class="onb-status-dot"></span>
					<span>Tenant Provisioned & Active</span>
				</div>
				<h1 class="onb-success-title">{created.tenant.name} is Live</h1>
				<p class="onb-success-subtitle">
					Provisioned as a {template.label.toLowerCase()} on the {selectedPlan?.label || created.plan || 'Standard'} plan. Secure initialization credentials generated.
				</p>
			</div>
		</div>

		<!-- High-Density Specification Manifest -->
		<div class="onb-success-spec">
			<div class="onb-success-spec-col">
				<span class="onb-success-spec-k">Organization</span>
				<span class="onb-success-spec-v" title={created.tenant.name}>{created.tenant.name}</span>
			</div>
			<div class="onb-success-spec-col">
				<span class="onb-success-spec-k">Subdomain</span>
				<span class="onb-success-spec-v" title={created.tenant.slug}>{created.tenant.slug}.{baseDomain}</span>
			</div>
			<div class="onb-success-spec-col">
				<span class="onb-success-spec-k">Administrator</span>
				<span class="onb-success-spec-v" title={created.admin_email}>{created.admin_email}</span>
			</div>
			<div class="onb-success-spec-col">
				<span class="onb-success-spec-k">Operating Model</span>
				<span class="onb-success-spec-v">{template.label} · {selectedPlan?.label || created.plan || 'Standard'}</span>
			</div>
			<div class="onb-success-spec-col">
				<span class="onb-success-spec-k">Currency / Timezone</span>
				<span class="onb-success-spec-v">{org.currency || 'INR'} · {org.timezone || 'Asia/Kolkata'}</span>
			</div>
		</div>

		<!-- Endpoints & Access Links -->
		<div class="onb-links-group">
			<div class="onb-links-header">
				<span class="onb-links-title">System Endpoints & Access Links</span>
				<span class="onb-links-count">4 endpoints ready</span>
			</div>

			<!-- Link 1: Administrator Setup Link -->
			<div class="onb-endpoint-row onb-endpoint-highlight">
				<div class="onb-endpoint-meta">
					<div class="onb-endpoint-icon">
						<IconKey size={16} stroke={2} />
					</div>
					<div class="onb-endpoint-info">
						<div class="onb-endpoint-title-row">
							<span class="onb-endpoint-title">Administrator Setup Link</span>
							{#if created.email_sent}
								<span class="onb-badge onb-badge-ok">Emailed to {created.admin_email}</span>
							{:else}
								<span class="onb-badge onb-badge-warn">Email not sent because it's not configured</span>
							{/if}
						</div>
						<span class="onb-endpoint-desc">
							Single-use initialization link for tenant owner to establish their password and policy acceptance.
						</span>
						{#if !created.email_sent}
							<div class="onb-email-unsent-banner">
								<IconAlertCircle size={15} stroke={2} />
								<span>
									<strong>Email not sent:</strong> Platform email (SMTP) is not configured. Please copy this setup link and share it directly with <strong>{created.admin_email}</strong>.
								</span>
							</div>
						{/if}
					</div>
				</div>
				<div class="onb-endpoint-url-bar">
					<code class="onb-endpoint-code" title={setupUrl}>{setupUrl}</code>
					<div class="onb-endpoint-actions">
						<button
							type="button"
							class="onb-link-btn"
							class:is-copied={copiedKey === 'setup'}
							onclick={() => copyUrl(setupUrl, 'setup', 'Administrator setup link')}
							title="Copy setup link"
						>
							{#if copiedKey === 'setup'}
								<IconCheck size={13} stroke={2.5} />
								<span>Copied</span>
							{:else}
								<IconCopy size={13} stroke={2} />
								<span>Copy</span>
							{/if}
						</button>
						<a
							class="onb-link-btn onb-link-btn-ghost"
							href={setupUrl}
							target="_blank"
							rel="noreferrer"
							title="Open setup link in new tab"
						>
							<span>Open</span>
							<IconExternalLink size={12} stroke={2} />
						</a>
					</div>
				</div>
			</div>

			<!-- Link 2: Tenant Admin Portal -->
			<div class="onb-endpoint-row">
				<div class="onb-endpoint-meta">
					<div class="onb-endpoint-icon">
						<IconLayoutDashboard size={16} stroke={2} />
					</div>
					<div class="onb-endpoint-info">
						<div class="onb-endpoint-title-row">
							<span class="onb-endpoint-title">Tenant Admin Portal</span>
							<span class="onb-badge onb-badge-neutral">Staff Console</span>
						</div>
						<span class="onb-endpoint-desc">
							Staff and management portal for catalog items, incoming orders, and daily business operations.
						</span>
					</div>
				</div>
				<div class="onb-endpoint-url-bar">
					<code class="onb-endpoint-code" title={adminLoginUrl}>{adminLoginUrl}</code>
					<div class="onb-endpoint-actions">
						<button
							type="button"
							class="onb-link-btn"
							class:is-copied={copiedKey === 'admin'}
							onclick={() => copyUrl(adminLoginUrl, 'admin', 'Tenant admin portal link')}
							title="Copy admin login link"
						>
							{#if copiedKey === 'admin'}
								<IconCheck size={13} stroke={2.5} />
								<span>Copied</span>
							{:else}
								<IconCopy size={13} stroke={2} />
								<span>Copy</span>
							{/if}
						</button>
						<a
							class="onb-link-btn onb-link-btn-ghost"
							href={adminLoginUrl}
							target="_blank"
							rel="noreferrer"
							title="Open admin console in new tab"
						>
							<span>Open</span>
							<IconExternalLink size={12} stroke={2} />
						</a>
					</div>
				</div>
			</div>

			<!-- Link 3: Customer Storefront -->
			<div class="onb-endpoint-row">
				<div class="onb-endpoint-meta">
					<div class="onb-endpoint-icon">
						<IconBuildingStore size={16} stroke={2} />
					</div>
					<div class="onb-endpoint-info">
						<div class="onb-endpoint-title-row">
							<span class="onb-endpoint-title">Public Storefront</span>
							<span class="onb-badge onb-badge-neutral">Storefront</span>
						</div>
						<span class="onb-endpoint-desc">
							Customer-facing responsive storefront and menu ordering portal.
						</span>
					</div>
				</div>
				<div class="onb-endpoint-url-bar">
					<code class="onb-endpoint-code" title={tenantUrl}>{tenantUrl}</code>
					<div class="onb-endpoint-actions">
						<button
							type="button"
							class="onb-link-btn"
							class:is-copied={copiedKey === 'store'}
							onclick={() => copyUrl(tenantUrl, 'store', 'Storefront link')}
							title="Copy storefront link"
						>
							{#if copiedKey === 'store'}
								<IconCheck size={13} stroke={2.5} />
								<span>Copied</span>
							{:else}
								<IconCopy size={13} stroke={2} />
								<span>Copy</span>
							{/if}
						</button>
						<a
							class="onb-link-btn onb-link-btn-ghost"
							href={tenantUrl}
							target="_blank"
							rel="noreferrer"
							title="Open storefront in new tab"
						>
							<span>Open</span>
							<IconExternalLink size={12} stroke={2} />
						</a>
					</div>
				</div>
			</div>

			<!-- Link 4: SuperAdmin Management Console -->
			<div class="onb-endpoint-row">
				<div class="onb-endpoint-meta">
					<div class="onb-endpoint-icon">
						<IconSettings size={16} stroke={2} />
					</div>
					<div class="onb-endpoint-info">
						<div class="onb-endpoint-title-row">
							<span class="onb-endpoint-title">SuperAdmin Tenant Console</span>
							<span class="onb-badge onb-badge-neutral">Platform Governance</span>
						</div>
						<span class="onb-endpoint-desc">
							Platform oversight, capability toggles, subscription management, and audit logs.
						</span>
					</div>
				</div>
				<div class="onb-endpoint-url-bar">
					<code class="onb-endpoint-code" title={superadminUrl}>{superadminUrl}</code>
					<div class="onb-endpoint-actions">
						<button
							type="button"
							class="onb-link-btn"
							class:is-copied={copiedKey === 'superadmin'}
							onclick={() => copyUrl(superadminFullUrl, 'superadmin', 'Superadmin management link')}
							title="Copy superadmin tenant link"
						>
							{#if copiedKey === 'superadmin'}
								<IconCheck size={13} stroke={2.5} />
								<span>Copied</span>
							{:else}
								<IconCopy size={13} stroke={2} />
								<span>Copy</span>
							{/if}
						</button>
						<a
							class="onb-link-btn onb-link-btn-ghost"
							href={superadminUrl}
							title="Open tenant console in SuperAdmin"
						>
							<span>Manage</span>
							<IconArrowRight size={12} stroke={2} />
						</a>
					</div>
				</div>
			</div>
		</div>

		<!-- Operational Next Steps Guidance -->
		<div class="onb-guidance-panel">
			<div class="onb-guidance-head">
				<span>Next Operational Steps</span>
			</div>
			<div class="onb-guidance-list">
				<div class="onb-guidance-step">
					<span class="onb-step-num">1</span>
					<div class="onb-step-text">
						{#if !created.email_sent}
							<strong>Share Setup Link:</strong> Email was not sent because SMTP is not configured. Share the single-use setup URL directly with <strong>{created.admin_email}</strong>.
						{:else}
							<strong>Send Initialization Link:</strong> Share the single-use setup URL directly with <strong>{created.admin_email}</strong>.
						{/if}
					</div>
				</div>
				<div class="onb-guidance-step">
					<span class="onb-step-num">2</span>
					<div class="onb-step-text">
						<strong>Admin Password & Policy:</strong> Tenant owner establishes their admin password and accepts platform agreements.
					</div>
				</div>
				<div class="onb-guidance-step">
					<span class="onb-step-num">3</span>
					<div class="onb-step-text">
						<strong>Go-Live Readiness:</strong> Staff can sign into the Tenant Admin Portal to configure catalog, schedule, and launch.
					</div>
				</div>
			</div>
		</div>

		<!-- Footer Actions -->
		<div class="onb-success-actions">
			<button type="button" class="btn btn-ghost" onclick={createAnother}>
				<IconPlus size={14} stroke={2} />
				<span>Onboard Another</span>
			</button>
			<a class="btn btn-ghost" href="/superadmin/businesses">
				Back to Businesses
			</a>
			<a class="btn btn-primary" href={superadminUrl}>
				<span>Manage Business</span>
				<IconArrowRight size={14} stroke={2} />
			</a>
		</div>
	</div>
{:else}
	<OnboardShell
		{steps}
		{step}
		{stepValid}
		{submitting}
		blocked={optionsLoading}
		canfinish={termsAccepted}
		themeColors={{
			primary: activePreviewTheme.primary,
			secondary: activePreviewTheme.secondary,
			accent: activePreviewTheme.accent
		}}
		onstepselect={jumpTo}
		onback={goBack}
		onnext={goNext}
		oncreate={create}
	>
		{#snippet preview()}
			<PortalPreview
				{template}
				businessName={org.name}
				slug={org.slug}
				{baseDomain}
				frontendPort={appEnv === 'production' || appEnv === 'prod' ? '' : frontendPort}
				capabilityLabels={enabledCapabilities}
				primary={activePreviewTheme.primary}
				secondary={activePreviewTheme.secondary}
				accent={activePreviewTheme.accent}
				themePreset={activePreviewTheme.preset}
				mode={activePreviewTheme.mode}
				logoUrl={theme.logo_url}
			/>
		{/snippet}

		{#if optionsLoading}
			<div class="onb-skeletons">
				{#each [1, 2, 3, 4] as i (i)}
					<div class="onb-skeleton onb-skeleton-card"></div>
				{/each}
			</div>
		{:else if step === 0}
			<div class="onb-step-in">
				<h1 class="onb-title">Business Category</h1>
				<p class="onb-sub">
					Select the operating model and industry template for this organization.
				</p>
				{#if errors.type}
					<p class="onb-error" id="type-error" role="alert">{errors.type}</p>
				{/if}
				<TypePicker
					templates={typeOptions}
					value={type}
					describedby={errors.type ? 'type-error' : ''}
					onselect={chooseType}
				/>
			</div>
		{:else if step === 1}
			<div class="onb-step-in">
				<h1 class="onb-title">Organization Profile</h1>
				<p class="onb-sub">
					Configure business identity, tenant subdomain, and regional settings.
				</p>

				<FormField label="Business name" htmlFor="org-name" required error={errors.name}>
					{#snippet children(control)}
						<TextInput
							id="org-name"
							bind:value={org.name}
							placeholder="Momo Magic"
							autocomplete="organization"
							onblur={() => {
								autoSlug();
								onBlurField('name');
							}}
							{...control}
						/>
					{/snippet}
				</FormField>

				<SlugField
					id="org-slug"
					bind:value={org.slug}
					{baseDomain}
					port={appEnv === 'production' || appEnv === 'prod' ? '' : frontendPort}
					status={slugStatus}
					error={errors.slug ?? ''}
					onslugchange={() => (dirty = true)}
					onblur={() => onBlurField('slug')}
				/>

				<div class="onb-row-2">
					<FormField label="Phone" htmlFor="org-phone" error={errors.phone}>
						{#snippet children(control)}
							<TextInput
								id="org-phone"
								type="tel"
								inputmode="tel"
								bind:value={org.phone}
								placeholder="9876543210"
								autocomplete="tel"
								onblur={() => onBlurField('phone')}
								{...control}
							/>
						{/snippet}
					</FormField>
					<FormField label="Business email" htmlFor="org-email" error={errors.email}>
						{#snippet children(control)}
							<TextInput
								id="org-email"
								type="email"
								bind:value={org.email}
								placeholder="hello@example.com"
								autocomplete="email"
								onblur={() => onBlurField('email')}
								{...control}
							/>
						{/snippet}
					</FormField>
				</div>

				<FormField
					label="Short description"
					htmlFor="org-desc"
					error={errors.short_description}
					hint={`${org.short_description.length}/160`}
				>
					{#snippet children(control)}
						<TextArea
							id="org-desc"
							rows={2}
							bind:value={org.short_description}
							placeholder="Fast, fresh momo made to order."
							{...control}
						/>
					{/snippet}
				</FormField>

				<div class="onb-row-3">
					<FormField label="Currency" htmlFor="org-currency" error={errors.currency}>
						{#snippet children(control)}
							<SelectField id="org-currency" bind:value={org.currency} options={CURRENCIES} {...control} />
						{/snippet}
					</FormField>
					<FormField label="Timezone" htmlFor="org-tz" error={errors.timezone}>
						{#snippet children(control)}
							<SelectField id="org-tz" bind:value={org.timezone} options={TIMEZONES} {...control} />
						{/snippet}
					</FormField>
					<FormField label="Language" htmlFor="org-lang" error={errors.language}>
						{#snippet children(control)}
							<SelectField id="org-lang" bind:value={org.language} options={LANGUAGES} {...control} />
						{/snippet}
					</FormField>
				</div>
			</div>
		{:else if step === 2}
			<div class="onb-step-in">
				<h1 class="onb-title">Administrator Account</h1>
				<p class="onb-sub">
					Designate administrative contact. A secure setup link will be generated.
				</p>

				<FormField label="Owner name" htmlFor="own-name" required error={errors.owner_name}>
					{#snippet children(control)}
						<TextInput
							id="own-name"
							bind:value={admin.owner_name}
							placeholder="Rahul Sharma"
							autocomplete="off"
							onblur={() => {
								if (!admin.admin_name.trim()) admin.admin_name = admin.owner_name;
								onBlurField('owner_name');
							}}
							{...control}
						/>
					{/snippet}
				</FormField>

				<div class="onb-row-2">
					<FormField
						label="Administrator name"
						htmlFor="adm-name"
						required
						error={errors.admin_name}
					>
						{#snippet children(control)}
							<TextInput
								id="adm-name"
								bind:value={admin.admin_name}
								autocomplete="off"
								onblur={() => onBlurField('admin_name')}
								{...control}
							/>
						{/snippet}
					</FormField>
					<FormField
						label="Administrator email"
						htmlFor="adm-email"
						required
						error={errors.admin_email}
					>
						{#snippet children(control)}
							<TextInput
								id="adm-email"
								type="email"
								bind:value={admin.admin_email}
								placeholder="rahul@example.com"
								autocomplete="off"
								onblur={() => onBlurField('admin_email')}
								{...control}
							/>
						{/snippet}
					</FormField>
				</div>

				{#if configsLoaded && !smtpConfigured}
					<div class="onb-warning-callout">
						<div class="onb-warning-callout-icon">
							<IconAlertTriangle size={17} stroke={2} />
						</div>
						<div class="onb-warning-callout-content">
							<div class="onb-warning-callout-title">Email service (SMTP) is not configured</div>
							<div class="onb-warning-callout-text">
								The tenant will still be created, but the invitation email will not be sent because SMTP is not configured on the platform. You will be provided with a single-use setup link after creation to share directly with the administrator.
								<a href="/superadmin/providers" target="_blank" rel="noreferrer" class="onb-warning-callout-link">Configure SMTP in Providers &rarr;</a>
							</div>
						</div>
					</div>
				{/if}

				<FormField label="Administrator phone" htmlFor="adm-phone" error={errors.admin_phone}>
					{#snippet children(control)}
						<TextInput
							id="adm-phone"
							type="tel"
							inputmode="tel"
							bind:value={admin.admin_phone}
							placeholder="9876543210"
							autocomplete="off"
							onblur={() => onBlurField('admin_phone')}
							{...control}
						/>
					{/snippet}
				</FormField>
			</div>
		{:else if step === 3}
			<div class="onb-step-in">
				<h1 class="onb-title">Subscription Plan</h1>
				<p class="onb-sub">
					Assign an initial subscription tier and resource allocation for this tenant.
				</p>

				{#if plans.length === 0}
					<OnboardAlert tone="warn">
						No active plan is offered to a {template.label.toLowerCase()}. Add or enable one under
						<a href="/superadmin/plans">Plans &amp; subscriptions</a>.
					</OnboardAlert>
				{:else}
					{#if errors.plan}
						<p class="onb-error" id="plan-error" role="alert">{errors.plan}</p>
					{/if}
					<OnboardPlanPicker
						{plans}
						value={plan}
						describedby={errors.plan ? 'plan-error' : ''}
						onselect={choosePlan}
					/>
				{/if}
			</div>
		{:else if step === 4}
			<div class="onb-step-in">
				<h1 class="onb-title">Branding &amp; Theme</h1>
				<p class="onb-sub">
					Select default styling for storefront and admin console. Customizable anytime.
				</p>

				<ThemePicker value={theme.preset} onselect={(id) => {
					const preset = THEME_PRESETS.find((candidate) => candidate.id === id);
					if (preset) applyPreset(preset);
				}} />

				<div class="onb-row-2">
					<FormField label="Theme Mode" htmlFor="theme-mode">
						{#snippet children(control)}
							<SelectField
								id="theme-mode"
								bind:value={theme.mode}
								onchange={() => {
									dirty = true;
									themeSelectedByUser = true;
								}}
								options={[
									{ value: 'light', label: 'Light' },
									{ value: 'dark', label: 'Dark' },
									{ value: 'system', label: 'System' }
								]}
								{...control}
							/>
						{/snippet}
					</FormField>
					<FormField label="Favicon URL (Optional)" htmlFor="favicon-url" error={errors.favicon_url}>
						{#snippet children(control)}
							<TextInput
								id="favicon-url"
								type="url"
								bind:value={theme.favicon_url}
								placeholder="https://…/favicon.ico"
								autocomplete="off"
								onblur={() => onBlurField('favicon_url')}
								{...control}
							/>
						{/snippet}
					</FormField>
				</div>

				<!-- Business Logo Uploader Section -->
				<div class="onb-logo-uploader">
					<div class="onb-logo-header">
						<div class="onb-logo-label-group">
							<span class="onb-logo-label">Business Logo</span>
							<span class="onb-logo-hint">Displayed on storefront header, invoices, and customer communications</span>
						</div>
						<div class="onb-logo-tabs" role="tablist">
							<button
								type="button"
								class="onb-logo-tab"
								class:is-active={logoMode === 'upload'}
								onclick={() => (logoMode = 'upload')}
							>
								<IconUpload size={13} stroke={2} />
								<span>Upload File</span>
							</button>
							<button
								type="button"
								class="onb-logo-tab"
								class:is-active={logoMode === 'url'}
								onclick={() => (logoMode = 'url')}
							>
								<IconLink size={13} stroke={2} />
								<span>Image URL</span>
							</button>
						</div>
					</div>

					{#if logoMode === 'upload'}
						<input
							type="file"
							bind:this={logoFileInput}
							accept="image/png,image/jpeg,image/webp,image/svg+xml"
							class="sr-only"
							style="display: none;"
							onchange={onLogoFileSelected}
						/>

						{#if configsLoaded && !storageConfigured}
							<div class="onb-warning-callout" style="margin-top: 0; margin-bottom: 0.5rem;">
								<div class="onb-warning-callout-icon">
									<IconAlertTriangle size={16} stroke={2} />
								</div>
								<div class="onb-warning-callout-content">
									<div class="onb-warning-callout-title">Storage provider is not configured</div>
									<div class="onb-warning-callout-text">
										Platform storage is not yet connected. Uploaded files will be embedded directly, or you can switch to the <strong>Image URL</strong> tab.
										<a href="/superadmin/providers" target="_blank" rel="noreferrer" class="onb-warning-callout-link">Configure Storage in Providers &rarr;</a>
									</div>
								</div>
							</div>
						{/if}

						{#if isUploadingLogo}
							<div class="onb-upload-loading">
								<div class="spinner" style="width: 16px; height: 16px;"></div>
								<span>Uploading logo to platform storage...</span>
							</div>
						{:else if theme.logo_url}
							<div class="onb-logo-preview-card">
								<div class="onb-logo-preview-thumb">
									<img src={theme.logo_url} alt="Logo preview" />
								</div>
								<div class="onb-logo-preview-info">
									<span class="onb-logo-preview-name">Active Business Logo</span>
									<span class="onb-logo-preview-url" title={theme.logo_url}>{theme.logo_url}</span>
								</div>
								<div class="onb-logo-preview-actions">
									<button
										type="button"
										class="onb-logo-btn"
										onclick={() => logoFileInput?.click()}
										title="Replace with another file"
									>
										<IconUpload size={12} stroke={2} />
										<span>Change</span>
									</button>
									<button
										type="button"
										class="onb-logo-btn onb-logo-btn-danger"
										onclick={removeLogo}
										title="Remove logo"
									>
										<IconTrash size={12} stroke={2} />
										<span>Remove</span>
									</button>
								</div>
							</div>
						{:else}
							<!-- svelte-ignore a11y_click_events_have_key_events -->
							<!-- svelte-ignore a11y_no_static_element_interactions -->
							<div
								class="onb-logo-dropzone"
								class:is-dragover={isDragOverLogo}
								onclick={() => logoFileInput?.click()}
								ondragover={(e) => { e.preventDefault(); isDragOverLogo = true; }}
								ondragleave={() => (isDragOverLogo = false)}
								ondrop={onLogoDrop}
							>
								<div class="onb-logo-dropzone-icon">
									<IconPhoto size={20} stroke={1.8} />
								</div>
								<span class="onb-logo-dropzone-text">
									Drop your business logo here, or <span style="color: var(--portal-accent, #6366f1); text-decoration: underline;">browse file</span>
								</span>
								<span class="onb-logo-dropzone-sub">
									PNG, JPG, WebP, or SVG up to 5MB (transparent background recommended)
								</span>
							</div>
						{/if}

						{#if logoUploadError}
							<p class="onb-error" role="alert" style="margin-top: 0.25rem;">{logoUploadError}</p>
						{/if}
					{:else}
						<FormField label="Direct Image URL" htmlFor="logo-url" error={errors.logo_url}>
							{#snippet children(control)}
								<TextInput
									id="logo-url"
									type="url"
									bind:value={theme.logo_url}
									placeholder="https://example.com/logo.png"
									autocomplete="off"
									oninput={() => {
										dirty = true;
										themeSelectedByUser = true;
									}}
									onblur={() => onBlurField('logo_url')}
									{...control}
								/>
							{/snippet}
						</FormField>
					{/if}
				</div>
			</div>
		{:else if step === 5}
			<div class="onb-step-in">
				{#if template.capabilityDriven}
					<h1 class="onb-title">Enabled Modules</h1>
					<p class="onb-sub">
						Configure default capabilities and optional modules for this {template.label.toLowerCase()}.
					</p>

					{#if capabilitiesLoading}
						<div class="onb-skeletons">
							{#each [1, 2, 3] as i (i)}<div class="onb-skeleton"></div>{/each}
						</div>
					{:else}
						{#if includedCapabilities.length > 0}
							<div class="onb-group">
								<span class="onb-label">Always included</span>
								<div class="onb-tags">
									{#each includedCapabilities as cap (cap.code)}
										<span class="onb-tag onb-tag-acc">{cap.label}</span>
									{/each}
								</div>
							</div>
						{/if}
						{#if optionalCapabilities.length > 0}
							<fieldset class="onb-group">
								<legend class="onb-label">Optional</legend>
								{#each optionalCapabilities as cap (cap.code)}
									<Switch
										bind:checked={capabilityOverrides[cap.code]}
										label={cap.label}
										onchange={() => {
											dirty = true;
											touched.prep_time = true;
										}}
									/>
								{/each}
							</fieldset>
						{/if}
						{#if includedCapabilities.length === 0 && optionalCapabilities.length === 0}
							<p class="onb-hint">
								No capability matrix is configured for this business type yet — it will be
								created with no modules enabled.
							</p>
						{/if}
					{/if}
				{:else}
					<h1 class="onb-title">Operational Settings</h1>
					<p class="onb-sub">
						Configure order workflows, fulfillment rules, and payment options.
					</p>

					{#if shows('ordering')}
						<Switch bind:checked={config.ordering_enabled} label="Accept orders from customers" />
					{/if}

					{#if shows('customer_login')}
						<FormField label="Customer accounts" htmlFor="cfg-login">
							{#snippet children(control)}
								<SelectField
									id="cfg-login"
									bind:value={config.customer_login_mode}
									options={[
										{
											value: 'off',
											label: CONTROL_LABELS.customer_login_mode.off
										},
										{
											value: 'optional',
											label: CONTROL_LABELS.customer_login_mode.optional
										},
										{
											value: 'required',
											label: CONTROL_LABELS.customer_login_mode.required
										}
									]}
									{...control}
								/>
							{/snippet}
						</FormField>
					{/if}

					{#if shows('prep_time')}
						<FormField
							label="Typical preparation time"
							htmlFor="cfg-prep"
							error={errors.prep_time}
						>
							{#snippet children(control)}
								<TextInput
									id="cfg-prep"
									type="number"
									min={1}
									max={240}
									suffix="min"
									value={String(config.prep_time_minutes)}
									oninput={(e) => {
										config.prep_time_minutes = Number((e.currentTarget as HTMLInputElement).value);
										dirty = true;
										touched.prep_time = true;
										validateStep(step);
									}}
									{...control}
								/>
							{/snippet}
						</FormField>
					{/if}

					{#if shows('acceptance')}
						<FormField label="Order acceptance" htmlFor="cfg-accept">
							{#snippet children(control)}
								<SelectField
									id="cfg-accept"
									bind:value={config.acceptance_mode}
									options={[
										{ value: 'MANUAL', label: CONTROL_LABELS.acceptance_mode.MANUAL },
										{ value: 'AUTO', label: CONTROL_LABELS.acceptance_mode.AUTO }
									]}
									{...control}
								/>
							{/snippet}
						</FormField>
					{/if}

					{#if shows('payment_methods')}
						<fieldset class="onb-group" aria-describedby={errors.payment_methods ? 'pay-error' : undefined}>
							<legend class="onb-label">Payment methods</legend>
							<Switch bind:checked={config.online_payment_enabled} label="Online payment" />
							<Switch bind:checked={config.cash_enabled} label="Cash" />
							{#if errors.payment_methods}
								<p class="onb-error" id="pay-error" role="alert">{errors.payment_methods}</p>
							{/if}
						</fieldset>
					{/if}

					{#if shows('payment_timing')}
						<FormField label="When customers pay" htmlFor="cfg-timing">
							{#snippet children(control)}
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
									{...control}
								/>
							{/snippet}
						</FormField>
					{/if}

					{#if shows('ready_notification')}
						<Switch
							bind:checked={config.ready_notification}
							label="Notify the customer when ready"
						/>
					{/if}

					{#if shows('auto_complete')}
						<Switch
							bind:checked={config.auto_complete}
							label="Complete orders automatically once ready"
						/>
					{/if}
				{/if}
			</div>
		{:else}
			<div class="onb-step-in">
				<div class="onb-review-header-block">
					<h1 class="onb-title">Review &amp; Provision</h1>
					<p class="onb-sub">
						Verify the organization specification below before initializing the tenant.
					</p>
				</div>

				<div class="onb-review-main">
					<div class="onb-review-spec">
						<!-- Row 1: Business Identity & Template -->
						<div class="onb-spec-row">
							<span class="onb-spec-label">Business</span>
							<div class="onb-spec-body">
								<div class="onb-spec-main">
									<span>{org.name || 'Untitled Business'}</span>
									<span class="onb-spec-badge">{template.label}</span>
								</div>
								<div class="onb-spec-meta">
									<code>https://{org.slug || 'slug'}.{baseDomain}</code>
									<span class="onb-spec-dot">·</span>
									<span>Currency: {org.currency || 'INR'}</span>
									<span class="onb-spec-dot">·</span>
									<span>{org.timezone || 'Asia/Kolkata'}</span>
								</div>
							</div>
							<button type="button" class="onb-spec-edit" onclick={() => (step = 1)} title="Edit Business">
								<span>Edit</span>
								<IconPencil size={11} stroke={2} />
							</button>
						</div>

						<!-- Row 2: Admin & Ownership -->
						<div class="onb-spec-row">
							<span class="onb-spec-label">Admin</span>
							<div class="onb-spec-body">
								<div class="onb-spec-main">
									<span>{admin.owner_name || 'Owner'}</span>
									<span class="onb-spec-badge">Tenant Admin</span>
								</div>
								<div class="onb-spec-meta">
									<span>{admin.admin_email || '—'}</span>
									<span class="onb-spec-dot">·</span>
									{#if configsLoaded && !smtpConfigured}
										<span class="onb-spec-warn-badge">Email not configured · Manual setup link</span>
									{:else}
										<span>Immediate credentials dispatch via SMTP</span>
									{/if}
								</div>
							</div>
							<button type="button" class="onb-spec-edit" onclick={() => (step = 2)} title="Edit Admin">
								<span>Edit</span>
								<IconPencil size={11} stroke={2} />
							</button>
						</div>

						<!-- Row 3: Subscription & Billing -->
						<div class="onb-spec-row">
							<span class="onb-spec-label">Plan</span>
							<div class="onb-spec-body">
								<div class="onb-spec-main">
									<span>{selectedPlan?.label ?? plan ?? 'Standard'}</span>
								</div>
								<div class="onb-spec-meta">
									<span>{isTrial ? `${trialDays}-Day Free Trial (Trial Provisioning)` : 'Active Subscription (Immediate Billing)'}</span>
								</div>
							</div>
							<button type="button" class="onb-spec-edit" onclick={() => (step = 3)} title="Edit Plan">
								<span>Edit</span>
								<IconPencil size={11} stroke={2} />
							</button>
						</div>

						<!-- Row 4: Brand & Visual Theme -->
						<div class="onb-spec-row">
							<span class="onb-spec-label">Branding</span>
							<div class="onb-spec-body">
								<div class="onb-spec-main">
									<span>{THEME_PRESETS.find((p) => p.id === theme.preset)?.name || 'Modern'} Theme</span>
									<span class="onb-spec-swatches" aria-label="Palette colors">
										<span class="onb-spec-swatch" style:background={theme.primary} title={`Primary: ${theme.primary}`}></span>
										<span class="onb-spec-swatch" style:background={theme.secondary} title={`Secondary: ${theme.secondary}`}></span>
										<span class="onb-spec-swatch" style:background={theme.accent} title={`Accent: ${theme.accent}`}></span>
									</span>
								</div>
								<div class="onb-spec-meta">
									<span class="capitalize">{theme.mode} Mode</span>
									<span class="onb-spec-dot">·</span>
									<span>Primary: {theme.primary}</span>
									{#if theme.logo_url}
										<span class="onb-spec-dot">·</span>
										<span>Logo configured</span>
									{/if}
								</div>
							</div>
							<button type="button" class="onb-spec-edit" onclick={() => (step = 4)} title="Edit Theme">
								<span>Edit</span>
								<IconPencil size={11} stroke={2} />
							</button>
						</div>

						<!-- Row 5: Operations & Governance -->
						<div class="onb-spec-row">
							<span class="onb-spec-label">Operations</span>
							<div class="onb-spec-body">
								{#if template.capabilityDriven}
									<div class="onb-spec-main">
										<span>{enabledCapabilities.length} capabilities enabled</span>
									</div>
									<div class="onb-spec-meta">
										<span>{enabledCapabilities.map((c) => c.label).join(' · ')}</span>
									</div>
								{:else}
									<div class="onb-spec-main">
										<span>{config.ordering_enabled ? 'Ordering Enabled' : 'Browse Only'}</span>
									</div>
									<div class="onb-spec-meta">
										<span>{paymentSummary()}</span>
									</div>
								{/if}
							</div>
							<button type="button" class="onb-spec-edit" onclick={() => (step = 5)} title="Edit Operations">
								<span>Edit</span>
								<IconPencil size={11} stroke={2} />
							</button>
						</div>

						<!-- Row 6: Security -->
						<div class="onb-spec-row">
							<span class="onb-spec-label">Security</span>
							<div class="onb-spec-body">
								<Switch
									bind:checked={mfaAllowed}
									label="Allow this business to use two-factor authentication"
									hint="Off by default. The policy below just seeds a starting point — the business's own Tenant Admin owns and can change it afterward from their Settings → Security."
								/>
								{#if mfaAllowed}
									<div style="margin-top:0.6rem;display:flex;flex-direction:column;gap:0.5rem;">
										<Select
											label="Starting policy"
											id="onb-mfa-mode"
											value={mfaMode}
											options={[
												{ value: 'OPTIONAL', label: 'Optional — anyone may turn it on for themselves' },
												{ value: 'REQUIRED', label: 'Required — enforced for all administrators' }
											]}
											onchange={(v) => (mfaMode = v as 'OPTIONAL' | 'REQUIRED')}
										/>
										<Switch bind:checked={mfaTotp} label="Authenticator app (TOTP)" />
										<Switch bind:checked={mfaEmailOtp} label="Email code" />
									</div>
								{/if}
							</div>
						</div>
					</div>

					<label class="onb-terms-row">
						<input
							type="checkbox"
							class="onb-terms-check"
							bind:checked={termsAccepted}
							aria-invalid={errors.terms ? 'true' : undefined}
							aria-describedby={errors.terms ? 'terms-error' : undefined}
							onchange={() => {
								dirty = true;
								touched.terms = true;
								validateStep(step);
							}}
						/>
						<span class="onb-terms-text">
							I confirm I am authorized to provision <strong>{org.name || 'this business'}</strong> under Orderly's <strong>Master Services Agreement</strong> and <strong>Business Operations Policy</strong>. Access credentials and initialization keys will be dispatched to <strong>{admin.admin_email || 'the owner'}</strong>.
						</span>
					</label>
					{#if errors.terms}
						<p class="onb-error" id="terms-error" role="alert">{errors.terms}</p>
					{/if}
				</div>
			</div>
		{/if}

		{#if failure}
			<OnboardAlert tone="error" title={failure.title}>{failure.detail}</OnboardAlert>
		{/if}
	</OnboardShell>
{/if}

<LeaveDraftModal
	bind:open={showLeaveModal}
	bind:rememberChoice={rememberLeaveChoice}
	onconfirm={confirmLeave}
	oncancel={cancelLeave}
/>
