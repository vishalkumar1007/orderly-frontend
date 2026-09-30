<script lang="ts">
	let {
		status = '',
		kind = 'auto',
		dot = true
	}: {
		status?: string;
		kind?: 'auto' | 'ok' | 'warn' | 'danger' | 'neutral' | 'accent';
		/** Show the leading status dot. Turn off inside dense clusters. */
		dot?: boolean;
	} = $props();

	const tone = $derived.by(() => {
		if (kind !== 'auto') return kind;
		const s = String(status ?? '').toUpperCase();
		if (['ACTIVE', 'SUCCESS', 'OPERATIONAL', 'COMPLETED', 'PUBLISHED'].includes(s)) return 'ok';
		if (['TRIAL', 'INVITED', 'PENDING', 'IN_PROGRESS', 'DEGRADED', 'WARN'].includes(s))
			return 'warn';
		if (['SUSPENDED', 'DISABLED', 'FAILURE', 'DENIED', 'EXPIRED', 'CANCELLED', 'DOWN'].includes(s))
			return 'danger';
		if (['STARTER', 'BUSINESS', 'SUPER_ADMIN'].includes(s)) return 'accent';
		return 'neutral';
	});

	const label = $derived(status ? String(status).replaceAll('_', ' ') : '—');
</script>

<span class={['badge', `badge-${tone}`, dot ? '' : 'badge-plain'].join(' ').trim()}>{label}</span>
