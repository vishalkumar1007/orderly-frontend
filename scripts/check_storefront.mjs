/**
 * Storefront experience checks.
 *
 * Which storefront a business gets (a menu, a booking page, a hotel) and the
 * words it uses come from one pure function, `experienceFor`, and the booking
 * pages lean on a few date helpers. A wrong mapping does not crash anything:
 * it quietly shows a salon a food menu. These run the real modules through
 * Vite's SSR loader so the mapping and the helpers are checked as shipped.
 *
 *   node scripts/check_storefront.mjs
 */
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const root = fileURLToPath(new URL('..', import.meta.url));
let failures = 0;
let checks = 0;

function eq(label, got, want) {
	checks++;
	const g = JSON.stringify(got);
	const w = JSON.stringify(want);
	if (g === w) {
		console.log(`  ok   ${label} = ${g}`);
		return;
	}
	failures++;
	console.log(`  FAIL ${label}\n         got  ${g}\n         want ${w}`);
}

const vite = await createServer({
	configFile: join(root, 'vite.config.ts'),
	server: { middlewareMode: true, hmr: false },
	appType: 'custom',
	logLevel: 'error'
});

try {
	const { experienceFor, cardShape, keyDetails } = await vite.ssrLoadModule('/src/lib/storefront/experience.ts');
	const booking = await vite.ssrLoadModule('/src/lib/storefront/booking.ts');
	const cfg = (type, capabilities) => ({ store: { business_type: type }, capabilities });

	console.log('\nEvery business type lands on the right storefront');
	const expect = {
		FOOD_SHOP: ['order', 'food'],
		CAFE: ['order', 'food'],
		RESTAURANT: ['order', 'food'],
		MOMO: ['order', 'food'],
		TEA: ['order', 'food'],
		GROCERY: ['order', 'grocery'],
		FASHION: ['order', 'fashion'],
		ELECTRONICS: ['order', 'electronics'],
		GENERAL: ['order', 'general'],
		OTHER: ['order', 'general'],
		BARBER: ['book', 'service'],
		SALON: ['book', 'service'],
		AUTOMOTIVE: ['book', 'service'],
		HOTEL: ['stay', 'stay']
	};
	for (const [code, want] of Object.entries(expect)) {
		const x = experienceFor(cfg(code));
		eq(`${code} without capabilities`, [x.family, x.variant], want);
	}

	console.log('\nCapabilities decide what actually works');
	eq('a general business with only appointments books', experienceFor(cfg('GENERAL', ['APPOINTMENTS'])).family, 'book');
	eq('a barber with appointments switched off falls back to its catalogue', experienceFor(cfg('BARBER', ['CATALOG', 'ORDERS'])).family, 'order');
	eq('a barber with nothing on keeps its own shape', experienceFor(cfg('BARBER', [])).family, 'book');
	eq('a food shop without a cart has no bag', experienceFor(cfg('FOOD_SHOP', ['CATALOG'])).features.cart, false);
	eq('a food shop shows veg marks', experienceFor(cfg('FOOD_SHOP')).features.dietMarks, true);
	eq('a fashion shop does not', experienceFor(cfg('FASHION')).features.dietMarks, false);
	eq('only a garage asks for the vehicle', ['AUTOMOTIVE', 'SALON'].map((c) => experienceFor(cfg(c)).features.vehicle), [true, false]);
	eq('a booking business always offers sign-in', experienceFor({ ...cfg('BARBER'), ordering: { customer_login_mode: 'off' } }).features.signIn, true);
	eq('a shop with sign-in off does not', experienceFor({ ...cfg('FOOD_SHOP'), ordering: { customer_login_mode: 'off' } }).features.signIn, false);
	eq('no config at all still renders', experienceFor(null).family, 'order');

	console.log('\nThe admin sign-in setting is what customers get');
	const login = (mode) => experienceFor({ ...cfg('FOOD_SHOP'), ordering: { customer_login_mode: mode } }).features;
	eq('Off: no sign-in anywhere', [login('off').signIn, login('off').signInRequired], [false, false]);
	eq('Optional: sign-in offered, guests welcome', [login('optional').signIn, login('optional').signInRequired], [true, false]);
	eq('Required: sign-in before ordering', [login('required').signIn, login('required').signInRequired], [true, true]);
	const offered = (list) => experienceFor({ ...cfg('FOOD_SHOP'), ordering: { customer_login_mode: 'optional', customer_login_methods: list } }).features;
	eq('only the methods the shop set up are offered', offered(['EMAIL']).signInMethods, ['EMAIL']);
	eq('no method set up means no sign-in', [offered([]).signIn, offered([]).signInRequired], [false, false]);
	eq('a booking shop with no method set up cannot ask for sign-in', experienceFor({ ...cfg('BARBER'), ordering: { customer_login_methods: [] } }).features.signIn, false);
	eq('an old config with only the on/off flag', experienceFor({ ...cfg('FOOD_SHOP'), ordering: { customer_login: true } }).features.signIn, true);

	console.log('\nCards and words');
	eq('food keeps the layout the owner chose', cardShape(experienceFor(cfg('CAFE')), 'grid'), 'grid');
	eq('grocery always uses tiles', cardShape(experienceFor(cfg('GROCERY')), 'list'), 'tile');
	eq('electronics uses the spec row', cardShape(experienceFor(cfg('ELECTRONICS')), 'grid'), 'spec');
	eq('key details split on lines and semicolons', keyDetails('6 GB RAM; 128 GB\n5000 mAh; extra'), ['6 GB RAM', '128 GB', '5000 mAh']);
	eq('a plain sentence has no key details', keyDetails('A good phone.'), []);
	eq('a salon is paid at the salon', experienceFor(cfg('SALON')).words.payAtVenue, 'Pay at the salon');
	eq('a grocer collects', experienceFor(cfg('GROCERY')).words.cash, 'Cash at collection');
	for (const code of Object.keys(expect)) {
		const words = Object.values(experienceFor(cfg(code)).words).join(' ');
		eq(`${code} copy has no dot separators, arrows or long dashes`, /[·→—]/.test(words), false);
	}

	console.log('\nDates are the business’s dates');
	// 23:30 UTC is already the next morning in India.
	const late = new Date('2026-10-20T23:30:00Z');
	eq('today in Kolkata after UTC midnight', booking.dateIn('Asia/Kolkata', late), '2026-10-21');
	eq('the strip starts on that day', booking.dateStrip('Asia/Kolkata', 3, late).map((d) => d.date), ['2026-10-21', '2026-10-22', '2026-10-23']);
	eq('the strip names today and tomorrow', booking.dateStrip('UTC', 2, late).map((d) => d.weekday), ['Today', 'Tomorrow']);
	eq('adding days crosses a month', booking.addDays('2026-10-31', 1), '2026-11-01');
	eq('two nights', booking.nights('2026-10-21', '2026-10-23'), 2);
	eq('a reversed range is no nights', booking.nights('2026-10-23', '2026-10-21'), 0);
	eq('past check-in is refused', booking.stayRangeError('2026-10-19', '2026-10-21', '2026-10-20', 30) !== '', true);
	eq('a valid stay passes', booking.stayRangeError('2026-10-20', '2026-10-21', '2026-10-20', 30), '');
	const at = (h) => ({ start: `2026-10-21T${String(h).padStart(2, '0')}:00:00Z` });
	eq(
		'times split into parts of the day',
		booking.groupSlots([at(11), at(12), at(16), at(17)], 'UTC').map((g) => [g.label, g.slots.length]),
		[['Morning', 1], ['Afternoon', 2], ['Evening', 1]]
	);
	eq('durations read naturally', [45, 60, 90].map(booking.duration), ['45 min', '1 hr', '1 hr 30 min']);
} finally {
	await vite.close();
}

console.log(`\n${failures === 0 ? `all ${checks} storefront checks passed` : `${failures} of ${checks} storefront checks FAILED`}`);
process.exit(failures === 0 ? 0 : 1);
