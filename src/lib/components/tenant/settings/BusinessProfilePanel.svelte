<script lang="ts">
	import FormField from '$lib/components/admin/FormField.svelte';
	import SettingsSection from '$lib/components/admin/SettingsSection.svelte';
	import Switch from '$lib/components/admin/Switch.svelte';
	import TextArea from '$lib/components/admin/TextArea.svelte';
	import TextInput from '$lib/components/admin/TextInput.svelte';
	import ImageUpload from '$lib/components/menu/ImageUpload.svelte';
	import { storefrontAdminApi } from '$lib/storefront/admin';
	import { seed, useStorefront, type StorefrontContext } from '$lib/storefront/admin-context';
	import { refreshStoreLink } from '$lib/tenant/storeLink.svelte';
	import { toast } from '$lib/components/admin/toast';

	/**
	 * Business profile: who the business is.
	 *
	 * Identity (logo, names, description), contact, where to find it online,
	 * the regional and tax facts bills carry, and what the console shows. Each
	 * block saves its own fields through the storefront document, which keeps
	 * the platform copy (tenants) in step on the server.
	 */
	let props: Partial<StorefrontContext> = $props();
	const ctx = useStorefront(() => props);

	/** One saveable block: its fields, the last saved copy, and the save state. */
	class Block<T extends Record<string, unknown>> {
		value = $state({} as T);
		saved = $state({} as T);
		saving = $state(false);
		justSaved = $state(false);
		constructor(initial: T) {
			this.value = { ...initial };
			this.saved = { ...initial };
		}
		get dirty() {
			return JSON.stringify(this.value) !== JSON.stringify(this.saved);
		}
		reset() {
			this.value = { ...this.saved };
		}
	}

	const store = seed(() => ctx.config.store);
	const NETWORKS = [
		{ key: 'instagram', label: 'Instagram' },
		{ key: 'facebook', label: 'Facebook' },
		{ key: 'x', label: 'X (Twitter)' },
		{ key: 'youtube', label: 'YouTube' },
		{ key: 'whatsapp', label: 'WhatsApp' }
	] as const;

	const identity = new Block({
		logo_url: store.logo_url ?? '',
		favicon_url: store.favicon_url ?? '',
		name: store.name ?? '',
		legal_name: store.legal_name ?? '',
		tagline: store.tagline ?? '',
		description: store.description ?? ''
	});
	const contact = new Block({
		address: store.address ?? '',
		phone: store.phone ?? '',
		email: store.email ?? '',
		website: store.website ?? ''
	});
	const social = new Block(
		Object.fromEntries(NETWORKS.map((n) => [n.key, store.social_links?.[n.key] ?? ''])) as Record<
			string,
			string
		>
	);
	const regional = new Block({
		currency: store.currency ?? 'INR',
		timezone: store.timezone ?? 'Asia/Kolkata',
		tax_id: store.tax_id ?? ''
	});
	const console = new Block({ show_logo_in_console: store.show_logo_in_console ?? false });

	let uploading = $state(false);
	let uploadingIcon = $state(false);

	/** Two letters for the brand card when there is no logo yet. */
	const monogram = $derived(
		String(identity.value.name || '?')
			.split(/\s+/)
			.filter(Boolean)
			.slice(0, 2)
			.map((w) => w[0]!.toUpperCase())
			.join('')
	);

	async function save<T extends Record<string, unknown>>(
		block: Block<T>,
		payload: Parameters<typeof storefrontAdminApi.saveIdentity>[0],
		touchesRail = false
	) {
		block.saving = true;
		const ok = await ctx.save(() => storefrontAdminApi.saveIdentity(payload));
		block.saving = false;
		if (!ok) {
			toast.error('Could not save your business profile');
			return;
		}
		block.saved = { ...block.value };
		block.justSaved = true;
		setTimeout(() => (block.justSaved = false), 2500);
		if (touchesRail) refreshStoreLink();
	}

	const trim = (v: unknown) => String(v ?? '').trim();
</script>

<div class="profile">
	<SettingsSection
		title="Identity"
		description="The logo, favicon and name customers see on your storefront, bills and messages."
		dirty={identity.dirty}
		saving={identity.saving || uploading || uploadingIcon}
		saved={identity.justSaved}
		onsave={() =>
			save(
				identity,
				{
					logo_url: trim(identity.value.logo_url),
					favicon_url: trim(identity.value.favicon_url),
					name: trim(identity.value.name),
					legal_name: trim(identity.value.legal_name),
					tagline: trim(identity.value.tagline),
					description: trim(identity.value.description)
				},
				true
			)}
		onreset={() => identity.reset()}
	>
		<!-- How the business reads to a customer, updated as you type. -->
		<div class="brand-card" aria-label="Brand preview">
			<span class="brand-mark">
				{#if identity.value.logo_url}
					<img src={identity.value.logo_url} alt="" />
				{:else}
					{monogram}
				{/if}
			</span>
			<span class="brand-text">
				<strong>{identity.value.name || 'Your business name'}</strong>
				<span class="brand-tagline">{identity.value.tagline || 'Add a tagline customers see under your name'}</span>
				{#if identity.value.legal_name}
					<span class="brand-legal">{identity.value.legal_name}</span>
				{/if}
			</span>
			<span class="brand-badge">Storefront preview</span>
		</div>

		<div class="marks">
			<div class="mark">
				<FormField label="Logo" hint="Square, at least 256px. PNG, JPEG or WebP up to 5MB.">
					<ImageUpload
						bind:url={identity.value.logo_url}
						bind:uploading
						endpoint="/api/v1/tenant/branding/upload"
						onupload={(u) => (identity.value.logo_url = u)}
					/>
				</FormField>
				{#if identity.value.logo_url}
					<button type="button" class="btn btn-quiet btn-sm" onclick={() => (identity.value.logo_url = '')}>
						Remove logo
					</button>
				{/if}
			</div>
			<div class="mark">
				<FormField label="Favicon" hint="The small icon on the browser tab for your storefront. A simple square mark, 64px or larger.">
					<ImageUpload
						bind:url={identity.value.favicon_url}
						bind:uploading={uploadingIcon}
						endpoint="/api/v1/tenant/branding/upload"
						onupload={(u) => (identity.value.favicon_url = u)}
					/>
				</FormField>
				{#if identity.value.favicon_url}
					<button type="button" class="btn btn-quiet btn-sm" onclick={() => (identity.value.favicon_url = '')}>
						Remove favicon
					</button>
				{/if}
			</div>
		</div>

		<div class="sfctl-grid" data-cols="2">
			<FormField label="Business name" hint="What customers call you." required>
				<TextInput bind:value={identity.value.name} maxlength={80} placeholder="Momo Magic" />
			</FormField>
			<FormField label="Legal name" hint="As registered, for invoices. Optional.">
				<TextInput bind:value={identity.value.legal_name} maxlength={160} placeholder="Momo Magic Foods Pvt Ltd" />
			</FormField>
		</div>
		<FormField label="Tagline" hint={`One line under your name on the storefront. ${String(identity.value.tagline).length}/140`}>
			<TextInput bind:value={identity.value.tagline} maxlength={140} placeholder="Steamed fresh, every hour" />
		</FormField>
		<FormField label="About" hint={`A short description for the storefront and search results. ${String(identity.value.description).length}/500`}>
			<TextArea bind:value={identity.value.description} rows={3} placeholder="Family-run momo kitchen since 2015." />
		</FormField>
	</SettingsSection>

	<SettingsSection
		title="Contact"
		description="How customers reach you and where they collect. Shown on confirmations and the tracking page."
		dirty={contact.dirty}
		saving={contact.saving}
		saved={contact.justSaved}
		onsave={() =>
			save(contact, {
				address: trim(contact.value.address),
				phone: trim(contact.value.phone),
				email: trim(contact.value.email),
				website: trim(contact.value.website)
			})}
		onreset={() => contact.reset()}
	>
		<FormField label="Address" hint="Where the counter is, and anything a customer should know.">
			<TextArea bind:value={contact.value.address} rows={2} placeholder="12 MG Road, Indiranagar, Bengaluru" />
		</FormField>
		<div class="sfctl-grid" data-cols="2">
			<FormField label="Phone" hint="Customers can tap to call.">
				<TextInput bind:value={contact.value.phone} inputmode="tel" maxlength={40} placeholder="98765 43210" />
			</FormField>
			<FormField label="Email" hint="For receipts and customer replies.">
				<TextInput bind:value={contact.value.email} type="email" inputmode="email" placeholder="hello@momomagic.in" />
			</FormField>
		</div>
		<FormField label="Website" hint="Must start with https://">
			<TextInput bind:value={contact.value.website} type="url" inputmode="url" placeholder="https://momomagic.in" />
		</FormField>
	</SettingsSection>

	<SettingsSection
		title="Social"
		description="Links shown in the storefront footer. Leave a network empty to hide it."
		dirty={social.dirty}
		saving={social.saving}
		saved={social.justSaved}
		onsave={() =>
			save(social, {
				social_links: Object.fromEntries(NETWORKS.map((n) => [n.key, trim(social.value[n.key])]))
			})}
		onreset={() => social.reset()}
	>
		<div class="sfctl-grid" data-cols="2">
			{#each NETWORKS as n (n.key)}
				<FormField label={n.label}>
					<TextInput bind:value={social.value[n.key]} type="url" inputmode="url" placeholder="https://" />
				</FormField>
			{/each}
		</div>
	</SettingsSection>

	<SettingsSection
		title="Regional and tax"
		description="The currency and timezone your bills and opening hours use, and the tax registration printed on them."
		dirty={regional.dirty}
		saving={regional.saving}
		saved={regional.justSaved}
		onsave={() =>
			save(regional, {
				currency: trim(regional.value.currency).toUpperCase(),
				timezone: trim(regional.value.timezone),
				tax_id: trim(regional.value.tax_id)
			})}
		onreset={() => regional.reset()}
	>
		<div class="sfctl-grid" data-cols="2">
			<FormField label="Currency" hint="Three-letter code, like INR or USD.">
				<TextInput bind:value={regional.value.currency} maxlength={3} placeholder="INR" />
			</FormField>
			<FormField label="Timezone" hint="A timezone name, like Asia/Kolkata.">
				<TextInput bind:value={regional.value.timezone} maxlength={64} placeholder="Asia/Kolkata" />
			</FormField>
		</div>
		<FormField label="Tax ID" hint="GSTIN or VAT number, printed on bills. Optional.">
			<TextInput bind:value={regional.value.tax_id} maxlength={40} placeholder="29ABCDE1234F1Z5" />
		</FormField>
	</SettingsSection>

	<SettingsSection
		title="Console"
		description="How this business appears to the people who work in it."
		dirty={console.dirty}
		saving={console.saving}
		saved={console.justSaved}
		onsave={() => save(console, { show_logo_in_console: console.value.show_logo_in_console }, true)}
		onreset={() => console.reset()}
	>
		<Switch
			bind:checked={console.value.show_logo_in_console}
			label="Show the logo in the side navigation"
			hint="Puts your logo beside the business name at the top of the rail. Needs a logo under Identity."
			disabled={!identity.saved.logo_url}
		/>
	</SettingsSection>
</div>

<style>
	.profile {
		display: flex;
		flex-direction: column;
		gap: var(--sp-11);
	}

	.brand-card {
		position: relative;
		display: flex;
		align-items: center;
		gap: 0.9rem;
		padding: 1rem 1.1rem;
		border: 1px solid var(--border);
		border-radius: var(--radius-lg);
		background:
			radial-gradient(120% 140% at 0% 0%, color-mix(in srgb, var(--accent) 12%, transparent), transparent 60%),
			var(--surface-2);
	}

	.brand-mark {
		display: grid;
		place-items: center;
		width: 3.5rem;
		height: 3.5rem;
		flex: none;
		overflow: hidden;
		border-radius: 14px;
		background: var(--accent);
		color: var(--on-accent, #fff);
		font-size: 1.15rem;
		font-weight: 750;
		box-shadow: 0 4px 14px color-mix(in srgb, var(--accent) 28%, transparent);
	}

	.brand-mark img {
		width: 100%;
		height: 100%;
		object-fit: contain;
		background: var(--surface);
	}

	.brand-text {
		display: grid;
		gap: 0.15rem;
		min-width: 0;
	}

	.brand-text strong {
		font-family: var(--font-display);
		font-size: 1.05rem;
		color: var(--text);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.brand-tagline {
		font-size: var(--fs-tab);
		color: var(--text-2);
	}

	.brand-legal {
		font-size: var(--fs-meta);
		color: var(--text-3);
	}

	.brand-badge {
		position: absolute;
		top: 0.6rem;
		right: 0.7rem;
		font-size: var(--fs-label, 0.65rem);
		font-weight: 650;
		letter-spacing: 0.05em;
		text-transform: uppercase;
		color: var(--text-3);
	}

	.marks {
		display: grid;
		grid-template-columns: 1fr;
		gap: 1rem;
	}

	@media (min-width: 640px) {
		.marks {
			grid-template-columns: 1fr 1fr;
		}
	}

	.mark {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 0.4rem;
	}
</style>
