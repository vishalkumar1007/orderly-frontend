<script lang="ts">
	import { onMount } from 'svelte';
	import RefreshCw from '@lucide/svelte/icons/refresh-cw';

	let status = $state<'loading' | 'ok' | 'degraded'>('loading');
	let detail = $state('');

	async function check() {
		status = 'loading';
		try {
			const res = await fetch('/health/ready');
			if (res.ok) {
				status = 'ok';
				detail = 'API ready';
			} else {
				status = 'degraded';
				detail = 'Readiness failed';
			}
		} catch {
			status = 'degraded';
			detail = 'API unreachable';
		}
	}

	onMount(check);
</script>

<div class="status-strip">
	<div class="status-item">
		<span
			class={['status-dot', status === 'ok' ? 'ok' : status === 'degraded' ? 'bad' : ''].join(' ')}
		></span>
		<strong style="color:var(--text);font-weight:550;">API</strong>
		<span class="muted">{status === 'loading' ? 'Checking…' : detail}</span>
	</div>
	<div class="status-item status-strip-end">
		<button type="button" class="btn btn-quiet btn-sm" onclick={check}>
			<RefreshCw size={13} strokeWidth={2} class={status === 'loading' ? 'spin' : ''} />
			Refresh
		</button>
	</div>
</div>
