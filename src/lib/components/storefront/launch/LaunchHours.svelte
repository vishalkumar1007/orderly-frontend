<script lang="ts">
	import Clock from '@lucide/svelte/icons/clock';
	import ExternalLink from '@lucide/svelte/icons/external-link';
	import './launch-shared.css';

	let {
		config
	}: {
		config: { hours: { label?: string; detail?: string; is_open?: boolean } };
	} = $props();
</script>

<div class="studio-content-grid">
	<div class="panel studio-section-intro">
		<div class="intro-icon-wrap">
			<Clock size={24} strokeWidth={1.8} />
		</div>
		<div>
			<h2 class="intro-h">Opening hours</h2>
			<p class="intro-p">Weekly schedule lives in Customize Studio — publish when you are ready.</p>
		</div>
	</div>

	<div class="panel hours-panel">
		<p class="section-note" style="margin:0 0 1rem;">
			Right now:
			<strong>{config.hours.is_open ? 'Open' : 'Closed'}</strong>
			{config.hours.detail ? ` · ${config.hours.detail}` : ''}
		</p>
		<a class="btn btn-primary" href="/shop/customize?section=ordering">
			<ExternalLink size={15} strokeWidth={2} />
			Edit hours in Customize
		</a>
	</div>
</div>

<style>
	.hours-panel {
		padding: 1.25rem 1.5rem;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: var(--radius-md, 12px);
	}
</style>
