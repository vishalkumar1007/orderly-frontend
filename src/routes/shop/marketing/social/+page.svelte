<script lang="ts">
	import { onMount } from 'svelte';
	import Share from '@tabler/icons-svelte/icons/share';
	import Trash from '@tabler/icons-svelte/icons/trash';
	import Pencil from '@tabler/icons-svelte/icons/pencil';
	import Copy from '@tabler/icons-svelte/icons/copy';
	import BrandFacebook from '@tabler/icons-svelte/icons/brand-facebook';
	import BrandInstagram from '@tabler/icons-svelte/icons/brand-instagram';
	import { ApiClientError } from '$lib/api/client';
	import { formatDateTime, formatRelative } from '$lib/admin/format';
	import ConfirmDialog from '$lib/components/admin/ConfirmDialog.svelte';
	import FormField from '$lib/components/admin/FormField.svelte';
	import Modal from '$lib/components/admin/Modal.svelte';
	import SelectField from '$lib/components/admin/SelectField.svelte';
	import StatusBadge from '$lib/components/admin/StatusBadge.svelte';
	import TextArea from '$lib/components/admin/TextArea.svelte';
	import { toast } from '$lib/components/admin/toast';
	import ImageUpload from '$lib/components/menu/ImageUpload.svelte';
	import MarketingTabs from '$lib/components/tenant/MarketingTabs.svelte';
	import { marketingApi, type MarketingLink, type Platform, type PostInput, type SocialPost } from '$lib/tenant/marketingApi';

	/**
	 * Social planner. A post is a caption, an image and the platforms it goes
	 * to. With Meta connected the worker publishes it through the official
	 * API; without, the post becomes "share yourself" with everything ready to
	 * paste. The platform never pretends to publish what it cannot.
	 */

	let posts = $state<SocialPost[]>([]);
	let connected = $state<Record<Platform, boolean>>({ FACEBOOK: false, INSTAGRAM: false });
	let links = $state<MarketingLink[]>([]);
	let loading = $state(true);
	let loadError = $state('');

	async function load() {
		loadError = '';
		try {
			const [p, l] = await Promise.all([marketingApi.posts(), marketingApi.links()]);
			posts = p.posts ?? [];
			connected = p.connected;
			links = l.links ?? [];
		} catch (err) {
			if (err instanceof ApiClientError && err.code === 'feature_not_in_plan') loadError = err.message;
			else loadError = err instanceof Error ? err.message : 'Could not load posts';
		} finally {
			loading = false;
		}
	}
	onMount(() => {
		void load();
		const timer = setInterval(() => {
			if (posts.some((p) => p.status === 'PUBLISHING' || p.status === 'SCHEDULED')) void load();
		}, 8000);
		return () => clearInterval(timer);
	});

	const anyConnected = $derived(connected.FACEBOOK || connected.INSTAGRAM);

	/* ---------- form ---------- */

	const blank = (): PostInput => ({ caption: '', image_url: '', platforms: ['FACEBOOK'], link_id: '', scheduled_at: '' });
	let formOpen = $state(false);
	let editing = $state<SocialPost | null>(null);
	let form = $state<PostInput>(blank());
	let whenLocal = $state('');
	let formError = $state('');
	let saving = $state(false);

	function openNew() {
		editing = null;
		form = blank();
		whenLocal = '';
		formError = '';
		formOpen = true;
	}
	function openEdit(p: SocialPost) {
		editing = p;
		form = { caption: p.caption, image_url: p.image_url, platforms: [...p.platforms], link_id: p.link_id ?? '', scheduled_at: p.scheduled_at ?? '' };
		whenLocal = p.scheduled_at ? toLocal(p.scheduled_at) : '';
		formError = '';
		formOpen = true;
	}
	function toLocal(iso: string): string {
		const d = new Date(iso);
		const pad = (n: number) => String(n).padStart(2, '0');
		return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
	}
	function togglePlatform(p: Platform) {
		form.platforms = form.platforms.includes(p) ? form.platforms.filter((x) => x !== p) : [...form.platforms, p];
	}

	async function save(publishNow = false) {
		saving = true;
		formError = '';
		const when = publishNow ? new Date() : whenLocal ? new Date(whenLocal) : null;
		const payload: PostInput = { ...form, scheduled_at: when && !Number.isNaN(when.getTime()) ? when.toISOString() : '' };
		try {
			if (editing) await marketingApi.updatePost(editing.id, payload);
			else await marketingApi.createPost(payload);
			toast.success(publishNow ? (anyConnected ? 'Publishing' : 'Ready to share') : editing ? 'Post updated' : 'Post saved');
			formOpen = false;
			await load();
		} catch (err) {
			formError = err instanceof Error ? err.message : 'Could not save';
		} finally {
			saving = false;
		}
	}

	async function publish(p: SocialPost) {
		try {
			await marketingApi.publishPost(p.id);
			toast.success(anyConnected ? 'Publishing' : 'Ready to share');
			await load();
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Could not publish');
		}
	}

	let deleteTarget = $state<SocialPost | null>(null);
	async function remove() {
		if (!deleteTarget) return;
		try {
			await marketingApi.deletePost(deleteTarget.id);
			toast.success('Post deleted');
			await load();
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Could not delete');
		} finally {
			deleteTarget = null;
		}
	}

	async function copy(text: string) {
		try {
			await navigator.clipboard.writeText(text);
			toast.success('Copied');
		} catch {
			toast.error('Could not copy');
		}
	}

	function badge(p: SocialPost): { label: string; kind: 'ok' | 'warn' | 'danger' | 'neutral' | 'accent' } {
		switch (p.status) {
			case 'PUBLISHED': return { label: 'Published', kind: 'ok' };
			case 'PARTIAL': return { label: 'Partly published', kind: 'warn' };
			case 'FAILED': return { label: 'Failed', kind: 'danger' };
			case 'MANUAL': return { label: 'Share yourself', kind: 'warn' };
			case 'PUBLISHING': return { label: 'Publishing', kind: 'accent' };
			case 'SCHEDULED': return { label: 'Scheduled', kind: 'accent' };
			default: return { label: 'Draft', kind: 'neutral' };
		}
	}
	const editable = (p: SocialPost) => ['DRAFT', 'SCHEDULED', 'MANUAL', 'FAILED'].includes(p.status);
</script>

<div class="so-page">
	<MarketingTabs />

	{#if loadError}
		<div class="panel so-error" role="alert">
			<strong>Could not load posts.</strong>
			<span class="muted">{loadError}</span>
			<button type="button" class="btn btn-ghost btn-sm" onclick={load}>Try again</button>
		</div>
	{:else}
		<header class="so-head">
			<p class="muted so-lead">
				Plan posts for Facebook and Instagram. Add a trackable link and you will see how many people came from each post.
			</p>
			<button type="button" class="btn btn-primary" onclick={openNew}>New post</button>
		</header>

		<section class="panel so-connect" aria-label="Connections">
			<span class="so-conn"><BrandFacebook size={16} stroke={1.6} /> Facebook <StatusBadge status={connected.FACEBOOK ? 'Connected' : 'Not connected'} kind={connected.FACEBOOK ? 'ok' : 'neutral'} /></span>
			<span class="so-conn"><BrandInstagram size={16} stroke={1.6} /> Instagram <StatusBadge status={connected.INSTAGRAM ? 'Connected' : 'Not connected'} kind={connected.INSTAGRAM ? 'ok' : 'neutral'} /></span>
			{#if !anyConnected}
				<span class="muted so-small">Connect Meta under <a href="/shop/configuration">Configuration</a> to publish directly. Until then, posts are prepared for you to share by hand.</span>
			{/if}
		</section>

		<section class="panel panel-flush so-card" aria-labelledby="so-posts">
			<h2 id="so-posts" class="so-h so-pad-top">Posts</h2>
			{#if loading}
				<p class="muted so-pad">Loading…</p>
			{:else if posts.length === 0}
				<p class="muted so-pad">No posts yet.</p>
			{:else}
				<ul class="so-list">
					{#each posts as p (p.id)}
						{@const b = badge(p)}
						<li class="so-row">
							{#if p.image_url}
								<img class="so-thumb" src={p.image_url} alt="" loading="lazy" />
							{:else}
								<span class="so-thumb so-thumb-empty"><Share size={18} stroke={1.5} /></span>
							{/if}
							<span class="so-main">
								<span class="so-caption">{p.caption || 'Image only'}</span>
								<span class="muted so-small">
									{p.platforms.map((x) => (x === 'FACEBOOK' ? 'Facebook' : 'Instagram')).join(' + ')}
									{#if p.status === 'SCHEDULED' && p.scheduled_at}· {formatDateTime(p.scheduled_at)}{/if}
									{#if p.published_at}· published {formatRelative(p.published_at)}{/if}
								</span>
								{#if p.results}
									{#each Object.entries(p.results) as [k, v] (k)}
										{#if k !== 'reason' && v && typeof v === 'object' && v.ok === false}
											<span class="so-small so-fail">{k === 'FACEBOOK' ? 'Facebook' : 'Instagram'}: {v.error}</span>
										{/if}
									{/each}
								{/if}
							</span>
							<StatusBadge status={b.label} kind={b.kind} />
							<span class="so-actions">
								{#if p.status === 'MANUAL' || !anyConnected}
									<button type="button" class="btn btn-quiet btn-sm" title="Copy caption and link" onclick={() => copy(p.share_text)}><Copy size={15} stroke={1.6} /></button>
								{/if}
								{#if editable(p) && p.status !== 'SCHEDULED'}
									<button type="button" class="btn btn-quiet btn-sm" onclick={() => publish(p)}>{anyConnected ? 'Publish now' : 'Prepare'}</button>
								{/if}
								{#if editable(p)}
									<button type="button" class="btn btn-quiet btn-sm" aria-label="Edit" title="Edit" onclick={() => openEdit(p)}><Pencil size={15} stroke={1.6} /></button>
								{/if}
								<button type="button" class="btn btn-quiet btn-sm" aria-label="Delete" title="Delete" onclick={() => (deleteTarget = p)}><Trash size={15} stroke={1.6} /></button>
							</span>
						</li>
					{/each}
				</ul>
			{/if}
		</section>
	{/if}
</div>

<Modal bind:open={formOpen} title={editing ? 'Edit post' : 'New post'}>
	<div class="so-form">
		<FormField label="Caption" htmlFor="so-caption" hint={`${form.caption.length}/2200`}>
			<TextArea id="so-caption" bind:value={form.caption} rows={5} maxlength={2200} placeholder="This weekend only: brunch for two." />
		</FormField>
		<FormField label="Image" hint="Required for Instagram.">
			<ImageUpload url={form.image_url || undefined} onupload={(u) => (form.image_url = u)} />
		</FormField>
		<FormField label="Platforms">
			<div class="so-platforms" role="group" aria-label="Platforms">
				<button type="button" class={['so-pick', form.platforms.includes('FACEBOOK') && 'on'].filter(Boolean).join(' ')} aria-pressed={form.platforms.includes('FACEBOOK')} onclick={() => togglePlatform('FACEBOOK')}><BrandFacebook size={16} stroke={1.6} /> Facebook</button>
				<button type="button" class={['so-pick', form.platforms.includes('INSTAGRAM') && 'on'].filter(Boolean).join(' ')} aria-pressed={form.platforms.includes('INSTAGRAM')} onclick={() => togglePlatform('INSTAGRAM')}><BrandInstagram size={16} stroke={1.6} /> Instagram</button>
			</div>
		</FormField>
		<div class="so-grid">
			<FormField label="Trackable link" htmlFor="so-link" hint="Added to the caption so visits are counted.">
				<SelectField id="so-link" bind:value={form.link_id} options={[{ value: '', label: 'No link' }, ...links.map((l) => ({ value: l.id, label: l.label || l.target_path }))]} />
			</FormField>
			<FormField label="Schedule for" htmlFor="so-when" hint="Blank to keep as a draft.">
				<input id="so-when" class="input" type="datetime-local" bind:value={whenLocal} />
			</FormField>
		</div>
		{#if formError}<p class="field-error" role="alert">{formError}</p>{/if}
	</div>
	{#snippet footer()}
		<button type="button" class="btn btn-ghost" onclick={() => (formOpen = false)}>Cancel</button>
		<button type="button" class="btn btn-ghost" disabled={saving} onclick={() => save(false)}>{whenLocal ? 'Schedule' : 'Save draft'}</button>
		<button type="button" class="btn btn-primary" disabled={saving || form.platforms.length === 0} onclick={() => save(true)}>{anyConnected ? 'Publish now' : 'Prepare to share'}</button>
	{/snippet}
</Modal>

<ConfirmDialog
	open={deleteTarget !== null}
	title="Delete this post?"
	message="A post already published stays on the platform; only the record here is removed."
	confirmLabel="Delete"
	danger
	onconfirm={remove}
/>

<style>
	.so-page { display: grid; gap: 1rem; }
	.so-head { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 0.75rem; }
	.so-lead { margin: 0; font-size: var(--fs-body); line-height: 1.5; max-width: 46rem; }
	.so-h { margin: 0; font-size: var(--fs-body); font-weight: 600; }
	.so-small { font-size: var(--fs-meta); }
	.so-connect { display: flex; flex-wrap: wrap; align-items: center; gap: 0.75rem 1.25rem; padding: 0.75rem 1rem; }
	.so-conn { display: inline-flex; align-items: center; gap: 0.4rem; font-size: var(--fs-body); }
	.so-card { display: grid; gap: 0.5rem; }
	.so-pad-top { padding: 0.9rem 1rem 0; }
	.so-pad { padding: 0.25rem 1rem 1rem; margin: 0; }
	.so-list { list-style: none; margin: 0; padding: 0; }
	.so-row { display: flex; align-items: center; gap: 0.75rem; padding: 0.7rem 1rem; border-top: 1px solid var(--border, color-mix(in srgb, var(--text) 10%, transparent)); }
	.so-thumb { width: 3rem; height: 3rem; border-radius: 8px; object-fit: cover; flex-shrink: 0; }
	.so-thumb-empty { display: grid; place-items: center; background: var(--surface-2, color-mix(in srgb, var(--text) 6%, transparent)); color: var(--text-2); }
	.so-main { display: grid; gap: 0.1rem; min-width: 0; flex: 1; }
	.so-caption { display: -webkit-box; -webkit-line-clamp: 2; line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
	.so-fail { color: var(--danger, #b91c1c); }
	.so-actions { display: flex; gap: 0.15rem; flex-wrap: wrap; justify-content: flex-end; }
	.so-form { display: grid; gap: 0.9rem; }
	.so-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(11rem, 1fr)); gap: 0.75rem; }
	.so-platforms { display: flex; gap: 0.5rem; flex-wrap: wrap; }
	.so-pick { display: inline-flex; align-items: center; gap: 0.4rem; padding: 0.45rem 0.8rem; border: 1px solid var(--border, color-mix(in srgb, var(--text) 12%, transparent)); border-radius: 999px; background: transparent; color: inherit; font: inherit; cursor: pointer; }
	.so-pick.on { border-color: var(--accent, #4f46e5); background: color-mix(in srgb, var(--accent, #4f46e5) 10%, transparent); }
	.so-error { display: flex; flex-wrap: wrap; align-items: center; gap: 0.75rem; padding: 1rem; }
	.field-error { margin: 0; }
</style>
