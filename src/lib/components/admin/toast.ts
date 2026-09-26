import { writable } from 'svelte/store';

export type ToastKind = 'success' | 'error' | 'info';

/** Optional inline button — used for prompts that need a decision. */
export type ToastAction = {
	label: string;
	onClick: () => void;
};

export type ToastItem = {
	id: string;
	message: string;
	kind: ToastKind;
	action?: ToastAction;
};

function createToastStore() {
	const { subscribe, update } = writable<ToastItem[]>([]);

	function push(
		message: string,
		kind: ToastKind = 'info',
		ms = 3200,
		action?: ToastAction
	) {
		const id = crypto.randomUUID();
		update((list) => [...list, { id, message, kind, action }]);
		// `duration: 0` keeps a prompt on screen until the user acts.
		if (ms > 0) {
			setTimeout(() => {
				update((list) => list.filter((t) => t.id !== id));
			}, ms);
		}
		return id;
	}

	return {
		subscribe,
		success: (message: string) => push(message, 'success'),
		error: (message: string) => push(message, 'error'),
		info: (message: string) => push(message, 'info'),
		/** A prompt that stays until dismissed, optionally with one action. */
		show: (opts: { message: string; action?: ToastAction; duration?: number }) =>
			push(opts.message, 'info', opts.duration ?? 0, opts.action),
		dismiss: (id: string) => update((list) => list.filter((t) => t.id !== id))
	};
}

export const toast = createToastStore();
