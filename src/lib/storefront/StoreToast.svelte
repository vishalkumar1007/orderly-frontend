<script lang="ts">
	/**
	 * A transient confirmation, shown after an item is added to the cart.
	 *
	 * It lives here rather than inline in the layout so the layout template stays
	 * declarative, and so the "something happened" message is announced once
	 * instead of on every page that adds to the cart.
	 */
	let { message = '' }: { message?: string } = $props();
</script>

{#if message}
	<!--
		`aria-live="polite"` rather than an alert: adding to a cart is feedback, not
		an interruption, and a screen reader should not interrupt itself over it.
	-->
	<div class="sf-toast" role="status" aria-live="polite">{message}</div>
{/if}
