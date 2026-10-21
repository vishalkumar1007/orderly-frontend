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

const KINDS = ['NONE', 'CHIME', 'BELL', 'PING', 'DINGDONG', 'MARIMBA', 'RISE', 'REGISTER', 'URGENT'] as const;
export type SoundKind = (typeof KINDS)[number];

// A per-viewer convenience, not shared state: whether alerts make a sound at
// all. Defaults on; stored per browser, same as any other personal UI
// preference that does not need to survive a device change.
const SOUND_PREF_KEY = 'orderly-notif-sound-enabled';

function readSoundPref(): boolean {
	try {
		const v = localStorage.getItem(SOUND_PREF_KEY);
		return v === null ? true : v === 'true';
	} catch {
		return true;
	}
}

/**
 * Reactive: `locked` is true while the browser is blocking audio, `enabled`
 * is the person's own on/off choice.
 */
export const soundState = $state({ locked: true, supported: true, enabled: readSoundPref() });

export function soundEnabled(): boolean {
	return soundState.enabled;
}

export function setSoundEnabled(on: boolean): void {
	soundState.enabled = on;
	try {
		localStorage.setItem(SOUND_PREF_KEY, String(on));
	} catch {
		/* private window / blocked storage: the toggle just won't persist */
	}
}

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

// Everything plays through one output stage: a compressor that lets the
// sounds be loud enough for a busy kitchen or a phone in a pocket without
// clipping. The first version peaked at 18% volume and was easy to miss.
let out: AudioNode | null = null;
function output(context: AudioContext): AudioNode {
	if (out) return out;
	const comp = context.createDynamicsCompressor();
	comp.threshold.value = -14;
	comp.knee.value = 8;
	comp.ratio.value = 4;
	comp.attack.value = 0.003;
	comp.release.value = 0.2;
	const master = context.createGain();
	master.gain.value = 0.9;
	comp.connect(master).connect(context.destination);
	out = comp;
	return out;
}

/**
 * One struck note: a fundamental plus a few quieter partials, rising in a few
 * milliseconds and fading naturally. Partials are what make a note sound like
 * a bell or a marimba rather than a test tone.
 */
function note(
	context: AudioContext,
	freq: number,
	at: number,
	duration: number,
	{ peak = 0.6, type = 'sine' as OscillatorType, partials = [] as Array<[number, number]> } = {}
) {
	const dest = output(context);
	for (const [ratio, level] of [[1, 1], ...partials] as Array<[number, number]>) {
		const osc = context.createOscillator();
		const gain = context.createGain();
		osc.type = type;
		osc.frequency.value = freq * ratio;
		// Higher partials die away faster, as on a real instrument.
		const life = duration / Math.max(1, ratio * 0.8);
		gain.gain.setValueAtTime(0, at);
		gain.gain.linearRampToValueAtTime(peak * level, at + 0.006);
		gain.gain.exponentialRampToValueAtTime(0.0001, at + life);
		osc.connect(gain).connect(dest);
		osc.start(at);
		osc.stop(at + life + 0.05);
	}
}

/** A short burst of noise, for the "ka" of a cash register. */
function click(context: AudioContext, at: number, duration = 0.05, peak = 0.35) {
	const frames = Math.floor(context.sampleRate * duration);
	const buffer = context.createBuffer(1, frames, context.sampleRate);
	const data = buffer.getChannelData(0);
	for (let i = 0; i < frames; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / frames);
	const src = context.createBufferSource();
	const gain = context.createGain();
	const band = context.createBiquadFilter();
	band.type = 'bandpass';
	band.frequency.value = 3200;
	gain.gain.value = peak;
	src.buffer = buffer;
	src.connect(band).connect(gain).connect(output(context));
	src.start(at);
}

const BELLISH: Array<[number, number]> = [
	[2, 0.45],
	[3, 0.2],
	[4.2, 0.12]
];
const WARM: Array<[number, number]> = [[2, 0.3]];

/**
 * Play a configured notification sound. Does nothing for NONE, an unknown
 * kind, or while the person has sound switched off (a settings preview passes
 * `preview` to be heard regardless). If audio is still locked, the sound is
 * kept and played on unlock.
 */
export function playSound(kind: string | null | undefined, opts?: { preview?: boolean }): void {
	const k = (kind || '').toUpperCase();
	if (!k || k === 'NONE') return;
	if (!opts?.preview && !soundState.enabled) return;
	const context = getContext();
	if (!context) return;
	if (context.state !== 'running') {
		pending = { kind: k, at: Date.now() };
		void context.resume().then(syncState, () => {});
		return;
	}
	const t = context.currentTime + 0.03;
	switch (k) {
		case 'BELL':
			note(context, 659.25, t, 1.8, { peak: 0.55, partials: BELLISH });
			break;
		case 'PING':
			note(context, 1567.98, t, 0.5, { peak: 0.55, partials: [[2, 0.2]] });
			break;
		case 'DINGDONG':
			note(context, 659.25, t, 1.0, { peak: 0.6, partials: BELLISH });
			note(context, 523.25, t + 0.42, 1.4, { peak: 0.6, partials: BELLISH });
			break;
		case 'MARIMBA':
			[523.25, 659.25, 783.99].forEach((f, i) =>
				note(context, f, t + i * 0.11, 0.45, { peak: 0.6, type: 'triangle', partials: [[4, 0.15]] })
			);
			break;
		case 'RISE':
			[523.25, 659.25, 783.99, 1046.5].forEach((f, i) =>
				note(context, f, t + i * 0.09, 0.6, { peak: 0.5, partials: WARM })
			);
			break;
		case 'REGISTER':
			click(context, t);
			note(context, 2093, t + 0.06, 0.9, { peak: 0.45, partials: BELLISH });
			note(context, 2637, t + 0.12, 1.0, { peak: 0.4, partials: BELLISH });
			break;
		case 'URGENT':
			// Two groups of three quick beeps: hard to miss over kitchen noise.
			for (let g = 0; g < 2; g++)
				for (let i = 0; i < 3; i++)
					note(context, 1046.5, t + g * 0.6 + i * 0.16, 0.12, { peak: 0.45, type: 'triangle' });
			break;
		case 'CHIME':
		default:
			note(context, 880, t, 0.7, { peak: 0.6, partials: WARM });
			note(context, 1318.51, t + 0.14, 0.9, { peak: 0.6, partials: WARM });
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
	{ value: 'CHIME', label: 'Chime' },
	{ value: 'DINGDONG', label: 'Ding-dong' },
	{ value: 'BELL', label: 'Bell' },
	{ value: 'MARIMBA', label: 'Marimba' },
	{ value: 'RISE', label: 'Rising notes' },
	{ value: 'PING', label: 'Ping' },
	{ value: 'REGISTER', label: 'Cash register' },
	{ value: 'URGENT', label: 'Urgent beeps (loud kitchens)' },
	{ value: 'NONE', label: 'No sound' }
];
