import tailwindcss from '@tailwindcss/vite';
import adapter from '@sveltejs/adapter-auto';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [
		tailwindcss(),
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},

			// We register the worker by hand (src/lib/pwa.ts) so a new build waits
			// for the user to accept it, instead of swapping under a live order.
			serviceWorker: {
				register: false
			},

			// adapter-auto only supports some environments, see https://svelte.dev/docs/kit/adapter-auto for a list.
			// If your environment is not supported, or you settled on a specific environment, switch out the adapter.
			// See https://svelte.dev/docs/kit/adapters for more information about adapters.
			adapter: adapter()
		})
	],
	ssr: {
		noExternal: ['@lucide/svelte']
	},
	server: {
		host: true,
		allowedHosts: true,
		proxy: {
			'/api': {
				target: 'http://127.0.0.1:8080',
				changeOrigin: true
			},
			'/health': {
				target: 'http://127.0.0.1:8080',
				changeOrigin: true
			}
		}
	}
});
