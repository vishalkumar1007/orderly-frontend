<script lang="ts">
	import { onMount } from 'svelte';
	import Plus from '@lucide/svelte/icons/plus';
	import {
		cancelAppointment,
		checkinAppointment,
		confirmAppointment,
		createAppointment,
		listAppointments,
		noShowAppointment,
		type Appointment
	} from '$lib/tenant/appointmentsApi';
	import { listServices, type Service } from '$lib/tenant/servicesApi';
	import { listShopUsers, type ShopUser } from '$lib/tenant/staffApi';
	import DataTable from '$lib/components/admin/DataTable.svelte';
	import FormField from '$lib/components/admin/FormField.svelte';
	import Menu from '$lib/components/admin/Menu.svelte';
	import Modal from '$lib/components/admin/Modal.svelte';
	import SelectField from '$lib/components/admin/SelectField.svelte';
	import StatusBadge from '$lib/components/admin/StatusBadge.svelte';
	import TextInput from '$lib/components/admin/TextInput.svelte';
	import { toast } from '$lib/components/admin/toast';

	let appointments = $state<Appointment[]>([]);
	let services = $state<Service[]>([]);
	let staff = $state<ShopUser[]>([]);
	let loading = $state(true);
	let saving = $state(false);

	let formOpen = $state(false);
	let form = $state({ service_id: '', staff_id: '', date: '', time: '' });
	let errors = $state<Record<string, string>>({});

	const serviceName = (id: string) => services.find((s) => s.id === id)?.name ?? '—';
	const staffName = (id?: string) => (id ? staff.find((s) => s.id === id)?.name ?? '—' : 'Any');

	async function load() {
		loading = true;
		try {
			[appointments, services, staff] = await Promise.all([
				listAppointments(),
				listServices(),
				listShopUsers()
			]);
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Failed to load appointments');
		} finally {
			loading = false;
		}
	}

	onMount(load);

	function openCreate() {
		const now = new Date();
		form = {
			service_id: services[0]?.id ?? '',
			staff_id: '',
			date: now.toISOString().slice(0, 10),
			time: '10:00'
		};
		errors = {};
		formOpen = true;
	}

	async function submit() {
		const errs: Record<string, string> = {};
		if (!form.service_id) errs.service_id = 'Choose a service';
		if (!form.date || !form.time) errs.date = 'Choose a date and time';
		errors = errs;
		if (Object.keys(errs).length) return;

		saving = true;
		try {
			await createAppointment({
				service_id: form.service_id,
				staff_id: form.staff_id || undefined,
				scheduled_at: new Date(`${form.date}T${form.time}`).toISOString()
			});
			toast.success('Appointment booked');
			formOpen = false;
			await load();
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Could not book appointment');
		} finally {
			saving = false;
		}
	}

	async function run(action: (id: string) => Promise<unknown>, id: string, okMsg: string) {
		try {
			await action(id);
			toast.success(okMsg);
			await load();
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Action failed');
		}
	}

	function actionsFor(a: Appointment) {
		switch (a.status) {
			case 'REQUESTED':
				return [
					{ label: 'Confirm', onclick: () => run(confirmAppointment, a.id, 'Appointment confirmed') },
					{ label: 'Cancel', danger: true, onclick: () => run(cancelAppointment, a.id, 'Appointment cancelled') }
				];
			case 'CONFIRMED':
				return [
					{
						label: 'Check in',
						onclick: () => run(checkinAppointment, a.id, 'Checked in — added to queue')
					},
					{ label: 'No-show', onclick: () => run(noShowAppointment, a.id, 'Marked no-show') },
					{ label: 'Cancel', danger: true, onclick: () => run(cancelAppointment, a.id, 'Appointment cancelled') }
				];
			default:
				return [];
		}
	}
</script>

<div class="appt-page">
	<header class="appt-head">
		<p class="muted">Bookings for a service with a barber. Walk-ins join the queue instead.</p>
		<button type="button" class="btn btn-primary" onclick={openCreate} disabled={services.length === 0}>
			<Plus size={15} strokeWidth={2.2} />
			Book appointment
		</button>
	</header>

	{#if !loading && services.length === 0}
		<div class="panel" style="padding:1rem;">
			<p class="muted" style="margin:0;">
				Add a service first under <a href="/shop/services">Services</a> before booking appointments.
			</p>
		</div>
	{/if}

	<section class="panel panel-flush">
		<DataTable
			{loading}
			empty={!loading && appointments.length === 0}
			emptyTitle="No upcoming appointments"
			emptyDescription="Booked appointments appear here."
		>
			{#snippet head()}
				<th>When</th>
				<th>Service</th>
				<th>Barber</th>
				<th>Status</th>
				<th style="width:1%;"><span class="sr-only">Actions</span></th>
			{/snippet}
			{#each appointments as a (a.id)}
				<tr>
					<td>{new Date(a.scheduled_at).toLocaleString()}</td>
					<td class="muted">{serviceName(a.service_id)}</td>
					<td class="muted">{staffName(a.staff_id)}</td>
					<td><StatusBadge status={a.status} /></td>
					<td>
						{#if actionsFor(a).length > 0}
							<Menu label={`Actions for appointment`} items={actionsFor(a)} />
						{/if}
					</td>
				</tr>
			{/each}
		</DataTable>
	</section>
</div>

<Modal bind:open={formOpen} title="Book appointment">
	<div style="display:flex;flex-direction:column;gap:0.85rem;">
		<FormField label="Service" htmlFor="appt-service" required error={errors.service_id}>
			<SelectField
				id="appt-service"
				bind:value={form.service_id}
				options={services.map((s) => ({ value: s.id, label: `${s.name} (${s.duration_minutes} min)` }))}
			/>
		</FormField>
		<FormField label="Barber" htmlFor="appt-staff" hint="Leave unassigned if any barber can take it.">
			<SelectField
				id="appt-staff"
				bind:value={form.staff_id}
				options={[{ value: '', label: 'Any available' }, ...staff.map((s) => ({ value: s.id, label: s.name }))]}
			/>
		</FormField>
		<FormField label="Date" htmlFor="appt-date" required error={errors.date}>
			<TextInput id="appt-date" type="date" bind:value={form.date} />
		</FormField>
		<FormField label="Time" htmlFor="appt-time" required>
			<TextInput id="appt-time" type="time" bind:value={form.time} />
		</FormField>
	</div>
	{#snippet footer()}
		<button type="button" class="btn btn-ghost" onclick={() => (formOpen = false)}>Cancel</button>
		<button type="button" class="btn btn-primary" disabled={saving} onclick={submit}>
			{saving ? 'Booking…' : 'Book'}
		</button>
	{/snippet}
</Modal>

<style>
	.appt-page {
		display: grid;
		gap: 1rem;
	}

	.appt-head {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
	}
</style>
