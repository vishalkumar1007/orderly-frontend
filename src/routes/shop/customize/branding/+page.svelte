<script lang="ts">
	import FormField from '$lib/components/admin/FormField.svelte';
	import TextArea from '$lib/components/admin/TextArea.svelte';
	import TextInput from '$lib/components/admin/TextInput.svelte';
	import { seed, useStorefront, type StorefrontContext } from '$lib/storefront/admin-context';
	import { storefrontAdminApi } from '$lib/storefront/admin';
	import { toast } from '$lib/components/admin/toast';

	let props: Partial<StorefrontContext> = $props();
	const ctx = useStorefront(() => props);
	const config = $derived(ctx.config);
	const save = (run: Parameters<StorefrontContext['save']>[0]) => ctx.save(run);

	let name = $state(seed(() => ctx.config.store.name));
	let tagline = $state(seed(() => ctx.config.store.tagline));
	let description = $state(seed(() => ctx.config.store.description));
	let logoUrl = $state(seed(() => ctx.config.store.logo_url));
	let faviconUrl = $state(seed(() => ctx.config.store.favicon_url));
	let logoBroken = $state(false);
	let saving = $state(false);
	let lastLogoUrl = $state(seed(() => ctx.config.store.logo_url));

	let dirty = false;
	$effect(() => {
		const s = ctx.config.store;
		if (!dirty) {
			name = s.name;
			tagline = s.tagline;
			description = s.description;
			logoUrl = s.logo_url;
			faviconUrl = s.favicon_url;
		}
	});

	$effect(() => {
		const url = logoUrl;
		if (url !== lastLogoUrl) {
			lastLogoUrl = url;
			logoBroken = false;
		}
	});

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
				style="width:56px;height:56px;border-radius:var(--radius-sm);display:grid;place-items:center;background:var(--accent);color:#fff;font-weight:800;font-size:var(--fs-h1);"
				aria-hidden="true"
			>
				{initial}
			</span>
		{/if}
		<div style="min-width:0;">
			<p style="margin:0;font-weight:600;">{name.trim() || 'Your store name'}</p>
			<p style="margin:0.1rem 0 0;font-size:var(--fs-code);color:var(--text-2);">
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
