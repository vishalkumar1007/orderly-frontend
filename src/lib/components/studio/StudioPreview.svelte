<script lang="ts">
	import Smartphone from '@lucide/svelte/icons/smartphone';
	import Monitor from '@lucide/svelte/icons/monitor';
	import ExternalLink from '@lucide/svelte/icons/external-link';
	import RefreshCw from '@lucide/svelte/icons/refresh-cw';
	import Minus from '@lucide/svelte/icons/minus';
	import Plus from '@lucide/svelte/icons/plus';
	import type { AdminStorefront } from '$lib/storefront/admin';

	let { config }: { config: AdminStorefront } = $props();

	type Mode = 'phone' | 'desktop';

	const PHONE_PRESETS = [
		{ id: 'iphone-se', label: 'iPhone SE', width: 375, height: 667 },
		{ id: 'iphone-14', label: 'iPhone 14', width: 390, height: 844 },
		{ id: 'iphone-14-pro-max', label: 'iPhone 14 Pro Max', width: 430, height: 932 },
		{ id: 'pixel-7', label: 'Pixel 7', width: 412, height: 915 },
		{ id: 'galaxy-s20', label: 'Galaxy S20', width: 360, height: 800 },
		{ id: 'galaxy-fold', label: 'Galaxy Fold', width: 280, height: 653 }
	] as const;

	const DESKTOP_PRESETS = [
		{ id: 'laptop', label: 'Laptop', width: 1280, height: 800 },
		{ id: 'desktop', label: 'Desktop', width: 1440, height: 900 },
		{ id: 'wide', label: 'Wide', width: 1536, height: 960 }
	] as const;

	type PhoneId = (typeof PHONE_PRESETS)[number]['id'];
	type DesktopId = (typeof DESKTOP_PRESETS)[number]['id'];

	const MSG_READY = 'orderly-studio-preview-ready';
	const MSG_DRAFT = 'orderly-studio-draft';
	const FRAME_PATH = '/shop/customize/preview-frame?fullscreen=1';

	let mode = $state<Mode>('phone');
	let phoneId = $state<PhoneId>('iphone-14');
	let desktopId = $state<DesktopId>('laptop');
	let scalePct = $state(90);
	let frameKey = $state(0);
	let loading = $state(true);
	let frameReady = $state(false);
	let stageEl = $state<HTMLDivElement | null>(null);
	let iframeEl = $state<HTMLIFrameElement | null>(null);
	let stageW = $state(0);
	let stageH = $state(0);

	const phone = $derived(PHONE_PRESETS.find((p) => p.id === phoneId) ?? PHONE_PRESETS[1]);
	const desktop = $derived(DESKTOP_PRESETS.find((p) => p.id === desktopId) ?? DESKTOP_PRESETS[0]);

	const liveUrl = $derived((config.public_url || '').replace(/\/$/, ''));
	const iframeSrc = $derived(`${FRAME_PATH}&k=${frameKey}`);

	const vpW = $derived(mode === 'phone' ? phone.width : desktop.width);
	const vpH = $derived(mode === 'phone' ? phone.height : desktop.height);

	const fitScale = $derived.by(() => {
		if (stageW < 8 || stageH < 8) return 1;
		return Math.min(stageW / vpW, stageH / vpH);
	});

	/** 100% is the largest size that still shows the whole device, edges touching the pane. */
	const scale = $derived(fitScale * (scalePct / 100));

	function bumpScale(delta: number) {
		scalePct = Math.min(130, Math.max(50, scalePct + delta));
	}

	function reloadPreview() {
		loading = true;
		frameReady = false;
		frameKey += 1;
	}

	function pushDraft(target: Window | null | undefined = iframeEl?.contentWindow) {
		if (!target || !frameReady) return;
		try {
			target.postMessage(
				{ type: MSG_DRAFT, draft: structuredClone(config) },
				window.location.origin
			);
		} catch {
			target.postMessage(
				{ type: MSG_DRAFT, draft: JSON.parse(JSON.stringify(config)) },
				window.location.origin
			);
		}
	}

	function onFrameLoad() {
		/* Ready handshake comes from the frame via postMessage. */
	}

	$effect(() => {
		const onMessage = (event: MessageEvent) => {
			if (event.origin !== window.location.origin) return;
			const data = event.data;
			if (!data || typeof data !== 'object' || !('type' in data)) return;
			if ((data as { type: string }).type !== MSG_READY) return;
			frameReady = true;
			loading = false;
			pushDraft(event.source as Window);
		};
		window.addEventListener('message', onMessage);
		return () => window.removeEventListener('message', onMessage);
	});

	$effect(() => {
		config;
		if (!frameReady) return;
		pushDraft();
	});

	$effect(() => {
		const el = stageEl;
		if (!el || typeof ResizeObserver === 'undefined') return;
		const ro = new ResizeObserver((entries) => {
			const r = entries[0]?.contentRect;
			if (!r) return;
			stageW = r.width;
			stageH = r.height;
		});
		ro.observe(el);
		stageW = el.clientWidth;
		stageH = el.clientHeight;
		return () => ro.disconnect();
	});

	$effect(() => {
		const stage = stageEl;
		if (!stage) return;
		const onWheel = (event: WheelEvent) => {
			const frame = iframeEl;
			const shell = frame?.contentDocument?.querySelector('.studio-preview-shell');
			if (!frame || !(shell instanceof HTMLElement)) return;
			if (event.target === frame) return;
			const rect = frame.getBoundingClientRect();
			const overFrame =
				event.clientX >= rect.left &&
				event.clientX <= rect.right &&
				event.clientY >= rect.top &&
				event.clientY <= rect.bottom;
			if (!overFrame || shell.scrollHeight <= shell.clientHeight + 1) return;
			event.preventDefault();
			shell.scrollTop += event.deltaY;
		};
		stage.addEventListener('wheel', onWheel, { passive: false });
		return () => stage.removeEventListener('wheel', onWheel);
	});
</script>

<div class="studio-preview-pane">
	<div class="studio-preview-bar">
		<div class="studio-preview-bar-main">
			<div class="studio-mode-switch" role="radiogroup" aria-label="Preview mode">
				<button
					type="button"
					class="studio-mode-btn"
					class:active={mode === 'phone'}
					role="radio"
					aria-checked={mode === 'phone'}
					onclick={() => (mode = 'phone')}
				>
					<Smartphone size={15} strokeWidth={2} />
					<span>Phone</span>
				</button>
				<button
					type="button"
					class="studio-mode-btn"
					class:active={mode === 'desktop'}
					role="radio"
					aria-checked={mode === 'desktop'}
					onclick={() => (mode = 'desktop')}
				>
					<Monitor size={15} strokeWidth={2} />
					<span>Web</span>
				</button>
			</div>

			{#if mode === 'phone'}
				<label class="studio-preset">
					<span class="sr-only">Phone size</span>
					<select bind:value={phoneId} aria-label="Phone screen size">
						{#each PHONE_PRESETS as p (p.id)}
							<option value={p.id}>{p.label} ({p.width}×{p.height})</option>
						{/each}
					</select>
				</label>
			{:else}
				<label class="studio-preset">
					<span class="sr-only">Desktop size</span>
					<select bind:value={desktopId} aria-label="Desktop screen size">
						{#each DESKTOP_PRESETS as p (p.id)}
							<option value={p.id}>{p.label} ({p.width}×{p.height})</option>
						{/each}
					</select>
				</label>
			{/if}
		</div>

		<div class="studio-preview-bar-tools">
			<div class="studio-scale" title="Preview zoom">
				<span>Size</span>
				<button
					type="button"
					class="studio-scale-btn"
					onclick={() => bumpScale(-5)}
					disabled={scalePct <= 50}
					aria-label="Decrease preview size"
				>
					<Minus size={14} strokeWidth={2.4} />
				</button>
				<span class="studio-scale-val">{scalePct}%</span>
				<button
					type="button"
					class="studio-scale-btn"
					onclick={() => bumpScale(5)}
					disabled={scalePct >= 130}
					aria-label="Increase preview size"
				>
					<Plus size={14} strokeWidth={2.4} />
				</button>
			</div>

			<div class="studio-preview-actions">
				<button type="button" class="studio-link-btn" onclick={reloadPreview} title="Reload preview">
					<RefreshCw size={13} strokeWidth={2} />
				</button>
				{#if liveUrl}
					<a
						class="studio-link-btn"
						href={liveUrl}
						target="_blank"
						rel="noopener"
						title="Open published store"
					>
						<ExternalLink size={13} strokeWidth={2} />
					</a>
				{/if}
			</div>
		</div>
	</div>

	<div
		class="studio-preview-stage"
		class:is-phone={mode === 'phone'}
		class:is-web={mode === 'desktop'}
		bind:this={stageEl}
	>
		<div class="viewport-scale-wrap" style="width: {vpW}px; height: {vpH}px; zoom: {scale};">
			<div
				class="device-viewport"
				class:is-phone={mode === 'phone'}
				class:is-web={mode === 'desktop'}
			>
				<div class="device-screen">
					{#if loading}
						<div class="frame-loading">Loading…</div>
					{/if}
					<iframe
						bind:this={iframeEl}
						title="Storefront draft preview"
						src={iframeSrc}
						class="preview-iframe"
						onload={onFrameLoad}
					></iframe>
				</div>
			</div>
		</div>
	</div>
</div>

<style>
	.studio-preview-pane {
		display: flex;
		flex-direction: column;
		height: 100%;
		min-height: 0;
	}

	.studio-preview-bar {
		flex: none;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.55rem 0.75rem;
		padding: 0.5rem 0.75rem;
		border-bottom: 1px solid var(--border);
		background: var(--surface);
		flex-wrap: wrap;
	}

	.studio-preview-bar-main,
	.studio-preview-bar-tools {
		display: flex;
		align-items: center;
		gap: 0.55rem;
		min-width: 0;
		flex-wrap: wrap;
	}

	.studio-preview-bar-main {
		flex: 1 1 auto;
	}

	.studio-preview-bar-tools {
		flex: 0 1 auto;
		margin-left: auto;
	}

	.studio-mode-switch {
		display: inline-flex;
		gap: 0.15rem;
		padding: 0.15rem;
		border-radius: 8px;
		background: var(--surface-2);
		border: 1px solid var(--border);
		flex: none;
	}

	.studio-mode-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		padding: 0.28rem 0.55rem;
		border: none;
		border-radius: 6px;
		background: transparent;
		color: var(--text-2);
		font: inherit;
		font-size: var(--fs-meta);
		font-weight: 600;
		cursor: pointer;
		white-space: nowrap;
	}

	.studio-mode-btn.active {
		background: var(--surface);
		color: var(--text);
		box-shadow: var(--shadow-sm, 0 1px 2px rgba(0, 0, 0, 0.08));
	}

	.studio-preset {
		min-width: 0;
		flex: 1 1 9rem;
		max-width: 14rem;
	}

	.studio-preset select {
		width: 100%;
		font: inherit;
		font-size: var(--fs-meta);
		font-weight: 600;
		color: var(--text);
		background: var(--surface-2);
		border: 1px solid var(--border);
		border-radius: 8px;
		padding: 0.3rem 0.5rem;
	}

	.studio-scale {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		font-size: var(--fs-meta);
		font-weight: 600;
		color: var(--text-3);
		flex: none;
	}

	.studio-scale-btn {
		display: inline-grid;
		place-items: center;
		width: 1.7rem;
		height: 1.7rem;
		padding: 0;
		border-radius: 7px;
		border: 1px solid var(--border);
		background: var(--surface-2);
		color: var(--text-2);
		cursor: pointer;
	}

	.studio-scale-btn:hover:not(:disabled) {
		color: var(--accent);
		border-color: color-mix(in srgb, var(--accent) 40%, var(--border));
	}

	.studio-scale-btn:disabled {
		opacity: 0.4;
		cursor: default;
	}

	.studio-scale-val {
		min-width: 2.6rem;
		text-align: center;
		font-variant-numeric: tabular-nums;
		color: var(--text-2);
	}

	.studio-preview-actions {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		flex: none;
	}

	.studio-link-btn {
		display: inline-grid;
		place-items: center;
		width: 1.85rem;
		height: 1.85rem;
		border-radius: 8px;
		border: 1px solid var(--border);
		background: var(--surface-2);
		color: var(--text-2);
		text-decoration: none;
		cursor: pointer;
		padding: 0;
	}

	.studio-link-btn:hover {
		color: var(--accent);
		border-color: color-mix(in srgb, var(--accent) 40%, var(--border));
	}

	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		border: 0;
	}

	@media (max-width: 420px) {
		.studio-preview-bar {
			padding: 0.45rem 0.55rem;
		}

		.studio-preview-bar-main,
		.studio-preview-bar-tools {
			width: 100%;
		}

		.studio-preview-bar-tools {
			margin-left: 0;
			justify-content: space-between;
		}

		.studio-preset {
			flex: 1 1 auto;
			max-width: none;
		}

		.studio-mode-btn span {
			display: none;
		}
	}

	.studio-preview-stage {
		flex: 1;
		min-height: 0;
		overflow: auto;
		overscroll-behavior: contain;
		display: flex;
		padding: 0;
		background: var(--bg);
	}

	.viewport-scale-wrap {
		flex: none;
		margin: auto;
	}

	.device-viewport {
		position: relative;
		width: 100%;
		height: 100%;
		display: flex;
		flex-direction: column;
		background: transparent;
		border: none;
		outline: none;
		border-radius: 12px;
		overflow: hidden;
	}

	/* Barely-there light edge so the screen reads against the themed stage. */
	.device-viewport::after {
		content: '';
		position: absolute;
		inset: 0;
		z-index: 4;
		border-radius: inherit;
		border: 1px solid rgba(255, 255, 255, 0.22);
		box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--text) 7%, transparent);
		pointer-events: none;
	}

	.device-viewport.is-phone {
		border-radius: 18px;
	}

	.device-viewport.is-web {
		border-radius: 10px;
	}

	.device-screen {
		position: absolute;
		inset: 0;
		background: transparent;
		overflow: hidden;
		border-radius: inherit;
	}

	.preview-iframe {
		position: absolute;
		inset: 0;
		display: block;
		width: 100%;
		height: 100%;
		border: 0;
		outline: none;
		background: transparent;
		margin: 0;
		pointer-events: auto;
	}

	.frame-loading {
		position: absolute;
		inset: 0;
		z-index: 2;
		display: grid;
		place-items: center;
		background: var(--bg);
		color: var(--text-3);
		font-size: var(--fs-meta);
		font-weight: 600;
		pointer-events: none;
	}
</style>
