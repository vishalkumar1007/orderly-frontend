/**
 * Notification sounds — short tones synthesised with the Web Audio API.
 *
 * No audio files: a handful of oscillator tones cover "new order" and "order
 * ready" without shipping assets or picking a license. `NONE` plays nothing.
 */

const KINDS = ['NONE', 'CHIME', 'BELL', 'PING'] as const;
export type SoundKind = (typeof KINDS)[number];

let ctx: AudioContext | null = null;

function getContext(): AudioContext | null {
	if (typeof window === 'undefined') return null;
	const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext })
		.webkitAudioContext;
	if (!Ctor) return null;
	if (!ctx) ctx = new Ctor();
	if (ctx.state === 'suspended') void ctx.resume();
	return ctx;
}

// Browsers suspend a fresh AudioContext until a user gesture unlocks it. A
// sound triggered by a poll timer has no gesture of its own, so unlock on the
// first click/keypress anywhere on the page and keep the context alive.
if (typeof window !== 'undefined') {
	const unlock = () => {
		getContext();
		window.removeEventListener('pointerdown', unlock);
		window.removeEventListener('keydown', unlock);
	};
	window.addEventListener('pointerdown', unlock, { once: true });
	window.addEventListener('keydown', unlock, { once: true });
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

/** Play a configured notification sound. Silently does nothing for NONE or an unknown kind. */
export function playSound(kind: string | null | undefined): void {
	const k = (kind || '').toUpperCase();
	if (!k || k === 'NONE') return;
	const context = getContext();
	if (!context) return;
	const now = context.currentTime;
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

export const SOUND_OPTIONS: { value: SoundKind; label: string }[] = [
	{ value: 'NONE', label: 'No sound' },
	{ value: 'CHIME', label: 'Chime' },
	{ value: 'BELL', label: 'Bell' },
	{ value: 'PING', label: 'Ping' }
];
