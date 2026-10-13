<script lang="ts">
	import { onMount } from 'svelte';
	import { fetchDashboard, fetchSystemHealth } from '$lib/admin/api';
	import { errorLines } from '$lib/admin/errors';
	import { healthCheckMessage, healthSummary } from '$lib/admin/health';
	import { toast } from '$lib/components/admin/toast';
	import type { DashboardData, SystemHealth } from '$lib/admin/types';
	import ErrorState from '$lib/components/admin/ErrorState.svelte';
	import DashboardView from '$lib/components/admin/dashboard/DashboardView.svelte';

	/**
	 * The platform overview: loads the data, and hands it to the view. Everything
	 * here is the sum across every tenant; a tenant only ever sees its own numbers
	 * in its own console.
	 */
	let data = $state<DashboardData | null>(null);
	let health = $state<SystemHealth | null>(null);
	let loading = $state(true);
	let healthLoading = $state(true);
	let healthError = $state('');
	let error = $state('');

	async function load() {
		loading = true;
		error = '';
		try {
			data = await fetchDashboard();
		} catch (err) {
			error = errorLines(err, 'load the dashboard').detail;
			data = null;
		} finally {
			loading = false;
		}
	}

	/**
	 * @param manual true when the operator pressed refresh on the health panel. A
	 * check they asked for is confirmed, so pressing it on a healthy platform
	 * still tells them the API answered.
	 */
	async function loadHealth(manual = false) {
		healthLoading = true;
		healthError = '';
		try {
			health = await fetchSystemHealth();
			if (manual) {
				const summary = healthSummary(health);
				const message = healthCheckMessage(health);
				if (summary.tone === 'bad') toast.error(message);
				else if (summary.tone === 'warn') toast.info(message);
				else toast.success(message);
			}
		} catch (err) {
			// The rest of the dashboard still works, but an empty health panel
			// reads as "nothing wrong" when the truth is "nobody checked".
			const lines = errorLines(err, 'read system health');
			healthError = lines.detail;
			health = null;
			if (manual) toast.error(`${lines.title}. ${lines.detail}`);
		} finally {
			healthLoading = false;
		}
	}

	onMount(() => {
		void load();
		void loadHealth();
	});
</script>

{#if error}
	<div class="panel" style="margin-bottom:1rem;">
		<ErrorState message={error} onretry={load} />
	</div>
{/if}

<DashboardView
	{data}
	{health}
	{healthError}
	{healthLoading}
	{loading}
	onrefresh={() => {
		void load();
		void loadHealth();
	}}
	onrefreshhealth={() => void loadHealth(true)}
/>
