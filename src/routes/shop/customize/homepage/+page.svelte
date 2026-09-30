<script lang="ts">
	import GripVertical from '@lucide/svelte/icons/grip-vertical';
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import ChevronUp from '@lucide/svelte/icons/chevron-up';
	import TextArea from '$lib/components/admin/TextArea.svelte';
	import TextInput from '$lib/components/admin/TextInput.svelte';
	import { seed, useStorefront, type StorefrontContext } from '$lib/storefront/admin-context';
	import { storefrontAdminApi, type AdminSection } from '$lib/storefront/admin';
	import { toast } from '$lib/components/admin/toast';

	let props: Partial<StorefrontContext> = $props();
	const ctx = useStorefront(() => props);
	const config = $derived(ctx.config);
	const save = (run: Parameters<StorefrontContext['save']>[0]) => ctx.save(run);

	let sections = $state<AdminSection[]>(
		seed(() => (ctx.config.homepage?.sections ?? []).map((s) => ({ ...s, content: { ...s.content } })))
	);
	let expanded = $state<string | null>(null);
	let saving = $state(false);

	let dirty = false;
	$effect(() => {
		const s = ctx.config.homepage?.sections;
		if (!dirty && s && s.length > 0) {
			sections = s.map((item) => ({ ...item, content: { ...item.content } }));
		}
	});

	const catalogue = $derived(config.catalogues?.section_types ?? []);
	const defFor = (type: string) => catalogue.find((d) => d.type === type);

	const missing = $derived(
		catalogue.filter((def) => !sections.some((s) => s.type === def.type))
	);

	function move(index: number, delta: number) {
		const next = sections.slice();
		const target = index + delta;
		if (target < 0 || target >= next.length) return;
		const [row] = next.splice(index, 1);
		next.splice(target, 0, row);
		sections = next;
	}

	function add(def: { type: string; label: string }) {
		sections = [
			...sections,
			{ id: def.type.toLowerCase(), type: def.type, enabled: true, content: {} }
		];
		expanded = sections[sections.length - 1].id;
	}

	function remove(index: number) {
		sections = sections.filter((_, i) => i !== index);
	}

	function setEnabled(index: number, enabled: boolean) {
		sections = sections.map((s, i) => (i === index ? { ...s, enabled } : s));
	}

	function setContent(index: number, key: string, value: string) {
		sections = sections.map((s, i) =>
			i === index ? { ...s, content: { ...s.content, [key]: value } } : s
		);
	}

	/* ---- drag and drop -------------------------------------------------- */

	let dragging = $state<number | null>(null);
	let over = $state<number | null>(null);

	function onDragStart(index: number, event: DragEvent) {
		dragging = index;
		event.dataTransfer?.setData('text/plain', String(index));
		if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
	}

	function onDragOver(index: number, event: DragEvent) {
		if (dragging === null) return;
		event.preventDefault();
		over = index;
	}

	function onDrop(index: number, event: DragEvent) {
		event.preventDefault();
		const from = dragging ?? Number(event.dataTransfer?.getData('text/plain'));
		dragging = null;
		over = null;
		if (!Number.isInteger(from) || from === index) return;
		const next = sections.slice();
		const [row] = next.splice(from, 1);
		next.splice(index, 0, row);
		sections = next;
	}

	function onDragEnd() {
		dragging = null;
		over = null;
	}

	function onGripKey(index: number, event: KeyboardEvent) {
		if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
			event.preventDefault();
			move(index, event.key === 'ArrowUp' ? -1 : 1);
			queueMicrotask(() => {
				const grips = document.querySelectorAll<HTMLButtonElement>('.sfsection-grip');
				grips[event.key === 'ArrowUp' ? index - 1 : index + 1]?.focus();
			});
		}
	}

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		saving = true;
		const ok = await save(() => storefrontAdminApi.saveHomepage(sections));
		saving = false;
		if (ok) toast.success('Homepage saved');
		else toast.error('Could not save your homepage');
	}

	const enabledCount = $derived(sections.filter((s) => s.enabled).length);
</script>

<form onsubmit={submit}>
	<div class="sfctl-section">
		<h2>Homepage sections</h2>
		<p class="sfctl-note">
			{enabledCount} of {sections.length} sections are showing. Drag a section by its handle to
			reorder, or use the arrow buttons. The order here is the order a customer sees.
		</p>

		<div class="sfsections">
			{#each sections as section, index (section.id + index)}
				{@const def = defFor(section.type)}
				<div
					class="sfsection"
					data-enabled={String(section.enabled)}
					data-dragging={String(dragging === index)}
					data-over={String(over === index && dragging !== index)}
					ondragover={(e) => onDragOver(index, e)}
					ondrop={(e) => onDrop(index, e)}
					role="listitem"
				>
					<button
						class="sfsection-grip"
						type="button"
						draggable="true"
						aria-label={'Reorder ' + (def?.label ?? section.type) + '. Use arrow up and arrow down.'}
						ondragstart={(e) => onDragStart(index, e)}
						ondragend={onDragEnd}
						onkeydown={(e) => onGripKey(index, e)}
					>
						<GripVertical size={16} strokeWidth={1.9} />
					</button>

					<div class="sfsection-body">
						<div class="sfsection-name">
							{def?.label ?? section.type}
							{#if !def}
								<span class="badge badge-warn">Unknown</span>
							{/if}
						</div>
						{#if def?.blurb}
							<div class="sfsection-blurb">{def.blurb}</div>
						{/if}
					</div>

					<div style="display:flex;align-items:center;gap:0.35rem;">
						<label class="switch" style="margin-right:0.2rem;" title="Show this section">
							<input
								type="checkbox"
								checked={section.enabled}
								onchange={(e) => setEnabled(index, (e.currentTarget as HTMLInputElement).checked)}
							/>
							<span class="switch-track"></span>
						</label>
						<div class="sfsection-moves">
							<button
								type="button"
								disabled={index === 0}
								aria-label="Move up"
								onclick={() => move(index, -1)}
							>
								<ChevronUp size={14} strokeWidth={2.2} />
							</button>
							<button
								type="button"
								disabled={index === sections.length - 1}
								aria-label="Move down"
								onclick={() => move(index, 1)}
							>
								<ChevronDown size={14} strokeWidth={2.2} />
							</button>
						</div>
					</div>

					{#if def && def.fields.length > 0 && expanded === section.id}
						<div class="sfsection-editor" style="grid-column:1 / -1;">
							{#each def.fields as field (field.key)}
								<div class="field" style="margin:0;">
									<label class="field-label" for={`${section.id}-${field.key}`}>
										{field.label}
									</label>
									{#if field.type === 'textarea'}
										<TextArea
											id={`${section.id}-${field.key}`}
											value={section.content[field.key] ?? ''}
											oninput={(e) =>
												setContent(index, field.key, (e.currentTarget as HTMLTextAreaElement).value)}
											rows={2}
											placeholder={field.hint}
										/>
									{:else}
										<TextInput
											id={`${section.id}-${field.key}`}
											value={section.content[field.key] ?? ''}
											oninput={(e) =>
												setContent(index, field.key, (e.currentTarget as HTMLInputElement).value)}
											placeholder={field.hint}
											inputmode={field.type === 'image' ? 'url' : field.type === 'number' ? 'numeric' : undefined}
										/>
									{/if}
									{#if field.hint}
										<p class="field-hint">{field.hint}</p>
									{/if}
								</div>
							{/each}
							<div style="display:flex;justify-content:space-between;gap:0.4rem;">
								<button
									class="btn btn-danger btn-sm"
									type="button"
									onclick={() => remove(index)}
								>
									Remove section
								</button>
								<button
									class="btn btn-secondary btn-sm"
									type="button"
									onclick={() => (expanded = null)}
								>
									Done
								</button>
							</div>
						</div>
					{/if}

					{#if def && def.fields.length > 0 && expanded !== section.id}
						<div style="grid-column:1 / -1;display:flex;gap:0.4rem;">
							<button
								class="btn btn-secondary btn-sm"
								type="button"
								onclick={() => (expanded = section.id)}
							>
								Edit content
							</button>
						</div>
					{/if}
				</div>
			{/each}
		</div>

		{#if missing.length > 0}
			<div style="margin-top:0.9rem;padding-top:0.9rem;border-top:1px solid var(--border);">
				<p class="field-hint" style="margin:0 0 0.5rem;">Not on your homepage</p>
				<div style="display:flex;flex-wrap:wrap;gap:0.4rem;">
					{#each missing as def (def.type)}
						<button class="btn btn-secondary btn-sm" type="button" onclick={() => add(def)}>
							+ {def.label}
						</button>
					{/each}
				</div>
			</div>
		{/if}

		<div class="sfctl-foot">
			<span class="sfctl-foot-note">
				Preview it on the <a href="/shop/storefront/promote" style="color:var(--accent);">Publish &amp; Marketing</a> screen.
			</span>
			<button class="btn btn-primary" type="submit" disabled={saving}>
				{saving ? 'Saving…' : 'Save homepage'}
			</button>
		</div>
	</div>
</form>
