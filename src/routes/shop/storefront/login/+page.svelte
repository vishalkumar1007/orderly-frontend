<script lang="ts">
	import FormField from '$lib/components/admin/FormField.svelte';
	import TextInput from '$lib/components/admin/TextInput.svelte';
	import { seed, type StorefrontContext } from '$lib/storefront/admin-context';
	import { storefrontAdminApi, type AdminStorefront } from '$lib/storefront/admin';
	import { toast } from '$lib/components/admin/toast';

	/**
	 * Customer login.
	 *
	 * Signing in is a convenience, never a requirement. This screen controls
	 * whether it is *available*; it cannot make it mandatory, and there is no
	 * setting here that could block a guest from ordering. That is the point of
	 * the screen, so the copy says so plainly.
	 */
	let { config, save }: StorefrontContext = $props();

	let enabled = $state(seed(() => config.behaviour.customer_login_enabled));
	let saving = $state(false);

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		saving = true;
		const ok = await save(() =>
			storefrontAdminApi.saveBehaviour({ customer_login_enabled: enabled })
		);
		saving = false;
		if (ok) {
			toast.success(enabled ? 'Phone sign-in is on' : 'Phone sign-in is off');
		} else {
			toast.error('Could not save this setting');
		}
	}
</script>

<form onsubmit={submit}>
	<div class="sfctl-section">
		<h2>Customer sign-in</h2>
		<p class="sfctl-note">
			Let customers sign in with their phone number to get faster checkout, order history and
			live tracking. Turning this off changes nothing else: anyone can still order as a guest,
			every time, without an account.
		</p>

		<div style="display:grid;gap:0.4rem;">
			<button
				class="sfopt"
				type="button"
				aria-pressed={enabled}
				onclick={() => (enabled = !enabled)}
			>
				<span class="sfopt-mark" aria-hidden="true"></span>
				<span class="sfopt-body">
					<span class="sfopt-label">Phone sign-in</span>
					<span class="sfopt-hint">
						{enabled
							? 'Customers can sign in with a one-time code. No password, no email.'
							: 'The sign-in screens are hidden. Guest checkout is unaffected.'}
					</span>
				</span>
			</button>
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
		<span class="sfctl-foot-note">Guest checkout is always available, whatever this is set to.</span>
		<button class="btn btn-primary" type="submit" disabled={saving}>
			{saving ? 'Saving…' : 'Save'}
		</button>
	</div>
</form>
