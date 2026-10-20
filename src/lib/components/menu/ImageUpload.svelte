<script lang="ts">
	import Camera from '@tabler/icons-svelte/icons/camera';
	import Loader2 from '@tabler/icons-svelte/icons/loader-2';
	import X from '@tabler/icons-svelte/icons/x';
	import { api } from '$lib/api/client';
	import { toast } from '$lib/components/admin/toast';

	let {
		url = $bindable(undefined),
		uploading = $bindable(false),
		onupload,
		disabled = false
	}: {
		url?: string | undefined;
		uploading?: boolean;
		onupload: (url: string) => void;
		disabled?: boolean;
	} = $props();

	let dragging = $state(false);
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

	const MAX_EDGE = 1200;

	// Downscale in the browser so thumbnails are not full camera photos. Falls
	// back to the original file when the browser cannot encode.
	async function shrink(file: File): Promise<File> {
		try {
			const bmp = await createImageBitmap(file);
			const scale = Math.min(1, MAX_EDGE / Math.max(bmp.width, bmp.height));
			if (scale === 1 && file.size < 400_000) return file;
			const canvas = document.createElement('canvas');
			canvas.width = Math.round(bmp.width * scale);
			canvas.height = Math.round(bmp.height * scale);
			canvas.getContext('2d')?.drawImage(bmp, 0, 0, canvas.width, canvas.height);
			const encode = (type: string) =>
				new Promise<Blob | null>((res) => canvas.toBlob(res, type, 0.85));
			let blob = await encode('image/webp');
			if (blob?.type !== 'image/webp') blob = await encode('image/jpeg');
			if (!blob || blob.size >= file.size) return file;
			const ext = blob.type === 'image/webp' ? 'webp' : 'jpg';
			return new File([blob], `${file.name.replace(/\.\w+$/, '')}.${ext}`, { type: blob.type });
		} catch {
			return file;
		}
	}

	async function uploadFile(original: File) {
		if (!ACCEPTED_TYPES.includes(original.type)) {
			toast.error('Only JPEG, PNG, or WebP images are allowed');
			return;
		}
		uploading = true;
		const file = await shrink(original);
		if (file.size > MAX_SIZE) {
			uploading = false;
			toast.error('Image must be 5MB or smaller');
			return;
		}

		try {
			const formData = new FormData();
			formData.append('image', file);
			const result = await api<{ url: string }>('/api/v1/tenant/upload', {
				method: 'POST',
				body: formData,
				timeoutMs: 60_000
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
					<X size={14} stroke={1.6} />
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
				<Loader2 size={20} stroke={1.6} class="spin" />
				<span>Uploading…</span>
			{:else}
				<Camera size={20} stroke={1.6} />
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
		font-size: var(--fs-tab);
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
		font-size: var(--fs-micro);
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
