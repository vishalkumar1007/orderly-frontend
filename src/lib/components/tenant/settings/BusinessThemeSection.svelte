<script lang="ts">
	import { page } from '$app/stores';
	import { api } from '$lib/api/client';
	import { adoptAppearance, loadAppearance } from '$lib/appearance.svelte';
	import type { ThemePreset } from '$lib/brandTheme';
	import { consoleThemeSeed } from '$lib/admin/consoleTheme';
	import BusinessThemeEditor, {
		type BusinessLook
	} from '$lib/components/admin/onboard/BusinessThemeEditor.svelte';
	import SettingsSection from '$lib/components/admin/SettingsSection.svelte';
	import { toast } from '$lib/components/admin/toast';
	import { storefrontAdminApi } from '$lib/storefront/admin';
	import { seed, useStorefront, type StorefrontContext } from '$lib/storefront/admin-context';

	/**
	 * The business theme, with the same editor the platform used to set it at
	 * onboarding. It writes the same two things onboarding does: the storefront
	 * theme, and the business console default seeded from it.
	 *
	 * It never touches anyone's personal Appearance: that is each person's own
	 * preference, layered on top, and stays theirs.
	 */
	let props: Partial<StorefrontContext> = $props();
	const ctx = useStorefront(() => props);

	function fromConfig(): BusinessLook {
		const t = ctx.config.theme;
		return {
			preset: t.preset,
			mode: t.mode,
			primary: t.primary,
			secondary: t.secondary,
			accent: t.accent,
			font: t.font,
			radius: t.radius,
			button: t.button,
			card: t.card,
			hero: t.hero
		};
	}

	let look = $state<BusinessLook>(seed(fromConfig));
	let saved = $state<BusinessLook>(seed(fromConfig));
	let saving = $state(false);
	let justSaved = $state(false);

	const HEX = /^#[0-9a-fA-F]{6}$/;
	const dirty = $derived(JSON.stringify(look) !== JSON.stringify(saved));
	const invalid = $derived(![look.primary, look.secondary, look.accent].every((c) => HEX.test(c)));

	async function submit() {
		if (invalid) {
			toast.error('Each colour needs to be a 6-digit hex value, like #4f46e5');
			return;
		}
		saving = true;
		const ok = await ctx.save(() => storefrontAdminApi.saveTheme({ ...look }));
		if (!ok) {
			saving = false;
			toast.error('Could not save the business theme');
			return;
		}
		// The console default follows the storefront colours, exactly as at
		// onboarding. Best effort: the storefront theme is already saved.
		try {
			const { presets } = await api<{ presets: ThemePreset[] }>('/api/v1/tenant/theme-presets');
			const seedTheme = consoleThemeSeed(
				{ primary: look.primary, secondary: look.secondary, mode: look.mode },
				presets ?? []
			);
			if (seedTheme) {
				await api('/api/v1/tenant/theme', { method: 'PATCH', body: JSON.stringify(seedTheme) });
				adoptAppearance('tenant', ($page.data.tenantSlug as string) || 'tenant', await loadAppearance('tenant'));
			}
		} catch {
			toast.info('Storefront theme saved. The console colours could not be updated just now.');
		}
		saved = { ...look };
		saving = false;
		justSaved = true;
		setTimeout(() => (justSaved = false), 2500);
	}
</script>

<SettingsSection
	title="Business theme"
	description="How your storefront looks, and the colours your team's console starts from. Anyone who set their own colours under Appearance keeps them."
	{dirty}
	{saving}
	saved={justSaved}
	saveLabel="Save business theme"
	onsave={submit}
	onreset={() => (look = { ...saved })}
>
	<BusinessThemeEditor bind:look />
	<p class="bt-more">
		Fonts, hero, header and layout in more detail are under <a href="/shop/customize">Customize</a>.
	</p>
</SettingsSection>

<style>
	.bt-more {
		margin: 0;
		font-size: var(--fs-meta);
		color: var(--text-3);
	}
</style>
