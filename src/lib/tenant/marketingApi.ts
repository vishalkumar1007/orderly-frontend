import { api } from '$lib/api/client';

/**
 * Marketing API, /api/v1/tenant/marketing/*. Every call is `quiet`: a plan
 * without MARKETING is rendered as a locked page by the Marketing screens, not
 * as the global upgrade dialog on top of them.
 */

export type Channel = 'EMAIL' | 'SMS' | 'WHATSAPP';
export type Platform = 'FACEBOOK' | 'INSTAGRAM';
export type Goal = 'ACQUIRE' | 'RETAIN' | 'PROMOTE' | 'FILL_SLOW_DAY' | 'ANNOUNCE';
export type Audience = 'ALL' | 'NEW' | 'REPEAT' | 'INACTIVE' | 'HIGH_VALUE';
export type CampaignStatus =
	| 'DRAFT'
	| 'SCHEDULED'
	| 'QUEUED'
	| 'RUNNING'
	| 'PAUSED'
	| 'COMPLETED'
	| 'PARTIALLY_FAILED'
	| 'FAILED'
	| 'CANCELLED';

export type Campaign = {
	id: string;
	name: string;
	goal: Goal;
	goal_label: string;
	audience: Audience;
	audience_label: string;
	channel: Channel;
	subject: string;
	body: string;
	button_label: string;
	link_id: string | null;
	template_name: string;
	template_lang: string;
	promotion_id: string | null;
	kind: 'CAMPAIGN' | 'AUTOMATION';
	automation_rule_id: string | null;
	status: CampaignStatus;
	status_reason: string;
	scheduled_at: string | null;
	started_at: string | null;
	finished_at: string | null;
	total_count: number;
	sent_count: number;
	failed_count: number;
	skipped_count: number;
	created_by: string;
	created_at: string;
	updated_at: string;
};

export type Recipient = {
	id: string;
	address: string;
	status: 'PENDING' | 'RETRYING' | 'SENT' | 'DELIVERED' | 'READ' | 'FAILED' | 'SKIPPED';
	attempt_count: number;
	last_error: string;
	sent_at: string | null;
	customer_name: string;
};

export type CampaignDetail = Campaign & {
	recipients: Recipient[];
	visits: number;
	link?: MarketingLink;
	attributed_orders?: number;
	attributed_revenue?: number;
	offer_code?: string;
};

export type MarketingLink = {
	id: string;
	code: string;
	label: string;
	target_path: string;
	/** The short address to share or print: the API redirects and counts the visit. */
	url: string;
	target_url: string;
	visits: number;
	created_at: string;
};

export type AudiencePreview = {
	matched: number;
	blocked: number;
	no_address: number;
	no_consent: number;
	eligible: number;
};

export type ChannelState = { allowed: boolean; ready: boolean; reason?: string };

export type Overview = {
	stats: {
		campaigns: number;
		active_campaigns: number;
		messages_sent: number;
		messages_failed: number;
		visits_30d: number;
		unsubscribes_30d: number;
		attributed_orders_30d: number;
		attributed_revenue_30d: number | string;
	};
	consent: ConsentSummary;
	channels: Record<Channel | Platform, ChannelState>;
	recent: Campaign[];
	goals: Record<Goal, string>;
	audiences: Record<Audience, string>;
};

export type ConsentSummary = {
	customers: number;
	with_email: number;
	with_phone: number;
	email_granted: number;
	sms_granted: number;
	whatsapp_granted: number;
	revoked: number;
};

export type Validation = { audience: AudiencePreview; problems: string[]; ready: boolean };

export type Draft = {
	name: string;
	goal: Goal;
	audience: Audience;
	channel: Channel;
	subject: string;
	body: string;
	button_label: string;
	link_id: string;
	template_name?: string;
	template_lang?: string;
	promotion_id?: string;
};

/* ---------- offers and loyalty ---------- */

export type Offer = {
	id: string;
	code: string;
	name: string;
	kind: 'PERCENT' | 'FIXED';
	value: number;
	min_subtotal: number;
	max_discount: number;
	starts_at: string | null;
	ends_at: string | null;
	max_redemptions: number;
	per_customer_limit: number;
	first_order_only: boolean;
	active: boolean;
	redemptions: number;
	discount_total: number;
	created_at: string;
};

export type OfferInput = {
	code: string;
	name: string;
	kind: 'PERCENT' | 'FIXED';
	value: number;
	min_subtotal: number;
	max_discount: number;
	starts_at: string;
	ends_at: string;
	max_redemptions: number;
	per_customer_limit: number;
	first_order_only: boolean;
	active?: boolean;
};

export type LoyaltyProgram = {
	enabled: boolean;
	points_per_100: number;
	point_value: number;
	min_redeem_points: number;
	max_redeem_percent: number;
};

export type LoyaltyView = {
	program: LoyaltyProgram;
	summary: { members: number; outstanding_points: number; lifetime_points: number };
	members: { customer_id: string; name: string; phone: string; balance: number; lifetime_earned: number; updated_at: string }[];
	outstanding_value: number;
};

/* ---------- automations ---------- */

export type Trigger = 'WELCOME' | 'ORDER_FOLLOW_UP' | 'WIN_BACK';

export type AutomationRule = {
	id: string;
	name: string;
	trigger: Trigger;
	trigger_label: string;
	enabled: boolean;
	channel: Channel;
	delay_hours: number;
	inactive_days: number;
	cooldown_days: number;
	quiet_start: number;
	quiet_end: number;
	subject: string;
	body: string;
	button_label: string;
	link_id: string | null;
	promotion_id: string | null;
	template_name: string;
	template_lang: string;
	last_run_at: string | null;
	runs: number;
	runs_30d: number;
};

export type RuleInput = Omit<AutomationRule, 'id' | 'trigger_label' | 'last_run_at' | 'runs' | 'runs_30d' | 'link_id' | 'promotion_id'> & {
	link_id: string;
	promotion_id: string;
};

export type RuleTemplate = {
	trigger: Trigger;
	name: string;
	subject: string;
	body: string;
	hint: string;
	delay_hours?: number;
	inactive_days?: number;
};

/* ---------- social ---------- */

export type SocialStatus = 'DRAFT' | 'SCHEDULED' | 'PUBLISHING' | 'PUBLISHED' | 'PARTIAL' | 'FAILED' | 'MANUAL';

export type SocialPost = {
	id: string;
	caption: string;
	image_url: string;
	platforms: Platform[];
	link_id: string | null;
	link_url?: string;
	share_text: string;
	status: SocialStatus;
	scheduled_at: string | null;
	published_at: string | null;
	results: Record<string, { ok?: boolean; id?: string; error?: string; reason?: string }> | null;
	created_at: string;
};

export type PostInput = {
	caption: string;
	image_url: string;
	platforms: Platform[];
	link_id: string;
	scheduled_at: string;
};

const BASE = '/api/v1/tenant/marketing';
const post = (body: unknown) => ({ method: 'POST', body: JSON.stringify(body), quiet: true });

export const marketingApi = {
	overview: () => api<Overview>(`${BASE}/overview`, { quiet: true }),

	previewAudience: (audience: Audience, channel: Channel) =>
		api<AudiencePreview>(`${BASE}/audience/preview`, post({ audience, channel })),

	consent: () => api<ConsentSummary>(`${BASE}/consent`, { quiet: true }),
	grantAll: (channel: Channel) =>
		api<{ granted: number }>(`${BASE}/consent/grant-all`, post({ channel, attested: true })),

	links: () => api<{ links: MarketingLink[] }>(`${BASE}/links`, { quiet: true }),
	createLink: (label: string, target_path: string) =>
		api<MarketingLink>(`${BASE}/links`, post({ label, target_path })),
	deleteLink: (id: string) => api<void>(`${BASE}/links/${id}`, { method: 'DELETE', quiet: true }),
	linkQr: (id: string) =>
		api<{ url: string; png: string; svg: string; size: number }>(`${BASE}/links/${id}/qr`, { quiet: true }),

	campaigns: () => api<{ campaigns: Campaign[] }>(`${BASE}/campaigns?limit=100`, { quiet: true }),
	campaign: (id: string) => api<CampaignDetail>(`${BASE}/campaigns/${id}`, { quiet: true }),
	create: (d: Draft) => api<Campaign>(`${BASE}/campaigns`, post(d)),
	update: (id: string, d: Draft) =>
		api<Campaign>(`${BASE}/campaigns/${id}`, { method: 'PATCH', body: JSON.stringify(d), quiet: true }),
	remove: (id: string) => api<void>(`${BASE}/campaigns/${id}`, { method: 'DELETE', quiet: true }),
	validate: (id: string) => api<Validation>(`${BASE}/campaigns/${id}/validate`, post({})),
	schedule: (id: string, scheduled_at?: string) =>
		api<Campaign>(`${BASE}/campaigns/${id}/schedule`, post(scheduled_at ? { scheduled_at } : {})),
	action: (id: string, action: 'pause' | 'resume' | 'cancel' | 'unschedule') =>
		api<Campaign>(`${BASE}/campaigns/${id}/${action}`, post({})),
	testSend: (id: string, to: string) =>
		api<{ sent_to: string }>(`${BASE}/campaigns/${id}/test-send`, post({ to })),

	offers: () => api<{ offers: Offer[] }>(`${BASE}/offers`, { quiet: true }),
	createOffer: (o: OfferInput) => api<Offer>(`${BASE}/offers`, post(o)),
	updateOffer: (id: string, o: OfferInput) =>
		api<Offer>(`${BASE}/offers/${id}`, { method: 'PATCH', body: JSON.stringify(o), quiet: true }),
	deleteOffer: (id: string) => api<void>(`${BASE}/offers/${id}`, { method: 'DELETE', quiet: true }),
	loyalty: () => api<LoyaltyView>(`${BASE}/loyalty`, { quiet: true }),
	saveLoyalty: (p: LoyaltyProgram) =>
		api<LoyaltyProgram>(`${BASE}/loyalty`, { method: 'PUT', body: JSON.stringify(p), quiet: true }),
	adjustLoyalty: (customer_id: string, points: number, note: string) =>
		api<{ balance: number }>(`${BASE}/loyalty/adjust`, post({ customer_id, points, note })),

	automations: () =>
		api<{ rules: AutomationRule[]; templates: RuleTemplate[]; triggers: Record<Trigger, string>; channels: Record<Channel | Platform, ChannelState> }>(
			`${BASE}/automations`,
			{ quiet: true }
		),
	createRule: (r: RuleInput) => api<AutomationRule>(`${BASE}/automations`, post(r)),
	updateRule: (id: string, r: RuleInput) =>
		api<AutomationRule>(`${BASE}/automations/${id}`, { method: 'PATCH', body: JSON.stringify(r), quiet: true }),
	setRuleEnabled: (id: string, enabled: boolean) =>
		api<AutomationRule>(`${BASE}/automations/${id}/${enabled ? 'enable' : 'disable'}`, post({})),
	deleteRule: (id: string) => api<void>(`${BASE}/automations/${id}`, { method: 'DELETE', quiet: true }),

	posts: () => api<{ posts: SocialPost[]; connected: Record<Platform, boolean> }>(`${BASE}/social`, { quiet: true }),
	createPost: (p: PostInput) => api<SocialPost>(`${BASE}/social`, post(p)),
	updatePost: (id: string, p: PostInput) =>
		api<SocialPost>(`${BASE}/social/${id}`, { method: 'PATCH', body: JSON.stringify(p), quiet: true }),
	deletePost: (id: string) => api<void>(`${BASE}/social/${id}`, { method: 'DELETE', quiet: true }),
	publishPost: (id: string) => api<SocialPost>(`${BASE}/social/${id}/publish`, post({}))
};

export const CHANNEL_LABEL: Record<Channel, string> = { EMAIL: 'Email', SMS: 'SMS', WHATSAPP: 'WhatsApp' };

/** The Marketing area's sections, for the tab strip every page shows. */
export const MARKETING_SECTIONS: { href: string; label: string }[] = [
	{ href: '/shop/marketing', label: 'Overview' },
	{ href: '/shop/marketing/offers', label: 'Offers & Loyalty' },
	{ href: '/shop/marketing/automations', label: 'Automations' },
	{ href: '/shop/marketing/social', label: 'Social' },
	{ href: '/shop/marketing/kit', label: 'Share kit' }
];

/** Badge wording and tone for a campaign state. */
export function statusBadge(s: CampaignStatus): {
	label: string;
	kind: 'ok' | 'warn' | 'danger' | 'neutral' | 'accent';
} {
	switch (s) {
		case 'DRAFT':
			return { label: 'Draft', kind: 'neutral' };
		case 'SCHEDULED':
			return { label: 'Scheduled', kind: 'accent' };
		case 'QUEUED':
		case 'RUNNING':
			return { label: 'Sending', kind: 'accent' };
		case 'PAUSED':
			return { label: 'Paused', kind: 'warn' };
		case 'COMPLETED':
			return { label: 'Sent', kind: 'ok' };
		case 'PARTIALLY_FAILED':
			return { label: 'Partly failed', kind: 'warn' };
		case 'FAILED':
			return { label: 'Failed', kind: 'danger' };
		case 'CANCELLED':
			return { label: 'Cancelled', kind: 'neutral' };
	}
}

/** Goal cards on the overview, each pre-filling the wizard. */
export const GOAL_CARDS: { goal: Goal; title: string; hint: string; audience: Audience }[] = [
	{ goal: 'ACQUIRE', title: 'Get new customers', hint: 'A welcome offer for people who just found you.', audience: 'NEW' },
	{ goal: 'RETAIN', title: 'Bring customers back', hint: 'Reach people who have not visited in a while.', audience: 'INACTIVE' },
	{ goal: 'PROMOTE', title: 'Promote a product or service', hint: 'Tell your regulars what is new.', audience: 'REPEAT' },
	{ goal: 'FILL_SLOW_DAY', title: 'Fill a slow day', hint: 'A same-day offer to everyone who said yes.', audience: 'ALL' },
	{ goal: 'ANNOUNCE', title: 'Share news', hint: 'New hours, a new location, a new menu.', audience: 'ALL' }
];
