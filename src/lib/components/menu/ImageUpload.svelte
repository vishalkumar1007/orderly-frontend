<script lang="ts">
	import { Camera, Loader2, X } from '@lucide/svelte/icons';
	import { api } from '$lib/api/client';
	import { toast } from '$lib/components/admin/toast';

	let {
		url = $bindable(undefined),
		onupload,
		disabled = false
	}: {
		url?: string | undefined;
		onupload: (url: string) => void;
		disabled?: boolean;
	} = $props();

	let dragging = $state(false);
	let uploading = $state(false);
	let fileInput = $state<HTMLInputElement | null>(null);

	const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
	const MAX_SIZE = 5 * 1024 * 1024; // 5MB

	function handleDragOver(e: DragEvent) {
		e.preventDefault();
		if (!disabled && !uploading) dragging = true;
	}

	function handleDragLeave(e: DragEvent) {
		e.preventDefault();
		dragging = false;
	}

	function handleDrop(e: DragEvent) {
		e.preventDefault();
		dragging = false;
		if (disabled || uploading) return;
		const file = e.dataTransfer?.files?.[0];
		if (file) void uploadFile(file);
	}

	function handleFileSelect(e: Event) {
		const input = e.target as HTMLInputElement;
		const file = input.files?.[0];
		if (file) void uploadFile(file);
		// Reset so the same file can be selected again
		input.value = '';
	}

	function handleRemove(e: MouseEvent) {
		e.stopPropagation();
		url = '';
	}

	async function uploadFile(file: File) {
		if (!ACCEPTED_TYPES.includes(file.type)) {
			toast.error('Only JPEG, PNG, or WebP images are allowed');
			return;
		}
		if (file.size > MAX_SIZE) {
			toast.error('Image must be 5MB or smaller');
			return;
		}

		uploading = true;
		try {
			const formData = new FormData();
			formData.append('image', file);
			const result = await api<{ url: string }>('/api/v1/tenant/upload', {
				method: 'POST',
				body: formData
			});
			url = result.url;
			onupload(result.url);
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Upload failed');
		} finally {
			uploading = false;
		}
	}
</script>

<div class="img-upload">
	<input
		bind:this={fileInput}
		type="file"
		accept="image/jpeg,image/png,image/webp"
		style="display:none;"
		onchange={handleFileSelect}
	/>

	{#if url}
		<div class="img-upload-preview">
			<img src={url} alt="Product" />
			{#if !disabled}
				<button
					type="button"
					class="img-upload-remove"
					aria-label="Remove image"
					onclick={handleRemove}
				>
					<X size={14} strokeWidth={2.2} />
				</button>
			{/if}
		</div>
	{:else}
		<button
			type="button"
			class="img-upload-zone"
			class:dragging
			disabled={disabled || uploading}
			onclick={() => fileInput?.click()}
			ondragover={handleDragOver}
			ondragleave={handleDragLeave}
			ondrop={handleDrop}
		>
			{#if uploading}
				<Loader2 size={20} strokeWidth={1.8} class="spin" />
				<span>Uploading…</span>
			{:else}
				<Camera size={20} strokeWidth={1.8} />
				<span>Add photo</span>
				<span class="img-upload-hint">800×800 · max 5MB</span>
			{/if}
		</button>
	{/if}
</div>

<style>
	.img-upload {
		display: flex;
		justify-content: center;
	}

	.img-upload-zone {
		width: 8.5rem;
		height: 8.5rem;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.25rem;
		border: 1.5px dashed var(--border);
		border-radius: var(--radius);
		background: var(--surface-2);
		color: var(--text-3);
		font-size: 0.78rem;
		font-family: inherit;
		cursor: pointer;
		transition: border-color var(--tr), background var(--tr), color var(--tr);
	}

	.img-upload-zone:hover:not(:disabled) {
		border-color: var(--accent);
		color: var(--accent-dark);
		background: var(--accent-soft);
	}

	.img-upload-zone.dragging {
		border-color: var(--accent);
		background: var(--accent-soft);
		color: var(--accent-dark);
	}

	.img-upload-zone:disabled {
		cursor: not-allowed;
	}

	.img-upload-preview {
		position: relative;
		width: 7.5rem;
		height: 7.5rem;
		border-radius: var(--radius);
		overflow: hidden;
		border: 1px solid var(--border);
	}

	.img-upload-preview img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
	}

	.img-upload-remove {
		position: absolute;
		top: 0.3rem;
		right: 0.3rem;
		width: 1.5rem;
		height: 1.5rem;
		display: grid;
		place-items: center;
		border: none;
		border-radius: 999px;
		background: rgba(0, 0, 0, 0.55);
		color: #fff;
		cursor: pointer;
		transition: background var(--tr);
	}

	.img-upload-remove:hover {
		background: var(--danger);
	}

	.img-upload-hint {
		font-size: 0.65rem;
		color: var(--text-3);
	}

	.spin {
		animation: spin 1s linear infinite;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}
</style>
