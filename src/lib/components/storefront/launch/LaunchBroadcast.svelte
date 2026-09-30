<script lang="ts">
	import Megaphone from '@lucide/svelte/icons/megaphone';
	import Sparkles from '@lucide/svelte/icons/sparkles';
	import AlertCircle from '@lucide/svelte/icons/circle-alert';
	import Info from '@lucide/svelte/icons/info';
	import Store from '@lucide/svelte/icons/store';
	import { storefrontAdminApi } from '$lib/storefront/admin';
	import type { StorefrontContext } from '$lib/storefront/admin-context';
	import { toast } from '$lib/components/admin/toast';
	import './launch-shared.css';

	type BroadcastType = 'alert' | 'msg' | 'offer' | 'others';

	let {
		config,
		save,
		publicHost = ''
	}: {
		config: StorefrontContext['config'];
		save: StorefrontContext['save'];
		publicHost?: string;
	} = $props();

	let broadcastType = $state<BroadcastType>('offer');
	let broadcastText = $state('');
	let savingBroadcast = $state(false);

	function parseBroadcast(msg: string): { type: BroadcastType; text: string } {
		if (!msg) return { type: 'msg', text: '' };
		const match = msg.match(/^\[(alert|msg|offer|others)\]\s*(.*)$/i);
		if (match) {
			return { type: match[1].toLowerCase() as BroadcastType, text: match[2] };
		}
		return { type: 'msg', text: msg };
	}

	function formatBroadcast(type: BroadcastType, text: string): string {
		const clean = text.trim();
		return clean ? `[${type}] ${clean}` : '';
	}

	$effect(() => {
		const parsed = parseBroadcast(config.behaviour.status_message || '');
		if (parsed.text) {
			broadcastType = parsed.type;
			broadcastText = parsed.text;
		} else {
			broadcastText = '';
		}
	});

	function applyPreset(type: BroadcastType, text: string) {
		broadcastType = type;
		broadcastText = text;
	}

	async function saveBroadcast() {
		if (savingBroadcast) return;
		savingBroadcast = true;
		const payload = formatBroadcast(broadcastType, broadcastText);
		const ok = await save(() => storefrontAdminApi.saveBehaviour({ status_message: payload }));
		savingBroadcast = false;
		if (ok) toast.success(payload ? 'Banner published' : 'Banner removed');
		else toast.error('Failed to save broadcast');
	}

	async function clearBroadcast() {
		broadcastText = '';
		await saveBroadcast();
	}
</script>

<div class="studio-content-grid">
	<div class="panel studio-section-intro">
		<div class="intro-icon-wrap">
			<Megaphone size={24} strokeWidth={1.8} />
		</div>
		<div>
			<h2 class="intro-h">Customer Banner</h2>
			<p class="intro-p">
				Pin a short announcement to the top of your storefront — offers, alerts, or welcome notes.
			</p>
		</div>
	</div>

	<div class="panel broadcast-builder-panel">
		<label class="form-label" for="broadcast-type">Announcement type</label>
		<div class="type-pill-grid" id="broadcast-type">
			<button
				type="button"
				class="type-pill-btn"
				class:active={broadcastType === 'offer'}
				onclick={() => (broadcastType = 'offer')}
			>
				<Sparkles size={16} strokeWidth={2} /> Offer
			</button>
			<button
				type="button"
				class="type-pill-btn"
				class:active={broadcastType === 'alert'}
				onclick={() => (broadcastType = 'alert')}
			>
				<AlertCircle size={16} strokeWidth={2} /> Alert
			</button>
			<button
				type="button"
				class="type-pill-btn"
				class:active={broadcastType === 'msg'}
				onclick={() => (broadcastType = 'msg')}
			>
				<Info size={16} strokeWidth={2} /> Message
			</button>
			<button
				type="button"
				class="type-pill-btn"
				class:active={broadcastType === 'others'}
				onclick={() => (broadcastType = 'others')}
			>
				<Store size={16} strokeWidth={2} /> Other
			</button>
		</div>

		<div class="composer-header">
			<label class="form-label" for="broadcast-text">Banner text</label>
			<span class="char-counter" class:warn={broadcastText.length > 180}
				>{broadcastText.length} / 200</span
			>
		</div>
		<textarea
			id="broadcast-text"
			class="text-input broadcast-textarea"
			rows={3}
			placeholder="Write an announcement…"
			maxlength={200}
			bind:value={broadcastText}
		></textarea>

		<div class="presets-row">
			<span class="presets-label">Templates:</span>
			<button
				type="button"
				class="preset-chip"
				onclick={() =>
					applyPreset('offer', 'Flat 20% OFF orders above ₹499 today. Use code CELEBRATE.')}
			>
				20% deal
			</button>
			<button
				type="button"
				class="preset-chip"
				onclick={() =>
					applyPreset('alert', 'Heavy rain: pickup times may be delayed by ~15 minutes.')}
			>
				Weather delay
			</button>
			<button
				type="button"
				class="preset-chip"
				onclick={() => applyPreset('msg', 'Welcome! Explore our seasonal menu.')}
			>
				Welcome
			</button>
		</div>

		<div class="broadcast-live-preview-box">
			<div class="preview-header">Live preview</div>
			<div class="preview-browser-frame">
				<div class="browser-address-bar">
					<span class="browser-url-text">https://{publicHost || 'yourstore.localhost'}</span>
				</div>
				<div class="browser-viewport">
					{#if broadcastText.trim()}
						<div class="sf-preview-alert" data-tone={broadcastType}>
							<span class="preview-text">{broadcastText.trim()}</span>
						</div>
					{:else}
						<p class="sf-preview-empty">No banner — enter text above.</p>
					{/if}
				</div>
			</div>
		</div>

		<div class="broadcast-actions-bar">
			<button
				type="button"
				class="btn btn-primary"
				disabled={savingBroadcast || !broadcastText.trim()}
				onclick={saveBroadcast}
			>
				{savingBroadcast ? 'Publishing…' : 'Publish Banner'}
			</button>
			{#if config.behaviour.status_message}
				<button
					type="button"
					class="btn btn-ghost text-danger"
					disabled={savingBroadcast}
					onclick={clearBroadcast}
				>
					Remove Banner
				</button>
			{/if}
		</div>
	</div>
</div>

<style>
	.broadcast-builder-panel {
		padding: 1.25rem 1.5rem;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: var(--radius-lg, 12px);
		box-shadow: none;
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}
	.type-pill-grid {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}
	.type-pill-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		padding: 0.45rem 0.75rem;
		border: 1px solid var(--border);
		border-radius: 999px;
		background: var(--surface-2);
		font: inherit;
		font-size: 0.8rem;
		font-weight: 600;
		color: var(--text-2);
		cursor: pointer;
	}
	.type-pill-btn.active {
		border-color: var(--accent);
		color: var(--accent);
		background: color-mix(in srgb, var(--accent) 12%, var(--surface));
	}
	.composer-header {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
	}
	.char-counter {
		font-size: 0.72rem;
		color: var(--text-3);
	}
	.char-counter.warn {
		color: #f59e0b;
	}
	.broadcast-textarea {
		resize: vertical;
		min-height: 4.5rem;
	}
	.presets-row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.45rem;
	}
	.presets-label {
		font-size: var(--fs-meta, 0.75rem);
		color: var(--text-3);
	}
	.preset-chip {
		border: 1px solid var(--border);
		background: var(--surface-2);
		border-radius: 999px;
		padding: 0.25rem 0.65rem;
		font: inherit;
		font-size: 0.75rem;
		cursor: pointer;
		color: var(--text-2);
	}
	.broadcast-live-preview-box {
		border: 1px solid var(--border);
		border-radius: var(--radius-sm, 8px);
		overflow: hidden;
	}
	.preview-header {
		padding: 0.5rem 0.75rem;
		font-size: 0.75rem;
		font-weight: 650;
		background: var(--surface-2);
		color: var(--text-2);
	}
	.browser-address-bar {
		padding: 0.4rem 0.75rem;
		background: var(--surface-3);
		font-size: 0.72rem;
		color: var(--text-3);
	}
	.browser-viewport {
		padding: 0.85rem;
		min-height: 3.5rem;
	}
	.sf-preview-alert {
		padding: 0.65rem 0.85rem;
		border-radius: 6px;
		background: rgba(59, 130, 246, 0.1);
		font-size: 0.85rem;
		color: var(--text);
	}
	.sf-preview-alert[data-tone='alert'] {
		background: rgba(239, 68, 68, 0.1);
	}
	.sf-preview-alert[data-tone='offer'] {
		background: rgba(16, 185, 129, 0.12);
	}
	.sf-preview-empty {
		margin: 0;
		font-size: 0.8rem;
		color: var(--text-3);
	}
	.broadcast-actions-bar {
		display: flex;
		flex-wrap: wrap;
		gap: 0.65rem;
	}
</style>
