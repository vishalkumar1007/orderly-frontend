<script lang="ts">
	/**
	 * How customers sign in, tied to Configuration. Each method needs its
	 * channel set up first (phone codes go by SMS, email codes by email), so a
	 * method whose channel is missing cannot be switched on and links to where
	 * it is set up. Customers only ever see methods that are on and ready.
	 */
	import MessageSquare from '@tabler/icons-svelte/icons/message';
	import Mail from '@tabler/icons-svelte/icons/mail';
	import Toggle from '$lib/components/config/Toggle.svelte';
	import { configHref } from '$lib/tenant/configuration';
	import type { SignInChannel } from '$lib/storefront/admin';
	import type { SignInMethod } from '$lib/storefront/api';

	let {
		methods,
		channels,
		mode,
		onchange
	}: {
		/** The methods the owner has switched on. */
		methods: SignInMethod[];
		/** Whether SMS and email are set up. Missing while the screen loads. */
		channels?: Partial<Record<SignInMethod, SignInChannel>>;
		mode: 'off' | 'optional' | 'required';
		onchange: (methods: SignInMethod[]) => void;
	} = $props();

	const ROWS = [
		{ id: 'PHONE' as const, label: 'Phone number', channel: 'SMS', service: 'SMS', icon: MessageSquare, how: 'A 6-digit code by text message.' },
		{ id: 'EMAIL' as const, label: 'Email address', channel: 'email', service: 'SMTP', icon: Mail, how: 'A 6-digit code by email.' }
	];

	const ready = (m: SignInMethod) => Boolean(channels?.[m]?.ready);
	const offered = $derived(methods.filter(ready));

	function status(m: SignInMethod, channel: string) {
		const c = channels?.[m];
		if (!channels) return 'Checking…';
		if (!c?.ready) return `${channel === 'SMS' ? 'SMS' : 'Email'} is not set up yet`;
		if (c.source === 'TENANT') return `Ready, using your own ${channel} account`;
		if (c.source === 'PLATFORM') return `Ready, using Orderly's ${channel} service`;
		return 'Ready';
	}

	function toggle(m: SignInMethod, on: boolean) {
		const next = on ? [...new Set([...methods, m])] : methods.filter((x) => x !== m);
		onchange((['PHONE', 'EMAIL'] as const).filter((x) => next.includes(x)));
	}
</script>

<div class="sim" aria-label="Sign-in methods">
	{#each ROWS as row (row.id)}
		{@const on = methods.includes(row.id) && ready(row.id)}
		<div class="sim-row" class:sim-off={!ready(row.id)}>
			<span class="sim-icon" aria-hidden="true"><row.icon size={18} stroke={1.6} /></span>
			<div class="sim-text">
				<span class="sim-label">{row.label}</span>
				<span class="sim-how">{row.how}</span>
				<span class="sim-status" data-ready={ready(row.id)}>
					{status(row.id, row.channel)}
					{#if channels && !ready(row.id)}
						<a href={configHref('integrations', `service=${row.service}`)}>Set up {row.channel === 'SMS' ? 'SMS' : 'email'}</a>
					{/if}
				</span>
			</div>
			<Toggle
				id={`sim-${row.id}`}
				label={`Let customers sign in with their ${row.label.toLowerCase()}`}
				checked={on}
				disabled={!ready(row.id)}
				onchange={(v) => toggle(row.id, v)}
			/>
		</div>
	{/each}

	{#if channels && mode !== 'off' && offered.length === 0}
		<p class="sim-warn" role="status">
			Customers cannot sign in until at least one method is on and set up.
			{#if mode === 'required'}Until then, guests can still order.{/if}
		</p>
	{:else if channels && mode !== 'off'}
		<p class="sim-note">
			Customers will see: {offered.map((m) => (m === 'PHONE' ? 'phone' : 'email')).join(' or ')}.
		</p>
	{/if}
</div>

<style>
	.sim {
		display: grid;
		gap: 0.5rem;
	}
	.sim-row {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr) auto;
		align-items: center;
		gap: 0.75rem;
		padding: 0.75rem 0.85rem;
		border: 1px solid var(--border);
		border-radius: var(--radius);
		background: var(--surface);
	}
	.sim-icon {
		display: grid;
		place-items: center;
		width: 34px;
		height: 34px;
		border-radius: var(--radius-sm);
		background: var(--surface-2);
		color: var(--text-2);
	}
	.sim-text {
		display: grid;
		gap: 0.1rem;
		min-width: 0;
	}
	.sim-label {
		font-weight: 600;
		color: var(--text);
	}
	.sim-how {
		font-size: var(--fs-code);
		color: var(--text-3);
	}
	.sim-status {
		font-size: var(--fs-code);
		color: var(--warn);
	}
	.sim-status[data-ready='true'] {
		color: var(--success);
	}
	.sim-status a {
		margin-left: 0.35rem;
		color: var(--accent);
		font-weight: 600;
		text-decoration: none;
	}
	.sim-status a:hover {
		text-decoration: underline;
	}
	.sim-off .sim-label {
		color: var(--text-2);
	}
	.sim-warn {
		margin: 0.25rem 0 0;
		padding: 0.6rem 0.75rem;
		border-radius: var(--radius-sm);
		background: var(--warn-bg);
		color: var(--warn);
		font-size: var(--fs-tab);
	}
	.sim-note {
		margin: 0.25rem 0 0;
		color: var(--text-3);
		font-size: var(--fs-code);
	}
</style>
