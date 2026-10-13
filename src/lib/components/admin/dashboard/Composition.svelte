<script lang="ts">
	import Skeleton from '../Skeleton.svelte';

	/**
	 * How the estate splits by state: one thin proportional bar and a count per
	 * state. A donut spends a lot of ink to say what a bar and three numbers say
	 * faster.
	 */
	let {
		total,
		active,
		suspended,
		loading = false
	}: { total: number; active: number; suspended: number; loading?: boolean } = $props();

	const other = $derived(Math.max(total - active - suspended, 0));
	const rows = $derived([
		{ label: 'Active', value: active, color: 'var(--success)', href: '/superadmin/businesses?status=ACTIVE' },
		{ label: 'Suspended', value: suspended, color: 'var(--danger)', href: '/superadmin/businesses?status=SUSPENDED' },
		{ label: 'Other', value: other, color: 'var(--text-3)', href: '/superadmin/businesses' }
	]);
	const pct = (n: number) => (total ? Math.round((n / total) * 100) : 0);
</script>

<section class="panel">
	<header class="ph"><h3>Business status</h3><span class="meta">{total} total</span></header>
	{#if loading}
		<Skeleton height="6rem" />
	{:else}
		<div class="bar" role="img" aria-label={rows.map((r) => `${r.label} ${r.value}`).join(', ')}>
			{#each rows.filter((r) => r.value > 0) as r (r.label)}
				<span style={`flex:${r.value};background:${r.color}`}></span>
			{/each}
		</div>
		<ul class="rows">
			{#each rows as r (r.label)}
				<li>
					<a href={r.href}>
						<span class="dot" style={`background:${r.color}`}></span>
						<span class="name">{r.label}</span>
						<span class="share">{pct(r.value)}%</span>
						<span class="count">{r.value}</span>
					</a>
				</li>
			{/each}
		</ul>
	{/if}
</section>

<style>
	.ph {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		margin-bottom: var(--sp-6);
	}

	h3 {
		margin: 0;
		font-size: var(--fs-body);
		font-weight: 600;
		color: var(--text);
	}

	.meta {
		font-size: var(--fs-meta);
		color: var(--text-3);
	}

	.bar {
		display: flex;
		gap: 2px;
		height: 6px;
		margin-bottom: var(--sp-6);
		overflow: hidden;
		border-radius: 3px;
	}

	.bar span {
		min-width: 3px;
	}

	.rows {
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.rows a {
		display: flex;
		align-items: center;
		gap: var(--sp-5);
		height: 32px;
		margin: 0 calc(var(--sp-4) * -1);
		padding: 0 var(--sp-4);
		border-radius: var(--radius-sm);
		color: inherit;
		text-decoration: none;
		font-size: var(--fs-body);
	}

	.rows a:hover {
		background: var(--surface-hover);
	}

	.dot {
		width: 7px;
		height: 7px;
		border-radius: 50%;
		flex-shrink: 0;
	}

	.name {
		flex: 1;
		color: var(--text-2);
	}

	.share {
		font-size: var(--fs-meta);
		color: var(--text-3);
		font-variant-numeric: tabular-nums;
	}

	.count {
		min-width: 2.2rem;
		text-align: right;
		font-weight: 600;
		color: var(--text);
		font-variant-numeric: tabular-nums;
	}
</style>
