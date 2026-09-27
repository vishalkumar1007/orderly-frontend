<script lang="ts">
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import CircleCheck from '@lucide/svelte/icons/circle-check';
	import Eye from '@lucide/svelte/icons/eye';
	import EyeOff from '@lucide/svelte/icons/eye-off';
	import { api } from '$lib/api/client';
	import { applyBrandTheme, setCachedBrandTheme, type BrandTheme, type ThemePreset } from '$lib/brandTheme';
	import BrandPicker from '$lib/components/admin/BrandPicker.svelte';
	import ErrorState from '$lib/components/admin/ErrorState.svelte';
	import Skeleton from '$lib/components/admin/Skeleton.svelte';
	import { toast } from '$lib/components/admin/toast';

	let presets = $state<ThemePreset[]>([]);
	let presetId = $state('indigo-violet');
	let colorMode = $state<'light' | 'dark' | 'system'>('system');
	let accent = $state('');
	let accent2 = $state('');
	let loading = $state(true);
	let saving = $state(false);
	let error = $state('');
	let isPublished = $state(false);
	let publishing = $state(false);

	const themeCacheKey = $derived(
		(($page.data as { tenantSlug?: string }).tenantSlug || 'tenant') as string
	);

	onMount(() => {
		let cancelled = false;
		(async () => {
			try {
				const [theme, list, storeLink] = await Promise.all([
					api<BrandTheme>('/api/v1/tenant/theme'),
					api<{ presets: ThemePreset[] }>('/api/v1/tenant/theme-presets'),
					api<{ is_published: boolean }>('/api/v1/tenant/store-link')
				]);
				if (cancelled) return;
				presets = list.presets;
				presetId = theme.preset_id;
				colorMode = theme.color_mode;
				isPublished = storeLink.is_published;
				const preset = presets.find((p) => p.id === presetId);
				// Only treat colours as overrides if they differ from the preset.
				if (preset && theme.tokens.accent.toLowerCase() !== preset.tokens.accent.toLowerCase()) {
					accent = theme.tokens.accent;
				}
				if (
					preset &&
					theme.tokens.accent2 &&
					theme.tokens.accent2.toLowerCase() !== (preset.tokens.accent2 ?? '').toLowerCase()
				) {
					accent2 = theme.tokens.accent2;
				}
				applyBrandTheme(theme);
				setCachedBrandTheme(themeCacheKey, theme);
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

	async function togglePublish() {
		if (publishing) return;
		publishing = true;
		try {
			const path = isPublished ? '/api/v1/tenant/unpublish' : '/api/v1/tenant/publish';
			const res = await api<{ is_published: boolean }>(path, { method: 'POST' });
			isPublished = res.is_published;
			toast.success(isPublished ? 'Your store is live' : 'Store unpublished');
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Could not change publish state');
		} finally {
			publishing = false;
		}
	}

	async function save() {
		if (saving) return;
		saving = true;
		try {
			const overrides: Record<string, string> = {};
			if (accent.trim()) overrides.accent = accent.trim();
			if (accent2.trim()) overrides.accent2 = accent2.trim();
			const updated = await api<{ theme?: BrandTheme }>('/api/v1/tenant/theme', {
				method: 'PATCH',
				body: JSON.stringify({
					theme_preset_id: presetId,
					theme_color_mode: colorMode,
					theme_overrides: overrides
				})
			});
			// Repaint immediately so the change is visible without a reload.
			if (updated.theme) {
				applyBrandTheme(updated.theme);
				setCachedBrandTheme(themeCacheKey, updated.theme);
			}
			toast.success('Console appearance saved');
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Could not save your appearance');
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
			<h2 class="panel-h" style="margin:0 0 0.2rem;">Store visibility</h2>
			<p class="panel-note" style="margin:0;">
				Control whether customers can see and order from your store.
			</p>
		</div>
		<div class="osh-publish">
			<button
				class="osh-publish-toggle"
				type="button"
				aria-pressed={isPublished}
				disabled={publishing}
				onclick={togglePublish}
			>
				<span class="osh-publish-mark" aria-hidden="true"></span>
				<span class="osh-publish-body">
					<span class="osh-publish-label">Storefront published</span>
					<span class="osh-publish-hint">
						{isPublished
							? 'Anyone with your store link can browse and order.'
							: 'Hidden. Only you can see it.'}
					</span>
				</span>
			</button>
			<button
				class={['btn', isPublished ? 'btn-ghost' : 'btn-primary'].join(' ')}
				type="button"
				disabled={publishing}
				onclick={togglePublish}
			>
				{#if isPublished}
					<EyeOff size={15} strokeWidth={1.9} /> Unpublish
				{:else}
					<Eye size={15} strokeWidth={1.9} /> Publish store
				{/if}
			</button>
		</div>
	</div>

	<div class="panel osh-brand">
		<div class="osh-brand-head">
			<h2 class="panel-h" style="margin:0 0 0.2rem;">Console appearance</h2>
			<p class="panel-note" style="margin:0;">
				Colours and mode for the organization admin console. Customer-facing look is set under
				Storefront → Theme.
			</p>
		</div>

		<BrandPicker {presets} bind:presetId bind:colorMode bind:accent bind:accent2 />

		<div class="osh-brand-save">
			<button class="btn btn-primary" type="button" disabled={saving} onclick={save}>
				{#if saving}
					Saving…
				{:else}
					<CircleCheck size={15} strokeWidth={2.2} /> Save appearance
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

	.osh-publish {
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
	}

	.osh-publish-toggle {
		display: flex;
		align-items: center;
		gap: 0.7rem;
		padding: 0.8rem 0.9rem;
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		background: var(--surface-2);
		cursor: pointer;
		text-align: left;
		-webkit-tap-highlight-color: transparent;
	}

	.osh-publish-mark {
		flex: none;
		width: 1.5rem;
		height: 1.5rem;
		border-radius: 999px;
		border: 2px solid var(--border);
		position: relative;
		transition: all var(--tr);
	}

	.osh-publish-toggle[aria-pressed="true"] .osh-publish-mark {
		border-color: var(--success);
		background: var(--success);
	}

	.osh-publish-toggle[aria-pressed="true"] .osh-publish-mark::after {
		content: '';
		position: absolute;
		top: 50%;
		left: 50%;
		width: 0.5rem;
		height: 0.25rem;
		border-left: 2px solid #fff;
		border-bottom: 2px solid #fff;
		transform: translate(-50%, -60%) rotate(-45deg);
	}

	.osh-publish-body {
		flex: 1;
		min-width: 0;
	}

	.osh-publish-label {
		display: block;
		font-size: 0.875rem;
		font-weight: 600;
		color: var(--text);
	}

	.osh-publish-hint {
		display: block;
		font-size: 0.75rem;
		color: var(--text-2);
		line-height: 1.4;
	}

	@media (min-width: 700px) {
		.osh-brand-save .btn {
			width: auto;
			min-width: 10rem;
		}

		.osh-publish {
			flex-direction: row;
			align-items: center;
			justify-content: space-between;
		}

		.osh-publish-toggle {
			flex: 1;
		}
	}
</style>
