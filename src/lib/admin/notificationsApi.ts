import { api } from '$lib/api/client';
import type {
	NotificationDelivery,
	NotificationEventDef,
	NotificationPreferences,
	NotificationRule,
	NotificationTemplate,
	TestSendOutcome
} from './notificationTypes';

export type RuleWrite = {
	event_code: string;
	channel: string;
	recipient_policy: string;
	enabled: boolean;
	priority: string;
};

export type TemplateWrite = {
	event_code: string;
	channel: string;
	subject?: string;
	body: string;
};

export type TestSendPayload = { event_code: string; channel: string; to: string };

/* ------------------------------------------------------------------ *
 * Platform
 * ------------------------------------------------------------------ */

export async function fetchNotificationEvents(): Promise<NotificationEventDef[]> {
	const data = await api<{ events: NotificationEventDef[] }>('/api/v1/admin/notification-events');
	return data.events;
}

export async function fetchPlatformNotificationRules(): Promise<NotificationRule[]> {
	const data = await api<{ rules: NotificationRule[] }>('/api/v1/admin/notification-rules');
	return data.rules;
}

export async function savePlatformNotificationRule(payload: RuleWrite): Promise<NotificationRule> {
	return api<NotificationRule>('/api/v1/admin/notification-rules', {
		method: 'PUT',
		body: JSON.stringify(payload)
	});
}

export async function fetchPlatformNotificationTemplates(): Promise<NotificationTemplate[]> {
	const data = await api<{ templates: NotificationTemplate[] }>('/api/v1/admin/notification-templates');
	return data.templates;
}

export async function savePlatformNotificationTemplate(payload: TemplateWrite): Promise<NotificationTemplate> {
	return api<NotificationTemplate>('/api/v1/admin/notification-templates', {
		method: 'PUT',
		body: JSON.stringify(payload)
	});
}

export async function testSendPlatformTemplate(payload: TestSendPayload): Promise<TestSendOutcome> {
	return api<TestSendOutcome>('/api/v1/admin/notification-templates/test-send', {
		method: 'POST',
		body: JSON.stringify(payload)
	});
}

export async function fetchAllNotificationDeliveries(): Promise<NotificationDelivery[]> {
	const data = await api<{ deliveries: NotificationDelivery[] }>('/api/v1/admin/notification-deliveries');
	return data.deliveries;
}

export async function retryNotificationDeliveryAsAdmin(id: string): Promise<void> {
	await api(`/api/v1/admin/notification-deliveries/${id}/retry`, { method: 'POST' });
}

export type TenantNotificationConfig = {
	rules: NotificationRule[];
	deliveries: NotificationDelivery[];
};

export async function fetchTenantNotificationConfig(tenantId: string): Promise<TenantNotificationConfig> {
	return api<TenantNotificationConfig>(`/api/v1/admin/tenants/${tenantId}/notification-config`);
}

/* ------------------------------------------------------------------ *
 * Tenant (business admin)
 * ------------------------------------------------------------------ */

export async function fetchTenantNotificationEvents(): Promise<NotificationEventDef[]> {
	const data = await api<{ events: NotificationEventDef[] }>('/api/v1/tenant/notification-events');
	return data.events;
}

export async function fetchTenantNotificationRules(): Promise<NotificationRule[]> {
	const data = await api<{ rules: NotificationRule[] }>('/api/v1/tenant/notification-rules');
	return data.rules;
}

export async function saveTenantNotificationRule(payload: RuleWrite): Promise<NotificationRule> {
	return api<NotificationRule>('/api/v1/tenant/notification-rules', {
		method: 'PUT',
		body: JSON.stringify(payload)
	});
}

export async function revertTenantNotificationRule(
	eventCode: string,
	channel: string,
	recipientPolicy: string
): Promise<void> {
	const params = new URLSearchParams({ event_code: eventCode, channel, recipient_policy: recipientPolicy });
	await api(`/api/v1/tenant/notification-rules?${params.toString()}`, { method: 'DELETE' });
}

export async function fetchTenantNotificationTemplates(): Promise<NotificationTemplate[]> {
	const data = await api<{ templates: NotificationTemplate[] }>('/api/v1/tenant/notification-templates');
	return data.templates;
}

export async function saveTenantNotificationTemplate(payload: TemplateWrite): Promise<NotificationTemplate> {
	return api<NotificationTemplate>('/api/v1/tenant/notification-templates', {
		method: 'PUT',
		body: JSON.stringify(payload)
	});
}

export async function testSendTenantTemplate(payload: TestSendPayload): Promise<TestSendOutcome> {
	return api<TestSendOutcome>('/api/v1/tenant/notification-templates/test-send', {
		method: 'POST',
		body: JSON.stringify(payload)
	});
}

export async function fetchTenantNotificationDeliveries(): Promise<NotificationDelivery[]> {
	const data = await api<{ deliveries: NotificationDelivery[] }>('/api/v1/tenant/notification-deliveries');
	return data.deliveries;
}

export async function retryTenantNotificationDelivery(id: string): Promise<void> {
	await api(`/api/v1/tenant/notification-deliveries/${id}/retry`, { method: 'POST' });
}

/* ------------------------------------------------------------------ *
 * Personal preferences (both portals; base path varies by caller)
 * ------------------------------------------------------------------ */

export async function fetchMyNotificationPreferences(
	basePath: '/api/v1/tenant' | '/api/v1/admin'
): Promise<NotificationPreferences> {
	return api<NotificationPreferences>(`${basePath}/me/notification-preferences`);
}

export async function saveMyNotificationPreferences(
	basePath: '/api/v1/tenant' | '/api/v1/admin',
	payload: NotificationPreferences
): Promise<NotificationPreferences> {
	return api<NotificationPreferences>(`${basePath}/me/notification-preferences`, {
		method: 'PUT',
		body: JSON.stringify(payload)
	});
}
