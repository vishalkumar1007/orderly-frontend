<script lang="ts">
	import IconAlertTriangle from '@tabler/icons-svelte/icons/alert-triangle';
	import IconX from '@tabler/icons-svelte/icons/x';

	let {
		open = $bindable(false),
		rememberChoice = $bindable(false),
		onconfirm,
		oncancel
	}: {
		open: boolean;
		rememberChoice?: boolean;
		onconfirm?: () => void;
		oncancel?: () => void;
	} = $props();

	function handleClose() {
		open = false;
		oncancel?.();
	}

	function handleConfirm() {
		open = false;
		onconfirm?.();
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape' && open) {
			e.preventDefault();
			handleClose();
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />

{#if open}
	<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
	<div
		class="onb-leave-overlay"
		role="presentation"
		onclick={handleClose}
	>
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			class="onb-leave-dialog"
			role="alertdialog"
			aria-modal="true"
			aria-labelledby="onb-leave-title"
			aria-describedby="onb-leave-desc"
			tabindex="-1"
			onclick={(e) => e.stopPropagation()}
		>
			<div class="onb-leave-head">
				<div class="onb-leave-icon-box">
					<IconAlertTriangle size={22} stroke={2} />
				</div>
				<div class="onb-leave-text">
					<h3 id="onb-leave-title">Leave onboarding?</h3>
					<p id="onb-leave-desc">
						This business has not been created yet. Leave and lose the draft?
					</p>
				</div>
				<button
					type="button"
					class="onb-leave-close"
					aria-label="Close dialog"
					onclick={handleClose}
				>
					<IconX size={16} stroke={2} />
				</button>
			</div>

			<div class="onb-leave-body">
				<label class="onb-leave-checkbox-row">
					<input
						type="checkbox"
						class="onb-leave-checkbox"
						bind:checked={rememberChoice}
					/>
					<span class="onb-leave-checkbox-text">
						Remember my choice and don't show this popup again
					</span>
				</label>
			</div>

			<div class="onb-leave-actions">
				<button
					type="button"
					class="onb-leave-btn onb-leave-btn-stay"
					onclick={handleClose}
				>
					Keep editing
				</button>
				<button
					type="button"
					class="onb-leave-btn onb-leave-btn-exit"
					onclick={handleConfirm}
				>
					Leave &amp; lose draft
				</button>
			</div>
		</div>
	</div>
{/if}

<style>
	.onb-leave-overlay {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.75);
		backdrop-filter: blur(8px);
		-webkit-backdrop-filter: blur(8px);
		z-index: 9999;
		display: grid;
		place-items: center;
		padding: 1.5rem;
		animation: onbModalFade 0.15s ease-out;
	}

	@keyframes onbModalFade {
		from { opacity: 0; }
		to { opacity: 1; }
	}

	.onb-leave-dialog {
		width: 100%;
		max-width: 460px;
		background: #0f131e;
		border: 1px solid rgba(255, 255, 255, 0.12);
		border-radius: 16px;
		box-shadow: 0 24px 60px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(255, 255, 255, 0.05);
		padding: 1.5rem;
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
		animation: onbModalPop 0.2s cubic-bezier(0.16, 1, 0.3, 1);
		outline: none;
	}

	@keyframes onbModalPop {
		from {
			opacity: 0;
			transform: scale(0.96) translateY(6px);
		}
		to {
			opacity: 1;
			transform: scale(1) translateY(0);
		}
	}

	.onb-leave-head {
		display: flex;
		align-items: flex-start;
		gap: 0.85rem;
		position: relative;
	}

	.onb-leave-icon-box {
		width: 40px;
		height: 40px;
		border-radius: 10px;
		background: rgba(245, 158, 11, 0.14);
		border: 1px solid rgba(245, 158, 11, 0.25);
		color: #f59e0b;
		display: grid;
		place-items: center;
		flex: none;
	}

	.onb-leave-text {
		flex: 1;
		min-width: 0;
		padding-right: 0.5rem;
	}

	.onb-leave-text h3 {
		margin: 0 0 0.3rem;
		font-size: 1.05rem;
		font-weight: 700;
		color: #f8fafc;
		letter-spacing: -0.01em;
	}

	.onb-leave-text p {
		margin: 0;
		font-size: 0.825rem;
		color: #94a3b8;
		line-height: 1.45;
	}

	.onb-leave-close {
		width: 28px;
		height: 28px;
		border-radius: 8px;
		border: 1px solid rgba(255, 255, 255, 0.08);
		background: rgba(255, 255, 255, 0.04);
		color: #94a3b8;
		display: grid;
		place-items: center;
		cursor: pointer;
		padding: 0;
		transition: all 0.15s ease;
		flex: none;
	}

	.onb-leave-close:hover {
		background: rgba(255, 255, 255, 0.1);
		color: #ffffff;
		border-color: rgba(255, 255, 255, 0.2);
	}

	.onb-leave-body {
		display: flex;
		flex-direction: column;
	}

	.onb-leave-checkbox-row {
		display: flex;
		align-items: center;
		gap: 0.65rem;
		padding: 0.75rem 0.9rem;
		border-radius: 10px;
		background: rgba(255, 255, 255, 0.04);
		border: 1px solid rgba(255, 255, 255, 0.07);
		cursor: pointer;
		user-select: none;
		transition: background 0.15s ease;
	}

	.onb-leave-checkbox-row:hover {
		background: rgba(255, 255, 255, 0.07);
	}

	.onb-leave-checkbox {
		width: 16px;
		height: 16px;
		border-radius: 4px;
		accent-color: #6366f1;
		cursor: pointer;
	}

	.onb-leave-checkbox-text {
		font-size: 0.8rem;
		color: #cbd5e1;
		font-weight: 500;
	}

	.onb-leave-actions {
		display: flex;
		align-items: center;
		justify-content: flex-end;
		gap: 0.65rem;
		padding-top: 0.25rem;
	}

	.onb-leave-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 0.55rem 1.1rem;
		border-radius: 9px;
		font-size: 0.825rem;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.15s ease;
		line-height: 1.2;
		font-family: inherit;
		outline: none;
	}

	.onb-leave-btn-stay {
		background: rgba(255, 255, 255, 0.08);
		border: 1px solid rgba(255, 255, 255, 0.12);
		color: #f1f5f9;
	}

	.onb-leave-btn-stay:hover {
		background: rgba(255, 255, 255, 0.14);
		border-color: rgba(255, 255, 255, 0.22);
		color: #ffffff;
	}

	.onb-leave-btn-exit {
		background: #dc2626;
		border: 1px solid #ef4444;
		color: #ffffff;
		box-shadow: 0 2px 8px rgba(220, 38, 38, 0.35);
	}

	.onb-leave-btn-exit:hover {
		background: #b91c1c;
		border-color: #dc2626;
	}
</style>
