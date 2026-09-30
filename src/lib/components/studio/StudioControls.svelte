<script lang="ts">
	import Palette from '@lucide/svelte/icons/palette';
	import Image from '@lucide/svelte/icons/image';
	import LayoutTemplate from '@lucide/svelte/icons/layout-template';
	import UtensilsCrossed from '@lucide/svelte/icons/utensils-crossed';
	import Users from '@lucide/svelte/icons/users';
	import CreditCard from '@lucide/svelte/icons/credit-card';
	import OpeningHoursForm from '$lib/components/storefront/OpeningHoursForm.svelte';
	import ArrowUp from '@lucide/svelte/icons/arrow-up';
	import ArrowDown from '@lucide/svelte/icons/arrow-down';
	import Sparkles from '@lucide/svelte/icons/sparkles';
	import Eye from '@lucide/svelte/icons/eye';
	import EyeOff from '@lucide/svelte/icons/eye-off';
	import Check from '@lucide/svelte/icons/check';
	import RefreshCw from '@lucide/svelte/icons/refresh-cw';
	import type { StudioDraftStore } from '$lib/storefront/studioDraft.svelte';
	import type { ConfigControl, Terminology } from '$lib/admin/businessTypes';
	import type { StudioSectionId } from '$lib/storefront/studioSections';
	import {
		THEME_PRESETS,
		FONT_OPTIONS,
		RADIUS_OPTIONS,
		BUTTON_OPTIONS,
		CARD_OPTIONS,
		HEADER_OPTIONS,
		HERO_OPTIONS,
		LAYOUT_OPTIONS,
		FILTER_OPTIONS,
		LOGIN_MODE_OPTIONS,
		MODE_OPTIONS,
		STORE_STATUS_OPTIONS,
		ACCEPTANCE_MODES,
		PAYMENT_TIMINGS
	} from '$lib/storefront/admin';
	import { toast } from '$lib/components/admin/toast';

	let {
		store,
		section = 'style',
		terms,
		allowed
	}: {
		store: StudioDraftStore;
		/** Which section to render. The rail lives in the shell, not in here. */
		section?: StudioSectionId;
		/** The business type's words for its own catalogue. */
		terms: Terminology;
		/** Controls this business type actually uses. */
		allowed: ReadonlySet<ConfigControl>;
	} = $props();

	const draft = $derived(store.draft);

	const SWATCH_PALETTES = [
		{ label: 'Modern Indigo', primary: '#5b4bdb', secondary: '#8b5cf6', accent: '#06b6d4' },
		{ label: 'Bold Sunset', primary: '#ea580c', secondary: '#b91c1c', accent: '#facc15' },
		{ label: 'Warm Artisan', primary: '#b45309', secondary: '#78350f', accent: '#f59e0b' },
		{ label: 'Fresh Emerald', primary: '#059669', secondary: '#0d9488', accent: '#84cc16' },
		{ label: 'Crimson Classic', primary: '#d7263d', secondary: '#8c1c2b', accent: '#f2b705' },
		{ label: 'Monochrome Slate', primary: '#0f172a', secondary: '#475569', accent: '#94a3b8' }
	];

	function applyPreset(presetId: string) {
		const preset = THEME_PRESETS.find((p) => p.id === presetId);
		if (!preset) return;
		store.mutate((d) => {
			d.theme.preset = preset.id as any;
			d.theme.primary = preset.primary;
			d.theme.secondary = preset.secondary;
			d.theme.accent = preset.accent;
			d.theme.font = preset.font as any;
			d.theme.radius = preset.radius as any;
			d.theme.button = preset.button_style as any;
			d.theme.card = preset.card_style as any;
			d.theme.header = preset.header_style as any;
			d.theme.hero = preset.hero_style as any;
			d.theme.mode = preset.mode as any;
		});
	}

	function applyPalette(primary: string, secondary: string, accent: string) {
		store.mutate((d) => {
			d.theme.primary = primary;
			d.theme.secondary = secondary;
			d.theme.accent = accent;
		});
	}

	function moveSection(id: string, direction: 'up' | 'down') {
		store.mutate((d) => {
			const index = d.homepage.sections.findIndex((s) => s.id === id);
			if (index < 0) return;
			const targetIndex = direction === 'up' ? index - 1 : index + 1;
			if (targetIndex < 0 || targetIndex >= d.homepage.sections.length) return;
			const item = d.homepage.sections.splice(index, 1)[0];
			d.homepage.sections.splice(targetIndex, 0, item);
		});
	}

	function toggleSection(id: string) {
		store.mutate((d) => {
			const sec = d.homepage.sections.find((s) => s.id === id);
			if (sec) {
				sec.enabled = !sec.enabled;
			}
		});
	}

	function updateSectionContent(id: string, key: string, value: string) {
		store.mutate((d) => {
			const sec = d.homepage.sections.find((s) => s.id === id);
			if (sec) {
				if (!sec.content) sec.content = {};
				sec.content[key] = value;
			}
		});
	}

	const heroSection = $derived(draft.homepage.sections.find((s) => s.type === 'HERO'));
	let showHeroAdvanced = $state(false);

	type BroadcastType = 'alert' | 'msg' | 'offer' | 'others';
	let bannerType = $state<BroadcastType>('offer');
	let bannerText = $state('');

	function parseBroadcast(msg: string): { type: BroadcastType; text: string } {
		if (!msg) return { type: 'msg', text: '' };
		const match = msg.match(/^\[(alert|msg|offer|others)\]\s*(.*)$/i);
		if (match) return { type: match[1].toLowerCase() as BroadcastType, text: match[2] };
		return { type: 'msg', text: msg };
	}

	function formatBroadcast(type: BroadcastType, text: string): string {
		const clean = text.trim();
		return clean ? `[${type}] ${clean}` : '';
	}

	let bannerSaving = $state(false);
	let statusSaving = $state(false);

	$effect(() => {
		if (section !== 'homepage') return;
		const parsed = parseBroadcast(draft.behaviour.status_message || '');
		bannerType = parsed.text ? parsed.type : bannerType;
		bannerText = parsed.text;
	});

	async function saveBanner() {
		if (bannerSaving) return;
		bannerSaving = true;
		const payload = formatBroadcast(bannerType, bannerText);
		const ok = await store.saveStatusMessage(payload);
		bannerSaving = false;
		if (ok) toast.success(payload ? 'Banner published' : 'Banner removed');
		else toast.error(store.error || 'Could not save banner');
	}

	async function clearBanner() {
		bannerText = '';
		bannerType = 'msg';
		if (bannerSaving) return;
		bannerSaving = true;
		const ok = await store.saveStatusMessage('');
		bannerSaving = false;
		if (ok) toast.success('Banner removed');
		else toast.error(store.error || 'Could not clear banner');
	}

	async function pickStatus(status: string) {
		if (statusSaving || (draft.behaviour.store_status || 'OPEN') === status) return;
		statusSaving = true;
		const ok = await store.saveStoreStatus(status);
		statusSaving = false;
		if (ok) {
			toast.success(
				`Store is now ${STORE_STATUS_OPTIONS.find((o) => o.value === status)?.label ?? status}`
			);
		} else toast.error(store.error || 'Could not update store status');
	}
</script>

<div class="studio-controls-container">
	<div class="studio-tab-content">
		<!-- 1. STYLE TAB -->
		{#if section === 'style'}
			<div class="studio-section">
				<div class="studio-section-header">
					<h3>Design Presets</h3>
					<p>Curated style systems crafted for high conversion and aesthetics.</p>
				</div>

				<div class="studio-presets-grid">
					{#each THEME_PRESETS as preset (preset.id)}
						{@const isSelected = draft.theme.preset === preset.id}
						<button
							type="button"
							class="studio-preset-card"
							class:selected={isSelected}
							onclick={() => applyPreset(preset.id)}
						>
							<div class="studio-preset-swatches">
								<span class="studio-swatch" style="background:{preset.primary};"></span>
								<span class="studio-swatch" style="background:{preset.secondary};"></span>
								<span class="studio-swatch" style="background:{preset.accent};"></span>
							</div>
							<div class="studio-preset-info">
								<span class="studio-preset-name">{preset.name}</span>
								<span class="studio-preset-desc">{preset.blurb}</span>
							</div>
							{#if isSelected}
								<span class="studio-preset-check">
									<Check size={14} strokeWidth={2.8} />
								</span>
							{/if}
						</button>
					{/each}
				</div>
			</div>

			<div class="studio-section">
				<div class="studio-section-header">
					<h3>Typography</h3>
					<p>Select the font pairing for headlines, product names, and body text.</p>
				</div>
				<div class="studio-pill-group">
					{#each FONT_OPTIONS as opt (opt.value)}
						<button
							type="button"
							class="studio-choice-pill"
							class:active={draft.theme.font === opt.value}
							onclick={() => store.mutate((d) => (d.theme.font = opt.value as any))}
						>
							{opt.label}
						</button>
					{/each}
				</div>
			</div>

			<div class="studio-section">
				<div class="studio-section-header">
					<h3>Buttons</h3>
					<p>Corner rounding and visual shape for call-to-actions and checkout buttons.</p>
				</div>
				<div class="studio-pill-group">
					{#each BUTTON_OPTIONS as opt (opt.value)}
						<button
							type="button"
							class="studio-choice-pill"
							class:active={draft.theme.button === opt.value}
							onclick={() => store.mutate((d) => (d.theme.button = opt.value as any))}
						>
							{opt.label}
						</button>
					{/each}
				</div>
			</div>

			<div class="studio-section">
				<div class="studio-section-header">
					<h3>Border Radius</h3>
					<p>Overall corner rounding for surfaces, cards, and containers.</p>
				</div>
				<div class="studio-pill-group">
					{#each RADIUS_OPTIONS as opt (opt.value)}
						<button
							type="button"
							class="studio-choice-pill"
							class:active={draft.theme.radius === opt.value}
							onclick={() => store.mutate((d) => (d.theme.radius = opt.value as any))}
						>
							{opt.label}
						</button>
					{/each}
				</div>
			</div>

			<div class="studio-section">
				<div class="studio-section-header">
					<h3>Product Card Style</h3>
					<p>Depth and border treatment for product tiles and rows.</p>
				</div>
				<div class="studio-pill-group">
					{#each CARD_OPTIONS as opt (opt.value)}
						<button
							type="button"
							class="studio-choice-pill"
							class:active={draft.theme.card === opt.value}
							onclick={() => store.mutate((d) => (d.theme.card = opt.value as any))}
						>
							{opt.label}
						</button>
					{/each}
				</div>
			</div>
		{/if}

		<!-- 2. BRANDING TAB -->
		{#if section === 'branding'}
			<div class="studio-section">
				<div class="studio-section-header">
					<h3>Business Profile</h3>
					<p>Your business identity as customers will see it across the storefront.</p>
				</div>

				<div class="studio-form-group">
					<label class="studio-label" for="sf-store-name">Store / Business Name</label>
					<input
						id="sf-store-name"
						type="text"
						class="studio-input"
						value={draft.store.name}
						oninput={(e) => store.mutate((d) => (d.store.name = e.currentTarget.value))}
						placeholder="e.g. Momo Magic or Hearth Bakery"
					/>
				</div>

				<div class="studio-form-group">
					<label class="studio-label" for="sf-store-tagline">Tagline / Subtitle</label>
					<input
						id="sf-store-tagline"
						type="text"
						class="studio-input"
						value={draft.store.tagline}
						oninput={(e) => store.mutate((d) => (d.store.tagline = e.currentTarget.value))}
						placeholder="e.g. Artisan Breads, Coffee & Good Vibes"
					/>
				</div>

				<div class="studio-form-group">
					<label class="studio-label" for="sf-logo-url">Logo Image URL</label>
					<div class="studio-input-with-preview">
						<input
							id="sf-logo-url"
							type="url"
							class="studio-input"
							value={draft.store.logo_url}
							oninput={(e) => store.mutate((d) => (d.store.logo_url = e.currentTarget.value))}
							placeholder="https://example.com/logo.png"
						/>
						{#if draft.store.logo_url}
							<button
								type="button"
								class="btn btn-ghost btn-sm"
								onclick={() => store.mutate((d) => (d.store.logo_url = ''))}
							>
								Clear
							</button>
						{/if}
					</div>
				</div>
			</div>

			<div class="studio-section">
				<div class="studio-section-header">
					<h3>Color Palette</h3>
					<p>High-contrast, accessible brand colors mapped to design tokens.</p>
				</div>

				<!-- Quick curated swatches -->
				<div class="studio-color-presets">
					<span class="studio-micro-label">Curated Color Pairs</span>
					<div class="studio-swatch-list">
						{#each SWATCH_PALETTES as pal (pal.label)}
							<button
								type="button"
								class="studio-swatch-chip"
								title={pal.label}
								onclick={() => applyPalette(pal.primary, pal.secondary, pal.accent)}
							>
								<span style="background:{pal.primary}"></span>
								<span style="background:{pal.secondary}"></span>
								<span style="background:{pal.accent}"></span>
							</button>
						{/each}
					</div>
				</div>

				<div class="studio-color-pickers-grid">
					<div class="studio-color-field">
						<label class="studio-color-label" for="sf-col-prim">Primary Brand</label>
						<div class="studio-color-control">
							<input
								id="sf-col-prim"
								type="color"
								class="studio-color-box"
								value={draft.theme.primary}
								oninput={(e) => store.mutate((d) => (d.theme.primary = e.currentTarget.value))}
							/>
							<input
								type="text"
								class="studio-hex-input"
								value={draft.theme.primary}
								oninput={(e) => store.mutate((d) => (d.theme.primary = e.currentTarget.value))}
							/>
						</div>
					</div>

					<div class="studio-color-field">
						<label class="studio-color-label" for="sf-col-sec">Secondary</label>
						<div class="studio-color-control">
							<input
								id="sf-col-sec"
								type="color"
								class="studio-color-box"
								value={draft.theme.secondary}
								oninput={(e) => store.mutate((d) => (d.theme.secondary = e.currentTarget.value))}
							/>
							<input
								type="text"
								class="studio-hex-input"
								value={draft.theme.secondary}
								oninput={(e) => store.mutate((d) => (d.theme.secondary = e.currentTarget.value))}
							/>
						</div>
					</div>

					<div class="studio-color-field">
						<label class="studio-color-label" for="sf-col-acc">Accent / Highlight</label>
						<div class="studio-color-control">
							<input
								id="sf-col-acc"
								type="color"
								class="studio-color-box"
								value={draft.theme.accent}
								oninput={(e) => store.mutate((d) => (d.theme.accent = e.currentTarget.value))}
							/>
							<input
								type="text"
								class="studio-hex-input"
								value={draft.theme.accent}
								oninput={(e) => store.mutate((d) => (d.theme.accent = e.currentTarget.value))}
							/>
						</div>
					</div>
				</div>
			</div>

			<div class="studio-section">
				<div class="studio-section-header">
					<h3>Default theme</h3>
					<p>First visit uses this mode; system follows the device when selected.</p>
				</div>
				<div class="studio-pill-group">
					{#each MODE_OPTIONS as opt (opt.value)}
						<button
							type="button"
							class="studio-choice-pill"
							class:active={draft.theme.mode === opt.value}
							onclick={() => store.mutate((d) => (d.theme.mode = opt.value as any))}
						>
							{opt.label}
						</button>
					{/each}
				</div>
			</div>

			<div class="studio-section">
				<div class="studio-section-header">
					<h3>Customer theme switch</h3>
					<p>When on, shoppers can switch light and dark; the default still applies on first visit.</p>
				</div>
				<div class="studio-switch-row">
					<div>
						<span class="studio-switch-title">Show theme toggle on storefront</span>
					</div>
					<input
						type="checkbox"
						class="studio-toggle"
						checked={Boolean(draft.theme.customer_mode_switch_enabled)}
						onchange={(e) =>
							store.mutate((d) => (d.theme.customer_mode_switch_enabled = e.currentTarget.checked))}
					/>
				</div>
			</div>
		{/if}

		<!-- 3. HOMEPAGE TAB -->
		{#if section === 'homepage'}
			<div class="studio-section">
				<div class="studio-section-header">
					<h3>Hero Banner</h3>
					<p>Cover style at the top of the homepage.</p>
				</div>

				<div class="studio-pill-group">
					{#each HERO_OPTIONS as opt (opt.value)}
						<button
							type="button"
							class="studio-choice-pill"
							class:active={draft.theme.hero === opt.value}
							onclick={() => store.mutate((d) => (d.theme.hero = opt.value as any))}
						>
							{opt.label}
						</button>
					{/each}
				</div>

				{#if draft.theme.hero === 'image'}
					<div class="studio-form-group">
						<label class="studio-label" for="sf-hero-image">Hero Cover Photo URL</label>
						<input
							id="sf-hero-image"
							type="url"
							class="studio-input"
							value={draft.theme.hero_image_url || ''}
							oninput={(e) => store.mutate((d) => (d.theme.hero_image_url = e.currentTarget.value))}
							placeholder="https://images.unsplash.com/photo-..."
						/>
						{#if !(draft.theme.hero_image_url || '').trim()}
							<p class="studio-hint">Paste an image URL to show a photo cover. Until then the brand gradient is used.</p>
						{/if}
					</div>
				{/if}

				<button
					type="button"
					class="studio-advanced-toggle"
					onclick={() => (showHeroAdvanced = !showHeroAdvanced)}
				>
					{showHeroAdvanced ? 'Hide' : 'Show'} title &amp; subtitle
				</button>

				{#if showHeroAdvanced && heroSection}
					<div class="studio-form-group">
						<label class="studio-label" for="sf-hero-title">Hero title</label>
						<input
							id="sf-hero-title"
							type="text"
							class="studio-input"
							value={heroSection.content?.title || ''}
							oninput={(e) => updateSectionContent(heroSection.id, 'title', e.currentTarget.value)}
							placeholder={draft.store.name || 'Store name'}
						/>
					</div>
					<div class="studio-form-group">
						<label class="studio-label" for="sf-hero-subtitle">Hero subtitle</label>
						<input
							id="sf-hero-subtitle"
							type="text"
							class="studio-input"
							value={heroSection.content?.subtitle || ''}
							oninput={(e) => updateSectionContent(heroSection.id, 'subtitle', e.currentTarget.value)}
							placeholder={draft.store.tagline || 'Short tagline'}
						/>
					</div>
				{/if}
			</div>

			<div class="studio-section">
				<div class="studio-section-header">
					<h3>Customer banner</h3>
					<p>
						Top-of-store notice for offers and alerts. Saves immediately — same as Storefront → Action.
					</p>
				</div>

				<div class="studio-form-group">
					<label class="studio-label">Announcement type</label>
					<div class="studio-pill-group">
						{#each [
							{ value: 'offer', label: 'Offer' },
							{ value: 'alert', label: 'Alert' },
							{ value: 'msg', label: 'Message' },
							{ value: 'others', label: 'Other' }
						] as opt (opt.value)}
							<button
								type="button"
								class="studio-choice-pill"
								class:active={bannerType === opt.value}
								onclick={() => (bannerType = opt.value as BroadcastType)}
							>
								{opt.label}
							</button>
						{/each}
					</div>
				</div>

				<div class="studio-form-group">
					<label class="studio-label" for="sf-banner-text">Banner text</label>
					<textarea
						id="sf-banner-text"
						class="studio-input"
						rows={3}
						maxlength={200}
						placeholder="Write an announcement…"
						value={bannerText}
						oninput={(e) => (bannerText = e.currentTarget.value)}
					></textarea>
				</div>

				<div class="studio-banner-actions">
					<button
						type="button"
						class="btn btn-primary btn-sm"
						disabled={bannerSaving}
						onclick={() => void saveBanner()}
					>
						{bannerSaving ? 'Saving…' : 'Publish banner'}
					</button>
					<button
						type="button"
						class="btn btn-ghost btn-sm"
						disabled={bannerSaving || !draft.behaviour.status_message}
						onclick={() => void clearBanner()}
					>
						Clear banner
					</button>
				</div>
			</div>

			<div class="studio-section">
				<div class="studio-section-header">
					<h3>Homepage Sections</h3>
					<p>Toggle, rename, and reorder what customers see.</p>
				</div>

				<div class="studio-sections-list">
					{#each draft.homepage.sections.filter((s) => s.type !== 'ANNOUNCEMENT') as section (section.id)}
						<div class="studio-section-item" class:disabled={!section.enabled}>
							<div class="studio-section-item-left">
								<button
									type="button"
									class="studio-visibility-btn"
									class:active={section.enabled}
									title={section.enabled ? 'Click to disable' : 'Click to enable'}
									onclick={() => toggleSection(section.id)}
								>
									{#if section.enabled}
										<Eye size={16} strokeWidth={2} />
									{:else}
										<EyeOff size={16} strokeWidth={2} />
									{/if}
								</button>
								<div class="studio-section-item-text">
									<span class="studio-section-type">{section.type.replace(/_/g, ' ')}</span>
									{#if section.type !== 'ANNOUNCEMENT' && section.type !== 'HERO'}
										<input
											type="text"
											class="studio-inline-input"
											value={section.content?.title ?? ''}
											oninput={(e) =>
												updateSectionContent(section.id, 'title', e.currentTarget.value)}
											placeholder="Section title"
										/>
										<input
											type="text"
											class="studio-inline-input studio-inline-input-sub"
											value={section.content?.description ?? section.content?.subtitle ?? ''}
											oninput={(e) =>
												updateSectionContent(section.id, 'description', e.currentTarget.value)}
											placeholder="Short description (optional)"
										/>
									{/if}
								</div>
							</div>

							<div class="studio-section-reorder-btns">
								<button
									type="button"
									class="studio-icon-button"
									disabled={draft.homepage.sections.findIndex((s) => s.id === section.id) === 0}
									title="Move Up"
									onclick={() => moveSection(section.id, 'up')}
								>
									<ArrowUp size={14} strokeWidth={2.4} />
								</button>
								<button
									type="button"
									class="studio-icon-button"
									disabled={
										draft.homepage.sections.findIndex((s) => s.id === section.id) ===
										draft.homepage.sections.length - 1
									}
									title="Move Down"
									onclick={() => moveSection(section.id, 'down')}
								>
									<ArrowDown size={14} strokeWidth={2.4} />
								</button>
							</div>
						</div>
					{/each}
				</div>
			</div>
		{/if}

		<!-- 4. MENU APPEARANCE TAB -->
		{#if section === 'menu'}
			<div class="studio-section">
				<div class="studio-section-header">
					<h3>Product Grid vs List</h3>
					<p>Select how your catalog and menu items are presented to customers.</p>
				</div>

				<div class="studio-pill-group">
					{#each LAYOUT_OPTIONS as opt (opt.value)}
						<button
							type="button"
							class="studio-choice-pill"
							class:active={draft.theme.product_layout === opt.value}
							onclick={() => store.mutate((d) => (d.theme.product_layout = opt.value as any))}
						>
							{opt.label}
						</button>
					{/each}
				</div>
			</div>

			<div class="studio-section">
				<div class="studio-section-header">
					<h3>Category Navigation Style</h3>
					<p>How customers jump between categories on mobile and desktop.</p>
				</div>

				<div class="studio-pill-group">
					{#each FILTER_OPTIONS as opt (opt.value)}
						<button
							type="button"
							class="studio-choice-pill"
							class:active={draft.theme.filter_style === opt.value}
							onclick={() => store.mutate((d) => (d.theme.filter_style = opt.value as any))}
						>
							{opt.label}
						</button>
					{/each}
				</div>
			</div>

			<div class="studio-section">
				<div class="studio-section-header">
					<h3>Header Navigation</h3>
					<p>Choose whether the top bar sticks to the top during page scroll.</p>
				</div>

				<div class="studio-pill-group">
					{#each HEADER_OPTIONS as opt (opt.value)}
						<button
							type="button"
							class="studio-choice-pill"
							class:active={draft.theme.header === opt.value}
							onclick={() => store.mutate((d) => (d.theme.header = opt.value as any))}
						>
							{opt.label}
						</button>
					{/each}
				</div>
			</div>
		{/if}

		<!-- ORDERING & STATUS -->
		{#if section === 'ordering'}
			<div class="studio-section">
				<div class="studio-section-header">
					<h3>Store status</h3>
					<p>Shown on the customer storefront. Saves immediately — same as Storefront → Action.</p>
				</div>
				<div class="studio-pill-group">
					{#each STORE_STATUS_OPTIONS as opt (opt.value)}
						<button
							type="button"
							class="studio-choice-pill"
							class:active={(draft.behaviour.store_status || 'OPEN') === opt.value}
							disabled={statusSaving}
							onclick={() => void pickStatus(opt.value)}
						>
							{opt.label}
						</button>
					{/each}
				</div>
			</div>

			<div class="studio-section">
				<div class="studio-section-header">
					<h3>Accept orders</h3>
					<p>When off, customers can browse but not check out.</p>
				</div>
				<div class="studio-switch-row">
					<div>
						<span class="studio-switch-title">Ordering enabled</span>
					</div>
					<input
						type="checkbox"
						class="studio-toggle"
						checked={draft.behaviour.ordering_enabled}
						onchange={(e) =>
							store.mutate((d) => (d.behaviour.ordering_enabled = e.currentTarget.checked))}
					/>
				</div>
			</div>

			<div class="studio-section">
				<div class="studio-section-header">
					<h3>Closed message</h3>
					<p>Shown when ordering is unavailable.</p>
				</div>
				<input
					type="text"
					class="studio-input"
					maxlength={200}
					value={draft.behaviour.closed_message}
					oninput={(e) =>
						store.mutate((d) => (d.behaviour.closed_message = e.currentTarget.value))}
				/>
			</div>

			<div class="studio-section">
				<div class="studio-section-header">
					<h3>Pricing &amp; prep time</h3>
					<p>Applied on every order at checkout ({draft.store.currency}).</p>
				</div>
				<div class="studio-form-group">
					<label class="studio-label" for="sf-prep-ordering">Preparation time (minutes)</label>
					<input
						id="sf-prep-ordering"
						type="number"
						class="studio-input"
						min="0"
						max="240"
						value={draft.behaviour.prep_time_minutes}
						oninput={(e) =>
							store.mutate(
								(d) => (d.behaviour.prep_time_minutes = parseInt(e.currentTarget.value) || 0)
							)}
					/>
				</div>
				<div class="studio-form-group">
					<label class="studio-label" for="sf-tax">Tax (%)</label>
					<input
						id="sf-tax"
						type="number"
						class="studio-input"
						min="0"
						max="100"
						step="0.01"
						value={draft.behaviour.tax_percent}
						oninput={(e) =>
							store.mutate((d) => (d.behaviour.tax_percent = parseFloat(e.currentTarget.value) || 0))}
					/>
				</div>
				<div class="studio-form-group">
					<label class="studio-label" for="sf-fee">Packaging fee</label>
					<input
						id="sf-fee"
						type="number"
						class="studio-input"
						min="0"
						step="0.01"
						value={draft.behaviour.packaging_fee}
						oninput={(e) =>
							store.mutate(
								(d) => (d.behaviour.packaging_fee = parseFloat(e.currentTarget.value) || 0)
							)}
					/>
				</div>
			</div>

			<div class="studio-section">
				<div class="studio-section-header">
					<h3>Opening hours</h3>
					<p>When the store accepts orders by the clock. Saves immediately — same as Action.</p>
				</div>
				<OpeningHoursForm
					studio={{
						hours: draft.hours,
						onChange: (patch) => store.previewHours(patch),
						onSave: (patch) => store.saveHours(patch)
					}}
				/>
			</div>
		{/if}

		<!-- CUSTOMERS -->
		{#if section === 'customer'}
			<div class="studio-section">
				<div class="studio-section-header">
					<h3>Phone sign-in (OTP)</h3>
					<p>Phone OTP only today — email login is not available yet.</p>
				</div>

				<div class="studio-options-list">
					{#each LOGIN_MODE_OPTIONS as opt (opt.value)}
						<button
							type="button"
							class="studio-option-row"
							class:active={draft.behaviour.customer_login_mode === opt.value}
							onclick={() =>
								store.mutate((d) => {
									d.behaviour.customer_login_mode = opt.value;
									d.behaviour.customer_login_enabled = opt.value !== 'off';
								})}
						>
							<div class="studio-option-label">
								<span class="studio-option-title">{opt.label}</span>
								<span class="studio-option-hint">{opt.hint}</span>
							</div>
							<span class="studio-radio-circle"></span>
						</button>
					{/each}
				</div>
			</div>
		{/if}

		<!-- 6. CHECKOUT TAB -->
		{#if section === 'checkout'}
			<div class="studio-section">
				<div class="studio-section-header">
					<h3>Payment Methods</h3>
					<p>Enable and configure the payment options customers can select.</p>
				</div>

				<div class="studio-switch-row">
					<div>
						<span class="studio-switch-title">Online Payment (UPI, Cards, Net Banking)</span>
						<span class="studio-switch-desc">Instant digital checkout through payment gateway</span>
					</div>
					<input
						type="checkbox"
						class="studio-toggle"
						checked={draft.payments.online_payment_enabled}
						onchange={(e) =>
							store.mutate((d) => (d.payments.online_payment_enabled = e.currentTarget.checked))}
					/>
				</div>

				<div class="studio-switch-row">
					<div>
						<span class="studio-switch-title">Cash on Counter</span>
						<span class="studio-switch-desc">Customer pays cash directly upon receiving order</span>
					</div>
					<input
						type="checkbox"
						class="studio-toggle"
						checked={draft.payments.cash_enabled}
						onchange={(e) => store.mutate((d) => (d.payments.cash_enabled = e.currentTarget.checked))}
					/>
				</div>

				<div class="studio-switch-row">
					<div>
						<span class="studio-switch-title">Pay at Pickup</span>
						<span class="studio-switch-desc">Allow card or UPI payment at the physical counter</span>
					</div>
					<input
						type="checkbox"
						class="studio-toggle"
						checked={draft.payments.pay_at_pickup_enabled}
						onchange={(e) =>
							store.mutate((d) => (d.payments.pay_at_pickup_enabled = e.currentTarget.checked))}
					/>
				</div>
			</div>

			<div class="studio-section">
				<div class="studio-section-header">
					<h3>Order flow</h3>
					<p>How orders are accepted, paid, and completed.</p>
				</div>

				<div class="studio-form-group">
					<label class="studio-label" for="sf-acceptance">Order Acceptance</label>
					<div class="studio-pill-group">
						{#each ACCEPTANCE_MODES as opt (opt.value)}
							<button
								type="button"
								class="studio-choice-pill"
								class:active={draft.workflow.acceptance_mode === opt.value}
								onclick={() => store.mutate((d) => (d.workflow.acceptance_mode = opt.value))}
							>
								{opt.label}
							</button>
						{/each}
					</div>
				</div>

				<div class="studio-form-group">
					<label class="studio-label" for="sf-pay-timing">Payment Requirement</label>
					<div class="studio-pill-group">
						{#each PAYMENT_TIMINGS as opt (opt.value)}
							<button
								type="button"
								class="studio-choice-pill"
								class:active={draft.workflow.payment_requirement === opt.value}
								onclick={() => store.mutate((d) => (d.workflow.payment_requirement = opt.value))}
							>
								{opt.label}
							</button>
						{/each}
					</div>
				</div>

				<div class="studio-switch-row">
					<div>
						<span class="studio-switch-title">Ready notification</span>
						<span class="studio-switch-desc">Notify customers when an order is ready</span>
					</div>
					<input
						type="checkbox"
						class="studio-toggle"
						checked={draft.workflow.ready_notification}
						onchange={(e) =>
							store.mutate((d) => (d.workflow.ready_notification = e.currentTarget.checked))}
					/>
				</div>

				<div class="studio-switch-row">
					<div>
						<span class="studio-switch-title">Auto-complete orders</span>
						<span class="studio-switch-desc">Mark orders complete when they reach Ready</span>
					</div>
					<input
						type="checkbox"
						class="studio-toggle"
						checked={draft.workflow.auto_complete}
						onchange={(e) =>
							store.mutate((d) => (d.workflow.auto_complete = e.currentTarget.checked))}
					/>
				</div>
			</div>
		{/if}
	</div>
</div>

<style>
	.studio-controls-container {
		display: block;
		min-height: 0;
		background: transparent;
	}

	.studio-tab-content {
		overflow: visible;
		padding: 1rem 1.1rem 1.5rem;
		display: flex;
		flex-direction: column;
		gap: 1.15rem;
		/* Sized to content; .studio-panel is the only scroll container */
		height: auto;
	}

	.studio-section {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		padding-bottom: 0;
		border-bottom: none;
	}

	.studio-section + .studio-section {
		padding-top: 1rem;
		border-top: 1px solid color-mix(in srgb, var(--border) 70%, transparent);
	}

	.studio-section:last-child {
		border-bottom: none;
	}

	.studio-section-header h3 {
		margin: 0;
		font-size: var(--fs-title);
		font-weight: 700;
		color: var(--text);
	}

	.studio-section-header p {
		margin: 2px 0 0;
		font-size: var(--fs-code);
		color: var(--text-3);
		line-height: 1.4;
	}

	.studio-advanced-toggle {
		align-self: flex-start;
		margin-top: 0.15rem;
		padding: 0;
		border: none;
		background: transparent;
		color: var(--accent);
		font: inherit;
		font-size: var(--fs-meta);
		font-weight: 650;
		cursor: pointer;
	}

	.studio-advanced-toggle:hover {
		text-decoration: underline;
	}

	.studio-presets-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
		gap: 8px;
	}

	.studio-preset-card {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		position: relative;
		padding: 8px 10px;
		border: 1.5px solid var(--border);
		border-radius: var(--radius-sm, 8px);
		background: var(--surface-2);
		text-align: left;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.studio-preset-card:hover {
		border-color: var(--accent);
		background: var(--surface);
	}

	.studio-preset-card.selected {
		border-color: var(--accent);
		background: color-mix(in srgb, var(--accent) 8%, var(--surface));
		box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent) 25%, transparent);
	}

	.studio-preset-swatches {
		display: flex;
		gap: 4px;
		margin-bottom: 6px;
	}

	.studio-swatch {
		width: 14px;
		height: 14px;
		border-radius: 50%;
		border: 1px solid rgba(0, 0, 0, 0.1);
	}

	.studio-preset-name {
		font-size: var(--fs-body);
		font-weight: 700;
		color: var(--text);
	}

	.studio-preset-desc {
		font-size: var(--fs-label);
		color: var(--text-3);
		line-height: 1.3;
	}

	.studio-preset-check {
		position: absolute;
		top: 6px;
		right: 6px;
		width: 18px;
		height: 18px;
		background: var(--accent);
		color: var(--on-accent);
		border-radius: 50%;
		display: grid;
		place-items: center;
	}

	.studio-pill-group {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}

	.studio-choice-pill {
		padding: 6px 12px;
		font-size: var(--fs-body);
		font-weight: 600;
		border: 1px solid var(--border);
		border-radius: 999px;
		background: var(--surface-2);
		color: var(--text-2);
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.studio-choice-pill:hover {
		border-color: var(--accent);
		color: var(--text);
	}

	.studio-choice-pill.active {
		background: var(--accent);
		color: var(--on-accent);
		border-color: var(--accent);
	}

	.studio-options-list {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.studio-option-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 10px 12px;
		border: 1px solid var(--border);
		border-radius: var(--radius-sm, 8px);
		background: var(--surface-2);
		text-align: left;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.studio-option-row:hover {
		border-color: var(--accent);
		background: var(--surface);
	}

	.studio-option-row.active {
		border-color: var(--accent);
		background: color-mix(in srgb, var(--accent) 8%, var(--surface));
	}

	.studio-option-title {
		display: block;
		font-size: var(--fs-body);
		font-weight: 600;
		color: var(--text);
	}

	.studio-option-hint {
		display: block;
		font-size: var(--fs-meta);
		color: var(--text-3);
		line-height: 1.35;
	}

	.studio-radio-circle {
		width: 16px;
		height: 16px;
		border-radius: 50%;
		border: 2px solid var(--border);
		transition: all 0.15s ease;
	}

	.studio-option-row.active .studio-radio-circle {
		border-color: var(--accent);
		background: var(--accent);
		box-shadow: inset 0 0 0 3px #fff;
	}

	.studio-form-group {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.studio-banner-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		align-items: center;
		margin-top: 0.35rem;
	}

	.studio-label {
		font-size: var(--fs-tab);
		font-weight: 600;
		color: var(--text);
	}

	.studio-input,
	.studio-select {
		padding: 7px 10px;
		font-size: var(--fs-body);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm, 6px);
		background: var(--surface);
		color: var(--text);
		width: 100%;
		box-sizing: border-box;
	}

	.studio-input:focus,
	.studio-select:focus {
		outline: none;
		border-color: var(--accent);
		box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent) 20%, transparent);
	}

	.studio-hint {
		font-size: var(--fs-meta);
		color: var(--text-3);
		line-height: 1.35;
	}

	.studio-color-pickers-grid {
		display: grid;
		grid-template-columns: 1fr;
		gap: 0.65rem;
	}

	.studio-color-field {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}

	.studio-color-label {
		font-size: var(--fs-meta);
		font-weight: 600;
		color: var(--text-2);
	}

	.studio-color-control {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.35rem 0.45rem;
		border: 1px solid var(--border);
		border-radius: 10px;
		background: var(--surface);
	}

	.studio-color-box {
		flex: none;
		width: 2rem;
		height: 2rem;
		padding: 0;
		border: 1px solid var(--border);
		border-radius: 8px;
		cursor: pointer;
		background: transparent;
		overflow: hidden;
	}

	.studio-color-box::-webkit-color-swatch-wrapper {
		padding: 0;
	}

	.studio-color-box::-webkit-color-swatch {
		border: none;
		border-radius: 6px;
	}

	.studio-hex-input {
		flex: 1;
		min-width: 0;
		padding: 0.35rem 0.45rem;
		font-size: var(--fs-tab);
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
		border: none;
		border-radius: 6px;
		background: transparent;
		color: var(--text);
	}

	.studio-hex-input:focus {
		outline: none;
	}

	.studio-color-presets {
		margin-bottom: 0.8rem;
	}

	.studio-micro-label {
		display: block;
		font-size: var(--fs-meta);
		font-weight: 600;
		color: var(--text-3);
		margin-bottom: 6px;
	}

	.studio-swatch-list {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}

	.studio-swatch-chip {
		display: flex;
		padding: 3px;
		border: 1px solid var(--border);
		border-radius: 999px;
		background: var(--surface-2);
		cursor: pointer;
		gap: 3px;
		transition: transform 0.15s ease;
	}

	.studio-swatch-chip:hover {
		transform: scale(1.08);
		border-color: var(--accent);
	}

	.studio-swatch-chip span {
		width: 14px;
		height: 14px;
		border-radius: 50%;
	}

	.studio-switch-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 10px 12px;
		background: var(--surface-2);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm, 8px);
		gap: 12px;
	}

	.studio-switch-title {
		display: block;
		font-size: var(--fs-body);
		font-weight: 600;
		color: var(--text);
	}

	.studio-switch-desc {
		display: block;
		font-size: var(--fs-meta);
		color: var(--text-3);
	}

	.studio-toggle {
		width: 36px;
		height: 20px;
		accent-color: var(--accent);
		cursor: pointer;
	}

	.studio-sections-list {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.studio-section-item {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 8px 10px;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm, 6px);
		transition: opacity 0.15s ease;
	}

	.studio-section-item.disabled {
		opacity: 0.55;
		background: var(--surface-2);
	}

	.studio-section-item-left {
		display: flex;
		align-items: center;
		gap: 10px;
		min-width: 0;
		flex: 1;
	}

	.studio-visibility-btn {
		background: transparent;
		border: none;
		cursor: pointer;
		color: var(--text-3);
		display: grid;
		place-items: center;
		padding: 4px;
		border-radius: 4px;
	}

	.studio-visibility-btn.active {
		color: var(--accent);
	}

	.studio-section-type {
		display: block;
		font-size: var(--fs-code);
		font-weight: 700;
		color: var(--text);
		text-transform: capitalize;
	}

	.studio-inline-input {
		font-size: var(--fs-code);
		padding: 2px 6px;
		border: 1px solid var(--border);
		border-radius: 4px;
		background: var(--surface);
		color: var(--text);
		width: 100%;
		max-width: 14rem;
	}

	.studio-inline-input-sub {
		margin-top: 0.25rem;
		color: var(--text-2);
		font-weight: 500;
	}

	.studio-section-item-text {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
		min-width: 0;
		flex: 1;
	}

	.studio-section-reorder-btns {
		display: flex;
		gap: 2px;
	}

	.studio-icon-button {
		background: transparent;
		border: 1px solid var(--border);
		border-radius: 4px;
		padding: 4px 6px;
		cursor: pointer;
		color: var(--text-2);
		display: grid;
		place-items: center;
	}

	.studio-icon-button:hover:not(:disabled) {
		background: var(--surface-2);
		color: var(--text);
	}

	.studio-icon-button:disabled {
		opacity: 0.3;
		cursor: not-allowed;
	}
</style>
