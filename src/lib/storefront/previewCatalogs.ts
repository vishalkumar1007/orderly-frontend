import type { StoreCategory, StoreProduct } from './api';

export type BusinessSampleCatalog = {
	type: string;
	label: string;
	icon: string;
	tagline: string;
	description: string;
	categories: StoreCategory[];
	products: StoreProduct[];
};

export const PREVIEW_CATALOGS: Record<string, BusinessSampleCatalog> = {
	RESTAURANT: {
		type: 'RESTAURANT',
		label: 'Restaurant',
		icon: 'Utensils',
		tagline: 'Authentic Himalayan Street Food & Flavors',
		description: 'Handcrafted momos, slow-simmered broths, and fresh wok specialties prepared daily.',
		categories: [
			{ id: 'cat-res-1', name: 'Steamed Momos', description: 'Freshly steamed handcrafted dumplings', sort_order: 1, products: [] },
			{ id: 'cat-res-2', name: 'Pan-Fried & Crispy', description: 'Golden wok-crisped favorites', sort_order: 2, products: [] },
			{ id: 'cat-res-3', name: 'Wok Noodles & Bowls', description: 'Tossed noodles and fragrant rice bowls', sort_order: 3, products: [] },
			{ id: 'cat-res-4', name: 'Refreshing Drinks', description: 'Chilled iced teas and homemade sodas', sort_order: 4, products: [] }
		],
		products: [
			{
				id: 'prod-res-1',
				category_id: 'cat-res-1',
				name: 'Classic Veg Himalayan Momo',
				description: 'Finely minced garden greens, paneer and Himalayan herbs with house spicy sesame dip.',
				price: 140,
				is_available: true,
				is_vegetarian: true,
				is_popular: true,
				is_featured: false,
				allow_special_instructions: true,
				addons: [],
				sort_order: 1,
				image_url: 'https://images.unsplash.com/photo-1625246333195-78d9c38ad449?auto=format&fit=crop&w=600&q=80'
			},
			{
				id: 'prod-res-2',
				category_id: 'cat-res-1',
				name: 'Juicy Chicken Kothey Momo',
				description: 'Pan-seared on one side with tender minced chicken, scallions, and ginger coriander sauce.',
				price: 180,
				is_available: true,
				is_vegetarian: false,
				is_popular: true,
				is_featured: true,
				allow_special_instructions: true,
				addons: [],
				sort_order: 2,
				image_url: 'https://images.unsplash.com/photo-1541696432-82c6da8ce7bf?auto=format&fit=crop&w=600&q=80'
			},
			{
				id: 'prod-res-3',
				category_id: 'cat-res-2',
				name: 'Crispy Chili Garlic Momo',
				description: 'Crispy fried momos tossed in fiery roasted chili garlic oil with charred peppers.',
				price: 195,
				is_available: true,
				is_vegetarian: true,
				is_popular: false,
				is_featured: true,
				allow_special_instructions: true,
				addons: [],
				sort_order: 3,
				image_url: 'https://images.unsplash.com/photo-1563245372-f21724e3856d?auto=format&fit=crop&w=600&q=80'
			},
			{
				id: 'prod-res-4',
				category_id: 'cat-res-3',
				name: 'Hakka Chili Garlic Noodles',
				description: 'Wok-tossed long wheat noodles with crisp julienned vegetables and spicy garlic reduction.',
				price: 160,
				is_available: true,
				is_vegetarian: true,
				is_popular: false,
				is_featured: false,
				allow_special_instructions: true,
				addons: [],
				sort_order: 4,
				image_url: 'https://images.unsplash.com/photo-1585032226651-759b368d7246?auto=format&fit=crop&w=600&q=80'
			}
		]
	},

	BAKERY: {
		type: 'BAKERY',
		label: 'Bakery & Patisserie',
		icon: 'Croissant',
		tagline: 'Artisan Sourdough, Flaky Viennoiserie & Cakes',
		description: 'Naturally leavened sourdough bread and French-style viennoiserie baked fresh every sunrise.',
		categories: [
			{ id: 'cat-bak-1', name: 'Fresh Breads', description: 'Country sourdough and baguettes', sort_order: 1, products: [] },
			{ id: 'cat-bak-2', name: 'Pastries & Viennoiserie', description: 'Butter laminated croissants and buns', sort_order: 2, products: [] },
			{ id: 'cat-bak-3', name: 'Artisan Cakes', description: 'Celebration cakes and single tarts', sort_order: 3, products: [] },
			{ id: 'cat-bak-4', name: 'Coffee & Brews', description: 'Espresso and batch brew pairings', sort_order: 4, products: [] }
		],
		products: [
			{
				id: 'prod-bak-1',
				category_id: 'cat-bak-1',
				name: 'Wild Yeast Country Sourdough',
				description: '36-hour cold fermented sourdough loaf with a blistered crunchy crust and open, airy crumb.',
				price: 240,
				is_available: true,
				is_vegetarian: true,
				is_popular: true,
				is_featured: true,
				allow_special_instructions: true,
				addons: [],
				sort_order: 1,
				image_url: 'https://images.unsplash.com/photo-1589367920969-ab8e050bbb04?auto=format&fit=crop&w=600&q=80'
			},
			{
				id: 'prod-bak-2',
				category_id: 'cat-bak-2',
				name: 'Classic French Butter Croissant',
				description: '81 delicate layers of premium cultured butter. Golden crisp exterior with honeycomb interior.',
				price: 150,
				is_available: true,
				is_vegetarian: true,
				is_popular: true,
				is_featured: false,
				allow_special_instructions: true,
				addons: [],
				sort_order: 2,
				image_url: 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?auto=format&fit=crop&w=600&q=80'
			},
			{
				id: 'prod-bak-3',
				category_id: 'cat-bak-2',
				name: 'Pain au Chocolat Valrhona',
				description: 'Rich dark 64% Valrhona chocolate batons rolled inside buttery, flaky French pastry.',
				price: 180,
				is_available: true,
				is_vegetarian: true,
				is_popular: false,
				is_featured: true,
				allow_special_instructions: true,
				addons: [],
				sort_order: 3,
				image_url: 'https://images.unsplash.com/photo-1608198093002-ad4e005484ec?auto=format&fit=crop&w=600&q=80'
			},
			{
				id: 'prod-bak-4',
				category_id: 'cat-bak-3',
				name: 'Cardamom Cinnamon Swirl Bun',
				description: 'Pillow-soft brioche dough swirled with aromatic Ceylon cinnamon and topped with pearl sugar.',
				price: 160,
				is_available: true,
				is_vegetarian: true,
				is_popular: false,
				is_featured: false,
				allow_special_instructions: true,
				addons: [],
				sort_order: 4,
				image_url: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=600&q=80'
			}
		]
	},

	CAFE: {
		type: 'CAFE',
		label: 'Specialty Cafe',
		icon: 'Coffee',
		tagline: 'Specialty Roasts, All-Day Brunch & Matchas',
		description: 'Single-origin espresso, oat milk lattes, and nourishing brunch favorites.',
		categories: [
			{ id: 'cat-caf-1', name: 'Espresso & Coffee', description: 'Single origin pour-overs and espresso', sort_order: 1, products: [] },
			{ id: 'cat-caf-2', name: 'Matcha & Tea', description: 'Ceremonial grade Japanese matchas', sort_order: 2, products: [] },
			{ id: 'cat-caf-3', name: 'All-Day Brunch', description: 'Avocado toasts and granola bowls', sort_order: 3, products: [] }
		],
		products: [
			{
				id: 'prod-caf-1',
				category_id: 'cat-caf-1',
				name: 'Iced Spanish Oat Latte',
				description: 'Double espresso pulled over condensed milk and creamy oat milk, dusted with organic cinnamon.',
				price: 210,
				is_available: true,
				is_vegetarian: true,
				is_popular: true,
				is_featured: true,
				allow_special_instructions: true,
				addons: [],
				sort_order: 1,
				image_url: 'https://images.unsplash.com/photo-1517256064527-09c73fc73e38?auto=format&fit=crop&w=600&q=80'
			},
			{
				id: 'prod-caf-2',
				category_id: 'cat-caf-2',
				name: 'Ceremonial Uji Matcha Latte',
				description: 'First harvest stone-ground green tea whisked with silky steamed milk and vanilla bean.',
				price: 230,
				is_available: true,
				is_vegetarian: true,
				is_popular: true,
				is_featured: false,
				allow_special_instructions: true,
				addons: [],
				sort_order: 2,
				image_url: 'https://images.unsplash.com/photo-1536256263959-770b48d82b0a?auto=format&fit=crop&w=600&q=80'
			},
			{
				id: 'prod-caf-3',
				category_id: 'cat-caf-3',
				name: 'Hass Avocado Tartine',
				description: 'Toasted country sourdough with smashed avocado, cherry tomatoes, radish ribbons and zaatar.',
				price: 260,
				is_available: true,
				is_vegetarian: true,
				is_popular: false,
				is_featured: true,
				allow_special_instructions: true,
				addons: [],
				sort_order: 3,
				image_url: 'https://images.unsplash.com/photo-1525351484163-7529414344d8?auto=format&fit=crop&w=600&q=80'
			}
		]
	},

	RETAIL: {
		type: 'RETAIL',
		label: 'Retail & Boutique',
		icon: 'ShoppingBag',
		tagline: 'Consciously Made Apparel & Everyday Essentials',
		description: 'Sustainable goods, organic cotton clothing, and handcrafted lifestyle essentials.',
		categories: [
			{ id: 'cat-ret-1', name: 'Apparel', description: 'Relaxed linen and organic cotton pieces', sort_order: 1, products: [] },
			{ id: 'cat-ret-2', name: 'Bags & Accessories', description: 'Heavyweight canvas totes and wallets', sort_order: 2, products: [] },
			{ id: 'cat-ret-3', name: 'Home & Ceramics', description: 'Hand-thrown stoneware ceramics', sort_order: 3, products: [] }
		],
		products: [
			{
				id: 'prod-ret-1',
				category_id: 'cat-ret-1',
				name: 'Relaxed Organic Linen Shirt',
				description: 'Lightweight breathable European flax linen shirt in natural oat tone with shell buttons.',
				price: 1850,
				is_available: true,
				is_vegetarian: false,
				is_popular: true,
				is_featured: true,
				allow_special_instructions: false,
				addons: [],
				sort_order: 1,
				image_url: 'https://images.unsplash.com/photo-1598033129183-c4f50c736f10?auto=format&fit=crop&w=600&q=80'
			},
			{
				id: 'prod-ret-2',
				category_id: 'cat-ret-2',
				name: 'Heavyweight Canvas Market Tote',
				description: '16oz organic cotton duck canvas with reinforced handles and interior key pocket.',
				price: 790,
				is_available: true,
				is_vegetarian: false,
				is_popular: true,
				is_featured: false,
				allow_special_instructions: false,
				addons: [],
				sort_order: 2,
				image_url: 'https://images.unsplash.com/photo-1544816155-12df9643f363?auto=format&fit=crop&w=600&q=80'
			},
			{
				id: 'prod-ret-3',
				category_id: 'cat-ret-3',
				name: 'Hand-Thrown Speckled Ceramic Mug',
				description: 'Wheel-thrown stoneware with satin matte glaze and ergonomic comfortable handle. 350ml.',
				price: 650,
				is_available: true,
				is_vegetarian: false,
				is_popular: false,
				is_featured: true,
				allow_special_instructions: false,
				addons: [],
				sort_order: 3,
				image_url: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=600&q=80'
			}
		]
	},

	SERVICE: {
		type: 'SERVICE',
		label: 'Studio & Services',
		icon: 'Sparkles',
		tagline: 'Bespoke Hair Styling, Skin Care & Wellness',
		description: 'Expert personalized wellness and grooming sessions by appointment or walk-in.',
		categories: [
			{ id: 'cat-ser-1', name: 'Hair & Styling', description: 'Custom cuts, styling and treatments', sort_order: 1, products: [] },
			{ id: 'cat-ser-2', name: 'Skin & Facials', description: 'Restorative botanical skincare sessions', sort_order: 2, products: [] },
			{ id: 'cat-ser-3', name: 'Massage & Body', description: 'Tension release and aromatherapy', sort_order: 3, products: [] }
		],
		products: [
			{
				id: 'prod-ser-1',
				category_id: 'cat-ser-1',
				name: 'Signature Cut & Botanical Scalp Ritual',
				description: 'Consultation, scalp detox massage with essential oils, precision dry cut, and blowout.',
				price: 1200,
				is_available: true,
				is_vegetarian: false,
				is_popular: true,
				is_featured: true,
				allow_special_instructions: true,
				addons: [],
				sort_order: 1,
				image_url: 'https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=600&q=80'
			},
			{
				id: 'prod-ser-2',
				category_id: 'cat-ser-2',
				name: 'Restorative Hydra-Glow Facial (60 mins)',
				description: 'Deep pore cleansing, enzyme exfoliation, lymphatic drainage and peptide infusion mask.',
				price: 2400,
				is_available: true,
				is_vegetarian: false,
				is_popular: true,
				is_featured: false,
				allow_special_instructions: true,
				addons: [],
				sort_order: 2,
				image_url: 'https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?auto=format&fit=crop&w=600&q=80'
			},
			{
				id: 'prod-ser-3',
				category_id: 'cat-ser-3',
				name: 'Deep Tissue Muscle Release Therapy',
				description: 'Targeted pressure therapy focusing on chronic neck, back and shoulder tension areas.',
				price: 2800,
				is_available: true,
				is_vegetarian: false,
				is_popular: false,
				is_featured: true,
				allow_special_instructions: true,
				addons: [],
				sort_order: 3,
				image_url: 'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?auto=format&fit=crop&w=600&q=80'
			}
		]
	}
};
