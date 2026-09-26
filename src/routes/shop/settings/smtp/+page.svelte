<script lang="ts">
	import ServiceConfigPanel from '../ServiceConfigPanel.svelte';
	import type { ConfigService } from '$lib/admin/configTypes';

	const service: ConfigService = 'SMTP';
</script>

<ServiceConfigPanel {service} />
