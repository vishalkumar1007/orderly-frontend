<script lang="ts">
	import Modal from '$lib/components/admin/Modal.svelte';
	import { dismissPlanNotice, planNotice } from '$lib/tenant/entitlements.svelte';

	const notice = $derived(planNotice.current);
</script>

<Modal
	bind:open={() => notice !== null, (v) => !v && dismissPlanNotice()}
	title={notice?.title ?? ''}
>
	{#if notice}
		<p style="margin:0 0 0.75rem;">{notice.message}</p>
		{#if notice.usage}
			<p class="muted" style="margin:0 0 0.75rem;">{notice.usage}</p>
		{/if}
		<p class="muted" style="margin:0;">
			{#if notice.requiredPlan}
				Ask your platform administrator to move your business to the
				<strong>{notice.requiredPlan}</strong> plan.
			{:else}
				Ask your platform administrator to change your plan.
			{/if}
		</p>
	{/if}
	{#snippet footer()}
		<button type="button" class="btn btn-primary" onclick={dismissPlanNotice}>Got it</button>
	{/snippet}
</Modal>
