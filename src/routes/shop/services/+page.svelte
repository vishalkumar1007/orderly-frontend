<script lang="ts">
	import { onMount } from 'svelte';
	import Plus from '@lucide/svelte/icons/plus';
	import ConfirmDialog from '$lib/components/admin/ConfirmDialog.svelte';
	import DataTable from '$lib/components/admin/DataTable.svelte';
	import FormField from '$lib/components/admin/FormField.svelte';
	import Menu from '$lib/components/admin/Menu.svelte';
	import Modal from '$lib/components/admin/Modal.svelte';
	import StatusBadge from '$lib/components/admin/StatusBadge.svelte';
	import Switch from '$lib/components/admin/Switch.svelte';
	import TextInput from '$lib/components/admin/TextInput.svelte';
	import { toast } from '$lib/components/admin/toast';
	import {
		createService,
		deleteService,
		listServices,
		updateService,
		type Service
	} from '$lib/tenant/servicesApi';

	let services = $state<Service[]>([]);
	let loading = $state(true);
	let saving = $state(false);

	let formOpen = $state(false);
	let editing = $state<Service | null>(null);
	let form = $state({ name: '', duration_minutes: '30', price: '0', is_active: true });
	let errors = $state<Record<string, string>>({});

	let target = $state<Service | null>(null);
	let confirmOpen = $state(false);
	let confirmLoading = $state(false);

	async function load() {
		loading = true;
		try {
			services = await listServices();
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Failed to load services');
		} finally {
			loading = false;
		}
	}

	onMount(load);

	function openCreate() {
		editing = null;
		form = { name: '', duration_minutes: '30', price: '0', is_active: true };
		errors = {};
		formOpen = true;
	}

	function openEdit(service: Service) {
		editing = service;
		form = {
			name: service.name,
			duration_minutes: String(service.duration_minutes),
			price: String(service.price),
			is_active: service.is_active
		};
		errors = {};
		formOpen = true;
	}

	async function submit() {
		const errs: Record<string, string> = {};
		if (!form.name.trim()) errs.name = 'Name is required';
		if (!Number(form.duration_minutes) || Number(form.duration_minutes) <= 0)
			errs.duration_minutes = 'Enter minutes';
		if (Number(form.price) < 0 || form.price.trim() === '') errs.price = 'Enter a price';
		errors = errs;
		if (Object.keys(errs).length) return;

		saving = true;
		try {
			const payload = {
				name: form.name.trim(),
				duration_minutes: Number(form.duration_minutes),
				price: Number(form.price),
				is_active: form.is_active
			};
			if (editing) {
				await updateService(editing.id, payload);
				toast.success('Service updated');
			} else {
				await createService(payload);
				toast.success('Service added');
			}
			formOpen = false;
			await load();
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Could not save service');
		} finally {
			saving = false;
		}
	}

	function askDelete(service: Service) {
		target = service;
		confirmOpen = true;
	}

	async function runDelete() {
		if (!target) return;
		confirmLoading = true;
		try {
			await deleteService(target.id);
			confirmOpen = false;
			toast.success(`${target.name} removed`);
			await load();
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Could not remove service');
		} finally {
			confirmLoading = false;
		}
	}

	function money(n: number): string {
		return `₹${n.toFixed(2)}`;
	}
</script>

<div class="services-page">
	<header class="services-head">
		<p class="muted">What customers can book an appointment for.</p>
		<button type="button" class="btn btn-primary" onclick={openCreate}>
			<Plus size={15} strokeWidth={2.2} />
			Add service
		</button>
	</header>

	<section class="panel panel-flush">
		<DataTable
			{loading}
			empty={!loading && services.length === 0}
			emptyTitle="No services yet"
			emptyDescription="Add a service so customers can book an appointment for it."
		>
			{#snippet head()}
				<th>Service</th>
				<th>Duration</th>
				<th>Price</th>
				<th>Status</th>
				<th style="width:1%;"><span class="sr-only">Actions</span></th>
			{/snippet}
			{#each services as s (s.id)}
				<tr>
					<td><strong>{s.name}</strong></td>
					<td class="muted">{s.duration_minutes} min</td>
					<td class="muted">{money(s.price)}</td>
					<td><StatusBadge status={s.is_active ? 'ACTIVE' : 'DISABLED'} /></td>
					<td>
						<Menu
							label={`Actions for ${s.name}`}
							items={[
								{ label: 'Edit', onclick: () => openEdit(s) },
								{ label: 'Remove', danger: true, onclick: () => askDelete(s), separatorBefore: true }
							]}
						/>
					</td>
				</tr>
			{/each}
		</DataTable>
	</section>
</div>

<Modal bind:open={formOpen} title={editing ? 'Edit service' : 'Add service'}>
	<div style="display:flex;flex-direction:column;gap:0.85rem;">
		<FormField label="Name" htmlFor="svc-name" required error={errors.name}>
			<TextInput id="svc-name" bind:value={form.name} placeholder="Haircut" />
		</FormField>
		<FormField label="Duration (minutes)" htmlFor="svc-duration" required error={errors.duration_minutes}>
			<TextInput id="svc-duration" type="number" min={1} bind:value={form.duration_minutes} />
		</FormField>
		<FormField label="Price" htmlFor="svc-price" required error={errors.price}>
			<TextInput id="svc-price" type="number" min={0} step="0.01" bind:value={form.price} />
		</FormField>
		<Switch bind:checked={form.is_active} label="Active" hint="Inactive services can't be booked." />
	</div>
	{#snippet footer()}
		<button type="button" class="btn btn-ghost" onclick={() => (formOpen = false)}>Cancel</button>
		<button type="button" class="btn btn-primary" disabled={saving} onclick={submit}>
			{saving ? 'Saving…' : 'Save'}
		</button>
	{/snippet}
</Modal>

<ConfirmDialog
	bind:open={confirmOpen}
	title="Remove service?"
	message={target ? `${target.name} will no longer be bookable.` : ''}
	confirmLabel="Remove"
	danger
	loading={confirmLoading}
	onconfirm={runDelete}
/>

<style>
	.services-page {
		display: grid;
		gap: 1rem;
	}

	.services-head {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
	}
</style>
