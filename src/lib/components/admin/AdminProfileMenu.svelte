<script lang="ts">
	import { onMount } from 'svelte';
	import ChevronsUpDown from '@lucide/svelte/icons/chevrons-up-down';
	import LogOut from '@lucide/svelte/icons/log-out';
	import Settings from '@lucide/svelte/icons/settings';

	let {
		email = '',
		displayName = '',
		role = 'SUPER_ADMIN',
		collapsed = false,
		settingsHref = '/superadmin/settings',
		onNavigate,
		onSignOut
	}: {
		email?: string;
		displayName?: string;
		role?: string;
		collapsed?: boolean;
		/** Destination for the Settings menu item — portal-specific. */
		settingsHref?: string;
		onNavigate?: () => void;
		onSignOut?: () => void;
	} = $props();

	const roleLabel = $derived(role.replaceAll('_', ' '));

	let open = $state(false);
	let rootEl = $state<HTMLDivElement | null>(null);
	let triggerEl = $state<HTMLButtonElement | null>(null);

	const initials = $derived(
		email
			.split('@')[0]
			.split(/[._-]/)
			.filter(Boolean)
			.slice(0, 2)
			.map((p) => p[0]?.toUpperCase() ?? '')
			.join('') || '?'
	);

	function close(refocus = false) {
		open = false;
		if (refocus) triggerEl?.focus();
	}

	function closeFromEvent() {
		close();
		onNavigate?.();
	}

	onMount(() => {
		const onDoc = (e: MouseEvent) => {
			if (open && !rootEl?.contains(e.target as Node)) close();
		};
		const onKey = (e: KeyboardEvent) => {
			if (e.key === 'Escape' && open) {
				e.stopPropagation();
				close(true);
			}
		};
		document.addEventListener('mousedown', onDoc);
		document.addEventListener('keydown', onKey);
		return () => {
			document.removeEventListener('mousedown', onDoc);
			document.removeEventListener('keydown', onKey);
		};
	});
</script>

<div class="rail-user" bind:this={rootEl}>
	<button
		type="button"
		class="rail-user-btn"
		bind:this={triggerEl}
		aria-haspopup="menu"
		aria-expanded={open}
		aria-label={collapsed ? `Account menu for ${displayName || email}` : undefined}
		title={collapsed ? (displayName || email) : undefined}
		onclick={() => (open = !open)}
	>
		<span class="rail-avatar">{initials}</span>
		{#if !collapsed}
			<span class="rail-user-txt">
				<strong>{displayName || email}</strong>
				<span>{roleLabel}</span>
			</span>
			<ChevronsUpDown size={14} strokeWidth={1.75} class="rail-user-caret" />
		{/if}
	</button>

	{#if open}
		<div class="rail-user-menu" role="menu" tabindex="-1">
			<div class="rail-user-menu-head">
				<strong>{email}</strong>
				<span>{roleLabel}</span>
			</div>
			<a href={settingsHref} role="menuitem" onclick={closeFromEvent}>
				<Settings size={15} strokeWidth={1.75} />
				Settings
			</a>
			<button
				type="button"
				role="menuitem"
				class="danger"
				onclick={() => {
					close();
					onSignOut?.();
				}}
			>
				<LogOut size={15} strokeWidth={1.75} />
				Sign out
			</button>
		</div>
	{/if}
</div>
