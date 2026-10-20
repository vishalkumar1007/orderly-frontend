/**
 * What kind of storefront a business gets.
 *
 * The business type picks the shape (a food menu, a grocery aisle, a booking
 * page, a hotel), and the capabilities the business has switched on decide
 * which journeys actually work. This is the only place the storefront asks
 * "what type of business is this?": components read `family`, `variant`,
 * `features` and `words` instead of comparing type codes.
 */
import { templateFor, type ModuleKey } from '$lib/admin/businessTypes';

/** The customer journey: buy things, book time, or reserve a stay. */
export type Family = 'order' | 'book' | 'stay';

/** How the catalogue looks inside a family. */
export type Variant = 'food' | 'grocery' | 'fashion' | 'electronics' | 'general' | 'service' | 'stay';

export type Experience = {
	code: string;
	family: Family;
	variant: Variant;
	features: {
		/** Customers can put things in a bag and check out. */
		cart: boolean;
		/** The catalogue search box in the header. */
		search: boolean;
		/** Vegetarian marks and the veg-only switch. */
		dietMarks: boolean;
		/** Quantity steppers on every card, for list shopping. */
		steppers: boolean;
		/** Ask for the vehicle when booking. */
		vehicle: boolean;
		/** The business also runs a walk-in queue. */
		queue: boolean;
		/** Customers can sign in. Booking always needs it. */
		signIn: boolean;
		/** Customers must sign in before they order or book. */
		signInRequired: boolean;
		/** How customers can sign in: only methods the shop has set up. */
		signInMethods: ('PHONE' | 'EMAIL')[];
	};
	words: {
		/** The catalogue: Menu, Catalogue, Shop, Services, Rooms. */
		catalog: string;
		/** The customer's history: Orders, Appointments, Reservations. */
		history: string;
		/** How paying in person is described. */
		payAtVenue: string;
		/** How the customer gets what they bought. */
		fulfilment: string;
		/** The badge on a dish or product the owner recommends. */
		pick: string;
		/** The notice shown while the business is busy. */
		busy: string;
		/** Added to the business name in the browser tab. */
		title: string;
		/** Who serves the customer: Barbers, Stylists, Technicians. */
		staff: string;
		/** The label on the checkout note: who reads it. */
		note: string;
		/** How a cash payment is described at checkout. */
		cash: string;
		/** The search box hint. */
		search: string;
		/** Default titles for the Popular and Featured rails. */
		popular: string;
		featured: string;
	};
};

const VARIANTS: Record<string, Variant> = {
	FOOD_SHOP: 'food',
	CAFE: 'food',
	RESTAURANT: 'food',
	GROCERY: 'grocery',
	FASHION: 'fashion',
	ELECTRONICS: 'electronics',
	BARBER: 'service',
	SALON: 'service',
	AUTOMOTIVE: 'service',
	HOTEL: 'stay'
};

/** The family each variant would choose when its capabilities allow it. */
const PREFERRED: Record<Variant, Family> = {
	food: 'order',
	grocery: 'order',
	fashion: 'order',
	electronics: 'order',
	general: 'order',
	service: 'book',
	stay: 'stay'
};

/** What a family cannot work without. */
const NEEDS: Record<Family, string[]> = {
	order: ['CATALOG', 'ORDERS'],
	book: ['APPOINTMENTS'],
	stay: ['ROOMS']
};

/** Console modules that imply a capability, for a backend that sends none. */
const MODULE_CAPS: Partial<Record<ModuleKey, string[]>> = {
	catalog: ['CATALOG', 'CART', 'ORDERS'],
	services: ['SERVICES'],
	appointments: ['APPOINTMENTS'],
	queue: ['QUEUE'],
	rooms: ['ROOMS'],
	reservations: ['RESERVATIONS']
};

const PAY_AT: Record<string, string> = {
	BARBER: 'Pay at the shop',
	SALON: 'Pay at the salon',
	AUTOMOTIVE: 'Pay at the garage',
	HOTEL: 'Pay at the hotel'
};

const BUSY: Record<Variant, string> = {
	food: 'The kitchen is busy right now, so orders take a little longer.',
	grocery: 'We are busy right now, so orders take a little longer to pack.',
	fashion: 'We are busy right now, so orders take a little longer to pack.',
	electronics: 'We are busy right now, so orders take a little longer to pack.',
	general: 'We are busy right now, so things take a little longer.',
	service: 'We are busy right now, so expect a short wait.',
	stay: 'The front desk is busy right now and will reply shortly.'
};

const TITLE: Record<Family, string> = {
	order: 'Order online',
	book: 'Book online',
	stay: 'Book your stay'
};

type ConfigLike = {
	store?: { business_type?: string | null } | null;
	capabilities?: string[] | null;
	ordering?: {
		customer_login_mode?: string;
		customer_login?: boolean;
		customer_login_methods?: ('PHONE' | 'EMAIL')[];
	} | null;
} | null;

/** The order sign-in setting, read the way older configs stored it too. */
function loginMode(config: ConfigLike): string {
	const o = config?.ordering;
	return o?.customer_login_mode ?? (o?.customer_login ? 'optional' : 'off');
}

export function experienceFor(config: ConfigLike): Experience {
	const template = templateFor(config?.store?.business_type);
	const code = template.code;
	// Legacy codes (MOMO, TEA) resolve to their template's terms; their
	// variant comes from the shape they alias, read off its modules.
	const variant: Variant =
		VARIANTS[code] ?? (template.modules.includes('diet_tags') ? 'food' : 'general');

	const caps = new Set(
		config?.capabilities ?? template.modules.flatMap((m) => MODULE_CAPS[m] ?? [])
	);
	const can = (f: Family) => NEEDS[f].some((c) => caps.has(c));
	const preferred = PREFERRED[variant];
	const family: Family = can(preferred)
		? preferred
		: ((['order', 'book', 'stay'] as Family[]).find(can) ?? preferred);

	const terms = template.terminology;
	const ordering = family === 'order';
	const methods = config?.ordering?.customer_login_methods ?? ['PHONE'];

	return {
		code,
		family,
		variant,
		features: {
			cart: ordering && (caps.has('CART') || caps.has('ORDERS')),
			search: ordering,
			dietMarks: ordering && template.modules.includes('diet_tags'),
			steppers: ordering && variant === 'grocery',
			vehicle: code === 'AUTOMOTIVE',
			queue: caps.has('QUEUE'),
			// Sign-in needs a way in: an older server sends no list and means phone.
			signIn: methods.length > 0 && (!ordering || loginMode(config) !== 'off'),
			signInRequired: methods.length > 0 && (!ordering || loginMode(config) === 'required'),
			signInMethods: methods
		},
		words: {
			catalog: family === 'book' ? 'Services' : family === 'stay' ? 'Rooms' : terms.catalog,
			history: family === 'book' ? 'Bookings' : family === 'stay' ? 'Reservations' : 'Orders',
			payAtVenue: PAY_AT[code] ?? `Pay at ${terms.fulfilment.toLowerCase()}`,
			fulfilment: terms.fulfilment,
			pick: variant === 'food' ? "Chef's pick" : variant === 'fashion' ? 'New in' : 'Featured',
			busy: BUSY[variant],
			title: TITLE[family],
			staff: terms.staff,
			note: variant === 'food' ? `Note for the ${terms.station.toLowerCase()}` : 'Note for the shop',
			cash: `Cash at ${terms.fulfilment.toLowerCase()}`,
			search: variant === 'food' ? 'Search dishes and drinks' : 'Search products',
			popular: variant === 'food' ? 'Popular right now' : 'Popular',
			featured: variant === 'food' ? "Chef's picks" : variant === 'fashion' ? 'New in' : 'Featured'
		}
	};
}

/** The card a catalogue item uses. */
export type CardShape = 'list' | 'grid' | 'compact' | 'tile' | 'spec';

/**
 * Food and general shops keep the layout the owner picked in Studio. Retail
 * types have one shape that suits how people shop them: photo tiles for a
 * grocery basket or a clothes rail, a scannable spec row for electronics.
 */
export function cardShape(exp: Experience, themeLayout: 'list' | 'grid' | 'compact'): CardShape {
	if (exp.variant === 'grocery' || exp.variant === 'fashion') return 'tile';
	if (exp.variant === 'electronics') return 'spec';
	return themeLayout;
}

/** Up to three short detail lines from a description written one per line or split by semicolons. */
export function keyDetails(description: string): string[] {
	const parts = description
		.split(/\n|;/)
		.map((p) => p.trim())
		.filter(Boolean);
	return parts.length > 1 ? parts.slice(0, 3) : [];
}
