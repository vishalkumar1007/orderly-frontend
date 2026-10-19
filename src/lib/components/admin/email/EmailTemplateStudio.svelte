<script lang="ts">
	/**
	 * The email template studio: every email this sender sends, its wording,
	 * and the branding they share, with a live preview rendered by the server
	 * so what is shown is exactly what is sent.
	 *
	 * Kept deliberately small. An email is a subject, a heading and a message;
	 * a highlight, a button and a note are added only when wanted. Branding is
	 * a logo, a colour, light or dark, and a footer. HTML is there for those
	 * who want it, one link away, and always sits inside the branding.
	 *
	 * One component for both levels: `platform` edits the defaults every
	 * business starts from plus the platform's own emails; `tenant` edits one
	 * business's copy. Class names carry an `es-` prefix because the app shell
	 * owns global names such as `.rail`.
	 */
	import { onMount, untrack } from 'svelte';
	import type { HTMLInputAttributes, HTMLTextareaAttributes } from 'svelte/elements';
	import ArrowBackUp from '@tabler/icons-svelte/icons/arrow-back-up';
	import Code from '@tabler/icons-svelte/icons/code';
	import DeviceDesktop from '@tabler/icons-svelte/icons/device-desktop';
	import DeviceMobile from '@tabler/icons-svelte/icons/device-mobile';
	import Mail from '@tabler/icons-svelte/icons/mail';
	import Moon from '@tabler/icons-svelte/icons/moon';
	import Palette from '@tabler/icons-svelte/icons/palette';
	import Photo from '@tabler/icons-svelte/icons/photo';
	import Plus from '@tabler/icons-svelte/icons/plus';
	import Search from '@tabler/icons-svelte/icons/search';
	import Send from '@tabler/icons-svelte/icons/send';
	import Sun from '@tabler/icons-svelte/icons/sun';
	import Trash from '@tabler/icons-svelte/icons/trash';
	import Upload from '@tabler/icons-svelte/icons/upload';
	import X from '@tabler/icons-svelte/icons/x';
	import ConfirmDialog from '$lib/components/admin/ConfirmDialog.svelte';
	import ErrorState from '$lib/components/admin/ErrorState.svelte';
	import FormField, { type FieldControl } from '$lib/components/admin/FormField.svelte';
	import Skeleton from '$lib/components/admin/Skeleton.svelte';
	import StatusBadge from '$lib/components/admin/StatusBadge.svelte';
	import UpgradeNote from '$lib/components/admin/UpgradeNote.svelte';
	import { toast } from '$lib/components/admin/toast';
	import { errorMessage } from '$lib/admin/errors';
	import {
		emailStudioApi,
		isExpiringLink,
		type BrandingView,
		type EmailBranding,
		type EmailContent,
		type EmailPreview,
		type EmailLayout,
		type EmailScope
	} from '$lib/admin/emailStudioApi';
	import {
		CATEGORY_LABEL,
		type NotificationCategory,
		type NotificationEventDef,
		type NotificationRule,
		type NotificationTemplate
	} from '$lib/admin/notificationTypes';
	import { featureAccess } from '$lib/tenant/entitlements.svelte';

	// FormField types aria-invalid as a plain string; native controls want the
	// narrower attribute types. Same values, so only the type changes.
	const wire = (c?: FieldControl) => c as unknown as HTMLInputAttributes & HTMLTextareaAttributes;

	let { scope, initialEvent = '' }: { scope: EmailScope; initialEvent?: string } = $props();

	// svelte-ignore state_referenced_locally
	const client = emailStudioApi(scope);
	const BRANDING = '__branding';
	const access = $derived(scope === 'platform' ? { enabled: true } : featureAccess('NOTIFY_TEMPLATES'));

	/* ---------- data ---------- */

	let events = $state<NotificationEventDef[]>([]);
	let rules = $state<NotificationRule[]>([]);
	let templates = $state<NotificationTemplate[]>([]);
	let brandingView = $state<BrandingView | null>(null);
	let loading = $state(true);
	let error = $state('');

	async function load() {
		loading = true;
		error = '';
		try {
			[events, rules, templates, brandingView] = await Promise.all([
				client.events(),
				client.rules(),
				client.templates(),
				client.branding()
			]);
			brandDraft = normalBranding(brandingView.branding);
			const first = initialEvent && listed.some((e) => e.code === initialEvent) ? initialEvent : listed[0]?.code;
			if (first) select(first);
		} catch (err) {
			error = errorMessage(err, 'load email templates');
		} finally {
			loading = false;
		}
	}
	onMount(load);

	/* ---------- the list ---------- */

	const CATEGORY_ORDER: NotificationCategory[] = [
		'ACCOUNT', 'ORDERS', 'PAYMENTS', 'BOOKINGS', 'INVENTORY', 'STAFF', 'SECURITY', 'PLATFORM'
	];

	// A business sees what it sends: its routed messages and its account
	// emails, never the platform's own alerts.
	const listed = $derived(
		scope === 'platform'
			? events
			: events.filter(
					(e) =>
						e.category === 'ACCOUNT' ||
						rules.some((r) => r.event_code === e.code && r.recipient_policy !== 'PLATFORM')
				)
	);

	let search = $state('');
	const groups = $derived.by(() => {
		const q = search.trim().toLowerCase();
		const hits = listed.filter(
			(e) => !q || e.label.toLowerCase().includes(q) || e.description.toLowerCase().includes(q)
		);
		return CATEGORY_ORDER.map((c) => ({
			category: c,
			label: c === 'PLATFORM' && scope === 'platform' ? 'Platform team' : CATEGORY_LABEL[c],
			items: hits.filter((e) => e.category === c).sort((a, b) => a.label.localeCompare(b.label))
		})).filter((g) => g.items.length);
	});

	const templateFor = (code: string, ch: string) =>
		templates.find((t) => t.event_code === code && t.channel === ch);
	const customized = (code: string) =>
		scope === 'tenant' && templates.some((t) => t.event_code === code && t.overridden);

	/* ---------- selection & draft ---------- */

	let selected = $state('');
	let channel = $state<'EMAIL' | 'SMS'>('EMAIL');
	let asHtml = $state(false);
	let lastEvent = $state('');

	const EMPTY: EmailContent = {
		subject: '', preheader: '', heading: '', body: '', highlight: '',
		button_label: '', button_url: '', footnote: '', html_body: ''
	};
	let draft = $state<EmailContent>({ ...EMPTY });
	let saved = $state<EmailContent>({ ...EMPTY });

	// The optional parts are shown once added, or when they already have text.
	let show = $state({ highlight: false, button: false, note: false });

	// What would be saved: the simple editor drops any HTML, so going back to
	// it and saving really returns the email to the standard layout.
	const effective = $derived<EmailContent>(asHtml ? { ...draft } : { ...draft, html_body: '' });
	const dirty = $derived(selected !== BRANDING && JSON.stringify(effective) !== JSON.stringify(saved));

	const event = $derived(events.find((e) => e.code === (selected === BRANDING ? lastEvent : selected)));
	const hasSms = $derived(rules.some((r) => r.event_code === selected && r.channel === 'SMS'));
	const current = $derived(selected === BRANDING ? undefined : templateFor(selected, channel));
	const variables = $derived(
		event ? [...event.variables, ...(event.variables.includes('business_name') ? [] : ['business_name'])] : []
	);

	function contentOf(t?: NotificationTemplate): EmailContent {
		return {
			subject: t?.subject ?? '',
			preheader: t?.preheader ?? '',
			heading: t?.heading ?? '',
			body: t?.body ?? '',
			highlight: t?.highlight ?? '',
			button_label: t?.button_label ?? '',
			button_url: t?.button_url ?? '',
			footnote: t?.footnote ?? '',
			html_body: t?.html_body ?? ''
		};
	}

	function select(code: string, ch: 'EMAIL' | 'SMS' = 'EMAIL') {
		selected = code;
		channel = ch;
		if (code === BRANDING) return;
		lastEvent = code;
		saved = contentOf(templateFor(code, ch));
		draft = { ...saved };
		asHtml = ch === 'EMAIL' && !!saved.html_body;
		show = {
			highlight: !!saved.highlight,
			button: !!(saved.button_label || saved.button_url),
			note: !!saved.footnote
		};
	}

	// Leaving unsaved work asks first; everything else switches at once.
	let pending = $state<{ code: string; ch: 'EMAIL' | 'SMS' } | null>(null);
	let discardOpen = $state(false);
	function open(code: string, ch: 'EMAIL' | 'SMS' = 'EMAIL') {
		if (dirty || brandDirty) {
			pending = { code, ch };
			discardOpen = true;
			return;
		}
		select(code, ch);
	}
	function discardAndGo() {
		discardOpen = false;
		if (brandingView) brandDraft = normalBranding(brandingView.branding);
		if (pending) select(pending.code, pending.ch);
		pending = null;
	}

	function removePart(part: 'highlight' | 'button' | 'note') {
		show[part] = false;
		if (part === 'highlight') draft.highlight = '';
		if (part === 'button') draft.button_label = draft.button_url = '';
		if (part === 'note') draft.footnote = '';
	}

	/* ---------- html ---------- */

	let loadingHtml = $state(false);
	let leaveHtmlOpen = $state(false);

	// The message as HTML, generated from the simple editor with the variables
	// still in place, so editing starts from the real email, not a blank page.
	async function editAsHtml() {
		if (!draft.html_body.trim()) {
			loadingHtml = true;
			try {
				const out = await client.preview(selected, { ...draft, html_body: '' }, brandDraft, true);
				draft.html_body = out.content ?? '';
			} catch (err) {
				toast.error(errorMessage(err, 'open the HTML'));
				return;
			} finally {
				loadingHtml = false;
			}
		}
		asHtml = true;
	}

	function useSimpleEditor() {
		leaveHtmlOpen = false;
		asHtml = false;
		draft.html_body = '';
	}

	/* ---------- variables ---------- */

	type FieldKey = keyof EmailContent;
	let focused = $state<{ key: FieldKey; el: HTMLInputElement | HTMLTextAreaElement } | null>(null);

	function track(key: FieldKey) {
		return (e: FocusEvent) => {
			focused = { key, el: e.currentTarget as HTMLInputElement | HTMLTextAreaElement };
		};
	}

	// Insert at the caret of the last field used (the message by default).
	function insertVariable(name: string) {
		const token = `{{${name}}}`;
		const key = focused?.key ?? (asHtml ? 'html_body' : 'body');
		const el = focused?.el;
		const value = draft[key];
		const start = el?.selectionStart ?? value.length;
		const end = el?.selectionEnd ?? value.length;
		draft[key] = value.slice(0, start) + token + value.slice(end);
		requestAnimationFrame(() => {
			el?.focus();
			el?.setSelectionRange(start + token.length, start + token.length);
		});
	}

	// Tab indents inside the HTML editor instead of leaving it.
	function codeKeydown(e: KeyboardEvent) {
		if (e.key !== 'Tab' || e.shiftKey) return;
		e.preventDefault();
		const el = e.currentTarget as HTMLTextAreaElement;
		const { selectionStart: s, selectionEnd: en } = el;
		draft.html_body = draft.html_body.slice(0, s) + '\t' + draft.html_body.slice(en);
		requestAnimationFrame(() => el.setSelectionRange(s + 1, s + 1));
	}

	/* ---------- validation ---------- */

	const problems = $derived.by(() => {
		const p: Partial<Record<FieldKey, string>> = {};
		if (channel === 'EMAIL' && !draft.subject.trim()) p.subject = 'An email needs a subject.';
		if (channel === 'EMAIL' && asHtml) {
			if (!draft.html_body.trim()) p.html_body = 'Write the email in HTML, or go back to the simple editor.';
			return p;
		}
		if (!draft.body.trim()) p.body = 'Write the message.';
		if (channel === 'EMAIL' && show.button) {
			const url = draft.button_url.trim();
			if (!draft.button_label.trim()) p.button_label = 'Give the button a label.';
			if (!url) p.button_url = 'Add where the button goes.';
			else if (!/^(https?:\/\/|\{\{)/i.test(url)) p.button_url = 'Use a web address (https://...) or a link variable.';
		}
		return p;
	});
	const valid = $derived(Object.keys(problems).length === 0);

	/* ---------- save / reset ---------- */

	let saving = $state(false);
	async function save() {
		if (!valid) {
			toast.error('Fix the highlighted fields first');
			return;
		}
		saving = true;
		try {
			const payload =
				channel === 'EMAIL'
					? { event_code: selected, channel, ...effective }
					: { event_code: selected, channel, body: draft.body };
			const row = await client.save(payload);
			templates = [...templates.filter((t) => !(t.event_code === selected && t.channel === channel)), row];
			saved = contentOf(row);
			draft = { ...saved };
			toast.success('Template saved');
		} catch (err) {
			toast.error(errorMessage(err, 'save this template'));
		} finally {
			saving = false;
		}
	}

	let resetOpen = $state(false);
	let resetting = $state(false);
	async function resetToStandard() {
		resetting = true;
		try {
			await client.reset(selected, channel);
			templates = await client.templates();
			resetOpen = false;
			select(selected, channel);
			toast.success('Back to the standard template');
		} catch (err) {
			toast.error(errorMessage(err, 'reset this template'));
		} finally {
			resetting = false;
		}
	}

	/* ---------- branding ---------- */

	// The page offers a layout and light or dark. Older custom colours are
	// shown, and saved, as light.
	function normalBranding(b: EmailBranding): EmailBranding {
		return {
			...b,
			show_logo: true,
			theme: b.theme === 'dark' ? 'dark' : 'classic',
			layout: b.layout || 'classic',
			page_color: '',
			card_color: ''
		};
	}

	let brandDraft = $state<EmailBranding>({
		show_logo: true, logo_url: '', brand_color: '#0F766E', footer_text: '', theme: 'classic', layout: 'classic', page_color: '', card_color: ''
	});

	// Quick picks for how the email is arranged. Each tile is a small drawing
	// of the layout, painted in the current light or dark colours.
	const LAYOUTS: { id: EmailLayout; label: string }[] = [
		{ id: 'classic', label: 'Classic' },
		{ id: 'header', label: 'Brand header' },
		{ id: 'centered', label: 'Centered' },
		{ id: 'plain', label: 'Plain letter' },
		{ id: 'footerbar', label: 'Footer bar' }
	];
	const isDark = $derived(brandDraft.theme === 'dark');

	const brandDirty = $derived(
		!!brandingView && JSON.stringify(brandDraft) !== JSON.stringify(normalBranding(brandingView.branding))
	);
	const storefrontLogo = $derived(brandingView?.storefront_logo_url ?? '');
	const shownLogo = $derived(brandDraft.logo_url || storefrontLogo);
	const SWATCHES = ['#0F766E', '#1D4ED8', '#B45309', '#BE123C', '#6D28D9', '#171923'];

	let brandSaving = $state(false);
	async function saveBranding() {
		if (isExpiringLink(brandDraft.logo_url)) {
			toast.error('Upload the logo again. The current link is temporary.');
			return;
		}
		brandSaving = true;
		try {
			const out = await client.saveBranding(brandDraft);
			brandingView = { ...brandingView!, branding: { ...out.branding } };
			brandDraft = normalBranding(out.branding);
			toast.success('Branding saved');
		} catch (err) {
			toast.error(errorMessage(err, 'save the branding'));
		} finally {
			brandSaving = false;
		}
	}

	let fileEl = $state<HTMLInputElement | null>(null);
	let uploading = $state(false);
	async function onLogoFile(e: Event) {
		const input = e.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		input.value = '';
		if (!file) return;
		if (!['image/png', 'image/jpeg', 'image/gif'].includes(file.type) || file.size > 2 * 1024 * 1024) {
			toast.error('Choose a PNG or JPG under 2 MB. Mail apps do not show SVG or WebP.');
			return;
		}
		uploading = true;
		try {
			brandDraft.logo_url = await client.upload(file);
		} catch (err) {
			toast.error(errorMessage(err, 'upload the logo'));
		} finally {
			uploading = false;
		}
	}

	/* ---------- preview ---------- */

	let preview = $state<EmailPreview | null>(null);
	let previewError = $state('');
	let device = $state<'desktop' | 'mobile'>('desktop');
	let seq = 0;

	// Re-render on every edit, debounced, always in the draft branding so a
	// colour, logo or theme change shows on whichever email is open.
	$effect(() => {
		const code = selected === BRANDING ? lastEvent : selected;
		const content = selected === BRANDING ? contentOf(templateFor(code, 'EMAIL')) : { ...effective };
		const branding = { ...brandDraft };
		if (!code || channel === 'SMS') return;
		const mine = ++seq;
		const timer = setTimeout(async () => {
			try {
				const out = await client.preview(code, content, branding);
				if (mine === seq) {
					preview = out;
					previewError = '';
				}
			} catch (err) {
				if (mine === seq) previewError = errorMessage(err, 'render the preview');
			}
		}, 300);
		return () => clearTimeout(timer);
	});

	let frame = $state<HTMLIFrameElement | null>(null);
	function fitFrame() {
		const doc = frame?.contentDocument;
		if (frame && doc?.documentElement) frame.style.height = `${doc.documentElement.scrollHeight}px`;
	}
	$effect(() => {
		void device;
		untrack(() => requestAnimationFrame(fitFrame));
	});

	/* ---------- test ---------- */

	let testTo = $state('');
	let testing = $state(false);
	async function sendTest() {
		if (channel === 'EMAIL' && !/^\S+@\S+\.\S+$/.test(testTo.trim())) {
			toast.error('Enter an email address');
			return;
		}
		testing = true;
		try {
			const out = await client.testSend(selected, channel, testTo.trim(), channel === 'EMAIL' ? effective : undefined);
			if (out.ok) toast.success(out.message || 'Test sent');
			else toast.error(out.message || 'Could not send the test');
		} catch (err) {
			toast.error(errorMessage(err, 'send the test'));
		} finally {
			testing = false;
		}
	}

	const senderName = $derived(brandingView?.sender_name ?? 'Orderly');
	const previewSubject = $derived(preview?.subject || draft.subject || 'Subject');
</script>

{#if error}
	<div class="panel"><ErrorState message={error} onretry={load} /></div>
{:else if loading}
	<div class="es-wrap">
		<div class="es-grid">
			<Skeleton height="30rem" />
			<Skeleton height="30rem" />
			<Skeleton height="30rem" />
		</div>
	</div>
{:else}
	{#if !access.enabled}
		<div class="es-gate"><UpgradeNote feature="Custom email templates" requiredPlan={access.requiredPlan} /></div>
	{/if}

	<div class="es-wrap">
		<div class="es-grid">
			<!-- ============ list ============ -->
			<nav class="es-list" aria-label="Email templates">
				<label class="es-search">
					<Search size={14} stroke={1.6} aria-hidden="true" />
					<input type="search" placeholder="Search emails" bind:value={search} aria-label="Search emails" />
				</label>

				<div class="es-scroll">
					<button
						type="button"
						class="es-item es-item-brand"
						aria-current={selected === BRANDING ? 'true' : undefined}
						onclick={() => open(BRANDING)}
					>
						<span class="es-item-icon"><Palette size={15} stroke={1.6} /></span>
						<span class="es-item-text">
							<span class="es-item-label">Branding</span>
							<span class="es-item-meta">Logo, colour and footer</span>
						</span>
						{#if brandDirty}<span class="es-dot" title="Unsaved changes"></span>{/if}
					</button>

					{#each groups as g (g.category)}
						<div class="es-group">
							<div class="es-group-h">{g.label}</div>
							{#each g.items as e (e.code)}
								<button
									type="button"
									class="es-item"
									aria-current={selected === e.code ? 'true' : undefined}
									onclick={() => open(e.code)}
									title={e.description}
								>
									<span class="es-item-text"><span class="es-item-label">{e.label}</span></span>
									{#if selected === e.code && dirty}
										<span class="es-dot" title="Unsaved changes"></span>
									{:else if customized(e.code)}
										<span class="es-tag">Edited</span>
									{/if}
								</button>
							{/each}
						</div>
					{:else}
						<p class="es-empty">No emails match "{search}".</p>
					{/each}
				</div>
			</nav>

			<!-- ============ editor ============ -->
			<section class="panel es-editor">
				{#if selected === BRANDING}
					<header class="es-head">
						<h2 class="es-title">Branding</h2>
						<p class="es-sub">
							{scope === 'platform'
								? 'How every email from the platform looks. Businesses start with this too.'
								: 'How every email from your business looks.'}
						</p>
					</header>

					<div class="es-body">
						<div class="es-row">
							<div class="es-row-label">
								<span class="es-label">Logo</span>
								<span class="es-help">PNG or JPG, about 360 x 80 px.</span>
							</div>
							<div class="es-logo">
								<div class="es-logo-box">
									{#if shownLogo && !isExpiringLink(shownLogo)}
										<img src={shownLogo} alt="" />
									{:else}
										<span class="es-logo-none"><Photo size={16} stroke={1.6} /> {senderName}</span>
									{/if}
								</div>
								<div class="es-logo-actions">
									<input bind:this={fileEl} type="file" accept="image/png,image/jpeg,image/gif" hidden onchange={onLogoFile} />
									<button type="button" class="btn btn-ghost btn-sm" disabled={uploading} onclick={() => fileEl?.click()}>
										<Upload size={14} stroke={1.6} /> {uploading ? 'Uploading...' : brandDraft.logo_url ? 'Replace' : 'Upload'}
									</button>
									{#if brandDraft.logo_url}
										<button type="button" class="btn btn-quiet btn-sm" onclick={() => (brandDraft.logo_url = '')}>
											<Trash size={14} stroke={1.6} /> Remove
										</button>
									{/if}
								</div>
								{#if scope === 'tenant' && !brandDraft.logo_url}
									<p class="es-help">{storefrontLogo ? 'Using your storefront logo.' : 'No logo yet, so your business name is shown.'}</p>
								{/if}
								{#if isExpiringLink(brandDraft.logo_url)}
									<p class="es-warn">This logo link is temporary and would break in emails. Upload it again.</p>
								{/if}
							</div>
						</div>

						<div class="es-row">
							<div class="es-row-label">
								<span class="es-label">Colour</span>
								<span class="es-help">Buttons and the highlight box.</span>
							</div>
							<div class="es-swatches">
								{#each SWATCHES as c (c)}
									<button
										type="button"
										class="es-swatch"
										style:background={c}
										aria-label={`Use ${c}`}
										aria-pressed={brandDraft.brand_color.toUpperCase() === c}
										onclick={() => (brandDraft.brand_color = c)}
									></button>
								{/each}
								<label class="es-swatch es-swatch-custom" title="Pick any colour" aria-pressed={!SWATCHES.includes(brandDraft.brand_color.toUpperCase())}>
									<input type="color" bind:value={brandDraft.brand_color} aria-label="Pick any colour" />
									<Plus size={12} stroke={2} />
								</label>
							</div>
						</div>

						<div class="es-row es-row-top">
							<div class="es-row-label">
								<span class="es-label">Layout</span>
								<span class="es-help">How the header, message and footer are arranged.</span>
							</div>
							<div class="es-layouts" role="radiogroup" aria-label="Layout" data-dark={isDark}>
								{#each LAYOUTS as l (l.id)}
									<button type="button" role="radio" class="es-layout" aria-checked={brandDraft.layout === l.id} onclick={() => (brandDraft.layout = l.id)}>
										<span class="es-lay es-lay-{l.id}" style:--brand={brandDraft.brand_color} aria-hidden="true">
											{#if l.id === 'header'}
												<span class="es-lay-card"><span class="es-lay-band"></span><span class="es-lay-txt"></span><span class="es-lay-txt es-lay-short"></span><span class="es-lay-btn"></span></span>
											{:else}
												<span class="es-lay-logo"></span>
												<span class="es-lay-card"><span class="es-lay-txt"></span><span class="es-lay-txt es-lay-short"></span><span class="es-lay-btn"></span>{#if l.id === 'footerbar'}<span class="es-lay-foot"></span>{/if}</span>
											{/if}
											{#if l.id !== 'footerbar'}<span class="es-lay-under"></span>{/if}
										</span>
										<span class="es-layout-label">{l.label}</span>
									</button>
								{/each}
							</div>
						</div>

						<div class="es-row">
							<div class="es-row-label">
								<span class="es-label">Theme</span>
							</div>
							<button
								type="button"
								class="btn btn-ghost btn-sm es-mode"
								aria-pressed={isDark}
								onclick={() => (brandDraft.theme = isDark ? 'classic' : 'dark')}
							>
								{#if isDark}<Moon size={14} stroke={1.6} /> Dark{:else}<Sun size={14} stroke={1.6} /> Light{/if}
							</button>
						</div>

						<div class="es-row es-row-top">
							<div class="es-row-label">
								<label class="es-label" for="es-footer">Footer</label>
								<span class="es-help">Your address or a support line.</span>
							</div>
							<textarea
								id="es-footer"
								class="input"
								rows="2"
								maxlength="300"
								bind:value={brandDraft.footer_text}
								placeholder={scope === 'tenant' ? `You are receiving this email from ${senderName}.` : ''}
							></textarea>
						</div>
					</div>

					<footer class="es-foot">
						<span class="es-foot-note">{brandDirty ? 'Unsaved changes' : 'All changes saved'}</span>
						<span class="es-foot-actions">
							<button type="button" class="btn btn-ghost btn-sm" disabled={!brandDirty} onclick={() => brandingView && (brandDraft = normalBranding(brandingView.branding))}>
								Discard
							</button>
							<button type="button" class="btn btn-primary btn-sm" disabled={!brandDirty || brandSaving || !access.enabled} onclick={saveBranding}>
								{brandSaving ? 'Saving...' : 'Save branding'}
							</button>
						</span>
					</footer>
				{:else if event}
					<header class="es-head">
						<div class="es-title-row">
							<h2 class="es-title">{event.label}</h2>
							{#if scope === 'platform'}
								<StatusBadge status={event.category === 'PLATFORM' ? 'Platform team' : 'Business default'} kind="neutral" dot={false} />
							{:else if current?.overridden}
								<StatusBadge status="Edited" kind="accent" dot={false} />
							{/if}
						</div>
						<p class="es-sub">{event.description}</p>
						{#if hasSms}
							<div class="es-seg es-channel" role="radiogroup" aria-label="Channel">
								<button type="button" role="radio" aria-checked={channel === 'EMAIL'} onclick={() => open(selected, 'EMAIL')}>Email</button>
								<button type="button" role="radio" aria-checked={channel === 'SMS'} onclick={() => open(selected, 'SMS')}>SMS</button>
							</div>
						{/if}
					</header>

					<div class="es-body">
						{#if channel === 'EMAIL'}
							<FormField label="Subject" htmlFor="es-subject" error={problems.subject}>
								{#snippet children(control)}
									<input class="input" bind:value={draft.subject} onfocus={track('subject')} {...wire(control)} />
								{/snippet}
							</FormField>
						{/if}

						{#if channel === 'EMAIL' && asHtml}
							<FormField
								label="Message (HTML)"
								htmlFor="es-html"
								error={problems.html_body}
								hint="Your logo, colour and footer are added around it."
							>
								{#snippet children(control)}
									<textarea
										class="input es-code"
										rows="16"
										spellcheck="false"
										autocapitalize="off"
										bind:value={draft.html_body}
										onfocus={track('html_body')}
										onkeydown={codeKeydown}
										{...wire(control)}
									></textarea>
								{/snippet}
							</FormField>
						{:else}
							{#if channel === 'EMAIL'}
								<FormField label="Heading" htmlFor="es-heading">
									{#snippet children(control)}
										<input class="input" bind:value={draft.heading} onfocus={track('heading')} placeholder={draft.subject} {...wire(control)} />
									{/snippet}
								</FormField>
							{/if}
							<FormField
								label="Message"
								htmlFor="es-msg"
								error={problems.body}
								hint={channel === 'SMS'
									? `${draft.body.length} characters, ${Math.max(1, Math.ceil(draft.body.length / 160))} SMS`
									: ''}
							>
								{#snippet children(control)}
									<textarea class="input" rows={channel === 'SMS' ? 4 : 5} bind:value={draft.body} onfocus={track('body')} {...wire(control)}></textarea>
								{/snippet}
							</FormField>

							{#if channel === 'EMAIL'}
								{#if show.highlight}
									<div class="es-part">
										<FormField label="Highlight" htmlFor="es-hl" hint="Shown in a box. A code is shown large.">
											{#snippet children(control)}
												<input class="input" bind:value={draft.highlight} onfocus={track('highlight')} placeholder={'Order #{{order_number}}'} {...wire(control)} />
											{/snippet}
										</FormField>
										<button type="button" class="es-part-x" aria-label="Remove highlight" onclick={() => removePart('highlight')}><X size={14} stroke={1.6} /></button>
									</div>
								{/if}
								{#if show.button}
									<div class="es-part">
										<div class="es-two">
											<FormField label="Button label" htmlFor="es-btn" error={problems.button_label}>
												{#snippet children(control)}
													<input class="input" bind:value={draft.button_label} onfocus={track('button_label')} placeholder="Track your order" {...wire(control)} />
												{/snippet}
											</FormField>
											<FormField label="Button link" htmlFor="es-url" error={problems.button_url}>
												{#snippet children(control)}
													<input class="input" bind:value={draft.button_url} onfocus={track('button_url')} placeholder="https://..." {...wire(control)} />
												{/snippet}
											</FormField>
										</div>
										<button type="button" class="es-part-x" aria-label="Remove button" onclick={() => removePart('button')}><X size={14} stroke={1.6} /></button>
									</div>
								{/if}
								{#if show.note}
									<div class="es-part">
										<FormField label="Note" htmlFor="es-note" hint="Small grey text at the end.">
											{#snippet children(control)}
												<textarea class="input" rows="2" bind:value={draft.footnote} onfocus={track('footnote')} {...wire(control)}></textarea>
											{/snippet}
										</FormField>
										<button type="button" class="es-part-x" aria-label="Remove note" onclick={() => removePart('note')}><X size={14} stroke={1.6} /></button>
									</div>
								{/if}

								{#if !show.highlight || !show.button || !show.note}
									<div class="es-adds">
										{#if !show.highlight}<button type="button" class="es-add" onclick={() => (show.highlight = true)}><Plus size={13} stroke={1.8} /> Highlight</button>{/if}
										{#if !show.button}<button type="button" class="es-add" onclick={() => (show.button = true)}><Plus size={13} stroke={1.8} /> Button</button>{/if}
										{#if !show.note}<button type="button" class="es-add" onclick={() => (show.note = true)}><Plus size={13} stroke={1.8} /> Note</button>{/if}
									</div>
								{/if}
							{/if}
						{/if}

						{#if variables.length}
							<div class="es-vars">
								<span class="es-vars-h">Insert</span>
								{#each variables as v (v)}
									<button type="button" class="es-var" onclick={() => insertVariable(v)}>{v.replaceAll('_', ' ')}</button>
								{/each}
							</div>
						{/if}
					</div>

					<footer class="es-foot">
						<span class="es-foot-left">
							{#if channel === 'EMAIL'}
								{#if asHtml}
									<button type="button" class="btn btn-quiet btn-sm" onclick={() => (leaveHtmlOpen = true)}>Use simple editor</button>
								{:else}
									<button type="button" class="btn btn-quiet btn-sm" disabled={loadingHtml} onclick={editAsHtml}>
										<Code size={14} stroke={1.6} /> {loadingHtml ? 'Opening...' : 'Edit as HTML'}
									</button>
								{/if}
							{/if}
							{#if scope === 'tenant' && current?.overridden}
								<button type="button" class="btn btn-quiet btn-sm" onclick={() => (resetOpen = true)}>
									<ArrowBackUp size={14} stroke={1.6} /> Reset
								</button>
							{/if}
						</span>
						<span class="es-foot-actions">
							<button type="button" class="btn btn-ghost btn-sm" disabled={!dirty} onclick={() => select(selected, channel)}>Discard</button>
							<button type="button" class="btn btn-primary btn-sm" disabled={!dirty || saving || !access.enabled} onclick={save}>
								{saving ? 'Saving...' : 'Save'}
							</button>
						</span>
					</footer>
				{/if}
			</section>

			<!-- ============ preview ============ -->
			<section class="panel es-preview" aria-label="Preview">
				<header class="es-pv-head">
					<span class="es-pv-title">Preview</span>
					{#if channel === 'EMAIL'}
						<div class="es-seg es-seg-icons" role="radiogroup" aria-label="Preview size">
							<button type="button" role="radio" aria-checked={device === 'desktop'} aria-label="Desktop" onclick={() => (device = 'desktop')}>
								<DeviceDesktop size={14} stroke={1.6} />
							</button>
							<button type="button" role="radio" aria-checked={device === 'mobile'} aria-label="Mobile" onclick={() => (device = 'mobile')}>
								<DeviceMobile size={14} stroke={1.6} />
							</button>
						</div>
					{/if}
				</header>

				{#if channel === 'SMS'}
					<div class="es-sms">
						<div class="es-bubble">{draft.body || 'Your message'}</div>
					</div>
				{:else}
					<div class="es-inbox">
						<span class="es-avatar" aria-hidden="true">{senderName.slice(0, 1).toUpperCase()}</span>
						<div class="es-inbox-text">
							<div class="es-inbox-from">{senderName}</div>
							<div class="es-inbox-line">{previewSubject}</div>
						</div>
					</div>

					<div class="es-stage" data-device={device}>
						{#if previewError}
							<p class="es-pv-error">{previewError}</p>
						{:else if preview}
							<iframe
								bind:this={frame}
								title="Email preview"
								class="es-frame"
								sandbox="allow-same-origin allow-popups"
								srcdoc={preview.html}
								onload={fitFrame}
							></iframe>
						{:else}
							<Skeleton height="22rem" />
						{/if}
					</div>
				{/if}

				{#if selected !== BRANDING}
					<div class="es-test">
						<Mail size={14} stroke={1.6} aria-hidden="true" />
						<input
							class="input"
							type={channel === 'EMAIL' ? 'email' : 'tel'}
							placeholder={channel === 'EMAIL' ? 'you@example.com' : '+91...'}
							aria-label="Send a test to"
							bind:value={testTo}
						/>
						<button type="button" class="btn btn-ghost btn-sm" disabled={testing} onclick={sendTest}>
							<Send size={14} stroke={1.6} /> {testing ? 'Sending...' : 'Send test'}
						</button>
					</div>
				{/if}
			</section>
		</div>
	</div>
{/if}

<ConfirmDialog
	bind:open={discardOpen}
	title="Discard unsaved changes?"
	message="You have changes that are not saved. Leaving this email will lose them."
	confirmLabel="Discard changes"
	danger
	onconfirm={discardAndGo}
/>
<ConfirmDialog
	bind:open={resetOpen}
	title="Reset this email?"
	message="Your version is removed and the standard email is used again."
	confirmLabel="Reset"
	loading={resetting}
	onconfirm={resetToStandard}
/>
<ConfirmDialog
	bind:open={leaveHtmlOpen}
	title="Go back to the simple editor?"
	message="Your HTML is dropped when you save. The email uses the heading and message fields again."
	confirmLabel="Use simple editor"
	onconfirm={useSimpleEditor}
/>

<style>
	.es-gate {
		margin-bottom: var(--sp-8);
	}

	/* Columns follow the space the studio is given, not the window: it sits
	   full-width in the console and inside a narrower Settings column. */
	.es-wrap {
		container-type: inline-size;
	}

	.es-grid {
		display: grid;
		grid-template-columns: 240px minmax(0, 1fr) minmax(0, 1fr);
		gap: var(--sp-8);
		align-items: start;
	}

	@container (max-width: 1100px) {
		.es-grid {
			grid-template-columns: 220px minmax(0, 1fr);
		}
		.es-preview {
			grid-column: 1 / -1;
			position: static;
		}
	}

	@container (max-width: 720px) {
		.es-grid {
			grid-template-columns: minmax(0, 1fr);
		}
		.es-list {
			position: static;
			max-height: 20rem;
		}
	}

	/* ---------- list ---------- */

	.es-list {
		position: sticky;
		top: var(--sp-8);
		display: flex;
		flex-direction: column;
		min-width: 0;
		max-height: calc(100vh - var(--topbar-h, 56px) - 2.5rem);
		border: 1px solid var(--border);
		border-radius: var(--radius-lg);
		background: var(--card-bg, var(--surface));
		overflow: hidden;
	}

	.es-search {
		display: flex;
		align-items: center;
		gap: var(--sp-4);
		padding: var(--sp-6) var(--sp-7);
		border-bottom: 1px solid var(--border-subtle);
		color: var(--text-3);
	}

	.es-search input {
		flex: 1;
		min-width: 0;
		border: 0;
		background: transparent;
		color: var(--text);
		font: inherit;
		font-size: var(--fs-tab);
		outline: none;
		cursor: text;
	}

	.es-scroll {
		overflow-y: auto;
		padding: var(--sp-4);
	}

	.es-group {
		margin-top: var(--sp-7);
	}

	.es-group-h {
		padding: 0 var(--sp-4) var(--sp-3);
		font-size: var(--fs-label);
		font-weight: 600;
		letter-spacing: 0.05em;
		text-transform: uppercase;
		color: var(--text-3);
	}

	.es-item {
		display: flex;
		align-items: center;
		gap: var(--sp-5);
		width: 100%;
		min-width: 0;
		padding: var(--sp-4) var(--sp-5);
		border: 0;
		border-radius: var(--radius-sm);
		background: transparent;
		color: var(--text-2);
		font: inherit;
		font-size: var(--fs-tab);
		text-align: left;
		transition: background var(--tr, 0.15s), color var(--tr, 0.15s);
	}

	.es-item:hover {
		background: var(--surface-hover);
		color: var(--text);
	}

	.es-item[aria-current='true'] {
		background: var(--accent-soft);
		color: var(--text);
		font-weight: 600;
	}

	.es-item-brand {
		padding: var(--sp-5);
		border: 1px solid var(--border-subtle);
	}

	.es-item-icon {
		display: grid;
		place-items: center;
		flex: none;
		width: 28px;
		height: 28px;
		border-radius: var(--radius-sm);
		background: var(--icon-bg);
		color: var(--icon-fg);
	}

	.es-item-text {
		display: flex;
		flex-direction: column;
		flex: 1;
		min-width: 0;
	}

	.es-item-label {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.es-item-meta {
		font-size: var(--fs-meta);
		font-weight: 400;
		color: var(--text-3);
	}

	.es-empty {
		padding: var(--sp-8) var(--sp-4);
		font-size: var(--fs-tab);
		color: var(--text-3);
	}

	.es-tag {
		flex: none;
		padding: 1px var(--sp-3);
		border-radius: 999px;
		background: var(--surface-2);
		color: var(--text-2);
		font-size: var(--fs-micro);
		font-weight: 600;
	}

	.es-dot {
		flex: none;
		width: 7px;
		height: 7px;
		border-radius: 50%;
		background: var(--warn);
	}

	/* ---------- editor ---------- */

	.es-editor {
		display: flex;
		flex-direction: column;
		min-width: 0;
		padding: 0;
	}

	.es-head {
		padding: var(--sp-10) var(--sp-11) var(--sp-8);
		border-bottom: 1px solid var(--border-subtle);
	}

	.es-title-row {
		display: flex;
		align-items: center;
		gap: var(--sp-5);
		flex-wrap: wrap;
	}

	.es-title {
		margin: 0;
		font-family: var(--font-display);
		font-size: var(--fs-title);
		font-weight: 600;
		color: var(--text);
		letter-spacing: -0.01em;
	}

	.es-sub {
		margin: var(--sp-3) 0 0;
		font-size: var(--fs-tab);
		color: var(--text-3);
	}

	.es-channel {
		margin-top: var(--sp-7);
	}

	.es-seg {
		display: inline-flex;
		align-self: flex-start;
		padding: 2px;
		border-radius: var(--radius);
		background: var(--surface-2);
	}

	.es-seg button {
		display: inline-flex;
		align-items: center;
		gap: var(--sp-3);
		padding: var(--sp-3) var(--sp-7);
		border: 0;
		border-radius: var(--radius-sm);
		background: transparent;
		color: var(--text-3);
		font: inherit;
		font-size: var(--fs-tab);
		font-weight: 500;
	}

	.es-seg button[aria-checked='true'] {
		background: var(--accent-soft);
		color: var(--text);
		font-weight: 600;
	}

	.es-seg-icons button {
		padding: var(--sp-3) var(--sp-5);
	}

	.es-body {
		display: flex;
		flex-direction: column;
		gap: var(--sp-8);
		padding: var(--sp-10) var(--sp-11);
	}

	.es-body textarea {
		resize: vertical;
		line-height: 1.55;
	}

	.es-code {
		font-family: var(--font-mono);
		font-size: var(--fs-code);
		line-height: 1.6;
		tab-size: 2;
		white-space: pre;
		overflow-x: auto;
		min-height: 14rem;
	}

	.es-two {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: var(--sp-6);
	}

	@container (max-width: 560px) {
		.es-two {
			grid-template-columns: 1fr;
		}
	}

	/* An added optional part, with its remove button on the label line. */
	.es-part {
		position: relative;
	}

	.es-part-x {
		position: absolute;
		top: -2px;
		right: 0;
		display: grid;
		place-items: center;
		width: 22px;
		height: 22px;
		border: 0;
		border-radius: var(--radius-sm);
		background: transparent;
		color: var(--text-3);
	}

	.es-part-x:hover {
		background: var(--surface-hover);
		color: var(--text);
	}

	.es-adds {
		display: flex;
		flex-wrap: wrap;
		gap: var(--sp-4);
	}

	.es-add {
		display: inline-flex;
		align-items: center;
		gap: var(--sp-2);
		padding: var(--sp-3) var(--sp-6);
		border: 1px dashed var(--border);
		border-radius: 999px;
		background: transparent;
		color: var(--text-2);
		font: inherit;
		font-size: var(--fs-tab);
		transition: border-color var(--tr, 0.15s), color var(--tr, 0.15s);
	}

	.es-add:hover {
		border-color: var(--accent);
		color: var(--text);
	}

	.es-vars {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--sp-3);
		padding-top: var(--sp-7);
		border-top: 1px solid var(--border-subtle);
	}

	.es-vars-h {
		margin-right: var(--sp-2);
		font-size: var(--fs-label);
		font-weight: 600;
		color: var(--text-3);
	}

	.es-var {
		padding: 1px var(--sp-5);
		border: 1px solid var(--border);
		border-radius: 999px;
		background: var(--surface-2);
		color: var(--text-2);
		font: inherit;
		font-size: var(--fs-meta);
		transition: border-color var(--tr, 0.15s), color var(--tr, 0.15s);
	}

	.es-var:hover {
		border-color: var(--accent);
		color: var(--text);
	}

	.es-foot {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: var(--sp-6);
		flex-wrap: wrap;
		padding: var(--sp-7) var(--sp-11);
		border-top: 1px solid var(--border-subtle);
		background: var(--card-bg, var(--surface));
		border-radius: 0 0 var(--radius-lg) var(--radius-lg);
	}

	.es-foot-left,
	.es-foot-actions {
		display: flex;
		gap: var(--sp-4);
		flex-wrap: wrap;
		align-items: center;
	}

	.es-foot-note {
		font-size: var(--fs-meta);
		color: var(--text-3);
	}

	/* branding: one row per setting, label on the left */
	.es-row {
		display: grid;
		grid-template-columns: 140px minmax(0, 1fr);
		gap: var(--sp-8);
		align-items: center;
	}

	.es-row-top {
		align-items: start;
	}

	.es-row + .es-row {
		padding-top: var(--sp-8);
		border-top: 1px solid var(--border-subtle);
	}

	@container (max-width: 560px) {
		.es-row {
			grid-template-columns: 1fr;
			gap: var(--sp-4);
		}
	}

	.es-row-label {
		display: flex;
		flex-direction: column;
		gap: var(--sp-1);
	}

	.es-label {
		font-size: var(--fs-tab);
		font-weight: 600;
		color: var(--text);
	}

	.es-help {
		margin: 0;
		font-size: var(--fs-meta);
		color: var(--text-3);
	}

	.es-warn {
		margin: 0;
		font-size: var(--fs-meta);
		color: var(--danger);
	}

	.es-logo {
		display: flex;
		flex-direction: column;
		gap: var(--sp-4);
	}

	.es-logo-box {
		display: grid;
		place-items: center;
		width: 180px;
		height: 60px;
		padding: var(--sp-4);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		background: #ffffff;
	}

	.es-logo-box img {
		max-width: 100%;
		max-height: 36px;
		object-fit: contain;
	}

	.es-logo-none {
		display: inline-flex;
		align-items: center;
		gap: var(--sp-3);
		color: #6b7280;
		font-size: var(--fs-tab);
		font-weight: 600;
	}

	.es-logo-actions {
		display: flex;
		gap: var(--sp-4);
	}

	.es-swatches {
		display: flex;
		align-items: center;
		gap: var(--sp-4);
		flex-wrap: wrap;
	}

	.es-swatch {
		position: relative;
		display: grid;
		place-items: center;
		width: 26px;
		height: 26px;
		padding: 0;
		border: 2px solid var(--card-bg, var(--surface));
		border-radius: 50%;
		box-shadow: 0 0 0 1px var(--border);
	}

	.es-swatch[aria-pressed='true'] {
		box-shadow: 0 0 0 2px var(--accent);
	}

	.es-swatch-custom {
		background: var(--surface-2);
		color: var(--text-3);
		overflow: hidden;
	}

	.es-swatch-custom input {
		position: absolute;
		inset: 0;
		opacity: 0;
	}

	.es-theme-pick {
		display: flex;
		flex-direction: column;
		gap: var(--sp-6);
	}

	.es-mode {
		justify-self: start;
		min-width: 6.5rem;
		justify-content: center;
	}

	.es-layouts {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(92px, 1fr));
		gap: var(--sp-5);
		--lay-page: #f5f6f8;
		--lay-card: #ffffff;
		--lay-ink: #c4c9d1;
		--lay-line: #e5e7eb;
	}

	.es-layouts[data-dark='true'] {
		--lay-page: #0e1116;
		--lay-card: #161b22;
		--lay-ink: #3a4250;
		--lay-line: #262c36;
	}

	.es-layout {
		display: flex;
		flex-direction: column;
		gap: var(--sp-3);
		padding: 0;
		border: 0;
		background: transparent;
		font: inherit;
	}

	/* A small drawing of the layout: logo, card with text and a button,
	   and the footer, in the current light or dark colours. */
	.es-lay {
		display: flex;
		flex-direction: column;
		gap: 4px;
		height: 74px;
		padding: 8px 10px;
		border: 1px solid var(--border);
		border-radius: var(--radius);
		background: var(--lay-page);
		overflow: hidden;
		transition: border-color var(--tr, 0.15s), box-shadow var(--tr, 0.15s);
	}

	.es-layout:hover .es-lay {
		border-color: var(--text-3);
	}

	.es-layout[aria-checked='true'] .es-lay {
		border-color: var(--accent);
		box-shadow: 0 0 0 2px var(--accent);
	}

	.es-lay-logo {
		width: 18px;
		height: 4px;
		border-radius: 2px;
		background: var(--lay-ink);
	}

	.es-lay-card {
		display: flex;
		flex-direction: column;
		gap: 4px;
		flex: 1;
		padding: 6px 7px;
		border: 1px solid var(--lay-line);
		border-radius: 4px;
		background: var(--lay-card);
		overflow: hidden;
	}

	.es-lay-txt {
		width: 80%;
		height: 3px;
		border-radius: 2px;
		background: var(--lay-ink);
	}

	.es-lay-short {
		width: 55%;
	}

	.es-lay-btn {
		width: 22px;
		height: 6px;
		margin-top: 1px;
		border-radius: 2px;
		background: var(--brand);
	}

	.es-lay-under {
		width: 45%;
		height: 3px;
		border-radius: 2px;
		background: var(--lay-ink);
		opacity: 0.6;
	}

	.es-lay-band {
		height: 9px;
		margin: -6px -7px 2px;
		background: var(--brand);
	}

	.es-lay-foot {
		height: 9px;
		margin: auto -7px -6px;
		border-top: 1px solid var(--lay-line);
		background: var(--lay-line);
	}

	.es-lay-centered {
		align-items: center;
	}

	.es-lay-centered .es-lay-card {
		align-items: center;
		align-self: stretch;
	}

	.es-lay-centered .es-lay-under {
		align-self: center;
	}

	.es-lay-plain .es-lay-card {
		padding-left: 0;
		border-color: transparent;
		border-top-color: var(--lay-line);
		border-radius: 0;
		background: transparent;
	}

	.es-lay-plain {
		background: var(--lay-card);
	}

	.es-layout-label {
		font-size: var(--fs-meta);
		font-weight: 500;
		color: var(--text-2);
		text-align: center;
	}

	.es-layout[aria-checked='true'] .es-layout-label {
		color: var(--text);
		font-weight: 600;
	}

	/* ---------- preview ---------- */

	.es-preview {
		position: sticky;
		top: var(--sp-8);
		display: flex;
		flex-direction: column;
		gap: var(--sp-7);
		min-width: 0;
	}

	.es-pv-head {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.es-pv-title {
		font-family: var(--font-display);
		font-size: var(--fs-body);
		font-weight: 600;
		color: var(--text);
	}

	.es-inbox {
		display: flex;
		gap: var(--sp-6);
		align-items: center;
		padding: var(--sp-6) var(--sp-7);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius);
		background: var(--surface-2);
	}

	.es-avatar {
		display: grid;
		place-items: center;
		flex: none;
		width: 32px;
		height: 32px;
		border-radius: 50%;
		background: var(--icon-bg);
		color: var(--icon-fg);
		font-weight: 650;
		font-size: var(--fs-tab);
	}

	.es-inbox-text {
		flex: 1;
		min-width: 0;
	}

	.es-inbox-from {
		font-size: var(--fs-tab);
		font-weight: 650;
		color: var(--text);
	}

	.es-inbox-line {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-size: var(--fs-tab);
		color: var(--text-2);
	}

	/* The email paints its own background; the stage only frames it. */
	.es-stage {
		display: flex;
		justify-content: center;
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius);
		background: var(--surface-sunken);
		overflow: hidden;
	}

	.es-frame {
		display: block;
		width: 100%;
		min-height: 24rem;
		border: 0;
		transition: width 0.2s ease;
	}

	.es-stage[data-device='mobile'] {
		padding: var(--sp-8) 0;
	}

	.es-stage[data-device='mobile'] .es-frame {
		width: 375px;
		max-width: calc(100% - 2 * var(--sp-8));
		border-radius: 22px;
		box-shadow:
			0 0 0 8px var(--surface-3, #e5e7eb),
			var(--shadow-md);
	}

	.es-pv-error {
		margin: var(--sp-8);
		font-size: var(--fs-tab);
		color: var(--danger);
	}

	.es-sms {
		padding: var(--sp-11);
		border-radius: var(--radius);
		background: var(--surface-sunken);
	}

	.es-bubble {
		max-width: 80%;
		padding: var(--sp-5) var(--sp-7);
		border-radius: 18px 18px 18px 4px;
		background: var(--surface);
		box-shadow: var(--shadow-sm);
		font-size: var(--fs-body);
		line-height: 1.5;
		white-space: pre-wrap;
		color: var(--text);
	}

	.es-test {
		display: flex;
		align-items: center;
		gap: var(--sp-4);
		padding-top: var(--sp-7);
		border-top: 1px solid var(--border-subtle);
		color: var(--text-3);
	}

	.es-test .input {
		flex: 1;
		min-width: 0;
	}
</style>
