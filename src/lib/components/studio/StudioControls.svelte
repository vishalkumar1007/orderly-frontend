<script lang="ts">
	import Palette from '@lucide/svelte/icons/palette';
	import Image from '@lucide/svelte/icons/image';
	import LayoutTemplate from '@lucide/svelte/icons/layout-template';
	import UtensilsCrossed from '@lucide/svelte/icons/utensils-crossed';
	import Users from '@lucide/svelte/icons/users';
	import CreditCard from '@lucide/svelte/icons/credit-card';
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
		ACCEPTANCE_MODES,
		PAYMENT_TIMINGS
	} from '$lib/storefront/admin';

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

	function moveSection(index: number, direction: 'up' | 'down') {
		const targetIndex = direction === 'up' ? index - 1 : index + 1;
		const sections = draft.homepage.sections;
		if (targetIndex < 0 || targetIndex >= sections.length) return;
		store.mutate((d) => {
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

	const announcementSection = $derived(draft.homepage.sections.find((s) => s.type === 'ANNOUNCEMENT'));
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

			<div class="studio-section">
				<div class="studio-section-header">
					<h3>Menu Layout</h3>
					<p>Choose between list rows, visual grid tiles, or compact scanning view.</p>
				</div>
				<div class="studio-options-list">
					{#each LAYOUT_OPTIONS as opt (opt.value)}
						<button
							type="button"
							class="studio-option-row"
							class:active={draft.theme.product_layout === opt.value}
							onclick={() => store.mutate((d) => (d.theme.product_layout = opt.value as any))}
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
					<h3>Color Mode</h3>
					<p>Choose default mode or let the customer's device decide.</p>
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
		{/if}

		<!-- 3. HOMEPAGE TAB -->
		{#if section === 'homepage'}
			<div class="studio-section">
				<div class="studio-section-header">
					<h3>Hero Banner</h3>
					<p>Visual welcome banner shown at the top of your homepage.</p>
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
					<div class="studio-form-group" style="margin-top:0.8rem;">
						<label class="studio-label" for="sf-hero-image">Hero Cover Photo URL</label>
						<input
							id="sf-hero-image"
							type="url"
							class="studio-input"
							value={draft.theme.hero_image_url || ''}
							oninput={(e) => store.mutate((d) => (d.theme.hero_image_url = e.currentTarget.value))}
							placeholder="https://images.unsplash.com/photo-..."
						/>
					</div>
				{/if}
			</div>

			<div class="studio-section">
				<div class="studio-section-header">
					<h3>Announcement Banner</h3>
					<p>Highlighted notice bar pinned at the top for deals, promotions, or alerts.</p>
				</div>

				<div class="studio-switch-row">
					<label class="studio-toggle-label" for="sf-ann-toggle">Enable announcement bar</label>
					<input
						id="sf-ann-toggle"
						type="checkbox"
						class="studio-toggle"
						checked={Boolean(announcementSection?.enabled)}
						onchange={() => {
							if (announcementSection) {
								toggleSection(announcementSection.id);
							} else {
								store.mutate((d) => {
									d.homepage.sections.unshift({
										id: 'announcement',
										type: 'ANNOUNCEMENT',
										enabled: true,
										content: { text: 'Free shipping on orders above ₹499!', tone: 'info' }
									});
								});
							}
						}}
					/>
				</div>

				{#if announcementSection?.enabled}
					<div class="studio-form-group" style="margin-top:0.6rem;">
						<label class="studio-label" for="sf-ann-text">Announcement Message</label>
						<input
							id="sf-ann-text"
							type="text"
							class="studio-input"
							value={announcementSection.content?.text || ''}
							oninput={(e) =>
								updateSectionContent(announcementSection.id, 'text', e.currentTarget.value)}
							placeholder="e.g. Flat 20% off all orders today! Use code TASTY20"
						/>
					</div>

					<div class="studio-form-group">
						<label class="studio-label" for="sf-ann-tone">Tone / Color Style</label>
						<div class="studio-pill-group">
							{#each ['info', 'success', 'warn'] as tone}
								<button
									type="button"
									class="studio-choice-pill"
									class:active={(announcementSection.content?.tone || 'info') === tone}
									onclick={() => updateSectionContent(announcementSection.id, 'tone', tone)}
								>
									{tone === 'info' ? 'Brand Blue' : tone === 'success' ? 'Green Deal' : 'Amber Alert'}
								</button>
							{/each}
						</div>
					</div>
				{/if}
			</div>

			<div class="studio-section">
				<div class="studio-section-header">
					<h3>Homepage Sections & Order</h3>
					<p>Enable, disable, rename, and arrange sections on your storefront.</p>
				</div>

				<div class="studio-sections-list">
					{#each draft.homepage.sections as section, i (section.id)}
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
									{#if section.content?.title !== undefined}
										<input
											type="text"
											class="studio-inline-input"
											value={section.content.title}
											oninput={(e) =>
												updateSectionContent(section.id, 'title', e.currentTarget.value)}
											placeholder="Section title"
										/>
									{/if}
								</div>
							</div>

							<div class="studio-section-reorder-btns">
								<button
									type="button"
									class="studio-icon-button"
									disabled={i === 0}
									title="Move Up"
									onclick={() => moveSection(i, 'up')}
								>
									<ArrowUp size={14} strokeWidth={2.4} />
								</button>
								<button
									type="button"
									class="studio-icon-button"
									disabled={i === draft.homepage.sections.length - 1}
									title="Move Down"
									onclick={() => moveSection(i, 'down')}
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

		<!-- 5. CUSTOMER EXPERIENCE TAB -->
		{#if section === 'customer'}
			<div class="studio-section">
				<div class="studio-section-header">
					<h3>Guest Ordering</h3>
					<p>Allow any visitor to order immediately without signing in.</p>
				</div>

				<div class="studio-switch-row">
					<div>
						<span class="studio-switch-title">Accept Guest Orders</span>
						<span class="studio-switch-desc">Frictionless checkout without password or verification</span>
					</div>
					<input
						type="checkbox"
						class="studio-toggle"
						checked={draft.behaviour.ordering_enabled}
						onchange={(e) => store.mutate((d) => (d.behaviour.ordering_enabled = e.currentTarget.checked))}
					/>
				</div>
			</div>

			<div class="studio-section">
				<div class="studio-section-header">
					<h3>Customer Phone Sign-In (OTP)</h3>
					<p>Control whether customers can sign in with their phone number.</p>
				</div>

				<div class="studio-options-list">
					{#each LOGIN_MODE_OPTIONS as opt (opt.value)}
						<button
							type="button"
							class="studio-option-row"
							class:active={draft.behaviour.customer_login_mode === opt.value}
							onclick={() => store.mutate((d) => (d.behaviour.customer_login_mode = opt.value))}
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

			<div class="studio-section">
				<div class="studio-section-header">
					<h3>Customer Perks & History</h3>
					<p>Enable self-serve tracking and order history for returning customers.</p>
				</div>

				<div class="studio-switch-row">
					<div>
						<span class="studio-switch-title">Order Tracking Notifications</span>
						<span class="studio-switch-desc">Send customer live order status updates</span>
					</div>
					<input
						type="checkbox"
						class="studio-toggle"
						checked={draft.workflow.ready_notification}
						onchange={(e) => store.mutate((d) => (d.workflow.ready_notification = e.currentTarget.checked))}
					/>
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
					<h3>Checkout Behavior & Timing</h3>
					<p>Operational workflow for order acceptance and preparation.</p>
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

				<div class="studio-form-group">
					<label class="studio-label" for="sf-prep-time">Estimated Preparation Time (Minutes)</label>
					<input
						id="sf-prep-time"
						type="number"
						class="studio-input"
						min="0"
						max="240"
						value={draft.behaviour.prep_time_minutes}
						oninput={(e) =>
							store.mutate((d) => (d.behaviour.prep_time_minutes = parseInt(e.currentTarget.value) || 20))}
					/>
				</div>
			</div>
		{/if}
	</div>
</div>

<style>
	.studio-controls-container {
		display: flex;
		flex-direction: column;
		height: 100%;
		background: var(--surface);
		border-right: 1px solid var(--border);
	}





	.studio-tab-content {
		flex: 1;
		overflow-y: auto;
		padding: 1.25rem;
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	.studio-section {
		display: flex;
		flex-direction: column;
		gap: 0.8rem;
		padding-bottom: 1.25rem;
		border-bottom: 1px solid var(--border-soft, #f1f5f9);
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
		grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
		gap: 10px;
	}

	.studio-color-field {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.studio-color-label {
		font-size: var(--fs-meta);
		font-weight: 600;
		color: var(--text-2);
	}

	.studio-color-control {
		display: flex;
		align-items: center;
		gap: 6px;
	}

	.studio-color-box {
		width: 32px;
		height: 32px;
		padding: 0;
		border: 1px solid var(--border);
		border-radius: var(--radius-sm, 6px);
		cursor: pointer;
		background: transparent;
	}

	.studio-hex-input {
		flex: 1;
		padding: 5px 8px;
		font-size: var(--fs-tab);
		font-family: monospace;
		border: 1px solid var(--border);
		border-radius: var(--radius-sm, 6px);
		background: var(--surface);
		color: var(--text);
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
		width: 180px;
		max-width: 100%;
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
