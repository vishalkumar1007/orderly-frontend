<script lang="ts">
	import { onMount } from 'svelte';
	import CircleCheck from '@lucide/svelte/icons/circle-check';
	import { api } from '$lib/api/client';
	import { applyBrandTheme, type BrandTheme, type ThemePreset } from '$lib/brandTheme';
	import BrandPicker from '$lib/components/admin/BrandPicker.svelte';
	import ErrorState from '$lib/components/admin/ErrorState.svelte';
	import Skeleton from '$lib/components/admin/Skeleton.svelte';
	import { toast } from '$lib/components/admin/toast';

	let presets = $state<ThemePreset[]>([]);
	let presetId = $state('indigo-violet');
	let colorMode = $state<'light' | 'dark' | 'system'>('system');
	let accent = $state('');
	let loading = $state(true);
	let saving = $state(false);
	let error = $state('');

	onMount(() => {
		let cancelled = false;
		(async () => {
			try {
				const [theme, list] = await Promise.all([
					api<BrandTheme>('/api/v1/tenant/theme'),
					api<{ presets: ThemePreset[] }>('/api/v1/tenant/theme-presets')
				]);
				if (cancelled) return;
				presets = list.presets;
				presetId = theme.preset_id;
				colorMode = theme.color_mode;
				const preset = presets.find((p) => p.id === presetId);
				// Only treat the accent as an override if it differs from the preset.
				if (preset && theme.tokens.accent.toLowerCase() !== preset.tokens.accent.toLowerCase()) {
					accent = theme.tokens.accent;
				}
				applyBrandTheme(theme);
			} catch (err) {
				if (!cancelled) error = err instanceof Error ? err.message : 'Failed to load brand';
			} finally {
				if (!cancelled) loading = false;
			}
		})();
		return () => {
			cancelled = true;
		};
	});

	async function save() {
		if (saving) return;
		saving = true;
		try {
			const updated = await api<{ theme?: BrandTheme }>('/api/v1/tenant/theme', {
				method: 'PATCH',
				body: JSON.stringify({
					theme_preset_id: presetId,
					theme_color_mode: colorMode,
					theme_overrides: accent.trim() ? { accent: accent.trim() } : {}
				})
			});
			// Repaint immediately so the change is visible without a reload.
			if (updated.theme) applyBrandTheme(updated.theme);
			toast.success('Brand saved');
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Could not save your brand');
		} finally {
			saving = false;
		}
	}
</script>

{#if error}
	<ErrorState message={error} />
{/if}

{#if loading}
	<div class="panel">
		<Skeleton height="1.2rem" width="8rem" />
		<div style="margin-top:0.9rem;display:grid;gap:0.6rem;grid-template-columns:repeat(auto-fill,minmax(8.5rem,1fr));">
			{#each [1, 2, 3, 4] as _, i (i)}
				<Skeleton height="6.5rem" />
			{/each}
		</div>
	</div>
{:else}
	<div class="panel osh-brand">
		<div class="osh-brand-head">
			<h2 class="panel-h" style="margin:0 0 0.2rem;">Your look</h2>
			<p class="panel-note" style="margin:0;">
				This is how your storefront and shop admin look to you and your customers.
			</p>
		</div>

		<BrandPicker {presets} bind:presetId bind:colorMode bind:accent />

		<div class="osh-brand-save">
			<button class="btn btn-primary" type="button" disabled={saving} onclick={save}>
				{#if saving}
					Saving…
				{:else}
					<CircleCheck size={15} strokeWidth={2.2} /> Save brand
				{/if}
			</button>
		</div>
	</div>
{/if}

<style>
	.osh-brand {
		padding-bottom: 1.1rem;
	}

	.osh-brand-head {
		margin-bottom: 0.95rem;
	}

	.osh-brand-save {
		display: flex;
		justify-content: flex-end;
		margin-top: 1.1rem;
		padding-top: 1rem;
		border-top: 1px solid var(--border-subtle);
	}

	.osh-brand-save .btn {
		width: 100%;
		min-height: 2.9rem;
	}

	@media (min-width: 700px) {
		.osh-brand-save .btn {
			width: auto;
			min-width: 10rem;
		}
	}
</style>
