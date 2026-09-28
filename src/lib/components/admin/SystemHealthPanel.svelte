<script lang="ts">
	import { onMount } from 'svelte';
	import RefreshCw from '@lucide/svelte/icons/refresh-cw';
	import { fetchSystemHealth } from '$lib/admin/api';
	import { errorLines } from '$lib/admin/errors';
	import { healthCheckMessage, healthSummary } from '$lib/admin/health';
	import { toast } from '$lib/components/admin/toast';
	import { formatRelative } from '$lib/admin/format';
	import type { HealthComponent, SystemHealth } from '$lib/admin/types';
	import Skeleton from './Skeleton.svelte';

	/**
	 * Platform component status.
	 *
	 * `compact` renders the dashboard's summary strip; the full form is the
	 * monitoring screen. Both read the same endpoint, so the dashboard can never
	 * claim everything is fine while the monitoring page says otherwise.
	 */
	let {
		compact = false,
		health = null,
		loading = false,
		error = '',
		onrefresh
	}: {
		compact?: boolean;
		/** Supply data to render a parent's copy instead of fetching one. */
		health?: SystemHealth | null;
		loading?: boolean;
		error?: string;
		onrefresh?: () => void;
	} = $props();

	let ownHealth = $state<SystemHealth | null>(null);
	let ownLoading = $state(false);
	let ownError = $state('');
	const managed = $derived(health !== null || onrefresh !== undefined);

	const data = $derived(managed ? health : ownHealth);
	const busy = $derived(managed ? loading : ownLoading);
	const failure = $derived(managed ? error : ownError);

	async function load(manual = false) {
		ownLoading = true;
		ownError = '';
		try {
			ownHealth = await fetchSystemHealth();
			if (manual) {
				const message = healthCheckMessage(ownHealth);
				const tone = healthSummary(ownHealth).tone;
				if (tone === 'bad') toast.error(message);
				else if (tone === 'warn') toast.info(message);
				else toast.success(message);
			}
		} catch (err) {
			const lines = errorLines(err, 'read system health');
			ownError = lines.detail;
			ownHealth = null;
			if (manual) toast.error(`${lines.title}. ${lines.detail}`);
		} finally {
			ownLoading = false;
		}
	}

	onMount(() => {
		if (!managed) void load();
	});

	/**
	 * A parent that supplies the data owns the confirmation too — it knows
	 * whether its own load was a poll or a button press. Only the panel's
	 * self-managed path confirms for itself.
	 */
	function refresh() {
		if (onrefresh) onrefresh();
		else void load(true);
	}

	/** Dot class per status. Unavailable is grey, not red: it is not a fault. */
	function dotClass(status: string): string {
		switch (status) {
			case 'HEALTHY':
				return 'ok';
			case 'WARNING':
				return 'warn';
			case 'ERROR':
				return 'bad';
			default:
				return '';
		}
	}

	const summary = $derived(healthSummary(data));
	const headline = $derived(data ? summary.headline : '');

	/** Group rows for the full view, preserving the server's ordering. */
	const groups = $derived.by(() => {
		const rows = data?.components ?? [];
		const order: string[] = [];
		const byGroup = new Map<string, HealthComponent[]>();
		for (const row of rows) {
			const key = row.group || 'Platform';
			if (!byGroup.has(key)) {
				byGroup.set(key, []);
				order.push(key);
			}
			byGroup.get(key)!.push(row);
		}
		return order.map((key) => ({ label: key, rows: byGroup.get(key)! }));
	});
</script>

{#if compact}
	<div class="status-strip">
		{#if busy && !data}
			<div class="status-item"><Skeleton height="0.9rem" width="12rem" /></div>
		{:else if failure}
			<div class="status-item">
				<span class="status-dot bad"></span>
				<strong style="color:var(--text);font-weight:550;">System health</strong>
				<span class="muted">{failure}</span>
			</div>
		{:else if data}
			<div class="status-item">
				<span class={['status-dot', dotClass(String(data.status))].join(' ')}></span>
				<strong style="color:var(--text);font-weight:550;">{headline}</strong>
				<span class="muted">
					{summary.healthy} healthy · checked {formatRelative(data.checked_at)}
				</span>
			</div>
		{/if}
		<div class="status-item status-strip-end">
			<a class="btn btn-quiet btn-sm" href="/superadmin/health">Details</a>
			<button type="button" class="btn btn-quiet btn-sm" onclick={refresh}>
				<RefreshCw size={13} strokeWidth={2} class={busy ? 'spin' : ''} />
				Refresh
			</button>
		</div>
	</div>
{:else}
	<div class="health-groups">
		{#if busy && !data}
			{#each [1, 2] as _, i (i)}
				<Skeleton height="7rem" />
			{/each}
		{:else if failure}
			<div class="alert alert-danger">{failure}</div>
		{:else}
			{#each groups as group (group.label)}
				<section class="panel panel-flush">
					<div class="hp-head">
						<h3>{group.label}</h3>
					</div>
					<ul class="hp-rows">
						{#each group.rows as row (row.id)}
							<li class="hp-row">
								<span class={['status-dot', dotClass(String(row.status))].join(' ')}></span>
								<span class="hp-main">
									<strong>{row.name}</strong>
									<span>{row.detail}</span>
								</span>
								<span class="hp-meta">
									{#if row.latency_ms !== undefined}
										<span class="mono">{row.latency_ms} ms</span>
									{/if}
									<span class={['hp-status', dotClass(String(row.status)) || 'idle'].join(' ')}>
										{String(row.status).toLowerCase()}
									</span>
									{#if row.href}
										<a class="btn btn-quiet btn-sm" href={row.href}>Open</a>
									{/if}
								</span>
							</li>
						{/each}
					</ul>
				</section>
			{/each}
		{/if}
	</div>
{/if}

<style>
	.health-groups {
		display: flex;
		flex-direction: column;
		gap: 0.85rem;
	}

	.hp-head {
		padding: 0.85rem 1.25rem 0.5rem;
	}

	.hp-head h3 {
		margin: 0;
		font-size: 0.7rem;
		font-weight: 650;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--text-3);
	}

	.hp-rows {
		list-style: none;
		margin: 0;
		padding: 0 1.25rem 0.5rem;
	}

	.hp-row {
		display: flex;
		align-items: center;
		gap: 0.7rem;
		padding: 0.7rem 0;
		border-top: 1px solid var(--border-subtle);
	}

	.hp-row:first-child {
		border-top: 0;
	}

	.hp-main {
		display: flex;
		flex-direction: column;
		gap: 0.1rem;
		min-width: 0;
		flex: 1;
	}

	.hp-main strong {
		font-size: 0.86rem;
		font-weight: 550;
	}

	.hp-main span {
		font-size: 0.76rem;
		color: var(--text-3);
		line-height: 1.45;
	}

	.hp-meta {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		flex-shrink: 0;
		font-size: 0.72rem;
		color: var(--text-3);
	}

	.hp-status {
		text-transform: capitalize;
		font-weight: 600;
		color: var(--text-3);
	}

	.hp-status.ok {
		color: var(--success);
	}

	.hp-status.warn {
		color: var(--warn);
	}

	.hp-status.bad {
		color: var(--danger);
	}

	@media (max-width: 640px) {
		.hp-row {
			flex-wrap: wrap;
		}

		.hp-meta {
			width: 100%;
			padding-left: 1.4rem;
		}
	}
</style>
