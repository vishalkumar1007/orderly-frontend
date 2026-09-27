<script lang="ts">
	import HardDrive from '@lucide/svelte/icons/hard-drive';
	import Mail from '@lucide/svelte/icons/mail';
	import Sparkles from '@lucide/svelte/icons/sparkles';

	const links = [
		{
			href: '/shop/settings/integrations/smtp',
			label: 'Email / SMTP',
			hint: 'Transactional email delivery',
			icon: Mail
		},
		{
			href: '/shop/settings/integrations/storage',
			label: 'Storage',
			hint: 'Media and file storage',
			icon: HardDrive
		},
		{
			href: '/shop/settings/integrations/ai',
			label: 'AI',
			hint: 'Assistive generation settings',
			icon: Sparkles
		}
	];
</script>

<div class="panel nav-hub">
	<p class="muted nav-hub-lead">
		Connect the services your shop depends on. Each link opens a configuration screen where you can
		set up and test the connection.
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
