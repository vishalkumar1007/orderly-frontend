<script lang="ts">
	import type { Snippet } from 'svelte';
	import IconArrowLeft from '@tabler/icons-svelte/icons/arrow-left';
	import IconArrowRight from '@tabler/icons-svelte/icons/arrow-right';
	import IconBuildingStore from '@tabler/icons-svelte/icons/building-store';
	import IconLoader from '@tabler/icons-svelte/icons/loader-2';
	import IconEye from '@tabler/icons-svelte/icons/eye';
	import IconEyeOff from '@tabler/icons-svelte/icons/eye-off';
	import IconX from '@tabler/icons-svelte/icons/x';
	import OnboardStepper from './OnboardStepper.svelte';

	let {
		steps = [] as { id: string; label: string; description?: string }[],
		step = 0,
		onstepselect,
		onback,
		onnext,
		oncreate,
		submitting = false,
		blocked = false,
		canfinish = true,
		stepValid = true,
		themeColors = { primary: '#5b4bdb', secondary: '#8b5cf6', accent: '#06b6d4' },
		children,
		preview
	}: {
		steps: { id: string; label: string; description?: string }[];
		step?: number;
		onstepselect?: (index: number) => void;
		onback?: () => void;
		onnext?: () => void;
		oncreate?: () => void;
		submitting?: boolean;
		blocked?: boolean;
		canfinish?: boolean;
		stepValid?: boolean;
		themeColors?: { primary: string; secondary: string; accent: string };
		children: Snippet;
		preview?: Snippet;
	} = $props();

	let showPreview = $state(true);
	let splitPct = $state(58);
	let isDragging = $state(false);
	let containerEl = $state<HTMLDivElement | null>(null);

	const isLast = $derived(step >= steps.length - 1);

	function startDrag(e: PointerEvent) {
		if (e.button !== 0) return;
		e.preventDefault();
		isDragging = true;

		const onMove = (moveEvent: PointerEvent) => {
			if (!containerEl) return;
			const rect = containerEl.getBoundingClientRect();
			if (rect.width <= 0) return;
			const currentX = moveEvent.clientX;
			let pct = ((currentX - rect.left) / rect.width) * 100;
			if (pct < 35) pct = 35;
			if (pct > 72) pct = 72;
			splitPct = pct;
		};

		const onUp = () => {
			isDragging = false;
			window.removeEventListener('pointermove', onMove);
			window.removeEventListener('pointerup', onUp);
			document.body.style.cursor = '';
			document.body.style.userSelect = '';
		};

		document.body.style.cursor = 'col-resize';
		document.body.style.userSelect = 'none';
		window.addEventListener('pointermove', onMove);
		window.addEventListener('pointerup', onUp);
	}

	function resetSplit() {
		splitPct = 58;
	}

	function handleSplitterKeydown(e: KeyboardEvent) {
		if (e.key === 'ArrowLeft') {
			e.preventDefault();
			splitPct = Math.max(35, splitPct - 2);
		} else if (e.key === 'ArrowRight') {
			e.preventDefault();
			splitPct = Math.min(72, splitPct + 2);
		} else if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			resetSplit();
		}
	}
</script>

<div class="onb-root">
	<div
		bind:this={containerEl}
		class="onb-container"
		class:is-dragging={isDragging}
		class:is-preview-hidden={!showPreview}
		style={showPreview ? `--left-split: ${splitPct}%;` : ''}
	>
		<!-- LEFT PANE: WIZARD INTERACTION FLOW (PORTAL THEMED) -->
		<div class="onb-flow-pane">
			<!-- Header with Logo Brand and Help -->
			<div class="onb-flow-header">
				<div class="onb-brand-badge">
					<span class="onb-brand-icon">
						<IconBuildingStore size={16} stroke={2.2} />
					</span>
					<span>Orderly SuperAdmin</span>
				</div>
				<div class="onb-header-links">
					<button
						type="button"
						class="onb-header-btn"
						title={showPreview ? 'Close Preview' : 'Show Preview'}
						onclick={() => (showPreview = !showPreview)}
					>
						{#if showPreview}
							<IconEyeOff size={13} stroke={2} />
							<span>Hide Preview</span>
						{:else}
							<IconEye size={13} stroke={2} />
							<span>Show Preview</span>
						{/if}
					</button>

					<span style="opacity: 0.3;">|</span>
					<a href="/superadmin/businesses" class="onb-header-link">Exit to Dashboard</a>
				</div>
			</div>

			<!-- Segmented Pill Stepper -->
			<OnboardStepper {steps} current={step} onSelect={onstepselect} />

			<!-- Step Dynamic Content Body -->
			{#key step}
				<div class="onb-step-content onb-fade-in">
					{@render children()}
				</div>
			{/key}

			<!-- Bottom Actions Footer -->
			<footer class="onb-footer">
				<button
					type="button"
					class="onb-btn-back"
					disabled={step === 0 || submitting}
					onclick={onback}
				>
					<IconArrowLeft size={15} stroke={2} />
					<span>Back</span>
				</button>

				{#if isLast}
					<button
						type="button"
						class="onb-btn-next"
						disabled={submitting || blocked || !canfinish}
						onclick={oncreate}
					>
						{#if submitting}
							<IconLoader size={16} stroke={2.5} class="spin" />
							<span>Creating Business…</span>
						{:else}
							<span>Create Business</span>
						{/if}
					</button>
				{:else}
					<button
						type="button"
						class="onb-btn-next"
						disabled={blocked || !stepValid}
						onclick={onnext}
					>
						<span>Continue</span>
						<IconArrowRight size={15} stroke={2} />
					</button>
				{/if}
			</footer>
		</div>

		<!-- LEETCODE STYLE RESIZER / DIVIDER BAR -->
		{#if showPreview}
			<div
				class="onb-splitter"
				role="separator"
				aria-orientation="vertical"
				aria-valuenow={Math.round(splitPct)}
				aria-valuemin={35}
				aria-valuemax={72}
				tabindex={0}
				onpointerdown={startDrag}
				ondblclick={resetSplit}
				onkeydown={handleSplitterKeydown}
				title="Drag to resize panels (Double-click to reset)"
			>
				<div class="onb-splitter-line"></div>
				<div class="onb-splitter-pill">
					<span class="onb-splitter-dots"></span>
				</div>
			</div>

			<!-- RIGHT PANE: LIVE INTERACTIVE PREVIEW (MATTE CLEAN SAAS) -->
			<div
				class="onb-showcase-pane"
				style:--tenant-primary={themeColors.primary || '#5b4bdb'}
				style:--tenant-secondary={themeColors.secondary || '#8b5cf6'}
				style:--tenant-accent={themeColors.accent || '#06b6d4'}
			>
				<button
					type="button"
					class="onb-close-pane-btn onb-preview-corner-close"
					title="Close Preview Panel"
					aria-label="Close Preview Panel"
					onclick={() => (showPreview = false)}
				>
					<IconX size={13} stroke={2} />
				</button>

				{#if preview}
					{@render preview()}
				{/if}
			</div>
		{/if}
	</div>
</div>
