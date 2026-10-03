<script lang="ts">
	import Check from '@lucide/svelte/icons/check';
	import CircleAlert from '@lucide/svelte/icons/circle-alert';
	import Loader from '@lucide/svelte/icons/loader-circle';
	import { slugify } from '$lib/admin/format';
	import { isLocalBaseDomain } from '$lib/host';

	type Status = 'idle' | 'checking' | 'available' | 'taken' | 'reserved' | 'invalid';

	let {
		id = 'tenant-slug',
		value = $bindable(''),
		baseDomain = 'localhost',
		port = '5173',
		status = 'idle',
		error = '',
		disabled = false,
		onblur,
		onslugchange
	}: {
		id?: string;
		value?: string;
		baseDomain?: string;
		/** Empty string omits the port (production). */
		port?: string;
		status?: Status;
		error?: string;
		disabled?: boolean;
		onblur?: () => void;
		onslugchange?: (slug: string) => void;
	} = $props();

	const scheme = $derived(isLocalBaseDomain(baseDomain) ? 'http' : 'https');
	const portSuffix = $derived(port && port !== '80' && port !== '443' ? `:${port}` : '');
	// The URL is the real deliverable, so show it live as they type.
	const host = $derived(
		value.trim() ? `${value.trim()}.${baseDomain}${portSuffix}` : `${baseDomain}${portSuffix}`
	);

	function onInput(e: Event) {
		const raw = (e.currentTarget as HTMLInputElement).value;
		// Slugs are URL-safe: fold to lowercase and strip anything invalid as they type.
		const clean = slugify(raw);
		value = clean;
		onslugchange?.(clean);
	}

	const META: Record<Status, { text: string; cls: string }> = {
		idle: { text: '', cls: '' },
		checking: { text: 'Checking availability…', cls: 'checking' },
		available: { text: 'Available', cls: 'available' },
		taken: { text: 'Already in use — try another', cls: 'taken' },
		reserved: { text: 'Reserved by the platform', cls: 'taken' },
		invalid: { text: 'Use lowercase letters, numbers and hyphens', cls: 'invalid' }
	};
</script>

<div class="field">
	<label class="field-label" for={id}>Subdomain slug <span style="color:var(--danger);">*</span></label>

	<div class="slug-wrap" class:has-status={status !== 'idle'}>
		<span class="slug-prefix" aria-hidden="true">{scheme}://</span>
		<input
			{id}
			class="input slug-input"
			type="text"
			{disabled}
			value={value}
			placeholder="momo-magic"
			autocomplete="off"
			autocapitalize="none"
			spellcheck="false"
			aria-invalid={error ? 'true' : undefined}
			aria-describedby="{id}-status"
			oninput={onInput}
			onblur={() => onblur?.()}
		/>
		<span class="slug-suffix" aria-hidden="true">.{baseDomain}</span>

		{#if status === 'checking'}
			<span class="slug-flag checking" aria-hidden="true">
				<Loader size={14} strokeWidth={2.2} class="spin" />
			</span>
		{:else if status === 'available'}
			<span class="slug-flag available" aria-hidden="true"><Check size={14} strokeWidth={2.6} /></span>
		{:else if status === 'taken' || status === 'reserved' || status === 'invalid'}
			<span class="slug-flag bad" aria-hidden="true"><CircleAlert size={14} strokeWidth={2.2} /></span>
		{/if}
	</div>

	<p class="slug-host" id="{id}-status">
		{#if error}
			<span class="field-error">{error}</span>
		{:else if META[status].text}
			<span class={['slug-note', META[status].cls].join(' ')}>{META[status].text}</span>
		{:else}
			<span class="field-hint">This becomes the tenant's public storefront address.</span>
		{/if}
	</p>

	<div class="slug-preview">
		<span class="slug-preview-label">Storefront</span>
		<code>{host}/</code>
	</div>
</div>

<style>
	.slug-wrap {
		position: relative;
		display: flex;
		align-items: center;
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		background: var(--surface);
		overflow: hidden;
		transition: border-color 0.15s ease, box-shadow 0.15s ease;
	}

	.slug-wrap:focus-within {
		border-color: var(--accent);
		box-shadow: 0 0 0 3px var(--accent-ring);
	}

	.slug-prefix,
	.slug-suffix {
		flex-shrink: 0;
		font-size: var(--fs-body);
		color: var(--text-3);
		background: var(--surface-2);
		align-self: stretch;
		display: flex;
		align-items: center;
	}

	.slug-prefix {
		padding: 0 0.4rem 0 0.65rem;
		border-right: 1px solid var(--border-subtle);
	}

	.slug-suffix {
		padding: 0 0.65rem 0 0.4rem;
		border-left: 1px solid var(--border-subtle);
	}

	.slug-input {
		flex: 1;
		min-width: 0;
		border: none;
		background: transparent;
		padding-left: 0.5rem;
		padding-right: 2.1rem;
		height: 2.5rem;
		font-family: var(--font-mono);
		font-size: var(--fs-body);
	}

	.slug-input:focus {
		outline: none;
		box-shadow: none;
	}

	.slug-flag {
		position: absolute;
		right: 0.6rem;
		display: inline-flex;
	}

	.slug-flag.available {
		color: var(--success);
	}

	.slug-flag.bad {
		color: var(--danger);
	}

	.slug-flag.checking {
		color: var(--text-3);
	}

	.slug-host {
		margin: 0.35rem 0 0;
		min-height: 1.1rem;
	}

	.slug-note {
		font-size: var(--fs-code);
		font-weight: 550;
	}

	.slug-note.available {
		color: var(--success);
	}

	.slug-note.taken,
	.slug-note.invalid {
		color: var(--danger);
	}

	.slug-note.checking {
		color: var(--text-3);
	}

	.slug-preview {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-top: 0.6rem;
		padding: 0.5rem 0.65rem;
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		background: var(--surface-2);
	}

	.slug-preview-label {
		font-size: var(--fs-micro);
		font-weight: 650;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--text-3);
		flex-shrink: 0;
	}

	.slug-preview code {
		font-family: var(--font-mono);
		font-size: var(--fs-tab);
		color: var(--text);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
</style>
