<script lang="ts">
	import { page } from '$app/stores';
	import EmailTemplateStudio from '$lib/components/admin/email/EmailTemplateStudio.svelte';
</script>

<EmailTemplateStudio scope="platform" initialEvent={$page.url.searchParams.get('event') ?? ''} />
