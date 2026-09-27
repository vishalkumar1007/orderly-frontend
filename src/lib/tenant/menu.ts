/**
 * Tenant admin menu types and API helpers.
 *
 * Tenant scope always comes from the host + JWT — never send tenant_id.
 */

import { api } from '$lib/api/client';

export type MenuOption = {
	id: string;
	name: string;
	price: number;
	max_qty?: number;
	is_active?: boolean;
	sort_order?: number;
};

export type OptionGroup = {
	id: string;
	name: string;
	/** single = radio; multiple = checkboxes / steppers */
	selection: 'single' | 'multiple';
	required: boolean;
	is_active: boolean;
	sort_order: number;
	options: MenuOption[];
};

/** Legacy flat add-on row (still returned for compatibility). */
export type MenuAddon = {
	id?: string;
	name: string;
	price: number;
	max_qty?: number;
};

export type MenuCategory = {
	id: string;
	name: string;
	description: string;
	image_url?: string | null;
	sort_order: number;
	is_active: boolean;
	created_at?: string;
	updated_at?: string;
};

export type MenuProduct = {
	id: string;
	category_id: string;
	name: string;
	description: string;
	price: number;
	image_url?: string | null;
	sort_order: number;
	is_available: boolean;
	is_vegetarian: boolean;
	is_featured: boolean;
	is_popular: boolean;
	allow_special_instructions: boolean;
	addons: MenuAddon[];
	option_groups?: OptionGroup[];
	created_at?: string;
	updated_at?: string;
};

export type CategoryInput = {
	name: string;
	description?: string;
	image_url?: string | null;
	sort_order?: number;
	is_active?: boolean;
};

export type ProductInput = {
	category_id: string;
	name: string;
	description?: string;
	price: number;
	image_url?: string | null;
	sort_order?: number;
	is_available?: boolean;
	is_vegetarian?: boolean;
	is_featured?: boolean;
	is_popular?: boolean;
	allow_special_instructions?: boolean;
	option_groups?: OptionGroup[];
	/** @deprecated Prefer option_groups; kept for simple PATCH payloads. */
	addons?: MenuAddon[];
};

export function productHasOptions(p: MenuProduct): boolean {
	if (p.option_groups && p.option_groups.some((g) => g.is_active !== false && g.options.length > 0)) {
		return true;
	}
	return (p.addons?.length ?? 0) > 0;
}

export function newOptionGroup(partial?: Partial<OptionGroup>): OptionGroup {
	const id = partial?.id || crypto.randomUUID().slice(0, 8);
	return {
		id,
		name: partial?.name ?? '',
		selection: partial?.selection ?? 'single',
		required: partial?.required ?? false,
		is_active: partial?.is_active ?? true,
		sort_order: partial?.sort_order ?? 0,
		options: partial?.options ?? [{ id: crypto.randomUUID().slice(0, 8), name: '', price: 0, is_active: true, sort_order: 0 }]
	};
}

export const menuApi = {
	listCategories: () => api<{ categories: MenuCategory[] }>('/api/v1/tenant/categories'),
	createCategory: (body: CategoryInput) =>
		api<MenuCategory>('/api/v1/tenant/categories', { method: 'POST', body: JSON.stringify(body) }),
	updateCategory: (id: string, body: Partial<CategoryInput>) =>
		api<MenuCategory>(`/api/v1/tenant/categories/${id}`, {
			method: 'PATCH',
			body: JSON.stringify(body)
		}),
	deleteCategory: (id: string, moveTo?: string) => {
		const q = moveTo ? `?move_to=${encodeURIComponent(moveTo)}` : '';
		return api<{ status: string }>(`/api/v1/tenant/categories/${id}${q}`, { method: 'DELETE' });
	},
	reorderCategories: (ids: string[]) =>
		api<{ status: string }>('/api/v1/tenant/categories/reorder', {
			method: 'POST',
			body: JSON.stringify({ ids })
		}),

	listProducts: () => api<{ products: MenuProduct[] }>('/api/v1/tenant/products'),
	getProduct: (id: string) => api<MenuProduct>(`/api/v1/tenant/products/${id}`),
	createProduct: (body: ProductInput) =>
		api<MenuProduct>('/api/v1/tenant/products', { method: 'POST', body: JSON.stringify(body) }),
	updateProduct: (id: string, body: Partial<ProductInput>) =>
		api<MenuProduct>(`/api/v1/tenant/products/${id}`, {
			method: 'PATCH',
			body: JSON.stringify(body)
		}),
	deleteProduct: (id: string) =>
		api<{ status: string }>(`/api/v1/tenant/products/${id}`, { method: 'DELETE' }),
	duplicateProduct: (id: string) =>
		api<MenuProduct>(`/api/v1/tenant/products/${id}/duplicate`, { method: 'POST' }),
	reorderProducts: (ids: string[]) =>
		api<{ status: string }>('/api/v1/tenant/products/reorder', {
			method: 'POST',
			body: JSON.stringify({ ids })
		}),

	uploadImage: async (file: File) => {
		const formData = new FormData();
		formData.append('image', file);
		return api<{ url: string }>('/api/v1/tenant/upload', { method: 'POST', body: formData });
	}
};
