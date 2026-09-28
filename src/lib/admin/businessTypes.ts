/**
 * The business-type system.
 *
 * A business type is not a label. It is the answer to "what shape of business
 * is this?", and that answer decides how the tenant starts life: which theme it
 * wears, how its storefront is laid out, what its products are called, which
 * categories it begins with, how orders move, and how customers pay.
 *
 * All of that lives here, in one table, for one reason: the alternative is a
 * `{#if business_type === 'GROCERY'}` in forty components, and the fortieth one
 * is always the one nobody updates when a sixth type is added.
 *
 * Adding a type is a two-step job with no code archaeology:
 *
 *   1. add the row under Settings → Business types (or a migration), and
 *   2. add a template below, keyed by the same code.
 *
 * A type that exists in the database but has no template still works — it falls
 * back to {@link GENERIC_TEMPLATE} — so the console never breaks because the
 * catalogue moved ahead of the code.
 */

import type { Component } from 'svelte';
import Building2 from '@lucide/svelte/icons/building-2';
import Coffee from '@lucide/svelte/icons/coffee';
import Hotel from '@lucide/svelte/icons/hotel';
import ShoppingBasket from '@lucide/svelte/icons/shopping-basket';
import Soup from '@lucide/svelte/icons/soup';
import UtensilsCrossed from '@lucide/svelte/icons/utensils-crossed';
import type { TenantType } from './types';

/* ------------------------------------------------------------------ *
 * Shapes
 * ------------------------------------------------------------------ */

/**
 * The words a type uses for the same underlying objects.
 *
 * These are not decoration. A grocer does not have a "menu" of "products" in
 * "categories" — they have a catalogue of products in aisles, and a console
 * that insists otherwise reads as software built for somebody else. Every
 * label in the business console comes from here.
 */
export type Terminology = {
	/** What a row in the catalogue is called. */
	item: string;
	items: string;
	/** What a group of items is called. */
	group: string;
	groups: string;
	/** What the whole catalogue is called, e.g. Menu or Catalogue. */
	catalog: string;
	/** What a completed transaction is called. */
	order: string;
	orders: string;
	/** How the customer takes delivery in this build (pickup only). */
	fulfilment: string;
	/**
	 * Where orders are prepared — Kitchen, Bar, Packing, Service desk. It is
	 * the same board in every case; the word is what tells the person using it
	 * that the software understands their job.
	 */
	station: string;
	/**
	 * What the middle stage of the board is called. A kitchen cooks, a bar
	 * pours, a grocer packs and a hotel is simply working on it — printing
	 * "Cooking" above a shelf-picking queue is how a board stops being read.
	 */
	prep: string;
	/** What one unit of work on the board is: a ticket, a picklist, a job. */
	ticket: string;
	/** The verb for finishing an order, e.g. "collected" or "delivered". */
	handover: string;
	/** What the people who work here are called. */
	staff: string;
};

/**
 * Console modules.
 *
 * A business type enables a set of these. They relabel and reorder far more
 * often than they hide: a grocer keeps the preparation board, it is simply
 * called Packing. Something is only hidden when it is genuinely meaningless
 * for the type — a pickup display in a hotel, where nobody is waiting at a
 * counter.
 */
export type ModuleKey =
	/** The preparation board, whatever it is called for this type. */
	| 'station'
	/** The customer-facing pickup display. */
	| 'live_display'
	/** Size / variant choices on an item. */
	| 'variants'
	/** Optional extras on an item. */
	| 'addons'
	/** Catalogue search, for catalogues too long to scroll. */
	| 'catalog_search'
	/** Stock on hand, rather than a simple available/unavailable switch. */
	| 'stock'
	/** Charging an order to a room rather than taking payment at handover. */
	| 'room_charge';

/**
 * Storefront defaults, in the vocabulary the storefront schema already uses.
 * The keys match the API payload on purpose — this object is sent, not
 * translated, so there is no second mapping to keep in step.
 */
export type StorefrontDefaults = {
	theme_preset: 'classic' | 'modern' | 'street-food' | 'minimal' | 'fresh' | 'dark';
	product_layout: 'list' | 'grid' | 'compact';
	hero_style: 'image' | 'gradient' | 'compact' | 'none';
	font_family: 'inter' | 'sora' | 'poppins' | 'system';
	radius: 'none' | 'sm' | 'md' | 'lg' | 'pill';
	card_style: 'elevated' | 'outlined' | 'filled' | 'minimal';
	button_style: 'rounded' | 'pill' | 'square' | 'soft';
};

export type BehaviourDefaults = {
	ordering_enabled: boolean;
	customer_login_mode: 'off' | 'optional' | 'required';
	prep_time_minutes: number;
};

export type PaymentDefaults = {
	online_payment_enabled: boolean;
	cash_enabled: boolean;
	pay_at_pickup_enabled: boolean;
	default_payment_method: 'ONLINE' | 'CASH';
};

export type WorkflowDefaults = {
	acceptance_mode: 'MANUAL' | 'AUTO';
	payment_requirement: 'BEFORE_PREPARATION' | 'AT_PICKUP';
	ready_notification: boolean;
	auto_complete: boolean;
};

/**
 * The configuration controls a type surfaces during onboarding.
 *
 * Step 6 of the wizard shows only these, which is what keeps it short: a cafe
 * operator is never asked about a grocery's pick-up window, and nobody is asked
 * to confirm a setting their type has no opinion about.
 */
export type ConfigControl =
	| 'ordering'
	| 'customer_login'
	| 'prep_time'
	| 'acceptance'
	| 'payment_timing'
	| 'payment_methods'
	| 'ready_notification'
	| 'auto_complete';

export type BusinessTypeTemplate = {
	code: string;
	label: string;
	/** One line under the card title. Written for a Super Admin, not marketing. */
	tagline: string;
	/** The sentence that decides the choice, as shown on the selection card. */
	description: string;
	icon: Component;
	/** Console brand preset applied to the tenant's own portal. */
	brand: { preset_id: string; color_mode: 'light' | 'dark' | 'system' };
	terminology: Terminology;
	storefront: StorefrontDefaults;
	behaviour: BehaviourDefaults;
	payments: PaymentDefaults;
	workflow: WorkflowDefaults;
	/** Suggested starter groups, shown as guidance. The tenant creates them. */
	starterCategories: string[];
	/** Which controls step 6 renders for this type. */
	controls: ConfigControl[];
	/** The console modules this type enables. */
	modules: ModuleKey[];
	/**
	 * What this type's owner most often needs to do, for the dashboard.
	 * Ordered: the first is the one they open the console for.
	 */
	quickActions: { label: string; href: string }[];
};

/* ------------------------------------------------------------------ *
 * Building blocks
 * ------------------------------------------------------------------ */

const FOOD_TERMS: Terminology = {
	item: 'Product',
	items: 'Products',
	group: 'Category',
	groups: 'Categories',
	catalog: 'Menu',
	order: 'Order',
	orders: 'Orders',
	fulfilment: 'Pickup',
	station: 'Kitchen',
	prep: 'Cooking',
	ticket: 'Ticket',
	handover: 'collected',
	staff: 'Staff'
};

const CAFE_TERMS: Terminology = {
	...FOOD_TERMS,
	// The person making the drinks stands behind a bar, not in a kitchen.
	station: 'Bar',
	prep: 'Pouring',
	staff: 'Baristas'
};

const RESTAURANT_TERMS: Terminology = {
	...FOOD_TERMS,
	// A restaurant menu is organised by course, and that is the word the
	// people writing it already use.
	group: 'Course',
	groups: 'Courses',
	staff: 'Team'
};

const RETAIL_TERMS: Terminology = {
	item: 'Product',
	items: 'Products',
	group: 'Aisle',
	groups: 'Aisles',
	catalog: 'Catalogue',
	order: 'Order',
	orders: 'Orders',
	fulfilment: 'Collection',
	// Nothing is cooked here: an order is picked off shelves and packed.
	station: 'Packing',
	prep: 'Packing',
	ticket: 'Picklist',
	handover: 'collected',
	staff: 'Staff'
};

const HOSPITALITY_TERMS: Terminology = {
	item: 'Service',
	items: 'Services',
	group: 'Department',
	groups: 'Departments',
	catalog: 'Service list',
	order: 'Request',
	orders: 'Requests',
	fulfilment: 'Delivery to room',
	station: 'Service desk',
	prep: 'In progress',
	ticket: 'Request',
	handover: 'delivered',
	staff: 'Team'
};

/** The controls almost every type wants. Kept as one list, not repeated. */
const COMMON_CONTROLS: ConfigControl[] = [
	'ordering',
	'customer_login',
	'prep_time',
	'acceptance',
	'payment_methods',
	'payment_timing',
	'ready_notification'
];

/* ------------------------------------------------------------------ *
 * The catalogue
 * ------------------------------------------------------------------ */

export const BUSINESS_TYPE_TEMPLATES: Record<string, BusinessTypeTemplate> = {
	FOOD_SHOP: {
		code: 'FOOD_SHOP',
		label: 'Food shop',
		tagline: 'Counter service, high volume, short queue',
		description:
			'Quick-service and local food businesses such as momo shops, snack counters, roll carts and roadside kitchens. Orders are taken fast, prepared to order and collected at the counter.',
		icon: Soup,
		brand: { preset_id: 'orange', color_mode: 'system' },
		terminology: FOOD_TERMS,
		storefront: {
			theme_preset: 'street-food',
			product_layout: 'grid',
			hero_style: 'image',
			font_family: 'poppins',
			radius: 'lg',
			card_style: 'elevated',
			button_style: 'pill'
		},
		behaviour: { ordering_enabled: true, customer_login_mode: 'optional', prep_time_minutes: 15 },
		payments: {
			online_payment_enabled: true,
			cash_enabled: true,
			pay_at_pickup_enabled: true,
			default_payment_method: 'CASH'
		},
		workflow: {
			acceptance_mode: 'MANUAL',
			payment_requirement: 'AT_PICKUP',
			ready_notification: true,
			auto_complete: false
		},
		starterCategories: ['Steamed', 'Fried', 'Combos', 'Drinks'],
		modules: ['station', 'live_display', 'addons'],
		quickActions: [
			{ label: 'Take an order', href: '/shop/orders' },
			{ label: 'Open the kitchen board', href: '/shop/kitchen' },
			{ label: 'Edit the menu', href: '/shop/menu' }
		],
		controls: COMMON_CONTROLS
	},

	GROCERY: {
		code: 'GROCERY',
		label: 'Grocery',
		tagline: 'A stocked catalogue, collected in store',
		description:
			'Neighbourhood grocers and provision stores. A long catalogue browsed by aisle rather than a short menu, packed against a list and collected when it is ready.',
		icon: ShoppingBasket,
		brand: { preset_id: 'emerald', color_mode: 'system' },
		terminology: RETAIL_TERMS,
		storefront: {
			theme_preset: 'fresh',
			product_layout: 'list',
			hero_style: 'compact',
			font_family: 'inter',
			radius: 'sm',
			card_style: 'outlined',
			button_style: 'rounded'
		},
		behaviour: { ordering_enabled: true, customer_login_mode: 'required', prep_time_minutes: 45 },
		payments: {
			online_payment_enabled: true,
			cash_enabled: true,
			pay_at_pickup_enabled: true,
			default_payment_method: 'ONLINE'
		},
		workflow: {
			acceptance_mode: 'MANUAL',
			payment_requirement: 'AT_PICKUP',
			ready_notification: true,
			auto_complete: false
		},
		starterCategories: ['Fruit & vegetables', 'Dairy', 'Staples & grains', 'Household'],
		// No pickup display: a grocery order is packed and collected, not
		// called out to a room of people waiting.
		modules: ['station', 'variants', 'catalog_search', 'stock'],
		quickActions: [
			{ label: 'Orders to pack', href: '/shop/kitchen' },
			{ label: 'Update the catalogue', href: '/shop/menu' },
			{ label: 'Review what is out of stock', href: '/shop/menu?availability=unavailable' }
		],
		controls: COMMON_CONTROLS
	},

	CAFE: {
		code: 'CAFE',
		label: 'Cafe',
		tagline: 'Short menu, fast turnaround, regulars',
		description:
			'Coffee shops, tea rooms and bakeries. A short menu that changes often, most orders ready in minutes, and customers who come back often enough to be worth recognising.',
		icon: Coffee,
		brand: { preset_id: 'indigo-violet', color_mode: 'system' },
		terminology: CAFE_TERMS,
		storefront: {
			theme_preset: 'minimal',
			product_layout: 'compact',
			hero_style: 'gradient',
			font_family: 'sora',
			radius: 'md',
			card_style: 'minimal',
			button_style: 'soft'
		},
		behaviour: { ordering_enabled: true, customer_login_mode: 'optional', prep_time_minutes: 10 },
		payments: {
			online_payment_enabled: true,
			cash_enabled: true,
			pay_at_pickup_enabled: true,
			default_payment_method: 'ONLINE'
		},
		workflow: {
			acceptance_mode: 'AUTO',
			payment_requirement: 'BEFORE_PREPARATION',
			ready_notification: true,
			auto_complete: true
		},
		starterCategories: ['Coffee', 'Tea', 'Bakery', 'Cold drinks'],
		modules: ['station', 'live_display', 'variants', 'addons'],
		quickActions: [
			{ label: 'Open the bar board', href: '/shop/kitchen' },
			{ label: 'Take an order', href: '/shop/orders' },
			{ label: 'Edit sizes and add-ons', href: '/shop/menu' }
		],
		controls: COMMON_CONTROLS
	},

	RESTAURANT: {
		code: 'RESTAURANT',
		label: 'Restaurant',
		tagline: 'Full menu, courses, longer tickets',
		description:
			'Sit-down and takeaway restaurants with a full menu across courses. Tickets take longer, the kitchen paces them, and the menu is browsed before it is ordered from.',
		icon: UtensilsCrossed,
		brand: { preset_id: 'rose', color_mode: 'system' },
		terminology: RESTAURANT_TERMS,
		storefront: {
			theme_preset: 'classic',
			product_layout: 'list',
			hero_style: 'image',
			font_family: 'sora',
			radius: 'md',
			card_style: 'elevated',
			button_style: 'rounded'
		},
		behaviour: { ordering_enabled: true, customer_login_mode: 'optional', prep_time_minutes: 30 },
		payments: {
			online_payment_enabled: true,
			cash_enabled: true,
			pay_at_pickup_enabled: true,
			default_payment_method: 'ONLINE'
		},
		workflow: {
			acceptance_mode: 'MANUAL',
			payment_requirement: 'BEFORE_PREPARATION',
			ready_notification: true,
			auto_complete: false
		},
		starterCategories: ['Starters', 'Mains', 'Sides', 'Desserts', 'Drinks'],
		modules: ['station', 'live_display', 'variants', 'addons'],
		quickActions: [
			{ label: 'Open the kitchen board', href: '/shop/kitchen' },
			{ label: 'Take an order', href: '/shop/orders' },
			{ label: 'Edit the menu', href: '/shop/menu' }
		],
		controls: COMMON_CONTROLS
	},

	HOTEL: {
		code: 'HOTEL',
		label: 'Hotel',
		tagline: 'In-house guests, charged to the stay',
		description:
			'Hotel food and beverage service for in-house guests: room service, restaurant and bar. Guests are known, requests are attached to a stay, and settlement usually happens at checkout.',
		icon: Hotel,
		brand: { preset_id: 'cyan', color_mode: 'system' },
		terminology: HOSPITALITY_TERMS,
		storefront: {
			theme_preset: 'classic',
			product_layout: 'list',
			hero_style: 'image',
			font_family: 'sora',
			radius: 'sm',
			card_style: 'outlined',
			button_style: 'square'
		},
		// A guest is identified before they can charge anything to a room, so
		// login is required rather than optional.
		behaviour: { ordering_enabled: true, customer_login_mode: 'required', prep_time_minutes: 35 },
		payments: {
			online_payment_enabled: true,
			cash_enabled: true,
			pay_at_pickup_enabled: true,
			default_payment_method: 'ONLINE'
		},
		workflow: {
			acceptance_mode: 'MANUAL',
			payment_requirement: 'AT_PICKUP',
			ready_notification: true,
			auto_complete: false
		},
		starterCategories: ['Room service', 'Restaurant', 'Bar', 'Breakfast'],
		// No pickup display: nobody waits at a counter for room service, so a
		// screen of ticket numbers would have no audience.
		modules: ['station', 'addons', 'room_charge'],
		quickActions: [
			{ label: 'Open requests', href: '/shop/orders' },
			{ label: 'Service desk board', href: '/shop/kitchen' },
			{ label: 'Edit the service list', href: '/shop/menu' }
		],
		controls: COMMON_CONTROLS
	}
};

/**
 * The fallback for a type with no template — including "Other" and any type an
 * operator adds later. Neutral on every axis: it configures a working shop
 * without pretending to know the business.
 */
export const GENERIC_TEMPLATE: BusinessTypeTemplate = {
	code: 'OTHER',
	label: 'Other',
	tagline: 'A working default for anything else',
	description:
		'Any business that does not fit the shapes above. Starts with a neutral theme, a plain catalogue and manual order acceptance — the tenant admin tunes it from there.',
	icon: Building2,
	brand: { preset_id: 'indigo-violet', color_mode: 'system' },
	terminology: FOOD_TERMS,
	storefront: {
		theme_preset: 'modern',
		product_layout: 'grid',
		hero_style: 'compact',
		font_family: 'inter',
		radius: 'md',
		card_style: 'elevated',
		button_style: 'rounded'
	},
	behaviour: { ordering_enabled: true, customer_login_mode: 'optional', prep_time_minutes: 20 },
	payments: {
		online_payment_enabled: true,
		cash_enabled: true,
		pay_at_pickup_enabled: true,
		default_payment_method: 'ONLINE'
	},
	workflow: {
		acceptance_mode: 'MANUAL',
		payment_requirement: 'BEFORE_PREPARATION',
		ready_notification: true,
		auto_complete: false
	},
	starterCategories: [],
	controls: COMMON_CONTROLS,
	modules: ['station', 'live_display', 'addons'],
	quickActions: [
		{ label: 'Take an order', href: '/shop/orders' },
		{ label: 'Open the preparation board', href: '/shop/kitchen' },
		{ label: 'Edit the catalogue', href: '/shop/menu' }
	]
};

/**
 * Cuisine codes from the first catalogue. They describe what a shop sells, not
 * how it runs, so they all resolve to the food-shop shape. Tenants created
 * under them keep working and keep their own label.
 */
const LEGACY_ALIASES: Record<string, string> = {
	MOMO: 'FOOD_SHOP',
	MANCHURIAN: 'FOOD_SHOP',
	FAST_FOOD: 'FOOD_SHOP',
	ROLLS: 'FOOD_SHOP',
	TEA: 'CAFE'
};

/* ------------------------------------------------------------------ *
 * Lookups
 * ------------------------------------------------------------------ */

/** Normalise whatever the API or a form hands us into a catalogue code. */
export function normalizeTypeCode(code?: string | null): string {
	return (code ?? '').trim().toUpperCase().replace(/[\s-]+/g, '_');
}

/**
 * The template for a code. Never throws and never returns undefined: an
 * unknown code resolves to the generic template carrying that code, so a
 * screen rendering a type it has never heard of still renders.
 */
export function templateFor(code?: string | null): BusinessTypeTemplate {
	const normalized = normalizeTypeCode(code);
	const direct = BUSINESS_TYPE_TEMPLATES[normalized];
	if (direct) return direct;

	const alias = LEGACY_ALIASES[normalized];
	if (alias && BUSINESS_TYPE_TEMPLATES[alias]) {
		return { ...BUSINESS_TYPE_TEMPLATES[alias], code: normalized, label: humanise(normalized) };
	}

	if (!normalized) return GENERIC_TEMPLATE;
	return { ...GENERIC_TEMPLATE, code: normalized, label: humanise(normalized) };
}

/** Does this type enable a module? The one call site for every such check. */
export function hasModule(code: string | null | undefined, module: ModuleKey): boolean {
	return templateFor(code).modules.includes(module);
}

/** The words this type uses. The one call site for every label in the UI. */
export function termsFor(code?: string | null): Terminology {
	return templateFor(code).terminology;
}

/**
 * The shortcuts this kind of business opens its day with.
 *
 * A cafe reaches for the counter, a grocer for stock, a hotel for room
 * requests. Returning the type's own list keeps the dashboard from offering
 * every business the same three buttons.
 */
export function quickActionsFor(code?: string | null): { label: string; href: string }[] {
	return templateFor(code).quickActions;
}

/**
 * Display label for a type code, preferring the operator's own catalogue.
 *
 * The database is the authority on what a type is called — an operator can
 * rename "Food shop" to "Street food" under Settings — so the catalogue wins
 * when it has the row, and the template is the fallback.
 */
export function labelForType(code?: string | null, catalog: TenantType[] = []): string {
	const normalized = normalizeTypeCode(code);
	if (!normalized) return '—';
	const hit = catalog.find((t) => t.code === normalized);
	if (hit?.label) return hit.label;
	return templateFor(normalized).label;
}

/**
 * The types offered during onboarding: the operator's active catalogue, each
 * paired with its template, in the catalogue's own order.
 *
 * Driving this from the server list rather than from the local table is what
 * makes a new type a data change instead of a release — a row added under
 * Settings shows up here on the next load, with the generic template until
 * someone writes a better one.
 */
export function onboardingTypes(catalog: TenantType[]): BusinessTypeTemplate[] {
	const active = catalog
		.filter((t) => t.active)
		.slice()
		.sort((a, b) => a.sort_order - b.sort_order || a.label.localeCompare(b.label));

	if (active.length === 0) {
		// A catalogue that failed to load must not leave the wizard with no
		// choices at all; fall back to the built-in shapes.
		return Object.values(BUSINESS_TYPE_TEMPLATES);
	}

	return active.map((row) => ({ ...templateFor(row.code), code: row.code, label: row.label }));
}

/** The API payload for a template's configuration, ready to send unmodified. */
export function configurationPayload(template: BusinessTypeTemplate, overrides?: Partial<BehaviourDefaults>) {
	const behaviour = { ...template.behaviour, ...overrides };
	return {
		...template.storefront,
		ordering_enabled: behaviour.ordering_enabled,
		customer_login_mode: behaviour.customer_login_mode,
		prep_time_minutes: behaviour.prep_time_minutes,
		payments: template.payments,
		workflow: template.workflow
	};
}

/** Human labels for the enum values the configuration step shows. */
export const CONTROL_LABELS = {
	customer_login_mode: {
		off: 'No customer accounts',
		optional: 'Optional — guests can also order',
		required: 'Required before ordering'
	},
	acceptance_mode: {
		MANUAL: 'Staff accept each order',
		AUTO: 'Accept automatically'
	},
	payment_requirement: {
		BEFORE_PREPARATION: 'Pay before preparation starts',
		AT_PICKUP: 'Pay at pickup'
	},
	default_payment_method: {
		ONLINE: 'Online',
		CASH: 'Cash'
	}
} as const;

function humanise(code: string): string {
	return code
		.split('_')
		.filter(Boolean)
		.map((part, i) => (i === 0 ? part.charAt(0) + part.slice(1).toLowerCase() : part.toLowerCase()))
		.join(' ');
}
