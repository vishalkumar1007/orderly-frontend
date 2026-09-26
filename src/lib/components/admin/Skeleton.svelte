<script lang="ts">
	let {
		height = '1rem',
		width = '100%',
		class: className = ''
	}: {
		height?: string;
		width?: string;
		class?: string;
	} = $props();
</script>

<div class={`skeleton ${className}`} style={`height: ${height}; width: ${width};`}></div>
