<script lang="ts">
	import FormField from '$lib/components/admin/FormField.svelte';
	import Switch from '$lib/components/admin/Switch.svelte';
	import TextArea from '$lib/components/admin/TextArea.svelte';
	import TextInput from '$lib/components/admin/TextInput.svelte';
	import ImageUpload from '$lib/components/menu/ImageUpload.svelte';
	import type { CategoryInput, MenuCategory } from '$lib/tenant/menu';

	let {
		editing,
		saving,
		onclose,
		onsave
	}: {
		editing: MenuCategory | null;
		saving: boolean;
		onclose: () => void;
		onsave: (data: CategoryInput) => Promise<void>;
	} = $props();

	let name = $state(editing?.name ?? '');
	let description = $state(editing?.description ?? '');
	let imageUrl = $state(editing?.image_url ?? '');
	let isActive = $state(editing?.is_active ?? true);
	let error = $state('');

	async function handleSubmit(e: SubmitEvent) {
		e.preventDefault();
		const trimmed = name.trim();
		if (!trimmed) {
			error = 'Category name is required';
			return;
		}
		error = '';
		await onsave({
			name: trimmed,
			description: description.trim(),
			image_url: imageUrl,
			is_active: isActive
		});
	}
</script>

<form class="cat-form" onsubmit={handleSubmit}>
	<FormField label="Name" htmlFor="cf-name" required>
		<TextInput id="cf-name" bind:value={name} placeholder="e.g. Drinks" required autocomplete="off" />
	</FormField>

	<FormField label="Description" htmlFor="cf-desc" hint="Optional">
		<TextArea id="cf-desc" rows={2} bind:value={description} />
	</FormField>

	<FormField label="Image" hint="Optional · JPEG, PNG, or WebP · max 5MB">
		<ImageUpload bind:url={imageUrl} onupload={() => {}} disabled={saving} />
	</FormField>

	<Switch bind:checked={isActive} label={isActive ? 'Visible on menu' : 'Hidden from customers'} disabled={saving} />

	{#if error}
		<p class="err" style="margin:0;">{error}</p>
	{/if}

	<div class="cat-form-actions">
		<button class="btn btn-ghost" type="button" onclick={onclose} disabled={saving}>Cancel</button>
		<button class="btn btn-primary" type="submit" disabled={saving}>
			{saving ? 'Saving…' : editing ? 'Save category' : 'Create category'}
		</button>
	</div>
</form>

<style>
	.cat-form {
		display: flex;
		flex-direction: column;
		gap: 0.85rem;
	}
	.cat-form-actions {
		display: flex;
		gap: 0.5rem;
		margin-top: 0.35rem;
	}
	.cat-form-actions .btn {
		flex: 1;
		min-height: 2.75rem;
	}
</style>
