/**
 * Notification sounds: short tones synthesised with the Web Audio API.
 *
 * No audio files: a handful of oscillator tones cover "new order" and "order
 * ready" without shipping assets or picking a license. `NONE` plays nothing.
 *
 * Every browser keeps audio locked until the person interacts with the page,
 * and a sound triggered by a poll has no interaction of its own. So:
 *
 * - audio is unlocked on any event a browser accepts as a gesture. iOS Safari
 *   does not count `pointerdown` on touch, only `touchend`/`click`, which is
 *   why customers on phones heard nothing;
 * - the unlock stays armed until audio is actually running, and re-arms when
 *   the browser suspends it again (background tab, iOS interruption);
 * - a sound asked for while locked is played the moment audio unlocks, if it
 *   is still recent, instead of being lost;
 * - `soundState.locked` lets a screen offer a "Turn on sound" button, so
 *   someone who only watches the page can still opt in with one tap.
 */

const KINDS = ['NONE', 'CHIME', 'BELL', 'PING'] as const;
export type SoundKind = (typeof KINDS)[number];

/** Reactive: `locked` is true while the browser is blocking audio. */
export const soundState = $state({ locked: true, supported: true });

let ctx: AudioContext | null = null;
let pending: { kind: string; at: number } | null = null;
const PENDING_MS = 60_000;
const GESTURES = ['pointerdown', 'pointerup', 'touchend', 'click', 'keydown'] as const;

function getContext(): AudioContext | null {
	if (typeof window === 'undefined') return null;
	if (ctx) return ctx;
	const Ctor =
		window.AudioContext ||
		(window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
	if (!Ctor) {
		soundState.supported = false;
		return null;
	}
	ctx = new Ctor();
	ctx.addEventListener('statechange', syncState);
	return ctx;
}

function syncState() {
	const running = ctx?.state === 'running';
	soundState.locked = !running;
	if (running) {
		disarm();
		if (pending && Date.now() - pending.at < PENDING_MS) {
			const kind = pending.kind;
			pending = null;
			playSound(kind);
		}
		pending = null;
	} else {
		arm();
	}
}

/** Resume audio from inside a user gesture. Safe to call any time. */
export function unlockSound(): void {
	const context = getContext();
	if (!context) return;
	// Older iOS only unlocks after a sound actually starts inside the gesture.
	try {
		const buffer = context.createBuffer(1, 1, 22050);
		const src = context.createBufferSource();
		src.buffer = buffer;
		src.connect(context.destination);
		src.start(0);
	} catch {
		/* not fatal */
	}
	if (context.state !== 'running') {
		void context.resume().then(syncState, () => {});
	} else {
		syncState();
	}
}

let armed = false;
function arm() {
	if (armed || typeof window === 'undefined') return;
	armed = true;
	for (const ev of GESTURES) window.addEventListener(ev, unlockSound, { capture: true, passive: true });
}
function disarm() {
	if (!armed) return;
	armed = false;
	for (const ev of GESTURES) window.removeEventListener(ev, unlockSound, { capture: true });
}

if (typeof window !== 'undefined') {
	arm();
	// Coming back to a tab is a good moment to try again: some browsers allow
	// resuming a context that was previously unlocked without a new gesture.
	document.addEventListener('visibilitychange', () => {
		if (!document.hidden && ctx && ctx.state !== 'running') void ctx.resume().then(syncState, () => {});
	});
}

function tone(context: AudioContext, freq: number, startAt: number, duration: number, peak = 0.18) {
	const osc = context.createOscillator();
	const gain = context.createGain();
	osc.type = 'sine';
	osc.frequency.value = freq;
	gain.gain.setValueAtTime(0, startAt);
	gain.gain.linearRampToValueAtTime(peak, startAt + 0.015);
	gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
	osc.connect(gain).connect(context.destination);
	osc.start(startAt);
	osc.stop(startAt + duration + 0.05);
}

/**
 * Play a configured notification sound. Does nothing for NONE or an unknown
 * kind. If audio is still locked, the sound is kept and played on unlock.
 */
export function playSound(kind: string | null | undefined): void {
	const k = (kind || '').toUpperCase();
	if (!k || k === 'NONE') return;
	const context = getContext();
	if (!context) return;
	if (context.state !== 'running') {
		pending = { kind: k, at: Date.now() };
		void context.resume().then(syncState, () => {});
		return;
	}
	const now = context.currentTime + 0.02;
	switch (k) {
		case 'CHIME':
			tone(context, 880, now, 0.22);
			tone(context, 1320, now + 0.12, 0.28);
			break;
		case 'BELL':
			tone(context, 660, now, 0.55, 0.22);
			break;
		case 'PING':
			tone(context, 1760, now, 0.12, 0.16);
			break;
		default:
			tone(context, 880, now, 0.2);
	}
}

/** A short buzz on phones that support it (Android; iOS ignores it). */
export function vibrate(pattern: number | number[] = [180, 80, 180]): void {
	try {
		navigator.vibrate?.(pattern);
	} catch {
		/* unsupported */
	}
}

export const SOUND_OPTIONS: { value: SoundKind; label: string }[] = [
	{ value: 'NONE', label: 'No sound' },
	{ value: 'CHIME', label: 'Chime' },
	{ value: 'BELL', label: 'Bell' },
	{ value: 'PING', label: 'Ping' }
];
