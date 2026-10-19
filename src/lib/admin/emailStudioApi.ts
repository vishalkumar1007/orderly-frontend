import { api } from '$lib/api/client';
import type {
	NotificationEventDef,
	NotificationRule,
	NotificationTemplate,
	TestSendOutcome
} from '$lib/admin/notificationTypes';

/** The editable copy of one email. Fields may hold {{variable}} tokens. */
export type EmailContent = {
	subject: string;
	preheader: string;
	heading: string;
	body: string;
	button_label: string;
	button_url: string;
	/** One detail shown in a box: a code, an order number, an amount. */
	highlight: string;
	/** The quiet note after the main content. */
	footnote: string;
	/** Hand-written HTML. When set it is the email; the guided fields are not used. */
	html_body: string;
};

/** The look shared by every email one sender sends. */
export type EmailBranding = {
	show_logo: boolean;
	logo_url: string;
	brand_color: string;
	footer_text: string;
	theme: EmailTheme;
	/** How the email is arranged: header, card and footer. */
	layout?: EmailLayout;
	/** Custom theme only: the colour behind the email, and of the email itself. */
	page_color?: string;
	card_color?: string;
};

export type EmailTheme = 'classic' | 'minimal' | 'bold' | 'dark' | 'custom';

export type EmailLayout = 'classic' | 'header' | 'centered' | 'plain' | 'footerbar';

export type BrandingView = {
	branding: EmailBranding;
	sender_name: string;
	/** Tenant only: the storefront logo used when no email logo is set. */
	storefront_logo_url?: string;
};

export type EmailPreview = {
	subject: string;
	text: string;
	html: string;
	/** With `raw`: the content block alone, for HTML inside the branded layout. */
	content?: string;
};

/** Whose emails the studio edits: the platform defaults, or one business. */
export type EmailScope = 'platform' | 'tenant';

/**
 * One client for both scopes: the platform and tenant endpoints have the same
 * shape under different prefixes, so the studio is written once.
 */
export function emailStudioApi(scope: EmailScope) {
	const base = scope === 'platform' ? '/api/v1/admin' : '/api/v1/tenant';
	return {
		events: () =>
			api<{ events: NotificationEventDef[] }>(`${base}/notification-events`).then((d) => d.events),
		rules: () => api<{ rules: NotificationRule[] }>(`${base}/notification-rules`).then((d) => d.rules),
		templates: () =>
			api<{ templates: NotificationTemplate[] }>(`${base}/notification-templates`).then((d) => d.templates),
		save: (payload: { event_code: string; channel: string } & Partial<EmailContent>) =>
			api<NotificationTemplate>(`${base}/notification-templates`, {
				method: 'PUT',
				body: JSON.stringify(payload)
			}),
		reset: (eventCode: string, channel: string) =>
			api(`${base}/notification-templates?${new URLSearchParams({ event_code: eventCode, channel })}`, {
				method: 'DELETE'
			}),
		/** `raw` keeps the {{variables}}: the layout as a starting point for HTML. */
		preview: (eventCode: string, content: EmailContent, branding?: EmailBranding, raw = false) =>
			api<EmailPreview>(`${base}/notification-templates/preview`, {
				method: 'POST',
				body: JSON.stringify({ event_code: eventCode, content, branding, raw })
			}),
		testSend: (eventCode: string, channel: string, to: string, content?: EmailContent) =>
			api<TestSendOutcome>(`${base}/notification-templates/test-send`, {
				method: 'POST',
				body: JSON.stringify({ event_code: eventCode, channel, to, content })
			}),
		branding: () => api<BrandingView>(`${base}/email-branding`),
		saveBranding: (b: EmailBranding) =>
			api<{ branding: EmailBranding }>(`${base}/email-branding`, { method: 'PUT', body: JSON.stringify(b) }),
		/** Returns a permanent address, safe to put in an email that is read days later. */
		upload: (file: File) => {
			const form = new FormData();
			form.append('file', file);
			return api<{ url: string }>(`${base}/email-branding/logo`, { method: 'POST', body: form }).then((r) => r.url);
		}
	};
}

/** A presigned storage link: fine for a page, dead by the time an email is read.
 * Uploads made here never produce one; this catches links pasted or saved earlier. */
export function isExpiringLink(url: string): boolean {
	return url.includes('X-Amz-Signature=');
}
