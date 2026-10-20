<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import Skeleton from '$lib/components/admin/Skeleton.svelte';
	import SettingsShell from '$lib/components/admin/SettingsShell.svelte';
	import { me, type User } from '$lib/auth';
	import {
		ensureLiveStorefrontAdmin,
		getStorefrontAdminOrDefault,
		loadStorefrontAdmin,
		setStorefrontAdmin,
		type AdminStorefront
	} from '$lib/storefront/adminCache.svelte';
	import { setStorefrontContext } from '$lib/storefront/admin-context';
	import { MOVED_FROM_SETTINGS, configHref } from '$lib/tenant/configuration';
	import {
		SETTINGS_GROUPS,
		settingsSectionFor,
		visibleSettingsSections
	} from '$lib/tenant/settings';
	import AppearancePanel from '$lib/components/tenant/settings/AppearancePanel.svelte';
	import BusinessProfilePanel from '$lib/components/tenant/settings/BusinessProfilePanel.svelte';
	import MfaPolicyPanel from '$lib/components/admin/MfaPolicyPanel.svelte';
	import MfaSetupPanel from '$lib/components/admin/MfaSetupPanel.svelte';
	import WorkflowPanel from '$lib/components/tenant/settings/WorkflowPanel.svelte';

	/**
	 * Settings.
	 *
	 * One destination with a section rail inside it, rather than six entries in
	 * the main navigation: the same shape the platform console uses, for the
	 * same reason. Settings is somewhere you go to change one thing and leave;
	 * spreading it across the rail made the console's top-level navigation
	 * mostly about configuration, which is not what a shopkeeper's day is.
	 *
	 * The section lives in the query string so a link can point at one, the back
	 * button works, and a reload stays put. The list itself is a pure module
	 * (`lib/tenant/settings.ts`) so `check:nav` can exercise the real thing.
	 *
	 * The storefront document is loaded once, here, and shared with every
	 * section that writes it. Three panels editing three parts of one document
	 * through three separate fetches is how two tabs end up disagreeing about
	 * what is saved.
	 */
	let { data }: { data: { storefront: AdminStorefront; storefrontError: string | null } } =
		$props();

	let config = $state<AdminStorefront>(data.storefront ?? getStorefrontAdminOrDefault());
	let configError = $state(data.storefrontError ?? '');
	/**
	 * Whether the shop's own storefront document has arrived.
	 *
	 * The sections that edit it seed their fields once, on mount, which is the
	 * behaviour an editable form wants: a refresh must never overwrite what
	 * somebody has typed. That is only correct if they mount *after* the real
	 * document, so until it lands they get a skeleton rather than a form full
	 * of defaults that silently becomes wrong.
	 */
	let configLoaded = $state(false);
	let retrying = $state(false);
	let user = $state<User | null>(null);

	setStorefrontContext({
		get config() {
			return config;
		},
		save,
		refresh
	});

	async function bootstrap(force = false) {
		try {
			const fetched = await loadStorefrontAdmin(force);
			config = fetched;
			setStorefrontAdmin(fetched);
			configError = '';
			configLoaded = true;
		} catch (err) {
			configError = err instanceof Error ? err.message : 'Could not load your settings';
		} finally {
			retrying = false;
		}
	}

	async function save(run: () => Promise<AdminStorefront>): Promise<boolean> {
		try {
			await ensureLiveStorefrontAdmin();
			const updated = await run();
			config = updated;
			setStorefrontAdmin(updated);
			configError = '';
			return true;
		} catch (err) {
			configError = err instanceof Error ? err.message : 'Could not save';
			return false;
		}
	}

	async function refresh() {
		await bootstrap(true);
	}

	async function retry() {
		retrying = true;
		await bootstrap(true);
	}

	onMount(() => {
		void bootstrap(false);
		void (async () => {
			try {
				user = await me();
			} catch {
				// The shell already guards this route. Without a permission list
				// we show every section and let the API refuse what it must.
			}
		})();
	});

	const sections = $derived(visibleSettingsSections(user?.permissions));
	const groups = $derived(
		SETTINGS_GROUPS.map((label) => ({
			label,
			items: sections.filter((section) => section.group === label)
		})).filter((group) => group.items.length > 0)
	);
	const active = $derived(
		settingsSectionFor($page.url.searchParams.get('section'), user?.permissions)
	);

	/** Only the owner may rewrite what everyone else starts from. */
	const canSetBusinessDefault = $derived(
		(user?.permissions ?? []).includes('storefront') || user?.role === 'TENANT_ADMIN'
	);

	/** The org-wide MFA policy, not one person's own enrollment: owner-only. */
	const canEditMfaPolicy = $derived(
		(user?.permissions ?? []).includes('organization') || user?.role === 'TENANT_ADMIN'
	);

	// Notifications, Email templates and Integrations moved to Configuration:
	// forward old links and bookmarks there, keeping any extra parameters.
	$effect(() => {
		const params = $page.url.searchParams;
		const requested = params.get('section');
		if (requested && MOVED_FROM_SETTINGS.has(requested)) {
			const rest = new URLSearchParams(params);
			rest.delete('section');
			goto(configHref(requested, rest.toString()), { replaceState: true });
		}
	});

	function select(id: string) {
		goto(`?section=${id}`, { replaceState: true, keepFocus: true, noScroll: true });
	}

</script>

{#snippet formSkeleton()}
	<div class="panel">
		<Skeleton height="1.1rem" width="11rem" />
		<div class="set-skeleton">
			{#each [1, 2, 3, 4] as _, i (i)}
				<Skeleton height="4.5rem" />
			{/each}
		</div>
	</div>
{/snippet}

<SettingsShell
	{groups}
	activeId={active.id}
	title={active.label}
	lede={active.lede}
	onselect={select}
>
	{#snippet notice()}
		{#if configError && active.id !== 'appearance' && active.id !== 'security'}
			<div class="alert alert-danger set-alert">
				<div><strong>API notice:</strong> {configError}</div>
				<button
					class="btn btn-primary btn-sm"
					type="button"
					disabled={retrying}
					onclick={() => void retry()}
				>
					{retrying ? 'Retrying…' : 'Try again'}
				</button>
			</div>
		{/if}
	{/snippet}

	{#if active.id === 'appearance'}
		<AppearancePanel {canSetBusinessDefault} />
	{:else if active.id === 'security'}
		{#if canEditMfaPolicy}
			<MfaPolicyPanel />
		{/if}
		<MfaSetupPanel />
	{:else if !configLoaded}
		{@render formSkeleton()}
	{:else if active.id === 'business'}
		<BusinessProfilePanel {config} {save} {refresh} />
	{:else}
		<WorkflowPanel {config} {save} {refresh} />
	{/if}
</SettingsShell>

<style>
	.set-skeleton {
		margin-top: var(--sp-8);
		display: grid;
		gap: var(--sp-5);
		grid-template-columns: repeat(auto-fill, minmax(11rem, 1fr));
	}

	.set-alert {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--sp-8);
		flex-wrap: wrap;
	}
</style>
