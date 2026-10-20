<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { ApiClientError } from '$lib/api/client';
	import FormField from '$lib/components/admin/FormField.svelte';
	import SelectField from '$lib/components/admin/SelectField.svelte';
	import TextArea from '$lib/components/admin/TextArea.svelte';
	import TextInput from '$lib/components/admin/TextInput.svelte';
	import { toast } from '$lib/components/admin/toast';
	import {
		CHANNEL_LABEL,
		GOAL_CARDS,
		marketingApi,
		type Audience,
		type AudiencePreview,
		type Campaign,
		type Channel,
		type Draft,
		type Goal,
		type MarketingLink,
		type Offer,
		type Overview,
		type Validation
	} from '$lib/tenant/marketingApi';

	/**
	 * Guided campaign builder: goal, audience, channel, message, review, send.
	 * One screen per decision, only the controls that decision needs. The
	 * draft is saved when the owner reaches Review, so nothing is written for
	 * a wizard they abandon on step two.
	 */

	type Step = 'goal' | 'audience' | 'channel' | 'content' | 'review';
	const STEPS: { id: Step; label: string }[] = [
		{ id: 'goal', label: 'Goal' },
		{ id: 'audience', label: 'Audience' },
		{ id: 'channel', label: 'Channel' },
		{ id: 'content', label: 'Message' },
		{ id: 'review', label: 'Review' }
	];
	let step = $state<Step>('goal');
	const stepIndex = $derived(STEPS.findIndex((s) => s.id === step));

	let draft = $state<Draft>({
		name: '',
		goal: 'PROMOTE',
		audience: 'ALL',
		channel: 'EMAIL',
		subject: '',
		body: '',
		button_label: '',
		link_id: '',
		template_name: '',
		template_lang: 'en',
		promotion_id: ''
	});
	/** Set once the draft exists on the server (editing, or after reaching Review). */
	let campaignId = $state<string | null>(null);
	let saving = $state(false);
	let error = $state('');

	let overview = $state<Overview | null>(null);
	let links = $state<MarketingLink[]>([]);
	let offers = $state<Offer[]>([]);
	let preview = $state<AudiencePreview | null>(null);
	let previewLoading = $state(false);
	let validation = $state<Validation | null>(null);
	let validating = $state(false);

	const channels = $derived(overview?.channels);
	const audiences = $derived(
		Object.entries(overview?.audiences ?? {}).map(([value, label]) => ({ value: value as Audience, label }))
	);

	onMount(async () => {
		const q = $page.url.searchParams;
		const goal = q.get('goal') as Goal | null;
		const audience = q.get('audience') as Audience | null;
		if (goal && GOAL_CARDS.some((g) => g.goal === goal)) draft.goal = goal;
		if (audience) draft.audience = audience;
		const id = q.get('id');
		try {
			const [o, l, of] = await Promise.all([marketingApi.overview(), marketingApi.links(), marketingApi.offers()]);
			overview = o;
			links = l.links ?? [];
			offers = (of.offers ?? []).filter((x) => x.active);
			if (!o.channels.EMAIL.ready) {
				if (o.channels.SMS.ready) draft.channel = 'SMS';
				else if (o.channels.WHATSAPP.ready) draft.channel = 'WHATSAPP';
			}
			if (id) {
				const c = await marketingApi.campaign(id);
				if (c.status !== 'DRAFT') {
					toast.error('Only a draft can be edited');
					await goto(`/shop/marketing/${id}`);
					return;
				}
				campaignId = c.id;
				draft = {
					name: c.name,
					goal: c.goal,
					audience: c.audience,
					channel: c.channel,
					subject: c.subject,
					body: c.body,
					button_label: c.button_label,
					link_id: c.link_id ?? '',
					template_name: c.template_name,
					template_lang: c.template_lang || 'en',
					promotion_id: c.promotion_id ?? ''
				};
			}
		} catch (err) {
			if (err instanceof ApiClientError && err.code === 'feature_not_in_plan') {
				await goto('/shop/marketing');
				return;
			}
			error = err instanceof Error ? err.message : 'Could not load';
		}
	});

	async function loadPreview() {
		previewLoading = true;
		try {
			preview = await marketingApi.previewAudience(draft.audience, draft.channel);
		} catch {
			preview = null;
		} finally {
			previewLoading = false;
		}
	}

	$effect(() => {
		// Re-count whenever the audience or channel changes while on those steps.
		if (step === 'audience' || step === 'channel') {
			void draft.audience;
			void draft.channel;
			void loadPreview();
		}
	});

	const goalProblem = $derived(draft.name.trim() === '' ? 'Give the campaign a name.' : '');
	const contentProblem = $derived.by(() => {
		if (draft.body.trim() === '') return 'Write the message.';
		if (draft.channel === 'EMAIL' && draft.subject.trim() === '') return 'An email needs a subject line.';
		if (draft.channel === 'SMS' && draft.body.length > 480) return 'An SMS must be 480 characters or fewer.';
		if (draft.channel === 'WHATSAPP' && !(draft.template_name ?? '').trim()) return 'WhatsApp needs the name of an approved template.';
		return '';
	});
	const canNext = $derived.by(() => {
		if (step === 'goal') return goalProblem === '';
		if (step === 'content') return contentProblem === '';
		if (step === 'channel') return !!channels?.[draft.channel]?.ready;
		return true;
	});

	async function saveDraft(): Promise<Campaign | null> {
		saving = true;
		error = '';
		try {
			const c = campaignId
				? await marketingApi.update(campaignId, draft)
				: await marketingApi.create(draft);
			campaignId = c.id;
			return c;
		} catch (err) {
			error = err instanceof Error ? err.message : 'Could not save the draft';
			return null;
		} finally {
			saving = false;
		}
	}

	async function runValidation() {
		if (!campaignId) return;
		validating = true;
		try {
			validation = await marketingApi.validate(campaignId);
		} catch (err) {
			error = err instanceof Error ? err.message : 'Could not check the campaign';
		} finally {
			validating = false;
		}
	}

	async function next() {
		if (!canNext) return;
		if (step === 'content') {
			const c = await saveDraft();
			if (!c) return;
			step = 'review';
			await runValidation();
			return;
		}
		step = STEPS[stepIndex + 1].id;
	}

	function back() {
		if (stepIndex > 0) step = STEPS[stepIndex - 1].id;
	}

	/* ---------- send ---------- */

	let mode = $state<'now' | 'later'>('now');
	let when = $state('');
	let sending = $state(false);

	const whenISO = $derived.by(() => {
		if (mode === 'now' || !when) return undefined;
		const d = new Date(when);
		return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
	});

	async function send() {
		if (!campaignId || !validation?.ready) return;
		if (mode === 'later' && !whenISO) {
			error = 'Pick a date and time.';
			return;
		}
		sending = true;
		error = '';
		try {
			await marketingApi.schedule(campaignId, whenISO);
			toast.success(mode === 'now' ? 'Campaign is on its way' : 'Campaign scheduled');
			await goto(`/shop/marketing/${campaignId}`);
		} catch (err) {
			if (err instanceof ApiClientError && Array.isArray(err.details?.problems)) {
				validation = validation ? { ...validation, problems: err.details.problems as string[], ready: false } : null;
			}
			error = err instanceof Error ? err.message : 'Could not schedule';
		} finally {
			sending = false;
		}
	}

	let testTo = $state('');
	let testing = $state(false);
	async function testSend() {
		if (!campaignId || !testTo.trim()) return;
		testing = true;
		try {
			await marketingApi.testSend(campaignId, testTo.trim());
			toast.success(`Test sent to ${testTo.trim()}`);
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Test failed');
		} finally {
			testing = false;
		}
	}

	const selectedLink = $derived(links.find((l) => l.id === draft.link_id) ?? null);
	const bodyCount = $derived(draft.body.length);
</script>

<div class="wiz">
	<nav class="wiz-steps" aria-label="Steps">
		{#each STEPS as s, i (s.id)}
			<span class={['wiz-step', i === stepIndex && 'active', i < stepIndex && 'done'].filter(Boolean).join(' ')}>
				<span class="wiz-num">{i + 1}</span>
				{s.label}
			</span>
		{/each}
	</nav>

	<section class="panel wiz-panel">
		{#if step === 'goal'}
			<h2 class="wiz-h">What is this campaign for?</h2>
			<div class="wiz-goals" role="radiogroup" aria-label="Goal">
				{#each GOAL_CARDS as g (g.goal)}
					<button
						type="button"
						role="radio"
						aria-checked={draft.goal === g.goal}
						class={['wiz-goal', draft.goal === g.goal && 'selected'].filter(Boolean).join(' ')}
						onclick={() => {
							draft.goal = g.goal;
							if (!campaignId) draft.audience = g.audience;
						}}
					>
						<strong>{g.title}</strong>
						<span class="muted">{g.hint}</span>
					</button>
				{/each}
			</div>
			<FormField label="Campaign name" htmlFor="wiz-name" hint="For you and your team. Customers never see it." required>
				<TextInput id="wiz-name" bind:value={draft.name} placeholder="Weekend brunch offer" maxlength={120} />
			</FormField>
		{:else if step === 'audience'}
			<h2 class="wiz-h">Who should hear about it?</h2>
			<FormField label="Audience" htmlFor="wiz-audience">
				<SelectField id="wiz-audience" bind:value={draft.audience} options={audiences} />
			</FormField>
			<div class="wiz-preview" aria-live="polite">
				{#if previewLoading && !preview}
					<p class="muted">Counting…</p>
				{:else if preview}
					<p class="wiz-big"><strong>{preview.eligible}</strong> {preview.eligible === 1 ? 'customer' : 'customers'} will receive it</p>
					<ul class="wiz-reasons muted">
						<li>{preview.matched} match this audience</li>
						{#if preview.no_consent > 0}<li>{preview.no_consent} left out: no marketing consent recorded</li>{/if}
						{#if preview.no_address > 0}<li>{preview.no_address} left out: no {draft.channel === 'EMAIL' ? 'email address' : 'phone number'}</li>{/if}
						{#if preview.blocked > 0}<li>{preview.blocked} left out: blocked</li>{/if}
					</ul>
					{#if preview.no_consent > 0}
						<p class="muted wiz-small">Consent is recorded on the <a href="/shop/marketing">Marketing home</a>.</p>
					{/if}
				{/if}
			</div>
		{:else if step === 'channel'}
			<h2 class="wiz-h">How should it reach them?</h2>
			<div class="wiz-channels" role="radiogroup" aria-label="Channel">
				{#each ['EMAIL', 'SMS', 'WHATSAPP'] as const as ch (ch)}
					{@const c = channels?.[ch]}
					<button
						type="button"
						role="radio"
						aria-checked={draft.channel === ch}
						class={['wiz-goal', draft.channel === ch && 'selected'].filter(Boolean).join(' ')}
						disabled={!c?.ready}
						onclick={() => (draft.channel = ch)}
					>
						<strong>{CHANNEL_LABEL[ch]}</strong>
						<span class="muted">
							{#if !c}Checking…{:else if c.ready}{ch === 'EMAIL' ? 'Branded email with a button to your storefront.' : ch === 'SMS' ? 'A short text message with a link.' : 'An approved WhatsApp template, sent through Meta.'}{:else}{c.reason}{/if}
						</span>
					</button>
				{/each}
			</div>
			{#if preview}
				<p class="muted wiz-small" aria-live="polite">
					{preview.eligible} {preview.eligible === 1 ? 'customer has' : 'customers have'} consent and {draft.channel === 'EMAIL' ? 'an email address' : 'a phone number'}.
				</p>
			{/if}
		{:else if step === 'content'}
			<h2 class="wiz-h">Write the message</h2>
			{#if draft.channel === 'EMAIL'}
				<FormField label="Subject" htmlFor="wiz-subject" required>
					<TextInput id="wiz-subject" bind:value={draft.subject} placeholder="This weekend: brunch for two at a special price" maxlength={200} />
				</FormField>
			{/if}
			{#if draft.channel === 'WHATSAPP'}
				<div class="wiz-two">
					<FormField label="Approved template name" htmlFor="wiz-tpl" required hint={"From WhatsApp Manager. Your message fills its {{1}} parameter."}>
						<TextInput id="wiz-tpl" bind:value={draft.template_name} placeholder="promo_update_v1" />
					</FormField>
					<FormField label="Template language" htmlFor="wiz-lang">
						<TextInput id="wiz-lang" bind:value={draft.template_lang} placeholder="en" maxlength={10} />
					</FormField>
				</div>
			{/if}
			<FormField
				label="Message"
				htmlFor="wiz-body"
				required
				hint={draft.channel === 'SMS'
					? `${bodyCount}/480. The link and an opt-out note are added automatically. You can write {{business_name}}, {{link}} and {{offer_code}}.`
					: draft.channel === 'WHATSAPP'
						? `${bodyCount}/1024. Sent as the template's text parameter. You can write {{business_name}}, {{link}} and {{offer_code}}.`
						: 'You can write {{business_name}}, {{link}} and {{offer_code}}; they are filled in when sent. An unsubscribe link is always added.'}
			>
				<TextArea id="wiz-body" bind:value={draft.body} rows={draft.channel === 'EMAIL' ? 8 : 4} maxlength={draft.channel === 'SMS' ? 480 : draft.channel === 'WHATSAPP' ? 1024 : 4000} />
			</FormField>
			<FormField label="Offer" htmlFor="wiz-offer" hint={"Its code fills {{offer_code}} and is shown in the email. Create offers under Offers & Loyalty."}>
				<SelectField
					id="wiz-offer"
					bind:value={draft.promotion_id}
					options={[{ value: '', label: 'No offer' }, ...offers.map((o) => ({ value: o.id, label: `${o.code}${o.name ? ' · ' + o.name : ''}` }))]}
				/>
			</FormField>
			<FormField label="Link" htmlFor="wiz-link" hint="A trackable link so you can see who visited. Create links on the Marketing home.">
				<SelectField
					id="wiz-link"
					bind:value={draft.link_id}
					options={[{ value: '', label: 'No link' }, ...links.map((l) => ({ value: l.id, label: `${l.label || l.target_path} (${l.target_path})` }))]}
				/>
			</FormField>
			{#if draft.channel === 'EMAIL' && selectedLink}
				<FormField label="Button label" htmlFor="wiz-button" hint="Shown on the button that opens the link.">
					<TextInput id="wiz-button" bind:value={draft.button_label} placeholder="See the menu" maxlength={60} />
				</FormField>
			{/if}
			{#if contentProblem && (draft.body || draft.subject)}
				<p class="field-error">{contentProblem}</p>
			{/if}
		{:else if step === 'review'}
			<h2 class="wiz-h">Review and send</h2>
			<dl class="wiz-summary">
				<dt>Name</dt><dd>{draft.name}</dd>
				<dt>Goal</dt><dd>{overview?.goals[draft.goal] ?? draft.goal}</dd>
				<dt>Audience</dt><dd>{overview?.audiences[draft.audience] ?? draft.audience}</dd>
				<dt>Channel</dt><dd>{CHANNEL_LABEL[draft.channel]}{draft.channel === 'WHATSAPP' ? ` (template ${draft.template_name})` : ''}</dd>
				{#if draft.promotion_id}<dt>Offer</dt><dd>{offers.find((o) => o.id === draft.promotion_id)?.code ?? ''}</dd>{/if}
				{#if draft.channel === 'EMAIL'}<dt>Subject</dt><dd>{draft.subject}</dd>{/if}
				<dt>Message</dt><dd class="wiz-pre">{draft.body}</dd>
				{#if selectedLink}<dt>Link</dt><dd>{selectedLink.label || selectedLink.target_path} <span class="muted">({selectedLink.target_path})</span></dd>{/if}
			</dl>

			<div class="wiz-preview" aria-live="polite">
				{#if validating}
					<p class="muted">Checking…</p>
				{:else if validation}
					<p class="wiz-big"><strong>{validation.audience.eligible}</strong> {validation.audience.eligible === 1 ? 'customer' : 'customers'} will receive it</p>
					{#if validation.problems.length > 0}
						<ul class="wiz-problems" role="alert">
							{#each validation.problems as p (p)}<li>{p}</li>{/each}
						</ul>
					{/if}
				{/if}
			</div>

			<div class="wiz-test">
				<FormField label="Send a test to yourself first" htmlFor="wiz-test" hint={draft.channel === 'EMAIL' ? 'Your email address' : 'Your phone number'}>
					<div class="wiz-inline">
						<TextInput id="wiz-test" bind:value={testTo} type={draft.channel === 'EMAIL' ? 'email' : 'tel'} placeholder={draft.channel === 'EMAIL' ? 'you@example.com' : '+91 98765 43210'} />
						<button type="button" class="btn btn-ghost" disabled={testing || !testTo.trim()} onclick={testSend}>{testing ? 'Sending…' : 'Send test'}</button>
					</div>
				</FormField>
			</div>

			<fieldset class="wiz-when">
				<legend class="field-label">When</legend>
				<label class="wiz-radio"><input type="radio" name="when" value="now" bind:group={mode} /> Send now</label>
				<label class="wiz-radio"><input type="radio" name="when" value="later" bind:group={mode} /> Schedule</label>
				{#if mode === 'later'}
					<input class="input" type="datetime-local" bind:value={when} aria-label="Date and time" />
				{/if}
			</fieldset>
		{/if}

		{#if error}<p class="field-error" role="alert">{error}</p>{/if}

		<footer class="wiz-footer">
			{#if stepIndex > 0}
				<button type="button" class="btn btn-ghost" onclick={back}>Back</button>
			{:else}
				<a class="btn btn-ghost" href="/shop/marketing">Cancel</a>
			{/if}
			<span class="wiz-spacer"></span>
			{#if step === 'review'}
				<button type="button" class="btn btn-primary" disabled={sending || validating || !validation?.ready} onclick={send}>
					{sending ? 'Sending…' : mode === 'now' ? `Send to ${validation?.audience.eligible ?? 0}` : 'Schedule'}
				</button>
			{:else}
				<button type="button" class="btn btn-primary" disabled={!canNext || saving} onclick={next}>
					{saving ? 'Saving…' : step === 'content' ? 'Review' : 'Next'}
				</button>
			{/if}
		</footer>
	</section>
</div>

<style>
	.wiz {
		display: grid;
		gap: 1rem;
		max-width: 48rem;
	}
	.wiz-steps {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem 1rem;
		font-size: var(--fs-meta);
		color: var(--text-2);
	}
	.wiz-step {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
	}
	.wiz-step.active {
		color: var(--text);
		font-weight: 600;
	}
	.wiz-num {
		display: inline-grid;
		place-items: center;
		width: 1.4rem;
		height: 1.4rem;
		border-radius: 999px;
		font-size: 0.72rem;
		background: var(--surface-2, color-mix(in srgb, var(--text) 6%, transparent));
	}
	.wiz-step.active .wiz-num,
	.wiz-step.done .wiz-num {
		background: var(--accent, #4f46e5);
		color: #fff;
	}
	.wiz-panel {
		display: grid;
		gap: 1rem;
		padding: 1.25rem;
	}
	.wiz-h {
		margin: 0;
		font-size: 1.05rem;
	}
	.wiz-goals,
	.wiz-channels {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(12rem, 1fr));
		gap: 0.6rem;
	}
	.wiz-goal {
		display: grid;
		gap: 0.2rem;
		text-align: left;
		padding: 0.8rem 0.9rem;
		border: 1px solid var(--border, color-mix(in srgb, var(--text) 12%, transparent));
		border-radius: var(--radius, 10px);
		background: transparent;
		color: inherit;
		cursor: pointer;
		font: inherit;
	}
	.wiz-goal .muted {
		font-size: var(--fs-meta);
		line-height: 1.4;
	}
	.wiz-goal.selected {
		border-color: var(--accent, #4f46e5);
		outline: 2px solid var(--accent, #4f46e5);
		outline-offset: -2px;
	}
	.wiz-goal:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}
	.wiz-preview {
		display: grid;
		gap: 0.4rem;
		padding: 0.9rem 1rem;
		border-radius: var(--radius, 10px);
		background: var(--surface-2, color-mix(in srgb, var(--text) 4%, transparent));
	}
	.wiz-big {
		margin: 0;
		font-size: var(--fs-body);
	}
	.wiz-big strong {
		font-size: 1.4rem;
	}
	.wiz-reasons,
	.wiz-problems {
		margin: 0;
		padding-left: 1.1rem;
		font-size: var(--fs-meta);
		line-height: 1.5;
	}
	.wiz-problems {
		color: var(--danger, #b91c1c);
	}
	.wiz-small {
		margin: 0;
		font-size: var(--fs-meta);
	}
	.wiz-summary {
		display: grid;
		grid-template-columns: max-content 1fr;
		gap: 0.35rem 1rem;
		margin: 0;
		font-size: var(--fs-body);
	}
	.wiz-summary dt {
		color: var(--text-2);
	}
	.wiz-summary dd {
		margin: 0;
		overflow-wrap: anywhere;
	}
	.wiz-pre {
		white-space: pre-wrap;
	}
	.wiz-two {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr));
		gap: 0.75rem;
	}
	.wiz-inline {
		display: flex;
		gap: 0.5rem;
		align-items: center;
	}
	.wiz-inline > :global(:first-child) {
		flex: 1;
	}
	.wiz-when {
		display: grid;
		gap: 0.5rem;
		margin: 0;
		padding: 0;
		border: 0;
	}
	.wiz-radio {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: var(--fs-body);
	}
	.wiz-footer {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding-top: 0.5rem;
		border-top: 1px solid var(--border, color-mix(in srgb, var(--text) 10%, transparent));
	}
	.wiz-spacer {
		flex: 1;
	}
	.field-error {
		margin: 0;
	}
</style>
