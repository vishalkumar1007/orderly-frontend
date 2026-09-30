<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import Rocket from '@lucide/svelte/icons/rocket';
	import Skeleton from '$lib/components/admin/Skeleton.svelte';
	import { me, type User } from '$lib/auth';
	import type { ConfigService } from '$lib/admin/configTypes';
	import {
		ensureLiveStorefrontAdmin,
		getStorefrontAdminOrDefault,
		loadStorefrontAdmin,
		setStorefrontAdmin,
		type AdminStorefront
	} from '$lib/storefront/adminCache.svelte';
	import { setStorefrontContext } from '$lib/storefront/admin-context';
	import {
		SETTINGS_GROUPS,
		settingsSectionFor,
		visibleSettingsSections
	} from '$lib/tenant/settings';
	import AppearancePanel from '$lib/components/tenant/settings/AppearancePanel.svelte';
	import BusinessProfilePanel from '$lib/components/tenant/settings/BusinessProfilePanel.svelte';
	import IntegrationsPanel from '$lib/components/tenant/settings/IntegrationsPanel.svelte';
	import NotificationsPanel from '$lib/components/tenant/settings/NotificationsPanel.svelte';
	import WorkflowPanel from '$lib/components/tenant/settings/WorkflowPanel.svelte';

	/**
	 * Settings.
	 *
	 * One destination with a section rail inside it, rather than six entries in
	 * the main navigation — the same shape the platform console uses, for the
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
	 * behaviour an editable form wants — a refresh must never overwrite what
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

	/** Integrations keeps its service in the URL too, beside the section. */
	const service = $derived(
		(($page.url.searchParams.get('service') ?? 'SMTP').toUpperCase() as ConfigService) ?? 'SMTP'
	);

	function select(id: string) {
		goto(`?section=${id}`, { replaceState: true, keepFocus: true, noScroll: true });
	}

	function selectService(next: ConfigService) {
		goto(`?section=integrations&service=${next}`, {
			replaceState: true,
			keepFocus: true,
			noScroll: true
		});
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

<div class="set-shell">
	<nav class="set-rail" aria-label="Settings sections">
		{#each groups as group (group.label)}
			<p class="set-rail-label">{group.label}</p>
			{#each group.items as section (section.id)}
				{@const isActive = active.id === section.id}
				<button
					type="button"
					class="set-rail-link"
					class:active={isActive}
					aria-current={isActive ? 'page' : undefined}
					onclick={() => select(section.id)}
				>
					<section.icon size={15} strokeWidth={1.9} />
					{section.label}
				</button>
			{/each}
		{/each}

		<!-- Not a section: a place to go, not a form to fill in. It keeps its
		     own screen and stays findable from here. -->
		<a class="set-rail-link set-rail-out" href="/shop/storefront/launch">
			<Rocket size={15} strokeWidth={1.9} />
			Launch checklist
		</a>
	</nav>

	<div class="set-main">
		<p class="set-lede">{active.lede}</p>

		{#if configError && active.id !== 'appearance' && active.id !== 'integrations'}
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

		{#if active.id === 'integrations'}
			<IntegrationsPanel {service} onselect={selectService} />
		{:else if active.id === 'appearance'}
			<AppearancePanel {canSetBusinessDefault} />
		{:else if !configLoaded}
			{@render formSkeleton()}
		{:else if active.id === 'business'}
			<BusinessProfilePanel {config} {save} {refresh} />
		{:else if active.id === 'workflow'}
			<WorkflowPanel {config} {save} {refresh} />
		{:else}
			<NotificationsPanel {config} {save} {refresh} />
		{/if}
	</div>
</div>

<style>
	.set-shell {
		display: grid;
		gap: 1.5rem;
		align-items: start;
	}

	@media (min-width: 1000px) {
		.set-shell {
			grid-template-columns: 14rem minmax(0, 1fr);
		}
	}

	.set-rail {
		display: flex;
		flex-direction: column;
		gap: 0.1rem;
	}

	@media (min-width: 1000px) {
		.set-rail {
			position: sticky;
			top: calc(var(--topbar-h) + 1rem);
		}
	}

	@media (max-width: 999px) {
		/* A column of section links above a form reads as part of the form on a
		   phone, so it becomes a scrolling row instead. */
		.set-rail {
			flex-direction: row;
			overflow-x: auto;
			padding-bottom: 0.3rem;
			gap: 0.3rem;
		}

		.set-rail-label {
			display: none;
		}
	}

	.set-rail-label {
		margin: 0.85rem 0 0.35rem;
		padding: 0 0.6rem;
		font-size: var(--fs-label);
		font-weight: 700;
		letter-spacing: 0.07em;
		text-transform: uppercase;
		color: var(--text-3);
	}

	.set-rail-label:first-child {
		margin-top: 0;
	}

	.set-rail-link {
		display: flex;
		align-items: center;
		gap: 0.55rem;
		padding: 0.5rem 0.6rem;
		border: 0;
		border-radius: 8px;
		background: transparent;
		color: var(--text-2);
		font-family: inherit;
		font-size: var(--fs-body);
		font-weight: 500;
		text-align: left;
		text-decoration: none;
		white-space: nowrap;
		cursor: pointer;
		transition:
			background var(--tr),
			color var(--tr);
	}

	.set-rail-link:hover {
		background: var(--surface-2);
		color: var(--text);
	}

	.set-rail-link.active {
		background: var(--accent-soft);
		color: var(--accent-dark);
		font-weight: 600;
	}

	.set-rail-out {
		margin-top: 0.6rem;
		color: var(--text-3);
	}

	@media (max-width: 999px) {
		.set-rail-out {
			margin-top: 0;
		}
	}

	.set-main {
		max-width: 58rem;
	}

	.set-lede {
		margin: 0 0 1.5rem;
		font-size: var(--fs-body);
		line-height: 1.6;
		color: var(--text-3);
		max-width: 46rem;
	}

	.set-skeleton {
		margin-top: 1rem;
		display: grid;
		gap: 0.7rem;
		grid-template-columns: repeat(auto-fill, minmax(11rem, 1fr));
	}

	.set-alert {
		margin-bottom: 1rem;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		flex-wrap: wrap;
	}
</style>
