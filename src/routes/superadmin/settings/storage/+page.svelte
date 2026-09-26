<script lang="ts">
	import ServiceConfigPanel from '../ServiceConfigPanel.svelte';
	import type { ConfigService } from '$lib/admin/configTypes';

	const service: ConfigService = 'STORAGE';
</script>

<ServiceConfigPanel {service} />
