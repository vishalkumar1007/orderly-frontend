import tailwindcss from '@tailwindcss/vite';
import adapter from '@sveltejs/adapter-node';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig, type Plugin, type UserConfig } from 'vite';
import net from 'node:net';

function isPortBusy(port: number): Promise<boolean> {
	return new Promise((resolve) => {
		// Check active socket connection on loopback (IPv4 & IPv6)
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

		// Check if any host interface fails to bind
		const checkListen = (host: string) =>
			new Promise<boolean>((res) => {
				const server = net.createServer();
				server.unref();
				server.once('error', (err: any) => {
					res(err.code === 'EADDRINUSE' || err.code === 'EACCES');
				});
				server.once('listening', () => {
					server.close(() => res(false));
				});
				try {
					server.listen(port, host);
				} catch {
					res(true);
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
					console.log(`\n  \x1b[33m➜  Port 5173 is busy, running on port ${finalPort}\x1b[0m`);
				}
				origPrintUrls.call(server);
				console.log(`  \x1b[36m➜\x1b[0m  \x1b[1mFinal port:\x1b[0m \x1b[32m${finalPort}\x1b[0m\n`);
			};
		}
	};
}

export default defineConfig(async ({ command }): Promise<UserConfig> => {
	let finalPort = 5173;
	let isBusy = false;

	if (command === 'serve') {
		isBusy = await isPortBusy(5173);
		if (isBusy) {
			finalPort = 5174;
			while (await isPortBusy(finalPort)) {
				finalPort++;
			}
			console.log(`\n\x1b[33m➜  Port 5173 is busy, running on port ${finalPort}\x1b[0m`);
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
				// Keep the browser Host (e.g. momo-magic.localhost) so the API can
				// resolve the tenant. changeOrigin:true rewrites Host to 127.0.0.1
				// and MatchHostTenant then returns 403 "tenant host required".
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

