<script lang="ts">
	import Info from '@tabler/icons-svelte/icons/info-circle';
	import TriangleAlert from '@tabler/icons-svelte/icons/alert-triangle';
	import {
		CONFIG_STATUS_LABEL,
		CONFIG_STATUS_TONE,
		type ConfigStatus
	} from '$lib/admin/configTypes';
	import StatusBadge from './StatusBadge.svelte';

	let {
		status = 'UNCONFIGURED',
		enabled = false,
		compact = false
	}: {
		status?: ConfigStatus;
		enabled?: boolean;
		compact?: boolean;
	} = $props();

	// A row that failed its last test reads as a failure even if it is switched
	// on, because that is what the operator needs to act on. A passing row that
	// is switched off reads as off: the last test result says nothing about use.
	const shown = $derived<ConfigStatus>(
		(status === 'ENABLED' || status === 'CONFIGURED') && !enabled ? 'DISABLED' : status
	);
</script>

<span class="cfg-status" class:compact>
	<StatusBadge status={shown} kind={CONFIG_STATUS_TONE[shown]} />
	{#if !compact && shown === 'ENABLED'}
		<span class="cfg-note ok"><Info size={12} stroke={1.6} /> Active</span>
	{:else if !compact && shown === 'CONFIGURED'}
		<span class="cfg-note">Saved, not enabled</span>
	{:else if !compact && status === 'CONNECTION_FAILED'}
		<span class="cfg-note bad"><TriangleAlert size={12} stroke={1.6} /> Check settings</span>
	{:else if !compact && shown === 'DISABLED'}
		<span class="cfg-note">Switched off</span>
	{:else if !compact && status === 'UNCONFIGURED'}
		<span class="cfg-note">{enabled ? 'Not set up' : 'Not set up'}</span>
	{/if}
</span>

<style>
	.cfg-status {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		flex-wrap: wrap;
	}

	.cfg-note {
		display: inline-flex;
		align-items: center;
		gap: 0.2rem;
		font-size: var(--fs-code);
		color: var(--text-3);
	}

	.cfg-note.ok {
		color: var(--ok, #059669);
	}

	.cfg-note.bad {
		color: var(--danger, #dc2626);
	}
</style>
