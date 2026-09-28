import { api } from '$lib/api/client';

/**
 * IAM: who is in this business and what they can reach.
 *
 * The role catalogue and the permission matrix come from the API rather than
 * being declared here, because the same table decides what the middleware
 * enforces. A console that shipped its own copy would eventually promise access
 * the API refuses — the exact bug this arrangement prevents.
 */

export type BusinessRole = 'TENANT_ADMIN' | 'MANAGER' | 'STAFF';

export type PermissionKey =
	| 'selling'
	| 'kitchen'
	| 'live_activity'
	| 'menu'
	| 'customers'
	| 'staff'
	| 'storefront'
	| 'organization'
	| 'integrations'
	| 'iam'
	| 'settings'
	| 'analytics'
	| 'activity';

export type PermissionInfo = {
	key: PermissionKey;
	label: string;
	group: string;
	description: string;
};

export type RoleInfo = {
	key: BusinessRole | string;
	label: string;
	description: string;
	permissions: PermissionKey[];
	assignable: boolean;
};

export type IamUser = {
	id: string;
	name: string;
	email: string;
	phone: string;
	role: BusinessRole | string;
	role_label: string;
	status: 'ACTIVE' | 'INVITED' | 'DISABLED' | string;
	must_set_password: boolean;
	permissions: PermissionKey[];
	active_sessions: number;
	created_at: string;
	last_activity: string | null;
	/** True for the signed-in user, who may not change their own access. */
	is_self: boolean;
};

export type IamOverview = {
	users: IamUser[];
	roles: RoleInfo[];
	permissions: PermissionInfo[];
	summary: { owners: number; managers: number; staff: number; total: number };
};

export async function fetchIam(): Promise<IamOverview> {
	return api<IamOverview>('/api/v1/tenant/iam');
}
