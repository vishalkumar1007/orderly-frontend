<script lang="ts">
	import Skeleton from './Skeleton.svelte';
</script>

<div class="shell">
	<div class="rail" aria-hidden="true">
		<div class="rail-head">
			<Skeleton height="0.8rem" width="5.5rem" />
		</div>
		<div class="rail-nav">
			{#each [1, 2, 3, 4, 5] as _, i (i)}
				<Skeleton height="1.9rem" />
			{/each}
		</div>
		<div class="rail-foot">
			<Skeleton height="1.9rem" />
		</div>
	</div>

	<div class="main">
		<div class="topbar">
			<div class="topbar-left">
				<Skeleton height="0.65rem" width="4.5rem" />
				<Skeleton height="0.85rem" width="9rem" />
			</div>
			<div class="topbar-actions">
				<Skeleton height="2.2rem" width="2.2rem" />
			</div>
		</div>
		<div class="content">
			<div class="stat-row">
				{#each [1, 2, 3, 4] as _, i (i)}
					<Skeleton height="5.5rem" />
				{/each}
			</div>
			<div class="grid-2">
				<Skeleton height="16rem" />
				<Skeleton height="16rem" />
			</div>
		</div>
	</div>
</div>
