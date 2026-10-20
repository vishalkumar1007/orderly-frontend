<script lang="ts">
	import { onMount } from 'svelte';
	import Robot from '@tabler/icons-svelte/icons/robot';
	import Trash from '@tabler/icons-svelte/icons/trash';
	import Pencil from '@tabler/icons-svelte/icons/pencil';
	import { ApiClientError } from '$lib/api/client';
	import { formatRelative } from '$lib/admin/format';
	import ConfirmDialog from '$lib/components/admin/ConfirmDialog.svelte';
	import FormField from '$lib/components/admin/FormField.svelte';
	import Modal from '$lib/components/admin/Modal.svelte';
	import SelectField from '$lib/components/admin/SelectField.svelte';
	import StatusBadge from '$lib/components/admin/StatusBadge.svelte';
	import Switch from '$lib/components/admin/Switch.svelte';
	import TextArea from '$lib/components/admin/TextArea.svelte';
	import TextInput from '$lib/components/admin/TextInput.svelte';
	import { toast } from '$lib/components/admin/toast';
	import MarketingTabs from '$lib/components/tenant/MarketingTabs.svelte';
	import {
		CHANNEL_LABEL,
		marketingApi,
		type AutomationRule,
		type Channel,
		type ChannelState,
		type MarketingLink,
		type Offer,
		type Platform,
		type RuleInput,
		type RuleTemplate,
		type Trigger
	} from '$lib/tenant/marketingApi';

	/**
	 * Automations: a small set of rules the engine evaluates every minute.
	 * Each run becomes a campaign in the campaign list, so there is one place
	 * to see what went out, automated or not.
	 */

	let rules = $state<AutomationRule[]>([]);
	let templates = $state<RuleTemplate[]>([]);
	let channels = $state<Record<Channel | Platform, ChannelState> | null>(null);
	let links = $state<MarketingLink[]>([]);
	let offers = $state<Offer[]>([]);
	let loading = $state(true);
	let loadError = $state('');

	async function load() {
		loadError = '';
		try {
			const [a, l, o] = await Promise.all([marketingApi.automations(), marketingApi.links(), marketingApi.offers()]);
			rules = a.rules ?? [];
			templates = a.templates ?? [];
			channels = a.channels;
			links = l.links ?? [];
			offers = (o.offers ?? []).filter((x) => x.active);
		} catch (err) {
			if (err instanceof ApiClientError && err.code === 'feature_not_in_plan') loadError = err.message;
			else loadError = err instanceof Error ? err.message : 'Could not load automations';
		} finally {
			loading = false;
		}
	}
	onMount(() => void load());

	const readyChannels = $derived(
		(['EMAIL', 'SMS', 'WHATSAPP'] as Channel[]).filter((c) => channels?.[c]?.ready)
	);

	/* ---------- form ---------- */

	const blank = (): RuleInput => ({
		name: '', trigger: 'WELCOME', enabled: true, channel: readyChannels[0] ?? 'EMAIL', delay_hours: 24, inactive_days: 45,
		cooldown_days: 30, quiet_start: 21, quiet_end: 9, subject: '', body: '', button_label: '', link_id: '', promotion_id: '',
		template_name: '', template_lang: 'en'
	});
	let formOpen = $state(false);
	let editing = $state<AutomationRule | null>(null);
	let form = $state<RuleInput>(blank());
	let formError = $state('');
	let saving = $state(false);

	function fromTemplate(t: RuleTemplate) {
		editing = null;
		form = { ...blank(), name: t.name, trigger: t.trigger, subject: t.subject, body: t.body, delay_hours: t.delay_hours ?? 24, inactive_days: t.inactive_days ?? 45 };
		formError = '';
		formOpen = true;
	}
	function openEdit(r: AutomationRule) {
		editing = r;
		form = {
			name: r.name, trigger: r.trigger, enabled: r.enabled, channel: r.channel, delay_hours: r.delay_hours, inactive_days: r.inactive_days,
			cooldown_days: r.cooldown_days, quiet_start: r.quiet_start, quiet_end: r.quiet_end, subject: r.subject, body: r.body,
			button_label: r.button_label, link_id: r.link_id ?? '', promotion_id: r.promotion_id ?? '', template_name: r.template_name, template_lang: r.template_lang
		};
		formError = '';
		formOpen = true;
	}

	async function save() {
		saving = true;
		formError = '';
		try {
			if (editing) await marketingApi.updateRule(editing.id, form);
			else await marketingApi.createRule(form);
			toast.success(editing ? 'Automation updated' : 'Automation created');
			formOpen = false;
			await load();
		} catch (err) {
			formError = err instanceof Error ? err.message : 'Could not save';
		} finally {
			saving = false;
		}
	}

	async function toggle(r: AutomationRule) {
		try {
			await marketingApi.setRuleEnabled(r.id, !r.enabled);
			await load();
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Could not update');
		}
	}

	let deleteTarget = $state<AutomationRule | null>(null);
	async function remove() {
		if (!deleteTarget) return;
		try {
			await marketingApi.deleteRule(deleteTarget.id);
			toast.success('Automation deleted');
			await load();
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Could not delete');
		} finally {
			deleteTarget = null;
		}
	}

	function when(r: AutomationRule): string {
		switch (r.trigger) {
			case 'WELCOME':
				return 'Within a week of a customer giving consent';
			case 'ORDER_FOLLOW_UP':
				return `${r.delay_hours} hours after a completed order`;
			case 'WIN_BACK':
				return `After ${r.inactive_days} days without a visit`;
		}
	}
	const hours = Array.from({ length: 24 }, (_, i) => ({ value: String(i), label: `${String(i).padStart(2, '0')}:00` }));
	const int = (s: string) => Number.parseInt(s, 10) || 0;
</script>

<div class="au-page">
	<MarketingTabs />

	{#if loadError}
		<div class="panel au-error" role="alert">
			<strong>Could not load automations.</strong>
			<span class="muted">{loadError}</span>
			<button type="button" class="btn btn-ghost btn-sm" onclick={load}>Try again</button>
		</div>
	{:else}
		<header class="au-head">
			<p class="muted au-lead">
				Messages that send themselves when something happens: a new customer, a completed order, a long silence.
				Each respects consent, quiet hours and a cooldown, and every run shows up under Campaigns.
			</p>
		</header>

		{#if channels && readyChannels.length === 0}
			<div class="panel au-note" role="status">
				No channel is connected yet. Set up email, SMS or WhatsApp under <a href="/shop/configuration">Configuration</a> first; rules you create will wait until one is ready.
			</div>
		{/if}

		<section class="au-section" aria-labelledby="au-templates">
			<h2 id="au-templates" class="au-h">Start from a template</h2>
			<div class="au-templates">
				{#each templates as t (t.trigger)}
					<button type="button" class="panel au-template" onclick={() => fromTemplate(t)}>
						<strong>{t.name}</strong>
						<span class="muted">{t.hint}</span>
					</button>
				{/each}
			</div>
		</section>

		<section class="panel panel-flush au-card" aria-labelledby="au-rules">
			<div class="au-card-head">
				<h2 id="au-rules" class="au-h">Your automations</h2>
			</div>
			{#if loading}
				<p class="muted au-pad">Loading…</p>
			{:else if rules.length === 0}
				<p class="muted au-pad">Nothing yet. Pick a template above.</p>
			{:else}
				<ul class="au-list">
					{#each rules as r (r.id)}
						<li class="au-row">
							<span class="au-main">
								<strong>{r.name}</strong>
								<span class="muted au-small">{when(r)} · {CHANNEL_LABEL[r.channel]} · quiet {String(r.quiet_start).padStart(2, '0')}:00 to {String(r.quiet_end).padStart(2, '0')}:00</span>
								<span class="muted au-small">
									{r.runs} {r.runs === 1 ? 'message' : 'messages'} all time, {r.runs_30d} in 30 days
									{#if r.last_run_at}· checked {formatRelative(r.last_run_at)}{/if}
								</span>
							</span>
							<StatusBadge status={r.enabled ? 'On' : 'Off'} kind={r.enabled ? 'ok' : 'neutral'} />
							<span class="au-actions">
								<button type="button" class="btn btn-quiet btn-sm" onclick={() => toggle(r)}>{r.enabled ? 'Pause' : 'Turn on'}</button>
								<button type="button" class="btn btn-quiet btn-sm" aria-label="Edit" title="Edit" onclick={() => openEdit(r)}><Pencil size={15} stroke={1.6} /></button>
								<button type="button" class="btn btn-quiet btn-sm" aria-label="Delete" title="Delete" onclick={() => (deleteTarget = r)}><Trash size={15} stroke={1.6} /></button>
							</span>
						</li>
					{/each}
				</ul>
			{/if}
		</section>
	{/if}
</div>

<Modal bind:open={formOpen} title={editing ? `Edit ${editing.name}` : 'New automation'}>
	<div class="au-form">
		<FormField label="Name" htmlFor="au-name" required>
			<TextInput id="au-name" bind:value={form.name} maxlength={120} />
		</FormField>
		<div class="au-grid">
			<FormField label="When" htmlFor="au-trigger">
				<SelectField id="au-trigger" bind:value={form.trigger} options={[
					{ value: 'WELCOME', label: 'A customer gives consent' },
					{ value: 'ORDER_FOLLOW_UP', label: 'An order is completed' },
					{ value: 'WIN_BACK', label: 'A customer goes quiet' }
				]} />
			</FormField>
			<FormField label="Channel" htmlFor="au-channel">
				<SelectField id="au-channel" bind:value={form.channel} options={(['EMAIL', 'SMS', 'WHATSAPP'] as Channel[]).map((c) => ({ value: c, label: CHANNEL_LABEL[c] + (channels?.[c]?.ready ? '' : ' (not connected)') }))} />
			</FormField>
			{#if form.trigger === 'ORDER_FOLLOW_UP'}
				<FormField label="Hours after completion" htmlFor="au-delay">
					<TextInput id="au-delay" type="number" min={0} max={720} value={String(form.delay_hours)} oninput={(e) => (form.delay_hours = int((e.target as HTMLInputElement).value))} />
				</FormField>
			{/if}
			{#if form.trigger === 'WIN_BACK'}
				<FormField label="Days without a visit" htmlFor="au-inactive">
					<TextInput id="au-inactive" type="number" min={1} max={365} value={String(form.inactive_days)} oninput={(e) => (form.inactive_days = int((e.target as HTMLInputElement).value))} />
				</FormField>
			{/if}
			<FormField label="At most once every" htmlFor="au-cooldown" hint="Days, per customer">
				<TextInput id="au-cooldown" type="number" min={0} max={365} value={String(form.cooldown_days)} oninput={(e) => (form.cooldown_days = int((e.target as HTMLInputElement).value))} />
			</FormField>
			<FormField label="Quiet from" htmlFor="au-qs" hint="Business clock">
				<SelectField id="au-qs" value={String(form.quiet_start)} options={hours} onchange={(v) => (form.quiet_start = int(v))} />
			</FormField>
			<FormField label="Quiet until" htmlFor="au-qe">
				<SelectField id="au-qe" value={String(form.quiet_end)} options={hours} onchange={(v) => (form.quiet_end = int(v))} />
			</FormField>
		</div>
		{#if form.channel === 'EMAIL'}
			<FormField label="Subject" htmlFor="au-subject" required>
				<TextInput id="au-subject" bind:value={form.subject} maxlength={200} />
			</FormField>
		{/if}
		{#if form.channel === 'WHATSAPP'}
			<div class="au-grid">
				<FormField label="Approved template name" htmlFor="au-tpl" required hint={"From WhatsApp Manager. The message below fills {{1}}."}>
					<TextInput id="au-tpl" bind:value={form.template_name} placeholder="promo_update_v1" />
				</FormField>
				<FormField label="Template language" htmlFor="au-lang">
					<TextInput id="au-lang" bind:value={form.template_lang} placeholder="en" maxlength={10} />
				</FormField>
			</div>
		{/if}
		<FormField label="Message" htmlFor="au-body" required hint={"You can use {{business_name}}, {{link}} and {{offer_code}}."}>
			<TextArea id="au-body" bind:value={form.body} rows={5} maxlength={4000} />
		</FormField>
		<div class="au-grid">
			<FormField label="Link" htmlFor="au-link" hint="A trackable link from the Overview.">
				<SelectField id="au-link" bind:value={form.link_id} options={[{ value: '', label: 'No link' }, ...links.map((l) => ({ value: l.id, label: l.label || l.target_path }))]} />
			</FormField>
			<FormField label="Offer" htmlFor="au-offer" hint={"Its code fills {{offer_code}}."}>
				<SelectField id="au-offer" bind:value={form.promotion_id} options={[{ value: '', label: 'No offer' }, ...offers.map((o) => ({ value: o.id, label: `${o.code}${o.name ? ' · ' + o.name : ''}` }))]} />
			</FormField>
			{#if form.channel === 'EMAIL' && form.link_id}
				<FormField label="Button label" htmlFor="au-button">
					<TextInput id="au-button" bind:value={form.button_label} placeholder="Book again" maxlength={60} />
				</FormField>
			{/if}
		</div>
		<Switch bind:checked={form.enabled} label="Turn on" hint="Off keeps the rule without sending." />
		{#if formError}<p class="field-error" role="alert">{formError}</p>{/if}
	</div>
	{#snippet footer()}
		<button type="button" class="btn btn-ghost" onclick={() => (formOpen = false)}>Cancel</button>
		<button type="button" class="btn btn-primary" disabled={saving || !form.name.trim() || !form.body.trim()} onclick={save}>{saving ? 'Saving…' : editing ? 'Save' : 'Create'}</button>
	{/snippet}
</Modal>

<ConfirmDialog
	open={deleteTarget !== null}
	title="Delete this automation?"
	message="Messages already sent are kept under Campaigns. Nothing further will be sent."
	confirmLabel="Delete"
	danger
	onconfirm={remove}
/>

<style>
	.au-page { display: grid; gap: 1rem; }
	.au-lead { margin: 0; font-size: var(--fs-body); line-height: 1.5; max-width: 46rem; }
	.au-h { margin: 0; font-size: var(--fs-body); font-weight: 600; }
	.au-small { font-size: var(--fs-meta); }
	.au-section { display: grid; gap: 0.6rem; }
	.au-templates { display: grid; grid-template-columns: repeat(auto-fill, minmax(14rem, 1fr)); gap: 0.75rem; }
	.au-template { display: grid; gap: 0.25rem; padding: 0.9rem 1rem; text-align: left; color: inherit; font: inherit; cursor: pointer; }
	.au-template:hover { border-color: var(--accent, #4f46e5); }
	.au-template .muted { font-size: var(--fs-meta); line-height: 1.4; }
	.au-card { display: grid; gap: 0.5rem; }
	.au-card-head { display: flex; align-items: center; justify-content: space-between; padding: 0.9rem 1rem 0.4rem; }
	.au-pad { padding: 0.25rem 1rem 1rem; margin: 0; }
	.au-list { list-style: none; margin: 0; padding: 0; }
	.au-row { display: flex; align-items: center; gap: 0.75rem; padding: 0.7rem 1rem; border-top: 1px solid var(--border, color-mix(in srgb, var(--text) 10%, transparent)); }
	.au-main { display: grid; gap: 0.1rem; min-width: 0; flex: 1; }
	.au-actions { display: flex; gap: 0.15rem; }
	.au-form { display: grid; gap: 0.9rem; }
	.au-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(11rem, 1fr)); gap: 0.75rem; }
	.au-note, .au-error { padding: 0.9rem 1rem; line-height: 1.5; }
	.au-error { display: flex; flex-wrap: wrap; align-items: center; gap: 0.75rem; }
	.field-error { margin: 0; }
</style>
