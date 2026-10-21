<script lang="ts">
	import Volume from '@tabler/icons-svelte/icons/volume';
	import VolumeOff from '@tabler/icons-svelte/icons/volume-off';
	import { setSoundEnabled, soundState, unlockSound } from '$lib/sound.svelte';

	/**
	 * Sound on / off for alerts, next to the theme toggle.
	 *
	 * Two states collapse into one control: the person's own preference
	 * (remembered per browser) and the browser's autoplay lock. While locked,
	 * the first click unlocks audio inside that gesture and leaves sound on;
	 * after that it simply flips the preference.
	 */
	const off = $derived(!soundState.enabled || soundState.locked);
	const title = $derived(
		!soundState.supported
			? 'This browser cannot play sounds'
			: soundState.locked
				? 'Turn on sound'
				: soundState.enabled
					? 'Sound is on'
					: 'Sound is off'
	);

	function onToggle() {
		if (soundState.locked) {
			setSoundEnabled(true);
			unlockSound();
			return;
		}
		setSoundEnabled(!soundState.enabled);
	}
</script>

<button
	type="button"
	class="btn btn-ghost topbar-icon"
	class:topbar-icon-attention={soundState.locked && soundState.enabled}
	aria-label={title}
	aria-pressed={!off}
	{title}
	disabled={!soundState.supported}
	onclick={onToggle}
>
	{#if off}
		<VolumeOff size={18} stroke={1.7} />
	{:else}
		<Volume size={18} stroke={1.7} />
	{/if}
</button>
