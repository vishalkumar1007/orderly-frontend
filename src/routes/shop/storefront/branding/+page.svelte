<script lang="ts">
	import FormField from '$lib/components/admin/FormField.svelte';
	import TextArea from '$lib/components/admin/TextArea.svelte';
	import TextInput from '$lib/components/admin/TextInput.svelte';
	import { seed, type StorefrontContext } from '$lib/storefront/admin-context';
	import { storefrontAdminApi, type AdminStorefront } from '$lib/storefront/admin';
	import { toast } from '$lib/components/admin/toast';

	/**
	 * Branding: the logo, favicon and the name customers see.
	 *
	 * These are the first things a customer notices, so they sit at the top of the
	 * settings tree rather than buried under "Theme".
	 *
	 * Images are entered as URLs rather than uploaded. That is a deliberate scope
	 * decision — the storage provider is configured elsewhere in this product — and
	 * a URL field is honest about what it does. Nothing here accepts markup: a
	 * value ends up in an `src` attribute, and the server only keeps absolute
	 * http(s) URLs.
	 */
	let { config, save }: StorefrontContext = $props();

	let name = $state(seed(() => config.store.name));
	let tagline = $state(seed(() => config.store.tagline));
	let description = $state(seed(() => config.store.description));
	let logoUrl = $state(seed(() => config.store.logo_url));
	let faviconUrl = $state(seed(() => config.store.favicon_url));
	/** Set when the logo URL does not load, so a broken link is obvious here. */
	let logoBroken = $state(false);
	let saving = $state(false);

	/** `isHttpUrl` is a client-side nudge; the server does the real check. */
	function isHttpUrl(value: string): boolean {
		return /^https?:\/\/[^\s]+$/i.test(value.trim());
	}

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		if (name.trim().length < 2) {
			toast.error('Your business name needs at least 2 characters');
			return;
		}
		for (const [value, label] of [
			[logoUrl, 'Logo URL'],
			[faviconUrl, 'Favicon URL']
		] as const) {
			if (value.trim() && !isHttpUrl(value)) {
				toast.error(`${label} must be a full http:// or https:// address`);
				return;
			}
		}
		saving = true;
		const ok = await save(() =>
			storefrontAdminApi.saveIdentity({
				name: name.trim(),
				tagline: tagline.trim(),
				description: description.trim(),
				logo_url: logoUrl.trim(),
				favicon_url: faviconUrl.trim()
			})
		);
		saving = false;
		if (ok) toast.success('Branding saved');
		else toast.error('Could not save your branding');
	}

	/** `initial` is the fallback a customer sees when there is no logo. */
	const initial = $derived((name.trim().charAt(0) || 'S').toUpperCase());
</script>

<form class="panel" onsubmit={submit}>
	<div class="panel-h">
		<h2 style="margin:0;">Brand identity</h2>
		<p class="panel-note" style="margin:0.2rem 0 0;">
			What a customer sees in the header, the browser tab and their order.
		</p>
	</div>

	<div
		style="display:flex;align-items:center;gap:1rem;flex-wrap:wrap;margin-top:1rem;padding:0.9rem;border:1px solid var(--border);border-radius:var(--radius-sm);background:var(--surface-2);"
	>
		{#if logoUrl.trim() && !logoBroken}
			<img
				src={logoUrl.trim()}
				alt="Your logo"
				width="56"
				height="56"
				style="width:56px;height:56px;border-radius:var(--radius-sm);object-fit:cover;border:1px solid var(--border);background:var(--surface);"
				onerror={() => (logoBroken = true)}
			/>
		{:else}
			<span
				style="width:56px;height:56px;border-radius:var(--radius-sm);display:grid;place-items:center;background:var(--accent);color:#fff;font-weight:800;font-size:1.25rem;"
				aria-hidden="true"
			>
				{initial}
			</span>
		{/if}
		<div style="min-width:0;">
			<p style="margin:0;font-weight:600;">{name.trim() || 'Your store name'}</p>
			<p style="margin:0.1rem 0 0;font-size:0.75rem;color:var(--text-2);">
				{#if logoBroken}
					That logo address did not load — check it is reachable.
				{:else if logoUrl.trim()}
					This logo appears in your storefront header
				{:else}
					Without a logo, customers see your first letter instead
				{/if}
			</p>
		</div>
	</div>

	<div class="sfctl-grid" style="margin-top:1rem;">
		<FormField label="Business name" hint="Shown in the header, the tab title and on the order confirmation.">
			<TextInput bind:value={name} maxlength={80} placeholder="Momo Magic" required />
		</FormField>

		<FormField label="Tagline" hint="One short line under your name. Optional.">
			<TextInput bind:value={tagline} maxlength={140} placeholder="Steamed to order" />
		</FormField>

		<FormField
			label="Logo URL"
			hint="A square image works best. Leave empty to show your store initial."
		>
			<TextInput bind:value={logoUrl} placeholder="https://cdn.example.com/logo.png" inputmode="url" />
		</FormField>

		<FormField label="Favicon URL" hint="The small icon in a browser tab. Optional.">
			<TextInput bind:value={faviconUrl} placeholder="https://cdn.example.com/icon.png" inputmode="url" />
		</FormField>

		<FormField
			label="Short description"
			hint="A sentence or two about your food. Used when your page is shared."
		>
			<TextArea bind:value={description} rows={3} placeholder="Hand-folded momo, steamed to order, every day from 9." />
		</FormField>
	</div>

	<div class="sfctl-foot">
		<span class="sfctl-foot-note">Changes appear on your storefront immediately.</span>
		<button class="btn btn-primary" type="submit" disabled={saving}>
			{saving ? 'Saving…' : 'Save branding'}
		</button>
	</div>
</form>
