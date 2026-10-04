import tailwindcss from '@tailwindcss/vite';
import adapter from '@sveltejs/adapter-node';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig, type Plugin, type UserConfig } from 'vite';
import net from 'node:net';

const DEV_PORT = 5173;
const DEV_PORT_MAX = 5199;

function isPortBusy(port: number): Promise<boolean> {
	return new Promise((resolve) => {
		const checkConnect = (host: string) =>
			new Promise<boolean>((res) => {
				const socket = new net.Socket();
				socket.setTimeout(250);
				socket.once('connect', () => {
					socket.destroy();
					res(true);
				});
				socket.once('timeout', () => {
					socket.destroy();
					res(false);
				});
				socket.once('error', () => {
					socket.destroy();
					res(false);
				});
				socket.connect(port, host);
			});

		const checkListen = (host: string) =>
			new Promise<boolean>((res) => {
				const server = net.createServer();
				server.unref();
				server.once('error', (err: NodeJS.ErrnoException) => {
					// Only a real in-use port counts; EACCES/other bind errors are not "busy".
					res(err.code === 'EADDRINUSE');
				});
				server.once('listening', () => {
					server.close(() => res(false));
				});
				try {
					server.listen(port, host);
				} catch {
					res(false);
				}
			});

		Promise.all([checkConnect('127.0.0.1'), checkConnect('::1')]).then(([c1, c2]) => {
			if (c1 || c2) return resolve(true);
			Promise.all([checkListen('127.0.0.1'), checkListen('::1'), checkListen('0.0.0.0')]).then(
				(results) => {
					resolve(results.some(Boolean));
				}
			);
		});
	});
}

function portNotifierPlugin(isBusy: boolean, finalPort: number): Plugin {
	return {
		name: 'orderly-port-notifier',
		configureServer(server) {
			const origPrintUrls = server.printUrls;
			server.printUrls = () => {
				if (isBusy) {
					console.log(`\n  \x1b[33m➜  Port ${DEV_PORT} is busy, running on port ${finalPort}\x1b[0m`);
				}
				origPrintUrls.call(server);
				console.log(`  \x1b[36m➜\x1b[0m  \x1b[1mFinal port:\x1b[0m \x1b[32m${finalPort}\x1b[0m\n`);
			};
		}
	};
}

export default defineConfig(async ({ command }): Promise<UserConfig> => {
	let finalPort = DEV_PORT;
	let isBusy = false;

	// Only probe ports for local `vite dev`. svelte-check/sync can load this
	// config with command=serve; CI runners often make bind checks look "busy".
	const shouldProbePort =
		command === 'serve' && !process.env.CI && process.env.npm_lifecycle_event === 'dev';

	if (shouldProbePort) {
		isBusy = await isPortBusy(DEV_PORT);
		if (isBusy) {
			finalPort = DEV_PORT + 1;
			while (finalPort <= DEV_PORT_MAX && (await isPortBusy(finalPort))) {
				finalPort++;
			}
			if (finalPort > DEV_PORT_MAX) {
				finalPort = DEV_PORT;
				isBusy = false;
			} else {
				console.log(`\n\x1b[33m➜  Port ${DEV_PORT} is busy, running on port ${finalPort}\x1b[0m`);
			}
		}
		console.log(`\x1b[36m➜\x1b[0m  \x1b[1mFinal port:\x1b[0m \x1b[32m${finalPort}\x1b[0m\n`);
	}

	return {
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

				adapter: adapter()
			}),
			portNotifierPlugin(isBusy, finalPort)
		],
		ssr: {
			noExternal: ['@lucide/svelte']
		},
		server: {
			port: finalPort,
			host: true,
			allowedHosts: true,
			proxy: {
				// Keep the browser Host (e.g. momo-magic.localhost) so local
				// Vite-proxy requests still resolve the tenant without needing
				// X-Tenant-Slug. Production dials api.{base} with that header.
				'/api': {
					target: 'http://127.0.0.1:8080',
					changeOrigin: false
				},
				'/health': {
					target: 'http://127.0.0.1:8080',
					changeOrigin: false
				}
			}
		}
	};
});
