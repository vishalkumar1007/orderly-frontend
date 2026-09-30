<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import { page } from '$app/stores';
	import CircleCheck from '@lucide/svelte/icons/circle-check';
	import RotateCcw from '@lucide/svelte/icons/rotate-ccw';
	import Users from '@lucide/svelte/icons/users';
	import UserRound from '@lucide/svelte/icons/user-round';
	import { api } from '$lib/api/client';
	import { applyBrandTheme, type BrandTheme, type ThemePreset } from '$lib/brandTheme';
	import {
		adoptAppearance,
		loadAppearance,
		previewColorMode,
		resetAppearance,
		saveAppearance,
		type ColorMode,
		type ConsoleAppearance,
		type ConsoleKind
	} from '$lib/appearance.svelte';
	import BrandPicker from '$lib/components/admin/BrandPicker.svelte';
	import ConfirmDialog from '$lib/components/admin/ConfirmDialog.svelte';
	import ErrorState from '$lib/components/admin/ErrorState.svelte';
	import Skeleton from '$lib/components/admin/Skeleton.svelte';
	import { errorMessage } from '$lib/admin/errors';
	import { toast } from '$lib/components/admin/toast';

	/**
	 * Console appearance.
	 *
	 * Two layers with two different owners, and saying so plainly is most of
	 * this screen's job:
	 *
	 * - **Yours** is stored against your account. It follows you to another
	 *   device and changes nothing for anyone else who works here.
	 * - **The business default** is what a colleague sees before they choose
	 *   anything, and what the sign-in screen is painted with. Only the owner
	 *   can write it, and doing so is a separate, confirmed action — it is the
	 *   one control on this screen that other people can see the result of.
	 *
	 * Edits paint immediately rather than on save. A colour you cannot see until
	 * you commit to it is a colour you pick twice.
	 */
	let {
		canSetBusinessDefault = false,
		kind = 'tenant' as ConsoleKind
	}: {
		canSetBusinessDefault?: boolean;
		/** Which console this is. Only the shared default underneath differs. */
		kind?: ConsoleKind;
	} = $props();

	/** The wording changes with the console; the behaviour does not. */
	const copy = $derived(
		kind === 'platform'
			? {
					defaultName: 'the console default',
					sharedWith: 'Everyone who works on this platform',
					customerNote: null
				}
			: {
					defaultName: 'the business default',
					sharedWith: 'Everyone who works here',
					customerNote: true
				}
	);

	let presets = $state<ThemePreset[]>([]);
	let appearance = $state<ConsoleAppearance | null>(null);
	let loading = $state(true);
	let error = $state('');
	let saving = $state(false);
	let resetting = $state(false);
	let publishOpen = $state(false);
	let publishing = $state(false);
	let restoreOpen = $state(false);
	let restoring = $state(false);

	let presetId = $state('indigo-violet');
	let colorMode = $state<ColorMode>('system');
	let accent = $state('');
	let accent2 = $state('');

	const scope = $derived(
		kind === 'platform'
			? 'platform'
			: ((($page.data as { tenantSlug?: string }).tenantSlug ?? '') as string) || 'tenant'
	);
	const selectedPreset = $derived(presets.find((p) => p.id === presetId));
	const usingOwn = $derived(appearance?.source === 'USER');

	/** Only a complete colour is worth painting with. */
	const HEX_RE = /^#[0-9a-fA-F]{6}$/;

	/**
	 * What the current form choices resolve to, without asking the server.
	 *
	 * The same merge the backend does — preset tokens, then the two accent
	 * overrides — so the live preview and the saved result agree.
	 *
	 * Half-typed colours are ignored rather than applied. Every themed surface
	 * is a `color-mix` against `--accent`, and `color-mix` with a malformed
	 * colour is invalid at computed-value time — so applying `#ab` on the way to
	 * `#abcdef` did not show a wrong colour, it dropped the rail's background
	 * entirely for a few keystrokes.
	 */
	const draftTheme = $derived.by<BrandTheme | null>(() => {
		const preset = selectedPreset;
		if (!preset) return null;
		const one = accent.trim();
		const two = accent2.trim();
		return {
			preset_id: preset.id,
			preset_name: preset.name,
			color_mode: colorMode,
			tokens: {
				...preset.tokens,
				accent: HEX_RE.test(one) ? one : preset.tokens.accent,
				accent2: HEX_RE.test(two) ? two : preset.tokens.accent2
			}
		};
	});

	/** Shown next to the field rather than only on save. */
	const accentError = $derived(accent.trim() && !HEX_RE.test(accent.trim()) ? 'Use a 6-digit hex colour, e.g. #4F46E5' : '');
	const accent2Error = $derived(
		accent2.trim() && !HEX_RE.test(accent2.trim()) ? 'Use a 6-digit hex colour' : ''
	);

	/** Seed the form from whichever layer is currently in force. */
	function adopt(next: ConsoleAppearance) {
		appearance = next;
		const theme = next.theme;
		presetId = theme.preset_id;
		colorMode = theme.color_mode;
		const preset = presets.find((p) => p.id === theme.preset_id);
		// Treat a colour as an override only when it actually differs from the
		// preset, so an untouched theme does not save a copy of its own values.
		accent =
			preset && theme.tokens.accent.toLowerCase() !== preset.tokens.accent.toLowerCase()
				? theme.tokens.accent
				: '';
		accent2 =
			preset &&
			theme.tokens.accent2 &&
			theme.tokens.accent2.toLowerCase() !== (preset.tokens.accent2 ?? '').toLowerCase()
				? theme.tokens.accent2
				: '';
		adoptAppearance(kind, scope, next);
	}

	async function bootstrap() {
		loading = true;
		try {
			const [list, resolved] = await Promise.all([
				api<{ presets: ThemePreset[] }>(
					kind === 'platform' ? '/api/v1/admin/theme-presets' : '/api/v1/tenant/theme-presets'
				),
				loadAppearance(kind)
			]);
			presets = list.presets;
			adopt(resolved);
			error = '';
		} catch (err) {
			error = errorMessage(err, 'load your appearance settings');
		} finally {
			loading = false;
		}
	}

	onMount(bootstrap);

	/*
	 * Paint every edit as it is made.
	 *
	 * `applyBrandTheme` writes the accent variables and `data-theme` onto
	 * <html>, and every themed surface — the rail above all — is a `color-mix`
	 * against those, so the whole console follows a preset click with no reload
	 * and nothing to re-render. `untrack` keeps this a one-way street: the
	 * effect reacts to the form, never to the theme it just applied.
	 */
	$effect(() => {
		const theme = draftTheme;
		if (!theme || loading) return;
		untrack(() => {
			applyBrandTheme(theme);
			previewColorMode(theme.color_mode);
		});
	});

	/**
	 * Leaving without saving must undo the preview.
	 *
	 * Otherwise a colour someone tried and walked away from follows them around
	 * the console until the next reload, which reads as "it saved" — the one
	 * thing a preview must never look like.
	 */
	onMount(() => () => {
		const saved = appearance?.theme;
		if (saved) applyBrandTheme(saved);
	});

	async function save() {
		if (saving) return;
		if (accentError || accent2Error) {
			toast.error('Fix the colour before saving');
			return;
		}
		saving = true;
		try {
			const overrides: Record<string, string> = {};
			if (accent.trim()) overrides.accent = accent.trim();
			if (accent2.trim()) overrides.accent2 = accent2.trim();
			const next = await saveAppearance(kind, {
				preset_id: presetId,
				color_mode: colorMode,
				overrides
			});
			adopt(next);
			toast.success('Your console appearance is saved');
		} catch (err) {
			toast.error(errorMessage(err, 'save your appearance'));
		} finally {
			saving = false;
		}
	}

	async function useBusinessDefault() {
		if (resetting) return;
		resetting = true;
		try {
			adopt(await resetAppearance(kind));
			toast.success(`Back on ${copy.defaultName}`);
		} catch (err) {
			toast.error(errorMessage(err, 'reset your appearance'));
		} finally {
			resetting = false;
		}
	}

	/**
	 * Put the shared default back to a fresh install's theme.
	 *
	 * The escape hatch for the console: an operator who has set the platform to
	 * something unreadable needs a way back that does not require knowing what
	 * the original values were. The server decides what "factory" is — the
	 * browser only asks.
	 */
	async function restoreFactoryDefault() {
		if (restoring) return;
		restoring = true;
		try {
			await api('/api/v1/admin/settings', {
				method: 'PATCH',
				body: JSON.stringify({ branding: { reset: true } })
			});
			adopt(await loadAppearance(kind));
			restoreOpen = false;
			toast.success('Console default restored');
		} catch (err) {
			toast.error(errorMessage(err, 'restore the console default'));
		} finally {
			restoring = false;
		}
	}

	/** Owner-only: make the current choices what everyone starts from. */
	async function publishAsDefault() {
		if (publishing) return;
		publishing = true;
		try {
			const overrides: Record<string, string> = {};
			if (accent.trim()) overrides.accent = accent.trim();
			if (accent2.trim()) overrides.accent2 = accent2.trim();
			if (kind === 'platform') {
				await api('/api/v1/admin/settings', {
					method: 'PATCH',
					body: JSON.stringify({
						branding: {
							preset_id: presetId,
							color_mode: colorMode,
							primary_color: overrides.accent ?? selectedPreset?.tokens.accent ?? '',
							secondary_color: overrides.accent2 ?? selectedPreset?.tokens.accent2 ?? ''
						}
					})
				});
			} else {
				await api('/api/v1/tenant/theme', {
					method: 'PATCH',
					body: JSON.stringify({
						theme_preset_id: presetId,
						theme_color_mode: colorMode,
						theme_overrides: overrides
					})
				});
			}
			// Re-resolve rather than patching state by hand: the shared layer
			// changed, and only the server knows whether it is now in force.
			adopt(await loadAppearance(kind));
			publishOpen = false;
			toast.success(`Saved as ${copy.defaultName}`);
		} catch (err) {
			toast.error(errorMessage(err, 'save the business default'));
		} finally {
			publishing = false;
		}
	}
</script>

{#if loading}
	<div class="panel">
		<Skeleton height="1.2rem" width="10rem" />
		<div class="ap-skeleton">
			{#each [1, 2, 3, 4] as _, i (i)}
				<Skeleton height="6.5rem" />
			{/each}
		</div>
	</div>
{:else if error && !appearance}
	<ErrorState message={error} onretry={bootstrap} />
{:else}
	<div class="panel">
		<div class="ap-head">
			<span class="ap-head-icon" aria-hidden="true">
				{#if usingOwn}
					<UserRound size={17} strokeWidth={1.9} />
				{:else}
					<Users size={17} strokeWidth={1.9} />
				{/if}
			</span>
			<div class="ap-head-text">
				<h2 class="panel-h" style="margin:0;">
					{usingOwn
						? 'Your own appearance'
						: copy.defaultName.charAt(0).toUpperCase() + copy.defaultName.slice(1)}
				</h2>
				<p class="panel-note" style="margin:0.15rem 0 0;">
					{usingOwn
						? 'These colours are yours alone. Nobody else sees them.'
						: 'You are on the appearance everyone starts from. Change anything below and it becomes yours alone.'}
				</p>
			</div>
			<!-- Always here, not only once you have something to undo: a reset
			     you can only find after changing something is a reset you do
			     not know exists while you are deciding whether to change it. -->
			<button
				class="btn btn-ghost btn-sm"
				type="button"
				disabled={resetting || !usingOwn}
				title={usingOwn
					? `Go back to ${copy.defaultName}`
					: `You are already on ${copy.defaultName}`}
				onclick={useBusinessDefault}
			>
				<RotateCcw size={14} strokeWidth={2} />
				{resetting ? 'Resetting…' : 'Reset'}
			</button>
		</div>

		<BrandPicker
			{presets}
			bind:presetId
			bind:colorMode
			bind:accent
			bind:accent2
			{accentError}
			{accent2Error}
		/>

		<div class="ap-foot">
			<p class="ap-foot-note">
				{#if copy.customerNote}
					Customer-facing colours are separate and live under
					<a href="/shop/customize/theme">Customize → Theme</a>.
				{:else}
					A business's own console and storefront carry their brand, never this one.
				{/if}
			</p>
			<div class="ap-actions">
				{#if canSetBusinessDefault}
					{#if kind === 'platform'}
						<button
							class="btn btn-ghost"
							type="button"
							disabled={saving || publishing || restoring}
							onclick={() => (restoreOpen = true)}
						>
							<RotateCcw size={15} strokeWidth={1.9} /> Restore factory default
						</button>
					{/if}
					<button
						class="btn btn-secondary"
						type="button"
						disabled={saving || publishing}
						onclick={() => (publishOpen = true)}
					>
						<Users size={15} strokeWidth={1.9} /> Set as {copy.defaultName}
					</button>
				{/if}
				<button class="btn btn-primary" type="button" disabled={saving} onclick={save}>
					{#if saving}
						Saving…
					{:else}
						<CircleCheck size={15} strokeWidth={2.2} /> Save for me
					{/if}
				</button>
			</div>
		</div>
	</div>
{/if}

<ConfirmDialog
	bind:open={publishOpen}
	title={`Set as ${copy.defaultName}?`}
	message={`${copy.sharedWith} and has not chosen their own appearance will see these colours, and so will the sign-in screen. Anyone who has picked their own keeps it.`}
	confirmLabel="Set as default"
	loading={publishing}
	onconfirm={publishAsDefault}
/>

<ConfirmDialog
	bind:open={restoreOpen}
	title="Restore the factory console theme?"
	message="The console default goes back to the theme a fresh install has. Your logo and favicon are left alone, and anyone who has chosen their own appearance keeps it."
	confirmLabel="Restore default"
	loading={restoring}
	onconfirm={restoreFactoryDefault}
/>

<style>
	.ap-skeleton {
		margin-top: 0.9rem;
		display: grid;
		gap: 0.6rem;
		grid-template-columns: repeat(auto-fill, minmax(8.5rem, 1fr));
	}

	.ap-head {
		display: flex;
		align-items: flex-start;
		gap: 0.75rem;
		margin-bottom: 1.1rem;
		flex-wrap: wrap;
	}

	.ap-head-icon {
		display: grid;
		place-items: center;
		width: 2.2rem;
		height: 2.2rem;
		flex: none;
		border-radius: 10px;
		background: var(--icon-bg);
		color: var(--icon-fg);
	}

	.ap-head-text {
		flex: 1;
		min-width: 14rem;
	}

	.ap-foot {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		flex-wrap: wrap;
		margin-top: 1.2rem;
		padding-top: 1rem;
		border-top: 1px solid var(--border-subtle);
	}

	.ap-foot-note {
		margin: 0;
		font-size: var(--fs-tab);
		color: var(--text-3);
		line-height: 1.45;
	}

	.ap-actions {
		display: flex;
		gap: 0.5rem;
		flex-wrap: wrap;
	}

	@media (max-width: 600px) {
		.ap-actions {
			width: 100%;
		}

		.ap-actions :global(.btn) {
			flex: 1;
			min-height: 2.75rem;
		}
	}
</style>
