/** The notification rules engine. Mirrors the backend's internal/notify + the
 * notification_events/rules/templates/deliveries/preferences tables. */

export type NotificationCategory = 'ORDERS' | 'PAYMENTS' | 'BOOKINGS' | 'STAFF' | 'SECURITY' | 'PLATFORM';
export type NotificationChannel = 'IN_APP' | 'EMAIL' | 'SMS';
export type NotificationPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL';
export type DeliveryStatus = 'PENDING' | 'SENT' | 'FAILED' | 'RETRYING' | 'DEAD';

export type NotificationEventDef = {
	code: string;
	category: NotificationCategory;
	label: string;
	description: string;
	default_channels: NotificationChannel[];
	required_capability?: string;
	variables: string[];
};

/** A rule is scoped to one (event, channel, audience) key. `overridden` is
 * true when this is the tenant's own row rather than the inherited platform
 * default — the settings UI uses it to render "Inherited" vs "Custom". */
export type NotificationRule = {
	id: string;
	event_code: string;
	channel: NotificationChannel;
	enabled: boolean;
	recipient_policy: string;
	priority: NotificationPriority;
	locked: boolean;
	overridden: boolean;
};

export type NotificationTemplate = {
	id: string;
	event_code: string;
	channel: NotificationChannel;
	subject: string;
	body: string;
	version: number;
	overridden: boolean;
	updated_at: string;
};

export type NotificationDelivery = {
	id: string;
	tenant_id?: string;
	event_code: string;
	channel: NotificationChannel;
	recipient: string;
	status: DeliveryStatus;
	attempt_count: number;
	max_attempts: number;
	last_error: string;
	created_at: string;
	delivered_at?: string;
};

export type NotificationPreferences = {
	sound_enabled: boolean;
	quiet_hours_start?: string;
	quiet_hours_end?: string;
	quiet_hours_tz?: string;
};

export type TestSendOutcome = {
	ok: boolean;
	message: string;
	detail?: string;
};

/** Recipient-policy prefix a rule uses to resolve who receives it. */
export const RECIPIENT_POLICY = {
	PLATFORM: 'PLATFORM',
	CUSTOMER: 'CUSTOMER',
	rolePrefix: 'ROLE:'
} as const;

/** True when a rule targets customers — the Storefront section of the
 * settings UI shows these; every other policy shows under Admin. */
export function isCustomerFacing(rule: NotificationRule): boolean {
	return rule.recipient_policy === RECIPIENT_POLICY.CUSTOMER;
}

export const CATEGORY_LABEL: Record<NotificationCategory, string> = {
	ORDERS: 'Orders',
	PAYMENTS: 'Payments',
	BOOKINGS: 'Bookings',
	STAFF: 'Staff',
	SECURITY: 'Security',
	PLATFORM: 'Platform'
};

export const CHANNEL_LABEL: Record<NotificationChannel, string> = {
	IN_APP: 'In-app',
	EMAIL: 'Email',
	SMS: 'SMS'
};
