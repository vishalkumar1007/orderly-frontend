<script lang="ts">
	import { onMount } from 'svelte';
	import Check from '@lucide/svelte/icons/check';
	import Plus from '@lucide/svelte/icons/plus';
	import Shapes from '@lucide/svelte/icons/shapes';
	import { createTenantType, fetchTenants, fetchTenantTypes, updateTenantType } from '$lib/admin/api';
	import { BUSINESS_TYPE_TEMPLATES, templateFor } from '$lib/admin/businessTypes';
	import { errorMessage } from '$lib/admin/errors';
	import type { Tenant, TenantType } from '$lib/admin/types';
	import ErrorState from '$lib/components/admin/ErrorState.svelte';
	import FormField from '$lib/components/admin/FormField.svelte';
	import SettingsSection from '$lib/components/admin/SettingsSection.svelte';
	import Skeleton from '$lib/components/admin/Skeleton.svelte';
	import Switch from '$lib/components/admin/Switch.svelte';
	import TextInput from '$lib/components/admin/TextInput.svelte';
	import { toast } from '$lib/components/admin/toast';

	/**
	 * The business-type catalogue.
	 *
	 * Each row is rendered as a card rather than a table row because a type is
	 * not one value: it carries a label, a set of defaults it will apply, and a
	 * count of businesses already relying on it. Those are the three things
	 * somebody needs before deciding to rename or withdraw one, and a table
	 * with a cramped "defaults" column hid all of it.
	 */

	let types = $state<TenantType[]>([]);
	let businesses = $state<Tenant[]>([]);
	let loading = $state(true);
	let error = $state('');

	/** Per-row edit state, so saving one card never touches another. */
	let drafts = $state<Record<string, { label: string; active: boolean }>>({});
	let savingCode = $state('');

	let newCode = $state('');
	let newLabel = $state('');
	let adding = $state(false);
	let addErrors = $state<Record<string, string>>({});

	function seedDrafts(rows: TenantType[]) {
		const next: Record<string, { label: string; active: boolean }> = {};
		for (const row of rows) next[row.code] = { label: row.label, active: row.active };
		drafts = next;
	}

	async function load() {
		loading = true;
		error = '';
		try {
			const [rows, tenants] = await Promise.all([fetchTenantTypes(), fetchTenants()]);
			types = rows.slice().sort((a, b) => a.sort_order - b.sort_order);
			businesses = tenants;
			seedDrafts(types);
		} catch (err) {
			error = errorMessage(err, 'load business types');
		} finally {
			loading = false;
		}
	}

	onMount(load);

	function inUse(code: string): number {
		return businesses.filter((b) => b.business_type === code).length;
	}

	function hasTemplate(code: string): boolean {
		return code in BUSINESS_TYPE_TEMPLATES;
	}

	function isDirty(row: TenantType): boolean {
		const draft = drafts[row.code];
		if (!draft) return false;
		return draft.label !== row.label || draft.active !== row.active;
	}

	/** What this type will configure on a business that picks it. */
	function defaults(code: string): { label: string; value: string }[] {
		const t = templateFor(code);
		return [
			{ label: 'Catalogue', value: `${t.terminology.catalog}, in ${t.terminology.groups.toLowerCase()}` },
			{ label: 'Storefront', value: `${t.storefront.theme_preset} theme · ${t.storefront.product_layout} layout` },
			{
				label: 'Orders',
				value:
					t.workflow.acceptance_mode === 'AUTO'
						? 'Accepted automatically'
						: 'Staff accept each order'
			},
			{ label: 'Preparation', value: `${t.behaviour.prep_time_minutes} minutes` }
		];
	}

	async function saveRow(row: TenantType) {
		const draft = drafts[row.code];
		if (!draft) return;
		savingCode = row.code;
		try {
			const updated = await updateTenantType(row.code, {
				label: draft.label.trim(),
				active: draft.active,
				sort_order: row.sort_order
			});
			types = types.map((t) => (t.code === updated.code ? updated : t));
			drafts[row.code] = { label: updated.label, active: updated.active };
			toast.success(`${updated.label} saved`);
		} catch (err) {
			toast.error(errorMessage(err, 'save this business type'));
		} finally {
			savingCode = '';
		}
	}

	async function addType() {
		const code = newCode.trim().toUpperCase().replace(/[\s-]+/g, '_');
		const next: Record<string, string> = {};
		if (!/^[A-Z][A-Z0-9_]{0,31}$/.test(code)) {
			next.code = 'Start with a letter; capitals, numbers and underscores only';
		}
		if (!newLabel.trim()) next.label = 'A label is required';
		if (types.some((t) => t.code === code)) next.code = 'That code already exists';
		addErrors = next;
		if (Object.keys(next).length > 0) return;

		adding = true;
		try {
			const created = await createTenantType({
				code,
				label: newLabel.trim(),
				active: true,
				sort_order: (types.at(-1)?.sort_order ?? 0) + 10
			});
			types = [...types, created].sort((a, b) => a.sort_order - b.sort_order);
			drafts[created.code] = { label: created.label, active: created.active };
			newCode = '';
			newLabel = '';
			toast.success(`${created.label} added`);
		} catch (err) {
			toast.error(errorMessage(err, 'add this business type'));
		} finally {
			adding = false;
		}
	}

	const offered = $derived(types.filter((t) => t.active).length);
</script>

{#if error}
	<div class="panel" style="margin-bottom:1rem;"><ErrorState message={error} onretry={load} /></div>
{/if}

{#if loading}
	<div style="display:flex;flex-direction:column;gap:1.5rem;">
		{#each [1, 2] as _, i (i)}
			<Skeleton height="14rem" />
		{/each}
	</div>
{:else}
	<SettingsSection
		title="Offered at onboarding"
		description={`${offered} of ${types.length} types are currently offered. Withdrawing one stops it being offered to new businesses; the businesses already using it keep it and keep working.`}
		icon={Shapes}
	>
		{#snippet footer()}
			<span class="bt-foot">
				Each card saves on its own — there is no page-wide save to forget.
			</span>
		{/snippet}

		<div class="bt-list">
			{#each types as row (row.code)}
				{@const draft = drafts[row.code]}
				{@const used = inUse(row.code)}
				<article class={['bt-card', draft?.active ? '' : 'withdrawn'].join(' ')}>
					<div class="bt-head">
						<div class="bt-id">
							<input
								class="input bt-label"
								bind:value={drafts[row.code].label}
								aria-label={`Label for ${row.code}`}
							/>
							<span class="bt-meta">
								<code class="mono">{row.code}</code>
								{#if !hasTemplate(row.code)}
									<span class="bt-tag warn" title="No built-in template — neutral defaults are used">
										generic defaults
									</span>
								{/if}
								<span class="bt-tag">
									{used}
									{used === 1 ? 'business' : 'businesses'}
								</span>
							</span>
						</div>

						<div class="bt-actions">
							<Switch bind:checked={drafts[row.code].active} label="Offered" />
							<button
								type="button"
								class="btn btn-primary btn-sm"
								disabled={savingCode === row.code || !isDirty(row) || !draft?.label.trim()}
								onclick={() => saveRow(row)}
							>
								{#if savingCode === row.code}
									Saving…
								{:else if isDirty(row)}
									Save
								{:else}
									<Check size={13} strokeWidth={2.6} />
									Saved
								{/if}
							</button>
						</div>
					</div>

					<dl class="bt-defaults">
						{#each defaults(row.code) as item (item.label)}
							<div>
								<dt>{item.label}</dt>
								<dd>{item.value}</dd>
							</div>
						{/each}
					</dl>
				</article>
			{/each}
		</div>
	</SettingsSection>

	<SettingsSection
		title="Add a type"
		description="A new type works immediately. Until someone writes a template for its code, it starts businesses on neutral defaults rather than breaking anything."
		icon={Plus}
	>
		{#snippet footer()}
			<button
				type="button"
				class="btn btn-primary btn-sm"
				disabled={adding || !newCode.trim() || !newLabel.trim()}
				onclick={addType}
			>
				{adding ? 'Adding…' : 'Add business type'}
			</button>
		{/snippet}

		<div class="bt-add">
			<FormField
				label="Code"
				htmlFor="nt-code"
				error={addErrors.code}
				hint="Stored form. Cannot be changed later."
			>
				<TextInput id="nt-code" bind:value={newCode} placeholder="PHARMACY" />
			</FormField>
			<FormField
				label="Label"
				htmlFor="nt-label"
				error={addErrors.label}
				hint="What an operator sees when onboarding."
			>
				<TextInput id="nt-label" bind:value={newLabel} placeholder="Pharmacy" />
			</FormField>
		</div>
	</SettingsSection>
{/if}

<style>
	.bt-list {
		display: grid;
		gap: 0.7rem;
		grid-template-columns: 1fr;
	}

	@media (min-width: 900px) {
		.bt-list {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}

	.bt-card {
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		background: var(--surface-2);
		padding: 0.9rem 1rem;
		transition: opacity var(--tr);
		min-width: 0;
	}

	.bt-card.withdrawn {
		opacity: 0.62;
	}

	.bt-head {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-start;
		justify-content: space-between;
		gap: 0.75rem;
	}

	.bt-id {
		min-width: 0;
		flex: 1;
	}

	.bt-label {
		max-width: 100%;
		font-weight: 600;
	}

	.bt-meta {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.4rem;
		margin-top: 0.4rem;
		font-size: var(--fs-meta);
	}

	.bt-tag {
		padding: 0.08rem 0.35rem;
		border-radius: var(--radius-sm);
		background: var(--surface-3);
		color: var(--text-3);
		font-weight: 550;
	}

	.bt-tag.warn {
		background: var(--warn-bg);
		color: var(--warn);
	}

	.bt-actions {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		flex-shrink: 0;
		flex-wrap: wrap;
	}

	.bt-defaults {
		display: grid;
		gap: 0.3rem 1.25rem;
		grid-template-columns: repeat(auto-fill, minmax(min(100%, 11rem), 1fr));
		margin: 0.85rem 0 0;
		padding-top: 0.75rem;
		border-top: 1px solid var(--border-subtle);
	}

	.bt-defaults > div {
		display: flex;
		align-items: baseline;
		gap: 0.4rem;
		font-size: var(--fs-code);
		min-width: 0;
	}

	.bt-defaults dt {
		color: var(--text-3);
		flex-shrink: 0;
	}

	.bt-defaults dd {
		margin: 0;
		color: var(--text-2);
		text-transform: capitalize;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.bt-add {
		display: grid;
		gap: 1.1rem;
		grid-template-columns: repeat(2, minmax(0, 1fr));
	}

	@media (max-width: 640px) {
		.bt-add {
			grid-template-columns: 1fr;
		}
	}

	.bt-foot {
		font-size: var(--fs-code);
		color: var(--text-3);
	}
</style>
