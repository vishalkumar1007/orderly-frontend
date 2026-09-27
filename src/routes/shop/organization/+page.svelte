<script lang="ts">
	import Clock from '@lucide/svelte/icons/clock';
	import CreditCard from '@lucide/svelte/icons/credit-card';
	import ListOrdered from '@lucide/svelte/icons/list-ordered';
	import Settings from '@lucide/svelte/icons/settings';
	import Shield from '@lucide/svelte/icons/shield';

	const links = [
		{
			href: '/shop/organization/hours',
			label: 'Operating Hours',
			hint: 'When customers can place orders',
			icon: Clock
		},
		{
			href: '/shop/organization/payments',
			label: 'Payments',
			hint: 'Online and cash payment methods',
			icon: CreditCard
		},
		{
			href: '/shop/organization/workflow',
			label: 'Order Workflow',
			hint: 'Acceptance, payment timing, and completion',
			icon: ListOrdered
		},
		{
			href: '/shop/iam',
			label: 'IAM',
			hint: 'Users, roles, and access',
			icon: Shield
		},
		{
			href: '/shop/settings',
			label: 'Settings',
			hint: 'Business profile, notifications, and integrations',
			icon: Settings
		}
	];
</script>

<div class="panel nav-hub">
	<p class="muted nav-hub-lead">
		How your shop runs day to day — hours, payments, order flow, access, and configuration.
	</p>
	<ul class="nav-hub-list">
		{#each links as link (link.href)}
			{@const Icon = link.icon}
			<li>
				<a class="nav-hub-link" href={link.href}>
					<span class="nav-hub-icon"><Icon size={16} strokeWidth={1.75} /></span>
					<span>
						<strong>{link.label}</strong>
						<span class="muted">{link.hint}</span>
					</span>
				</a>
			</li>
		{/each}
	</ul>
</div>

<style>
	.nav-hub {
		max-width: 40rem;
	}

	.nav-hub-lead {
		margin: 0 0 1rem;
		font-size: 0.9rem;
		line-height: 1.45;
	}

	.nav-hub-list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		gap: 0.5rem;
	}

	.nav-hub-link {
		display: flex;
		align-items: flex-start;
		gap: 0.75rem;
		padding: 0.75rem 0.85rem;
		border: 1px solid var(--border);
		border-radius: var(--radius-md, 10px);
		text-decoration: none;
		color: var(--text);
		background: var(--bg);
	}

	.nav-hub-link:hover {
		border-color: color-mix(in srgb, var(--accent, #3b82f6) 35%, var(--border));
	}

	.nav-hub-link strong {
		display: block;
		font-size: 0.875rem;
		font-weight: 650;
	}

	.nav-hub-link .muted {
		display: block;
		font-size: 0.78rem;
		margin-top: 0.15rem;
	}

	.nav-hub-icon {
		display: grid;
		place-items: center;
		width: 2rem;
		height: 2rem;
		border-radius: 8px;
		background: color-mix(in srgb, var(--surface) 70%, var(--border));
		flex: none;
	}
</style>
