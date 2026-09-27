<script lang="ts">
	import { seed, type StorefrontContext } from '$lib/storefront/admin-context';
	import {
		LOGIN_MODE_OPTIONS,
		storefrontAdminApi
	} from '$lib/storefront/admin';
	import { toast } from '$lib/components/admin/toast';

	let { config, save }: StorefrontContext = $props();

	function initialMode(): 'off' | 'optional' | 'required' {
		const mode = config.behaviour.customer_login_mode;
		if (mode === 'off' || mode === 'optional' || mode === 'required') return mode;
		return config.behaviour.customer_login_enabled ? 'optional' : 'off';
	}

	let mode = $state<'off' | 'optional' | 'required'>(seed(() => initialMode()));
	let saving = $state(false);

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		saving = true;
		const ok = await save(() =>
			storefrontAdminApi.saveBehaviour({ customer_login_mode: mode })
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
			Phone OTP sign-in — no password, no email. Choose whether it is hidden, available, or
			required before checkout.
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

	<div class="sfctl-section">
		<h2>What a customer gets</h2>
		<p class="sfctl-note">This is the list your customers read on the sign-in screen.</p>
		<ul style="margin:0;padding-left:1.1rem;display:grid;gap:0.35rem;color:var(--text-2);font-size:0.875rem;">
			<li>Their name and phone are filled in next time, so checkout is one tap shorter.</li>
			<li>Every order they have placed, with live tracking from the profile screen.</li>
			<li>Later: offers, coupons and loyalty — the plumbing is per-customer already.</li>
		</ul>
	</div>

	<div class="sfctl-section">
		<h2>How it works</h2>
		<p class="sfctl-note">There is no email and no password anywhere in this flow.</p>
		<ol style="margin:0;padding-left:1.1rem;display:grid;gap:0.35rem;color:var(--text-2);font-size:0.875rem;line-height:1.5;">
			<li>The customer types a phone number.</li>
			<li>They receive a six-digit code that expires in five minutes.</li>
			<li>They enter it once and are signed in on that device.</li>
		</ol>
		<div class="alert alert-info" style="margin-top:0.9rem;">
			No SMS provider is wired up in this build, so the code is shown on screen and written to
			the server log instead of being texted. The endpoints and the limits are already the real
			ones.
		</div>
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
