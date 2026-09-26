<script lang="ts">
	import {
		CONFIG_FIELDS,
		ENCRYPTION_OPTIONS,
		MASK_SENTINEL,
		type ConfigService,
		type ConfigView
	} from '$lib/admin/configTypes';
	import ConfigField from './ConfigField.svelte';

	let {
		service,
		view,
		onchange
	}: {
		service: ConfigService;
		view: ConfigView;
		/** Reports the current draft so the page can save or test it. */
		onchange?: (draft: Record<string, unknown>) => void;
	} = $props();

	const fields = $derived(CONFIG_FIELDS[service]);

	/**
	 * The draft the page will submit. Secrets the server already holds are
	 * represented by the mask sentinel, which the backend reads as "unchanged";
	 * an empty string means the operator deliberately cleared the field.
	 */
	let draft = $state<Record<string, unknown>>({});
	let nonce = $state('');

	function seed(): Record<string, unknown> {
		const next: Record<string, unknown> = {};
		for (const [k, v] of Object.entries(view.config ?? {})) next[k] = v;
		for (const field of fields) {
			if (field.secret && (next[field.key] === undefined || next[field.key] === null)) {
				next[field.key] = MASK_SENTINEL;
			}
		}
		return next;
	}

	// Re-seed when the server hands us a different revision of this record, so
	// an external change shows up without a manual reload. The nonce keeps the
	// effect from firing on every unrelated state change.
	$effect(() => {
		void view.updated_at;
		void view.provider;
		void view.config;
		nonce = String(Date.now());
	});

	$effect(() => {
		void nonce;
		draft = seed();
		onchange?.(draft);
	});

	function set(key: string, value: string) {
		draft = { ...draft, [key]: value === '' && isSecret(key) ? MASK_SENTINEL : value };
		onchange?.(draft);
	}

	function isSecret(key: string): boolean {
		return fields.some((f) => f.key === key && f.secret);
	}

	function optionsFor(key: string) {
		return key === 'encryption' ? ENCRYPTION_OPTIONS : null;
	}
</script>

<div class="form">
	{#each fields as field (field.key)}
		<ConfigField
			id={`cfg-${service}-${field.key}`}
			label={field.label}
			hint={field.hint ?? ''}
			type={field.type ?? 'text'}
			placeholder={field.secret
				? view.has_secret
					? 'Unchanged — type to replace'
					: 'Enter a secret'
				: ''}
			options={optionsFor(field.key)}
			secret={field.secret ?? false}
			set={field.secret ? view.has_secret : false}
			onvalue={(v: string) => set(field.key, v)}
		/>
	{/each}
</div>

<style>
	.form {
		display: grid;
		gap: 0.85rem;
		grid-template-columns: repeat(auto-fit, minmax(15rem, 1fr));
	}
</style>
