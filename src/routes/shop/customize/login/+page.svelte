<script lang="ts">
	import { seed, useStorefront, type StorefrontContext } from '$lib/storefront/admin-context';
	import {
		LOGIN_MODE_OPTIONS,
		storefrontAdminApi
	} from '$lib/storefront/admin';
	import { toast } from '$lib/components/admin/toast';
	import SignInMethods from '$lib/components/studio/SignInMethods.svelte';
	import type { SignInMethod } from '$lib/storefront/api';

	let props: Partial<StorefrontContext> = $props();
	const ctx = useStorefront(() => props);
	const config = $derived(ctx.config);
	const save = (run: Parameters<StorefrontContext['save']>[0]) => ctx.save(run);

	function initialMode(): 'off' | 'optional' | 'required' {
		const m = ctx.config.behaviour.customer_login_mode;
		if (m === 'off' || m === 'optional' || m === 'required') return m;
		return ctx.config.behaviour.customer_login_enabled ? 'optional' : 'off';
	}

	let mode = $state<'off' | 'optional' | 'required'>(seed(() => initialMode()));
	let methods = $state<SignInMethod[]>(seed(() => ctx.config.behaviour.customer_login_methods ?? ['PHONE', 'EMAIL']));
	let saving = $state(false);

	let dirty = false;
	$effect(() => {
		const m = ctx.config.behaviour.customer_login_mode;
		if (!dirty && m) {
			mode = (m === 'off' || m === 'optional' || m === 'required') ? m : 'optional';
		}
	});

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		saving = true;
		const ok = await save(() =>
			storefrontAdminApi.saveBehaviour({ customer_login_mode: mode, customer_login_methods: methods })
		);
		saving = false;
		if (ok) {
			const label = LOGIN_MODE_OPTIONS.find((o) => o.value === mode)?.label ?? mode;
			toast.success(`Customer login set to ${label.toLowerCase()}`);
		} else {
			toast.error('Could not save this setting');
		}
	}
</script>

<form onsubmit={submit}>
	<div class="sfctl-section">
		<h2>Customer sign-in</h2>
		<p class="sfctl-note">
			Customers sign in with a one-time code, no password. Choose whether sign-in is hidden,
			available, or required before checkout.
		</p>

		<div style="display:grid;gap:0.4rem;">
			{#each LOGIN_MODE_OPTIONS as option (option.value)}
				<button
					class="sfopt"
					type="button"
					aria-pressed={mode === option.value}
					onclick={() => (mode = option.value)}
				>
					<span class="sfopt-mark" aria-hidden="true"></span>
					<span class="sfopt-body">
						<span class="sfopt-label">{option.label}</span>
						<span class="sfopt-hint">{option.hint}</span>
					</span>
				</button>
			{/each}
		</div>
	</div>

	{#if mode !== 'off'}
		<div class="sfctl-section">
			<h2>Sign-in methods</h2>
			<p class="sfctl-note">Only methods set up under Configuration, Integrations can be switched on.</p>
			<SignInMethods {methods} channels={ctx.config.sign_in_channels} {mode} onchange={(m) => (methods = m)} />
		</div>
	{/if}

	<div class="sfctl-section">
		<h2>What a customer gets</h2>
		<p class="sfctl-note">This is the list your customers read on the sign-in screen.</p>
		<ul style="margin:0;padding-left:1.1rem;display:grid;gap:0.35rem;color:var(--text-2);font-size:var(--fs-body);">
			<li>Their name and phone are filled in next time, so checkout is one tap shorter.</li>
			<li>Every order they have placed, with live tracking from the profile screen.</li>

		</ul>
	</div>

	<div class="sfctl-section">
		<h2>How it works</h2>
		<p class="sfctl-note">There is no password anywhere in this flow.</p>
		<ol style="margin:0;padding-left:1.1rem;display:grid;gap:0.35rem;color:var(--text-2);font-size:var(--fs-body);line-height:1.5;">
			<li>The customer enters a phone number or email, whichever you offer.</li>
			<li>They receive a six-digit code by text or email that expires in five minutes.</li>
			<li>They enter it once and are signed in on that device.</li>
		</ol>
	</div>

	<div class="sfctl-foot">
		<span class="sfctl-foot-note">
			{#if mode === 'required'}
				Guests cannot place an order until they sign in.
			{:else if mode === 'optional'}
				Guest checkout stays available; sign-in is a shortcut.
			{:else}
				Sign-in screens and OTP endpoints are hidden.
			{/if}
		</span>
		<button class="btn btn-primary" type="submit" disabled={saving}>
			{saving ? 'Saving…' : 'Save'}
		</button>
	</div>
</form>
