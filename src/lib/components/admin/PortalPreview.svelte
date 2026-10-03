<script lang="ts">
	import type { BusinessTypeTemplate } from '$lib/admin/businessTypes';
	import { hasModule } from '$lib/admin/businessTypes';
	import IconAddressBook from '@tabler/icons-svelte/icons/address-book';
	import IconCalendarCheck from '@tabler/icons-svelte/icons/calendar-check';
	import IconCalendarEvent from '@tabler/icons-svelte/icons/calendar-event';
	import IconCircle from '@tabler/icons-svelte/icons/circle';
	import IconCreditCard from '@tabler/icons-svelte/icons/credit-card';
	import IconDashboard from '@tabler/icons-svelte/icons/dashboard';
	import IconDeviceMobile from '@tabler/icons-svelte/icons/device-mobile';
	import IconDoor from '@tabler/icons-svelte/icons/door';
	import IconLayoutGrid from '@tabler/icons-svelte/icons/layout-grid';
	import IconList from '@tabler/icons-svelte/icons/list';
	import IconListCheck from '@tabler/icons-svelte/icons/list-check';
	import IconReceipt from '@tabler/icons-svelte/icons/receipt';
	import IconScreenShare from '@tabler/icons-svelte/icons/screen-share';
	import IconShoppingBag from '@tabler/icons-svelte/icons/shopping-bag';
	import IconSparkles from '@tabler/icons-svelte/icons/sparkles';
	import IconToolsKitchen from '@tabler/icons-svelte/icons/tools-kitchen';
	import IconUsers from '@tabler/icons-svelte/icons/users';
	import { isLocalBaseDomain } from '$lib/host';

	let {
		template,
		businessName = '',
		slug = '',
		baseDomain = 'localhost',
		frontendPort = '5173',
		capabilityLabels = [],
		primary = '#5b4bdb',
		secondary = '#8b5cf6',
		accent = '#06b6d4',
		themePreset = 'modern',
		mode = 'light',
		logoUrl = ''
	}: {
		template: BusinessTypeTemplate;
		businessName?: string;
		slug?: string;
		baseDomain?: string;
		/** Empty string omits the port (production). */
		frontendPort?: string;
		capabilityLabels?: { code: string; label: string }[];
		primary?: string;
		secondary?: string;
		accent?: string;
		themePreset?: string;
		mode?: string;
		logoUrl?: string;
	} = $props();

	let activeTab = $state<'admin' | 'storefront'>('admin');

	const CAP_ICON: Record<string, typeof IconUsers> = {
		CUSTOMERS: IconUsers,
		STAFF: IconAddressBook,
		PAYMENTS: IconCreditCard,
		BILLING: IconReceipt,
		CATALOG: IconShoppingBag,
		CART: IconShoppingBag,
		ORDERS: IconListCheck,
		KITCHEN: IconToolsKitchen,
		SERVICES: IconList,
		APPOINTMENTS: IconCalendarCheck,
		QUEUE: IconList,
		RESERVATIONS: IconCalendarEvent,
		TABLES: IconLayoutGrid,
		ROOMS: IconDoor,
		HOUSEKEEPING: IconSparkles
	};

	type NavItem = { label: string; icon: typeof IconUsers };

	const navItems = $derived<NavItem[]>(
		template.capabilityDriven
			? capabilityLabels.map((c) => ({ label: c.label, icon: CAP_ICON[c.code] ?? IconCircle }))
			: [
					{ label: template.terminology.catalog, icon: IconShoppingBag },
					{ label: template.terminology.orders, icon: IconListCheck },
					...(hasModule(template.code, 'station')
						? [{ label: template.terminology.station, icon: IconToolsKitchen }]
						: []),
					{ label: 'Customers', icon: IconUsers },
					{ label: 'Staff', icon: IconAddressBook }
				]
	);

	const activityRows = $derived(
		template.capabilityDriven
			? [
					{ label: `${template.terminology.ticket} #101`, status: 'Waiting' },
					{ label: `${template.terminology.ticket} #102`, status: template.terminology.prep }
				]
			: [
					{ label: `${template.terminology.order} #142`, status: template.terminology.prep },
					{ label: `${template.terminology.order} #141`, status: 'Ready' }
				]
	);

	// Contextual sample items based on business type
	const sampleProducts = $derived(() => {
		switch (template.code) {
			case 'FOOD_SHOP':
				return [
					{ name: 'Steamed Momo (10 pcs)', cat: 'Momo', price: '₹140' },
					{ name: 'Crispy Fried Wontons', cat: 'Appetizers', price: '₹180' },
					{ name: 'Spicy Thukpa Bowl', cat: 'Soups', price: '₹210' }
				];
			case 'CAFE':
				return [
					{ name: 'Cold Brew Vanilla Latte', cat: 'Coffee', price: '₹220' },
					{ name: 'Almond Croissant', cat: 'Bakery', price: '₹160' },
					{ name: 'Matcha Iced Cloud', cat: 'Specialty', price: '₹240' }
				];
			case 'GROCERY':
				return [
					{ name: 'Organic Himalayan Honey (500g)', cat: 'Staples', price: '₹350' },
					{ name: 'Fresh Farm A2 Milk (1L)', cat: 'Dairy', price: '₹85' },
					{ name: 'Sourdough Whole Wheat Loaf', cat: 'Bakery', price: '₹120' }
				];
			case 'BARBER':
				return [
					{ name: 'Classic Fade & Beard Sculpt', cat: 'Services', price: '₹450' },
					{ name: 'Hydrating Scalp Treatment', cat: 'Spa', price: '₹600' },
					{ name: 'Precision Styling & Wash', cat: 'Hair', price: '₹350' }
				];
			case 'HOTEL':
				return [
					{ name: 'Deluxe Mountain View Suite', cat: 'Rooms', price: '₹4,500/nt' },
					{ name: 'Executive King Studio', cat: 'Rooms', price: '₹6,200/nt' },
					{ name: 'Airport Express Chauffeur', cat: 'Add-ons', price: '₹1,200' }
				];
			default:
				return [
					{ name: `${template.terminology.item} 1`, cat: template.terminology.group, price: '₹199' },
					{ name: `${template.terminology.item} 2`, cat: template.terminology.group, price: '₹349' },
					{ name: `${template.terminology.item} 3`, cat: template.terminology.group, price: '₹499' }
				];
		}
	});

	const initial = $derived((businessName.trim().charAt(0) || template.label.charAt(0)).toUpperCase());
	const displayUrl = $derived(`${slug || 'subdomain'}.${baseDomain}`);
	const displayOrigin = $derived.by(() => {
		const local = isLocalBaseDomain(baseDomain);
		const scheme = local ? 'http' : 'https';
		const port =
			local && frontendPort && frontendPort !== '80' && frontendPort !== '443'
				? `:${frontendPort}`
				: '';
		return `${scheme}://${displayUrl}${port}`;
	});
</script>

<div class="pv-container" class:is-light-mode={mode === 'light'}>
	<!-- Top Preview View Mode Switcher -->
	<div class="pv-view-tabs">
		<button
			type="button"
			class="pv-view-tab"
			class:is-active={activeTab === 'admin'}
			onclick={() => (activeTab = 'admin')}
		>
			<IconScreenShare size={15} stroke={2} />
			<span>Admin Console</span>
		</button>
		<button
			type="button"
			class="pv-view-tab"
			class:is-active={activeTab === 'storefront'}
			onclick={() => (activeTab = 'storefront')}
		>
			<IconDeviceMobile size={15} stroke={2} />
			<span>Storefront (Mobile)</span>
		</button>
	</div>

	<!-- TAB 1: ADMIN CONSOLE PREVIEW -->
	{#if activeTab === 'admin'}
		<div class="pv-console-wrapper">
			<div class="pv-console">
				<!-- Console Window Chrome -->
				<div class="pv-console-chrome">
					<div class="pv-chrome-dots">
						<span class="pv-dot red"></span>
						<span class="pv-dot yellow"></span>
						<span class="pv-dot green"></span>
					</div>
					<div class="pv-chrome-url">
						<span>http://{displayUrl}/admin</span>
					</div>
				</div>

				<!-- Console Main Interface -->
				<div class="pv-console-body">
					<!-- Console Left Navigation -->
					<div class="pv-console-sidebar">
						<div class="pv-console-brand">
							{#if logoUrl}
								<img class="pv-console-logo" src={logoUrl} alt="" />
							{:else}
								<span class="pv-console-logo-fallback" style:background={primary || accent}>{initial}</span>
							{/if}
							<div class="pv-console-brand-text">
								<strong>{businessName || 'Business'}</strong>
								<small>{template.label}</small>
							</div>
						</div>

						<nav class="pv-console-nav">
							<div class="pv-nav-row is-active" style:color={primary || accent} style:background={`color-mix(in srgb, ${primary || accent} 18%, transparent)`}>
								<IconDashboard size={14} stroke={2} />
								<span>Dashboard</span>
							</div>
							{#each navItems.slice(0, 4) as item}
								<div class="pv-nav-row">
									<item.icon size={14} stroke={1.8} />
									<span>{item.label}</span>
								</div>
							{/each}
						</nav>
					</div>

					<!-- Console Content Area -->
					<div class="pv-console-main">
						<div class="pv-content-top">
							<span class="pv-view-title">{template.terminology.orders} live stream</span>
							<span class="pv-badge" style:border-color={primary || accent} style:color={primary || accent}>Operational</span>
						</div>

						<!-- Metric stat tiles -->
						<div class="pv-console-stats">
							<div class="pv-stat-card">
								<span class="pv-stat-num">18</span>
								<small>Today's {template.terminology.orders}</small>
							</div>
							<div class="pv-stat-card">
								<span class="pv-stat-num" style:color={primary || accent}>₹12,450</span>
								<small>Revenue</small>
							</div>
						</div>

						<!-- Recent Activity Queue -->
						<div class="pv-activity-list">
							{#each activityRows as row}
								<div class="pv-activity-row">
									<span class="pv-act-label">{row.label}</span>
									<span class="pv-act-status" style:background={`color-mix(in srgb, ${primary || accent} 20%, transparent)`} style:color={primary || accent}>
										{row.status}
									</span>
								</div>
							{/each}
						</div>
					</div>
				</div>
			</div>
		</div>

	<!-- TAB 2: STOREFRONT MOBILE PREVIEW -->
	{:else}
		<div class="pv-phone-wrapper">
			<div class="pv-phone" style:--active-accent={accent}>
				<!-- Phone Speaker / Dynamic Island -->
				<div class="pv-phone-speaker">
					<span class="pv-phone-camera"></span>
				</div>

				<!-- Phone Top Bar -->
				<div class="pv-phone-top-bar">
					<span class="pv-phone-title">{businessName || 'Your Business'}</span>
					<span
						class="pv-phone-tag"
						style:color={primary || accent}
						style:border={`1px solid color-mix(in srgb, ${primary || accent} 35%, transparent)`}
						style:background={`color-mix(in srgb, ${primary || accent} 14%, ${mode === 'light' ? 'rgba(255, 255, 255, 0.9)' : 'rgba(0, 0, 0, 0.4)'})`}
					>
						{template.label}
					</span>
				</div>

				<!-- Phone Scrollable Body -->
				<div class="pv-phone-content">
					<!-- Store Header -->
					<div class="pv-phone-header">
						{#if logoUrl}
							<img class="pv-phone-logo" src={logoUrl} alt="" />
						{:else}
							<span class="pv-phone-avatar" style:background={primary || accent}>{initial}</span>
						{/if}
						<div class="pv-phone-biz-info">
							<strong class="pv-phone-biz-name">{businessName || 'Your Business Name'}</strong>
							<span class="pv-phone-biz-url">{displayOrigin}</span>
						</div>
					</div>

					<!-- Categories Pills -->
					<div class="pv-phone-cat-pills">
						<span class="pv-cat-pill is-active" style:background={primary || accent}>All {template.terminology.catalog}</span>
						{#each (template.starterCategories.length > 0 ? template.starterCategories.slice(0, 3) : ['Popular', 'Featured', 'New']) as cat}
							<span class="pv-cat-pill">{cat}</span>
						{/each}
					</div>

					<!-- Live Product List -->
					<div class="pv-phone-items">
						{#each sampleProducts() as prod}
							<div class="pv-product-card">
								<div class="pv-prod-thumb" style:background={`color-mix(in srgb, ${secondary || accent} 25%, ${mode === 'light' ? '#e2e8f0' : '#1e293b'})`}>
									<span class="pv-prod-dot" style:background={secondary || accent}></span>
								</div>
								<div class="pv-prod-details">
									<strong class="pv-prod-name">{prod.name}</strong>
									<span class="pv-prod-cat">{prod.cat}</span>
								</div>
								<div class="pv-prod-action">
									<span class="pv-prod-price">{prod.price}</span>
									<button type="button" class="pv-prod-add" style:background={primary || accent}>+</button>
								</div>
							</div>
						{/each}
					</div>

					<!-- Checkout CTA -->
					<button type="button" class="pv-phone-cta" style:background={primary || accent}>
						<span>Proceed to {template.terminology.order}</span>
						<span class="pv-phone-cta-badge">3 items</span>
					</button>
				</div>
			</div>
		</div>
	{/if}
</div>

<style>
	.pv-container {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		width: 100%;
		height: 100%;
	}

	.pv-view-tabs {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		padding: 4px;
		background: rgba(0, 0, 0, 0.4);
		border-radius: 12px;
		border: 1px solid rgba(255, 255, 255, 0.08);
		width: fit-content;
		margin: 0 auto;
	}

	.pv-view-tab {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 6px 14px;
		border-radius: 9px;
		border: none;
		background: transparent;
		color: #94a3b8;
		font-size: 0.775rem;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.18s ease;
	}

	.pv-view-tab.is-active {
		background: rgba(255, 255, 255, 0.1);
		color: #ffffff;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
	}

	/* Phone Mockup Frame */
	.pv-phone-wrapper {
		display: flex;
		justify-content: center;
		align-items: center;
		padding: 0.5rem 0;
		position: relative;
	}

	.pv-phone {
		width: 290px;
		height: 480px;
		border-radius: 36px;
		background: rgba(12, 16, 26, 0.72);
		backdrop-filter: blur(16px);
		-webkit-backdrop-filter: blur(16px);
		border: 2px solid rgba(255, 255, 255, 0.12);
		box-shadow: 0 16px 36px -8px rgba(0, 0, 0, 0.65), 0 0 1px rgba(255, 255, 255, 0.1);
		overflow: hidden;
		display: flex;
		flex-direction: column;
		position: relative;
		z-index: 1;
	}

	.pv-phone-speaker {
		position: absolute;
		top: 10px;
		left: 50%;
		transform: translateX(-50%);
		width: 70px;
		height: 14px;
		background: rgba(0, 0, 0, 0.7);
		border-radius: 10px;
		z-index: 10;
		display: grid;
		place-items: center;
	}

	.pv-phone-camera {
		width: 6px;
		height: 6px;
		border-radius: 9999px;
		background: #1e293b;
	}

	.pv-phone-top-bar {
		padding: 26px 14px 10px;
		display: flex;
		align-items: center;
		justify-content: space-between;
		color: #ffffff;
		flex: none;
		background: rgba(10, 14, 22, 0.6);
		backdrop-filter: blur(12px);
		-webkit-backdrop-filter: blur(12px);
		border-bottom: 1px solid rgba(255, 255, 255, 0.08);
	}

	.pv-phone-title {
		font-size: 0.75rem;
		font-weight: 700;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		max-width: 140px;
	}

	.pv-phone-tag {
		font-size: 0.625rem;
		font-weight: 700;
		padding: 2px 7px;
		border-radius: 9999px;
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}

	.pv-phone-content {
		flex: 1;
		overflow-y: auto;
		padding: 10px 12px;
		display: flex;
		flex-direction: column;
		gap: 10px;
		background: rgba(8, 12, 20, 0.45);
		scrollbar-width: none;
		-ms-overflow-style: none;
	}

	.pv-phone-content::-webkit-scrollbar {
		display: none;
	}

	.pv-phone-header {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 8px 10px;
		border-radius: 12px;
		background: rgba(255, 255, 255, 0.04);
		border: 1px solid rgba(255, 255, 255, 0.06);
	}

	.pv-phone-logo,
	.pv-phone-avatar {
		width: 32px;
		height: 32px;
		border-radius: 8px;
		object-fit: cover;
		display: grid;
		place-items: center;
		color: #fff;
		font-weight: 700;
		font-size: 0.85rem;
		flex: none;
	}

	.pv-phone-biz-info {
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}

	.pv-phone-biz-name {
		font-size: 0.775rem;
		color: #f8fafc;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.pv-phone-biz-url {
		font-size: 0.65rem;
		color: #64748b;
		font-family: monospace;
	}

	.pv-phone-cat-pills {
		display: flex;
		gap: 6px;
		overflow-x: auto;
		padding-bottom: 2px;
	}

	.pv-cat-pill {
		padding: 3px 8px;
		border-radius: 9999px;
		font-size: 0.65rem;
		font-weight: 600;
		background: rgba(255, 255, 255, 0.06);
		color: #94a3b8;
		white-space: nowrap;
	}

	.pv-cat-pill.is-active {
		color: #ffffff;
	}

	.pv-phone-items {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.pv-product-card {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 7px 8px;
		border-radius: 10px;
		background: rgba(255, 255, 255, 0.035);
		border: 1px solid rgba(255, 255, 255, 0.06);
	}

	.pv-prod-thumb {
		width: 30px;
		height: 30px;
		border-radius: 8px;
		display: grid;
		place-items: center;
		flex: none;
	}

	.pv-prod-dot {
		width: 8px;
		height: 8px;
		border-radius: 9999px;
	}

	.pv-prod-details {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
	}

	.pv-prod-name {
		font-size: 0.725rem;
		color: #f1f5f9;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.pv-prod-cat {
		font-size: 0.625rem;
		color: #64748b;
	}

	.pv-prod-action {
		display: flex;
		align-items: center;
		gap: 6px;
	}

	.pv-prod-price {
		font-size: 0.7rem;
		font-weight: 600;
		color: #cbd5e1;
		font-family: monospace;
	}

	.pv-prod-add {
		width: 20px;
		height: 20px;
		border-radius: 6px;
		border: none;
		color: #fff;
		font-weight: 700;
		display: grid;
		place-items: center;
		cursor: pointer;
		font-size: 0.75rem;
	}

	.pv-phone-cta {
		margin-top: auto;
		width: 100%;
		padding: 8px 12px;
		border-radius: 10px;
		border: none;
		color: #fff;
		font-size: 0.75rem;
		font-weight: 700;
		display: flex;
		align-items: center;
		justify-content: space-between;
		cursor: pointer;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
	}

	.pv-phone-cta-badge {
		font-size: 0.65rem;
		padding: 1px 6px;
		border-radius: 9999px;
		background: rgba(0, 0, 0, 0.25);
	}

	/* Console Mockup Frame */
	.pv-console-wrapper {
		display: flex;
		justify-content: center;
		align-items: center;
		padding: 0.5rem 0;
		position: relative;
	}

	.pv-console {
		width: 100%;
		max-width: 440px;
		height: 480px;
		border-radius: 18px;
		background: rgba(12, 16, 26, 0.72);
		backdrop-filter: blur(16px);
		-webkit-backdrop-filter: blur(16px);
		border: 1px solid rgba(255, 255, 255, 0.12);
		box-shadow: 0 16px 36px -8px rgba(0, 0, 0, 0.65);
		overflow: hidden;
		display: flex;
		flex-direction: column;
		position: relative;
		z-index: 1;
	}

	.pv-console-chrome {
		padding: 10px 14px;
		display: flex;
		align-items: center;
		gap: 12px;
		background: rgba(10, 14, 22, 0.6);
		border-bottom: 1px solid rgba(255, 255, 255, 0.08);
	}

	.pv-chrome-dots {
		display: flex;
		gap: 6px;
	}

	.pv-dot {
		width: 9px;
		height: 9px;
		border-radius: 9999px;
	}

	.pv-dot.red { background: #ef4444; }
	.pv-dot.yellow { background: #f59e0b; }
	.pv-dot.green { background: #10b981; }

	.pv-chrome-url {
		flex: 1;
		padding: 3px 10px;
		border-radius: 9999px;
		background: rgba(255, 255, 255, 0.05);
		font-size: 0.675rem;
		color: #94a3b8;
		font-family: monospace;
	}

	.pv-console-body {
		flex: 1;
		display: flex;
		min-height: 0;
	}

	.pv-console-sidebar {
		width: 130px;
		background: rgba(10, 14, 22, 0.5);
		border-right: 1px solid rgba(255, 255, 255, 0.06);
		padding: 10px 8px;
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.pv-console-brand {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 2px 4px;
	}

	.pv-console-logo,
	.pv-console-logo-fallback {
		width: 22px;
		height: 22px;
		border-radius: 6px;
		display: grid;
		place-items: center;
		color: #fff;
		font-size: 0.75rem;
		font-weight: 700;
	}

	.pv-console-brand-text {
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}

	.pv-console-brand-text strong {
		font-size: 0.7rem;
		color: #f8fafc;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.pv-console-brand-text small {
		font-size: 0.6rem;
		color: #64748b;
	}

	.pv-console-nav {
		display: flex;
		flex-direction: column;
		gap: 3px;
	}

	.pv-nav-row {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 5px 8px;
		border-radius: 6px;
		font-size: 0.7rem;
		font-weight: 550;
		color: #94a3b8;
	}

	.pv-console-main {
		flex: 1;
		padding: 12px;
		display: flex;
		flex-direction: column;
		gap: 10px;
		background: rgba(8, 12, 20, 0.45);
	}

	.pv-content-top {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.pv-view-title {
		font-size: 0.775rem;
		font-weight: 700;
		color: #f1f5f9;
	}

	.pv-badge {
		font-size: 0.625rem;
		font-weight: 700;
		padding: 2px 7px;
		border-radius: 9999px;
		border: 1px solid;
	}

	.pv-console-stats {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 8px;
	}

	.pv-stat-card {
		padding: 8px 10px;
		border-radius: 10px;
		background: rgba(255, 255, 255, 0.04);
		border: 1px solid rgba(255, 255, 255, 0.06);
		display: flex;
		flex-direction: column;
	}

	.pv-stat-num {
		font-size: 1rem;
		font-weight: 700;
		color: #ffffff;
		font-family: monospace;
	}

	.pv-stat-card small {
		font-size: 0.625rem;
		color: #64748b;
	}

	.pv-activity-list {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.pv-activity-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 7px 9px;
		border-radius: 8px;
		background: rgba(255, 255, 255, 0.03);
		border: 1px solid rgba(255, 255, 255, 0.05);
	}

	.pv-act-label {
		font-size: 0.7rem;
		color: #cbd5e1;
	}

	.pv-act-status {
		font-size: 0.625rem;
		font-weight: 600;
		padding: 2px 6px;
		border-radius: 6px;
	}


	/* ============================================================
	   LIGHT MODE PREVIEW STYLES
	   Transforms mockups cleanly when mode === 'light'
	   ============================================================ */

	.pv-container.is-light-mode .pv-view-tabs {
		background: rgba(0, 0, 0, 0.05);
		border-color: rgba(0, 0, 0, 0.08);
	}

	.pv-container.is-light-mode .pv-view-tab {
		color: #64748b;
	}

	.pv-container.is-light-mode .pv-view-tab.is-active {
		background: #ffffff;
		color: #0f172a;
		box-shadow: 0 1px 4px rgba(0, 0, 0, 0.1);
	}

	/* Light Mode Phone */
	.pv-container.is-light-mode .pv-phone {
		background: #ffffff;
		border: 2px solid rgba(0, 0, 0, 0.12);
		box-shadow: 0 16px 36px -8px rgba(0, 0, 0, 0.15), 0 0 1px rgba(0, 0, 0, 0.08);
	}

	.pv-container.is-light-mode .pv-phone-speaker {
		background: #1e293b;
	}

	.pv-container.is-light-mode .pv-phone-camera {
		background: #475569;
	}

	.pv-container.is-light-mode .pv-phone-top-bar {
		background: rgba(248, 250, 252, 0.95);
		color: #0f172a;
		border-bottom: 1px solid rgba(0, 0, 0, 0.06);
	}

	.pv-container.is-light-mode .pv-phone-title {
		color: #0f172a;
	}

	.pv-container.is-light-mode .pv-phone-content {
		background: #f8fafc;
	}

	.pv-container.is-light-mode .pv-phone-header {
		background: #ffffff;
		border: 1px solid rgba(0, 0, 0, 0.06);
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
	}

	.pv-container.is-light-mode .pv-phone-biz-name {
		color: #0f172a;
	}

	.pv-container.is-light-mode .pv-phone-biz-url {
		color: #64748b;
	}

	.pv-container.is-light-mode .pv-cat-pill {
		background: rgba(0, 0, 0, 0.06);
		color: #64748b;
	}

	.pv-container.is-light-mode .pv-cat-pill.is-active {
		color: #ffffff;
	}

	.pv-container.is-light-mode .pv-product-card {
		background: #ffffff;
		border: 1px solid rgba(0, 0, 0, 0.06);
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
	}

	.pv-container.is-light-mode .pv-prod-name {
		color: #0f172a;
	}

	.pv-container.is-light-mode .pv-prod-cat {
		color: #64748b;
	}

	.pv-container.is-light-mode .pv-prod-price {
		color: #0f172a;
	}

	/* Light Mode Console */
	.pv-container.is-light-mode .pv-console {
		background: #ffffff;
		border: 1px solid rgba(0, 0, 0, 0.1);
		box-shadow: 0 16px 36px -8px rgba(0, 0, 0, 0.12);
	}

	.pv-container.is-light-mode .pv-console-chrome {
		background: #f1f5f9;
		border-bottom: 1px solid rgba(0, 0, 0, 0.06);
	}

	.pv-container.is-light-mode .pv-chrome-url {
		background: #ffffff;
		border: 1px solid rgba(0, 0, 0, 0.06);
		color: #475569;
	}

	.pv-container.is-light-mode .pv-console-sidebar {
		background: #f8fafc;
		border-right: 1px solid rgba(0, 0, 0, 0.06);
	}

	.pv-container.is-light-mode .pv-console-brand-text strong {
		color: #0f172a;
	}

	.pv-container.is-light-mode .pv-console-brand-text small {
		color: #64748b;
	}

	.pv-container.is-light-mode .pv-nav-row {
		color: #64748b;
	}

	.pv-container.is-light-mode .pv-nav-row.is-active {
		color: #0f172a;
	}

	.pv-container.is-light-mode .pv-console-main {
		background: #f1f5f9;
	}

	.pv-container.is-light-mode .pv-view-title {
		color: #0f172a;
	}

	.pv-container.is-light-mode .pv-stat-card {
		background: #ffffff;
		border: 1px solid rgba(0, 0, 0, 0.06);
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.03);
	}

	.pv-container.is-light-mode .pv-stat-num {
		color: #0f172a;
	}

	.pv-container.is-light-mode .pv-stat-card small {
		color: #64748b;
	}

	.pv-container.is-light-mode .pv-activity-row {
		background: #ffffff;
		border: 1px solid rgba(0, 0, 0, 0.06);
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.03);
	}

	.pv-container.is-light-mode .pv-act-label {
		color: #334155;
	}

</style>
