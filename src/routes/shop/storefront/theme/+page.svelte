<script lang="ts">
	import { themeVars, type FilterStyleId, type ProductLayoutId, type StoreTheme } from '$lib/storefront/theme';
	import type { StoreConfig } from '$lib/storefront/api';
	import {
		BUTTON_OPTIONS,
		CARD_OPTIONS,
		FILTER_OPTIONS,
		FONT_OPTIONS,
		HEADER_OPTIONS,
		HERO_OPTIONS,
		LAYOUT_OPTIONS,
		MODE_OPTIONS,
		RADIUS_OPTIONS,
		THEME_PRESETS,
		storefrontAdminApi,
		type AdminStorefront,
		type ThemePreset
	} from '$lib/storefront/admin';
	import { seed, type StorefrontContext } from '$lib/storefront/admin-context';
	import { toast } from '$lib/components/admin/toast';

	/**
	 * Theme.
	 *
	 * A tenant picks a preset, optionally overrides three colours, and chooses
	 * from fixed component styles. There is no free-form CSS anywhere on this
	 * screen, and the server rejects any value outside these lists — which is
	 * what makes "no arbitrary CSS" a property of the system rather than a
	 * promise.
	 *
	 * The preview is the real storefront stylesheet with the real tokens, so what
	 * an owner approves is what a customer gets. It is not a mockup.
	 */
	let { config, save }: StorefrontContext = $props();

	let preset = $state<ThemePreset['id']>(seed(() => config.theme.preset));
	let mode = $state(seed(() => config.theme.mode));
	let font = $state(seed(() => config.theme.font));
	let radius = $state(seed(() => config.theme.radius));
	let button = $state(seed(() => config.theme.button));
	let card = $state(seed(() => config.theme.card));
	let header = $state(seed(() => config.theme.header));
	let hero = $state(seed(() => config.theme.hero));
	let layout = $state<ProductLayoutId>(seed(() => (config.theme.product_layout ?? 'list') as ProductLayoutId));
	let filterStyle = $state<FilterStyleId>(seed(() => (config.theme.filter_style ?? 'chips') as FilterStyleId));
	let primary = $state(seed(() => config.theme.primary));
	let secondary = $state(seed(() => config.theme.secondary));
	let accent = $state(seed(() => config.theme.accent));
	let saving = $state(false);

	type ColourKey = 'primary' | 'secondary' | 'accent';

	/** The preset's own colours, used to show which values are overrides. */
	const basePreset = $derived<ThemePreset>(
		THEME_PRESETS.find((option) => option.id === preset) ?? THEME_PRESETS[1]
	);

	/** `isOverridden` marks a colour the tenant has changed away from the preset. */
	function isOverridden(value: string, fallback: string): boolean {
		return value.toLowerCase() !== fallback.toLowerCase();
	}

	/**
	 * The live preview theme. Tokens the server would compute for these choices
	 * are taken from the last saved response for fields this screen has not
	 * changed, and the three colours are recomputed here for the ones it has.
	 * The preview is therefore indicative of the exact change being made, and the
	 * server is still the authority once saved.
	 */
	const previewTheme = $derived<StoreTheme>({
		...config.theme,
		preset: preset as StoreTheme['preset'],
		mode: mode as StoreTheme['mode'],
		font: font as StoreTheme['font'],
		radius: radius as StoreTheme['radius'],
		button: button as StoreTheme['button'],
		card: card as StoreTheme['card'],
		header: header as StoreTheme['header'],
		hero: hero as StoreTheme['hero'],
		product_layout: layout as StoreTheme['product_layout'],
		filter_style: filterStyle as StoreTheme['filter_style'],
		primary,
		secondary,
		accent,
		vars: {
			...config.theme.vars,
			'--sf-primary': primary,
			'--sf-secondary': secondary,
			'--sf-accent': accent,
			'--sf-product-layout': layout,
			'--sf-filter-style': filterStyle
		}
	});

	const previewVars = $derived(themeVars(previewTheme));
	const previewConfig = $derived<StoreConfig>({
		...({} as StoreConfig),
		store: { ...config.store, name: config.store.name, tagline: config.store.tagline },
		theme: previewTheme,
		ordering: {
			enabled: true,
			closed_reason: '',
			prep_time_minutes: 20,
			customer_login: true,
			customer_login_mode: 'optional',
			payment_requirement: '',
			auto_accept: false,
			store_status: 'OPEN',
			status_message: '',
			store_status_label: 'Open',
			status_message_display: ''
		},
		hours: { always_open: true, is_open: true, label: 'Open', detail: '', timezone: '', schedule: {}, today_closes: '' },
		payments: { online_payment_enabled: true, cash_enabled: true, pay_at_pickup_enabled: true, default_payment_method: 'ONLINE', methods: ['ONLINE', 'CASH'] },
		homepage: { sections: [] },
		preview: true
	});

	function selectPreset(id: ThemePreset['id']) {
		const found = THEME_PRESETS.find((p) => p.id === id);
		if (!found) return;
		preset = id;
		// Choosing a preset applies its whole look. Colours that were customised
		// before would otherwise linger and make the new preset look wrong.
		primary = found.primary;
		secondary = found.secondary;
		accent = found.accent;
		font = found.font as typeof font;
		radius = found.radius as typeof radius;
		button = found.button_style as typeof button;
		card = found.card_style as typeof card;
		header = found.header_style as typeof header;
		hero = found.hero_style as typeof hero;
	}

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		saving = true;
		const ok = await save(() =>
			storefrontAdminApi.saveTheme({
				preset,
				mode,
				font,
				radius,
				button,
				card,
				header,
				hero,
				product_layout: layout,
				filter_style: filterStyle,
				primary,
				secondary,
				accent
			})
		);
		saving = false;
		if (ok) {
			toast.success('Theme saved');
		} else {
			toast.error('Could not save your theme');
		}
	}
</script>

<form onsubmit={submit}>
	<div class="sfctl-grid" style="grid-template-columns:minmax(0,1fr);gap:1rem;">
		<!-- Preview -->
		<div class="sfpreview">
			<div class="sfpreview-bar">
				<span class="sfpreview-dot"></span>
				<span class="sfpreview-dot"></span>
				<span class="sfpreview-dot"></span>
				<span class="sfpreview-url">{config.public_url}</span>
			</div>
			<div class="sfpreview-body sf-root" data-sf-theme={mode === 'system' ? 'light' : mode} style={previewVars}>
				<div class="sf-preview-inner">
					<header class="sf-header" data-transparent={header === 'transparent'}>
						<div class="sf-header-row">
							<a class="sf-brand" href="#preview" onclick={(e) => e.preventDefault()}>
								{#if config.store.logo_url}
									<img class="sf-brand-logo" src={config.store.logo_url} alt="" />
								{:else}
									<span class="sf-brand-mark" aria-hidden="true">
										{(config.store.name || 'S').trim().charAt(0).toUpperCase()}
									</span>
								{/if}
								<span class="sf-brand-text">
									<span class="sf-brand-name">{config.store.name}</span>
									<span class="sf-brand-meta">
										<span class="sf-open-dot" data-open="true"></span> Open
									</span>
								</span>
							</a>
							<div class="sf-header-actions">
								<span class="sf-icon-btn" aria-hidden="true">
									<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9">
										<circle cx="12" cy="8" r="4" />
										<path d="M4 21a8 8 0 0 1 16 0" />
									</svg>
								</span>
								<span class="sf-icon-btn" aria-hidden="true">
									<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9">
										<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
										<path d="M3 6h18M16 10a4 4 0 0 1-8 0" />
									</svg>
								</span>
							</div>
						</div>
					</header>

					{#if hero !== 'none'}
						<section class="sf-hero" data-style={hero}>
							<div class="sf-hero-inner">
								<h1 style="font-size:1.25rem;">{config.store.name}</h1>
								{#if config.store.tagline}<p>{config.store.tagline}</p>{/if}
							</div>
						</section>
					{/if}

					<div style="padding:12px;">
						<div class="sf-section-head" style="padding:0;margin-bottom:8px;">
							<h2 style="font-size:0.875rem;">Popular right now</h2>
						</div>
						<nav class="sf-filter-bar" data-style={filterStyle} aria-label="Filters preview">
							<span class="sf-filter-chip" data-active="true">All</span>
							<span class="sf-filter-chip">Veg</span>
							<span class="sf-filter-chip">Popular</span>
						</nav>
						<div class="sf-products" data-layout={layout}>
							{#each [0, 1] as i (i)}
								<article class="sf-product" data-layout={layout}>
									<span class="sf-product-media"></span>
									<span class="sf-product-body">
										<span class="sf-product-name">
											{i === 0 ? 'Steamed Veg Momo' : 'Chowmein'}
										</span>
										<span class="sf-product-desc">Hand-folded, steamed to order</span>
										<span class="sf-product-foot">
											<span class="sf-product-price">₹{i === 0 ? '120' : '170'}</span>
											<span class="sf-add-btn">Add</span>
										</span>
									</span>
								</article>
							{/each}
						</div>

						<div style="display:grid;gap:6px;margin-top:12px;">
							<span class="sf-btn sf-btn-primary" style="min-height:40px;font-size:0.8125rem;">
								Place order · ₹360
							</span>
							<span class="sf-btn sf-btn-secondary" style="min-height:36px;font-size:0.75rem;">
								Continue shopping
							</span>
						</div>
					</div>
				</div>
			</div>
		</div>

		<!-- Presets -->
		<div class="sfctl-section">
			<h2>Theme preset</h2>
			<p class="sfctl-note">
				A starting point for the whole look. Choosing one applies its colours, font, corner
				rounding and component styles; you can still change any of them after.
			</p>
			<div class="sfpresets">
				{#each THEME_PRESETS as option (option.id)}
					<button
						class="sfpreset"
						type="button"
						aria-pressed={preset === option.id}
						onclick={() => selectPreset(option.id as ThemePreset['id'])}
					>
						<span class="sfpreset-swatches" aria-hidden="true">
							<span style="background:{option.primary};"></span>
							<span style="background:{option.secondary};"></span>
							<span style="background:{option.accent};"></span>
						</span>
						<span class="sfpreset-name">{option.name}</span>
						<span class="sfpreset-blurb">{option.blurb}</span>
					</button>
				{/each}
			</div>
		</div>

		<!-- Colours -->
		<div class="sfctl-section">
			<h2>Colours</h2>
			<p class="sfctl-note">
				Primary is your buttons and highlights. Secondary and accent are used for supporting
				elements. Text colour on your primary is worked out automatically so labels stay
				readable on any colour you pick.
			</p>
			<div class="sfctl-grid" data-cols="3">
				{#each [
					{ key: 'primary' as ColourKey, label: 'Primary', value: primary },
					{ key: 'secondary' as ColourKey, label: 'Secondary', value: secondary },
					{ key: 'accent' as ColourKey, label: 'Accent', value: accent }
				] as colour (colour.key)}
					<div class="field">
						<label class="field-label" for={'colour-' + colour.key}>
							{colour.label}
							{#if isOverridden(colour.value, basePreset[colour.key])}
								<span class="badge badge-accent" style="margin-left:0.35rem;">Custom</span>
							{/if}
						</label>
						<div class="sfcolor">
							<span class="sfcolor-swatch" style="background:{colour.value};">
								<input
									id={'colour-' + colour.key}
									type="color"
									bind:value={colour.value}
									aria-label={colour.label + ' colour'}
								/>
							</span>
							<input
								class="input"
								style="font-family:var(--font-mono);font-size:0.75rem;text-transform:lowercase;"
								bind:value={colour.value}
								maxlength={7}
								spellcheck="false"
							/>
						</div>
					</div>
				{/each}
			</div>
			<div style="display:flex;gap:0.4rem;margin-top:0.8rem;">
				<button
					class="btn btn-secondary btn-sm"
					type="button"
					onclick={() => {
						primary = basePreset.primary;
						secondary = basePreset.secondary;
						accent = basePreset.accent;
					}}
				>
					Reset to {basePreset.name}
				</button>
			</div>
		</div>

		<!-- Mode -->
		<div class="sfctl-section">
			<h2>Light or dark</h2>
			<p class="sfctl-note">System follows whatever the customer's phone or computer is set to.</p>
			<div style="display:grid;gap:0.4rem;">
				{#each MODE_OPTIONS as option (option.value)}
					<button
						class="sfopt"
						type="button"
						aria-pressed={mode === option.value}
						onclick={() => (mode = option.value as typeof mode)}
					>
						<span class="sfopt-mark" aria-hidden="true"></span>
						<span class="sfopt-body"><span class="sfopt-label">{option.label}</span></span>
					</button>
				{/each}
			</div>
		</div>

		<!-- Layout -->
		<div class="sfctl-section">
			<h2>Menu layout</h2>
			<p class="sfctl-note">
				How product cards are arranged and how filters look on the customer menu. These are
				closed styles from the platform catalogue — no free-form CSS.
			</p>
			<div class="sfctl-grid" data-cols="2">
				{#each [
					{ label: 'Product cards', value: layout, options: LAYOUT_OPTIONS, set: (v: string) => (layout = v as ProductLayoutId) },
					{ label: 'Filters', value: filterStyle, options: FILTER_OPTIONS, set: (v: string) => (filterStyle = v as FilterStyleId) }
				] as group (group.label)}
					<div class="field">
						<span class="field-label">{group.label}</span>
						<div style="display:grid;gap:0.3rem;">
							{#each group.options as option (option.value)}
								<button
									class="sfopt"
									type="button"
									aria-pressed={group.value === option.value}
									onclick={() => group.set(option.value)}
								>
									<span class="sfopt-mark" aria-hidden="true"></span>
									<span class="sfopt-body">
										<span class="sfopt-label">{option.label}</span>
										{#if 'hint' in option && option.hint}
											<span class="sfopt-hint">{option.hint}</span>
										{/if}
									</span>
								</button>
							{/each}
						</div>
					</div>
				{/each}
			</div>
		</div>

		<!-- Components -->
		<div class="sfctl-section">
			<h2>Components</h2>
			<p class="sfctl-note">
				How buttons, cards and the header look. These are fixed styles from the platform
				catalogue, so your storefront stays predictable on every screen size.
			</p>
			<div class="sfctl-grid" data-cols="2">
				{#each [
					{ label: 'Font', value: font, options: FONT_OPTIONS, set: (v: string) => (font = v as typeof font) },
					{ label: 'Corner rounding', value: radius, options: RADIUS_OPTIONS, set: (v: string) => (radius = v as typeof radius) },
					{ label: 'Buttons', value: button, options: BUTTON_OPTIONS, set: (v: string) => (button = v as typeof button) },
					{ label: 'Cards', value: card, options: CARD_OPTIONS, set: (v: string) => (card = v as typeof card) },
					{ label: 'Header', value: header, options: HEADER_OPTIONS, set: (v: string) => (header = v as typeof header) },
					{ label: 'Hero', value: hero, options: HERO_OPTIONS, set: (v: string) => (hero = v as typeof hero) }
				] as group (group.label)}
					<div class="field">
						<span class="field-label">{group.label}</span>
						<div style="display:grid;gap:0.3rem;">
							{#each group.options as option (option.value)}
								<button
									class="sfopt"
									type="button"
									aria-pressed={group.value === option.value}
									onclick={() => group.set(option.value)}
								>
									<span class="sfopt-mark" aria-hidden="true"></span>
									<span class="sfopt-body"><span class="sfopt-label">{option.label}</span></span>
								</button>
							{/each}
						</div>
					</div>
				{/each}
			</div>
		</div>

		<div class="sfctl-foot">
			<span class="sfctl-foot-note">The preview above updates as you choose.</span>
			<button class="btn btn-primary" type="submit" disabled={saving}>
				{saving ? 'Saving…' : 'Save theme'}
			</button>
		</div>
	</div>
</form>
