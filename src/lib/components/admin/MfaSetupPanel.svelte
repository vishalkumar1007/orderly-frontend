<script lang="ts">
	import { onMount } from 'svelte';
	import Copy from '@lucide/svelte/icons/copy';
	import Download from '@lucide/svelte/icons/download';
	import Mail from '@lucide/svelte/icons/mail';
	import ShieldCheck from '@lucide/svelte/icons/shield-check';
	import {
		confirmEmailOtp,
		confirmMfa,
		fetchMfaStatus,
		regenerateRecoveryCodes,
		removeMfaMethod,
		requestEmailOtp,
		setupMfa,
		type MfaMethod,
		type MfaMethodStatus,
		type MfaSetup
	} from '$lib/mfaApi';
	import { errorMessage } from '$lib/admin/errors';
	import FormField from '$lib/components/admin/FormField.svelte';
	import Modal from '$lib/components/admin/Modal.svelte';
	import SettingsSection from '$lib/components/admin/SettingsSection.svelte';
	import Skeleton from '$lib/components/admin/Skeleton.svelte';
	import TextInput from '$lib/components/admin/TextInput.svelte';
	import { toast } from '$lib/components/admin/toast';

	/**
	 * Two-factor authentication for one person's own account — one or more
	 * methods (authenticator app, email code), each addable and removable on
	 * its own, with a single shared set of recovery codes issued once, on
	 * whichever method is enrolled first.
	 *
	 * Mounted as-is in both the superadmin's own profile settings and a
	 * tenant's per-person Security section — same component, same endpoints,
	 * because enrollment belongs to the signed-in user's row, not to whichever
	 * console they're looking at it from.
	 */

	const METHOD_LABEL: Record<MfaMethod, string> = { TOTP: 'Authenticator app', EMAIL_OTP: 'Email code' };

	let loading = $state(true);
	let methods = $state<MfaMethodStatus[]>([]);
	let available = $state(true);
	const enrolledSet = $derived(new Set(methods.map((m) => m.method)));

	type View = 'status' | 'enroll-totp' | 'enroll-email' | 'recovery-codes';
	let view = $state<View>('status');
	let removeModalOpen = $state(false);
	let removeMethod = $state<MfaMethod>('TOTP');

	let setup = $state<MfaSetup | null>(null);
	let code = $state('');
	let enrolling = $state(false);
	let enrollError = $state('');
	let emailSending = $state(false);

	let recoveryCodes = $state<string[]>([]);
	let savedConfirmed = $state(false);
	let afterRecoveryCodes = $state<'status' | 'regenerated'>('status');

	let removePassword = $state('');
	let removing = $state(false);
	let removeError = $state('');
	let removeIntent = $state<'remove' | 'regenerate'>('remove');

	async function load() {
		loading = true;
		try {
			const status = await fetchMfaStatus();
			methods = status.methods ?? [];
			available = status.available;
		} catch (err) {
			toast.error(errorMessage(err, 'load two-factor status'));
		} finally {
			loading = false;
		}
	}

	onMount(load);

	async function startTotpEnroll() {
		enrollError = '';
		code = '';
		try {
			setup = await setupMfa();
			view = 'enroll-totp';
		} catch (err) {
			toast.error(errorMessage(err, 'start authenticator app setup'));
		}
	}

	async function startEmailEnroll() {
		enrollError = '';
		code = '';
		emailSending = true;
		try {
			await requestEmailOtp();
			view = 'enroll-email';
			toast.success('Code sent to your email');
		} catch (err) {
			toast.error(errorMessage(err, 'send an email code'));
		} finally {
			emailSending = false;
		}
	}

	function afterMethodEnrolled(codes: string[] | undefined, label: string) {
		if (codes && codes.length > 0) {
			recoveryCodes = codes;
			savedConfirmed = false;
			afterRecoveryCodes = 'status';
			view = 'recovery-codes';
		} else {
			view = 'status';
		}
		toast.success(`${label} is on`);
	}

	async function confirmTotpEnroll(event: Event) {
		event.preventDefault();
		if (!setup || code.trim().length < 6) {
			enrollError = 'Enter the 6-digit code from your app';
			return;
		}
		enrolling = true;
		enrollError = '';
		try {
			const result = await confirmMfa(setup.setup_token, code.trim());
			await load();
			afterMethodEnrolled(result.recovery_codes, 'Authenticator app');
		} catch (err) {
			enrollError = errorMessage(err, 'confirm that code');
		} finally {
			enrolling = false;
		}
	}

	async function confirmEmailEnroll(event: Event) {
		event.preventDefault();
		if (code.trim().length < 6) {
			enrollError = 'Enter the code from your email';
			return;
		}
		enrolling = true;
		enrollError = '';
		try {
			const result = await confirmEmailOtp(code.trim());
			await load();
			afterMethodEnrolled(result.recovery_codes, 'Email code');
		} catch (err) {
			enrollError = errorMessage(err, 'confirm that code');
		} finally {
			enrolling = false;
		}
	}

	function cancelEnroll() {
		setup = null;
		code = '';
		enrollError = '';
		view = 'status';
	}

	function openRemove(method: MfaMethod) {
		removeMethod = method;
		removeIntent = 'remove';
		removePassword = '';
		removeError = '';
		removeModalOpen = true;
	}

	function openRegenerate() {
		removeIntent = 'regenerate';
		removePassword = '';
		removeError = '';
		removeModalOpen = true;
	}

	async function submitRemove(event: Event) {
		event.preventDefault();
		if (!removePassword) {
			removeError = 'Enter your password';
			return;
		}
		removing = true;
		removeError = '';
		try {
			if (removeIntent === 'remove') {
				await removeMfaMethod(removeMethod, removePassword);
				await load();
				removeModalOpen = false;
				toast.success(`${METHOD_LABEL[removeMethod]} turned off`);
			} else {
				recoveryCodes = await regenerateRecoveryCodes(removePassword);
				savedConfirmed = false;
				afterRecoveryCodes = 'regenerated';
				view = 'recovery-codes';
				removeModalOpen = false;
				toast.success('New recovery codes generated — your old ones no longer work');
			}
		} catch (err) {
			removeError = errorMessage(
				err,
				removeIntent === 'remove' ? 'turn off that method' : 'regenerate your codes'
			);
		} finally {
			removing = false;
		}
	}

	function finishRecoveryCodes() {
		recoveryCodes = [];
		view = 'status';
	}

	function copyRecoveryCodes() {
		const text = recoveryCodes.join('\n');
		navigator.clipboard?.writeText(text).then(
			() => toast.success('Recovery codes copied'),
			() => toast.error('Could not copy — select and copy manually')
		);
	}

	function downloadRecoveryCodes() {
		const blob = new Blob([recoveryCodes.join('\n') + '\n'], { type: 'text/plain' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = 'orderly-recovery-codes.txt';
		a.click();
		URL.revokeObjectURL(url);
	}
</script>

<SettingsSection
	title="Two-factor authentication"
	description="A code from an authenticator app or your email, in addition to your password, when you sign in. Set up and controlled by you — nobody else can see your secrets or your codes."
	icon={ShieldCheck}
>
	{#if loading}
		<Skeleton height="4rem" />
	{:else if view === 'status'}
		<div class="mfa-status">
			{#if !available}
				<p class="muted">Not available for your business yet — ask your platform administrator to turn it on.</p>
			{:else if methods.length === 0}
				<p class="muted">Add a method below to require a code at sign-in.</p>
			{:else}
				<ul class="mfa-methods">
					{#each methods as m (m.method)}
						<li class="mfa-method-row">
							<span class="mfa-pill on">{METHOD_LABEL[m.method]}</span>
							<span class="muted mfa-method-meta">
								{m.last_used_at ? `Last used ${new Date(m.last_used_at).toLocaleDateString()}` : 'Never used'}
							</span>
							<button type="button" class="btn btn-ghost btn-sm" onclick={() => openRemove(m.method)}>
								Turn off
							</button>
						</li>
					{/each}
				</ul>
			{/if}

			<div class="mfa-actions">
				{#if available && !enrolledSet.has('TOTP')}
					<button type="button" class="btn btn-primary btn-sm" onclick={startTotpEnroll}>
						Add authenticator app
					</button>
				{/if}
				{#if available && !enrolledSet.has('EMAIL_OTP')}
					<button type="button" class="btn btn-secondary btn-sm" disabled={emailSending} onclick={startEmailEnroll}>
						<Mail size={14} strokeWidth={2} /> Add email code
					</button>
				{/if}
				{#if methods.length > 0}
					<button type="button" class="btn btn-ghost btn-sm" onclick={openRegenerate}>
						Regenerate recovery codes
					</button>
				{/if}
			</div>
		</div>
	{:else if view === 'enroll-totp' && setup}
		<form class="mfa-enroll" onsubmit={confirmTotpEnroll}>
			<ol class="mfa-steps">
				<li>
					<p class="mfa-step-label">Scan this with your authenticator app</p>
					<img class="mfa-qr" src={setup.qr_code_data_uri} alt="QR code for two-factor setup" width="200" height="200" />
					<details class="mfa-manual">
						<summary>Can't scan? Enter this code manually</summary>
						<code class="mfa-secret">{setup.secret}</code>
					</details>
				</li>
				<li>
					<FormField label="Enter the 6-digit code it shows" htmlFor="mfa-code" error={enrollError}>
						<TextInput
							id="mfa-code"
							bind:value={code}
							inputmode="numeric"
							maxlength={6}
							placeholder="123456"
							autocomplete="one-time-code"
						/>
					</FormField>
				</li>
			</ol>
			<div class="mfa-actions">
				<button type="button" class="btn btn-ghost btn-sm" onclick={cancelEnroll}>Cancel</button>
				<button type="submit" class="btn btn-primary btn-sm" disabled={enrolling}>
					{enrolling ? 'Confirming…' : 'Confirm and turn on'}
				</button>
			</div>
		</form>
	{:else if view === 'enroll-email'}
		<form class="mfa-enroll" onsubmit={confirmEmailEnroll}>
			<p class="mfa-step-label">
				We sent a code to your email.
				<button type="button" class="btn btn-ghost btn-sm" disabled={emailSending} onclick={startEmailEnroll}>
					Resend
				</button>
			</p>
			<FormField label="Enter the code" htmlFor="mfa-email-code" error={enrollError}>
				<TextInput
					id="mfa-email-code"
					bind:value={code}
					inputmode="numeric"
					maxlength={6}
					placeholder="123456"
					autocomplete="one-time-code"
				/>
			</FormField>
			<div class="mfa-actions">
				<button type="button" class="btn btn-ghost btn-sm" onclick={cancelEnroll}>Cancel</button>
				<button type="submit" class="btn btn-primary btn-sm" disabled={enrolling}>
					{enrolling ? 'Confirming…' : 'Confirm and turn on'}
				</button>
			</div>
		</form>
	{:else if view === 'recovery-codes'}
		<div class="mfa-recovery">
			<p class="mfa-step-label">
				{afterRecoveryCodes === 'regenerated'
					? 'Your new recovery codes — your old ones no longer work.'
					: 'Save these recovery codes somewhere safe.'}
				Each works once, if you ever lose access to your other methods. They are shown only now.
			</p>
			<div class="mfa-codes">
				{#each recoveryCodes as rc (rc)}
					<code>{rc}</code>
				{/each}
			</div>
			<div class="mfa-actions">
				<button type="button" class="btn btn-ghost btn-sm" onclick={copyRecoveryCodes}>
					<Copy size={14} strokeWidth={2} /> Copy
				</button>
				<button type="button" class="btn btn-ghost btn-sm" onclick={downloadRecoveryCodes}>
					<Download size={14} strokeWidth={2} /> Download
				</button>
			</div>
			<label class="mfa-confirm-saved">
				<input type="checkbox" bind:checked={savedConfirmed} />
				I've saved these codes
			</label>
			<div class="mfa-actions">
				<button type="button" class="btn btn-primary btn-sm" disabled={!savedConfirmed} onclick={finishRecoveryCodes}>
					Done
				</button>
			</div>
		</div>
	{/if}
</SettingsSection>

<Modal
	bind:open={removeModalOpen}
	title={removeIntent === 'remove' ? `Turn off ${METHOD_LABEL[removeMethod].toLowerCase()}?` : 'Regenerate recovery codes?'}
>
	<form id="mfa-remove-form" onsubmit={submitRemove}>
		<p class="muted" style="margin:0 0 0.85rem;">
			{removeIntent === 'remove'
				? methods.length === 1
					? 'Confirm your password. Your account will only need a password to sign in after this.'
					: 'Confirm your password.'
				: 'Confirm your password. Your existing recovery codes will stop working immediately.'}
		</p>
		<FormField label="Password" htmlFor="mfa-remove-pw" error={removeError}>
			<TextInput id="mfa-remove-pw" type="password" bind:value={removePassword} autocomplete="current-password" />
		</FormField>
	</form>
	{#snippet footer()}
		<button type="button" class="btn btn-ghost" onclick={() => (removeModalOpen = false)}>Cancel</button>
		<button type="submit" form="mfa-remove-form" class="btn btn-primary" disabled={removing}>
			{removing ? 'Working…' : removeIntent === 'remove' ? 'Turn off' : 'Regenerate codes'}
		</button>
	{/snippet}
</Modal>

<style>
	.mfa-status {
		display: flex;
		flex-direction: column;
		gap: 0.85rem;
	}

	.mfa-methods {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.mfa-method-row {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		flex-wrap: wrap;
	}

	.mfa-method-meta {
		flex: 1;
	}

	.mfa-pill {
		font-size: var(--fs-meta);
		font-weight: 700;
		padding: 0.15rem 0.55rem;
		border-radius: 999px;
	}

	.mfa-pill.on {
		background: color-mix(in srgb, var(--success) 18%, transparent);
		color: var(--success);
	}

	.mfa-actions {
		display: flex;
		gap: 0.5rem;
		flex-wrap: wrap;
	}

	.mfa-steps {
		list-style: none;
		margin: 0 0 0.85rem;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 1rem;
		max-width: 24rem;
	}

	.mfa-step-label {
		margin: 0 0 0.5rem;
		font-size: var(--fs-body);
		font-weight: 600;
	}

	.mfa-qr {
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-sm);
		background: #fff;
		padding: 0.5rem;
	}

	.mfa-manual {
		margin-top: 0.5rem;
		font-size: var(--fs-meta);
	}

	.mfa-secret {
		display: block;
		margin-top: 0.35rem;
		padding: 0.4rem 0.5rem;
		background: var(--surface-2);
		border-radius: var(--radius-sm);
		word-break: break-all;
	}

	.mfa-recovery {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		max-width: 24rem;
	}

	.mfa-codes {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 0.4rem;
		padding: 0.85rem;
		background: var(--surface-2);
		border-radius: var(--radius-sm);
	}

	.mfa-codes code {
		font-size: var(--fs-body);
	}

	.mfa-confirm-saved {
		display: flex;
		align-items: center;
		gap: 0.45rem;
		font-size: var(--fs-body);
	}
</style>
