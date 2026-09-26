import { api } from '$lib/api/client';
import type {
	AdminTenantConfigOverview,
	ConfigService,
	ConfigView,
	EffectiveConfig,
	PlatformConfigList,
	PostureResponse,
	SaveConfigPayload,
	TenantServiceDetail,
	TenantServiceView,
	TestOutcome
} from './configTypes';

const servicePath = (service: ConfigService | string) => String(service).toLowerCase();

/* ------------------------------------------------------------------ *
 * Super Admin
 * ------------------------------------------------------------------ */

export async function fetchPlatformConfigs(): Promise<PlatformConfigList> {
	return api<PlatformConfigList>('/api/v1/admin/configurations');
}

export async function fetchPlatformConfig(service: ConfigService): Promise<ConfigView> {
	return api<ConfigView>(`/api/v1/admin/configurations/${servicePath(service)}`);
}

export async function savePlatformConfig(
	service: ConfigService,
	payload: SaveConfigPayload & { allow_tenants?: boolean }
): Promise<ConfigView> {
	return api<ConfigView>(`/api/v1/admin/configurations/${servicePath(service)}`, {
		method: 'PUT',
		body: JSON.stringify(payload)
	});
}

export async function setPlatformSharing(
	service: ConfigService,
	allowTenants: boolean
): Promise<ConfigView> {
	return api<ConfigView>(`/api/v1/admin/configurations/${servicePath(service)}/sharing`, {
		method: 'PATCH',
		body: JSON.stringify({ allow_tenants: allowTenants })
	});
}

/** Test a saved configuration, or unsaved values when a payload is supplied. */
export async function testPlatformConfig(
	service: ConfigService,
	draft?: SaveConfigPayload
): Promise<TestOutcome> {
	return api<TestOutcome>(`/api/v1/admin/configurations/${servicePath(service)}/test`, {
		method: 'POST',
		body: JSON.stringify(draft ?? {})
	});
}

export async function testPlatformConfigAction(
	service: ConfigService,
	action: string,
	extra: Record<string, unknown> = {}
): Promise<TestOutcome> {
	return api<TestOutcome>(`/api/v1/admin/configurations/${servicePath(service)}/test-action`, {
		method: 'POST',
		body: JSON.stringify({ action, ...extra })
	});
}

export async function fetchTenantConfigOverview(
	tenantId: string
): Promise<AdminTenantConfigOverview> {
	return api<AdminTenantConfigOverview>(
		`/api/v1/admin/tenants/${tenantId}/configurations`
	);
}

export async function setTenantServiceAccess(
	tenantId: string,
	service: ConfigService,
	allowPlatform: boolean
): Promise<AdminTenantConfigOverview> {
	return api<AdminTenantConfigOverview>(
		`/api/v1/admin/tenants/${tenantId}/configurations/${servicePath(service)}/access`,
		{ method: 'PUT', body: JSON.stringify({ allow_platform: allowPlatform }) }
	);
}

export async function fetchAllTenantConfigs(): Promise<PostureResponse> {
	return api<PostureResponse>('/api/v1/admin/tenant-configurations');
}

/* ------------------------------------------------------------------ *
 * Tenant
 * ------------------------------------------------------------------ */

export async function fetchTenantConfigs(): Promise<{
	services: TenantServiceView[];
	encryption: { enabled: boolean };
}> {
	return api('/api/v1/tenant/configurations');
}

export async function fetchTenantConfig(service: ConfigService): Promise<TenantServiceDetail> {
	return api<TenantServiceDetail>(`/api/v1/tenant/configurations/${servicePath(service)}`);
}

export async function saveTenantConfig(
	service: ConfigService,
	payload: SaveConfigPayload
): Promise<ConfigView> {
	return api<ConfigView>(`/api/v1/tenant/configurations/${servicePath(service)}`, {
		method: 'PUT',
		body: JSON.stringify(payload)
	});
}

export async function deleteTenantConfig(service: ConfigService): Promise<{ status: string }> {
	return api<{ status: string }>(`/api/v1/tenant/configurations/${servicePath(service)}`, {
		method: 'DELETE'
	});
}

export async function testTenantConfig(
	service: ConfigService,
	draft?: SaveConfigPayload
): Promise<TestOutcome> {
	return api<TestOutcome>(`/api/v1/tenant/configurations/${servicePath(service)}/test`, {
		method: 'POST',
		body: JSON.stringify(draft ?? {})
	});
}

export async function testTenantConfigAction(
	service: ConfigService,
	action: string,
	extra: Record<string, unknown> = {}
): Promise<TestOutcome> {
	return api<TestOutcome>(`/api/v1/tenant/configurations/${servicePath(service)}/test-action`, {
		method: 'POST',
		body: JSON.stringify({ action, ...extra })
	});
}

export async function fetchEffectiveConfig(service: ConfigService): Promise<EffectiveConfig> {
	return api<EffectiveConfig>(
		`/api/v1/tenant/configurations/${servicePath(service)}/effective`
	);
}

export async function setServiceSource(
	service: ConfigService,
	source: 'PLATFORM' | 'ORGANIZATION'
): Promise<unknown> {
	return api(`/api/v1/tenant/service-preferences/${servicePath(service)}`, {
		method: 'PUT',
		body: JSON.stringify({ source })
	});
}
