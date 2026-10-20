<script lang="ts">
	/**
	 * A one-time code entered into separate boxes, backed by a single real
	 * input. One input (not six) is what keeps the platform features working:
	 * iOS and Android offer the emailed or texted code above the keyboard
	 * (`autocomplete="one-time-code"`), a pasted code fills every box, and a
	 * screen reader hears one field. The boxes are only its picture.
	 */
	let {
		value = $bindable(''),
		length = 6,
		id,
		disabled = false,
		invalid = false,
		autofocus = false,
		describedby,
		oncomplete,
		oninput
	}: {
		value?: string;
		length?: number;
		id: string;
		disabled?: boolean;
		invalid?: boolean;
		autofocus?: boolean;
		describedby?: string;
		/** Called once all digits are in, so the form can submit itself. */
		oncomplete?: () => void;
		oninput?: () => void;
	} = $props();

	let el = $state<HTMLInputElement | null>(null);
	let focused = $state(false);

	$effect(() => {
		if (autofocus && el) el.focus();
	});

	function handleInput(e: Event) {
		const input = e.currentTarget as HTMLInputElement;
		const digits = input.value.replace(/\D/g, '').slice(0, length);
		input.value = digits;
		value = digits;
		oninput?.();
		if (digits.length === length) oncomplete?.();
	}

	const active = $derived(focused ? Math.min(value.length, length - 1) : -1);
</script>

<div class="otp" class:otp-invalid={invalid} class:otp-disabled={disabled}>
	<input
		bind:this={el}
		{id}
		class="otp-input"
		{value}
		oninput={handleInput}
		onfocus={() => (focused = true)}
		onblur={() => (focused = false)}
		type="text"
		inputmode="numeric"
		autocomplete="one-time-code"
		pattern="[0-9]*"
		maxlength={length}
		spellcheck="false"
		{disabled}
		aria-invalid={invalid ? 'true' : undefined}
		aria-describedby={describedby}
	/>
	{#each Array.from({ length }) as _, i (i)}
		<span class="otp-box" class:otp-filled={i < value.length} class:otp-active={i === active} aria-hidden="true">
			{value[i] ?? ''}
		</span>
	{/each}
</div>

<style>
	.otp {
		position: relative;
		display: grid;
		grid-template-columns: repeat(6, minmax(0, 1fr));
		gap: var(--sp-5);
		max-width: 22rem;
	}

	/* The real input covers the boxes, invisible but focusable and tappable.
	   16px keeps iOS from zooming the page when it gets focus. */
	.otp-input {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		border: 0;
		background: transparent;
		color: transparent;
		caret-color: transparent;
		font-size: 16px;
		letter-spacing: 2.5em;
		outline: none;
		cursor: text;
		z-index: 1;
	}

	.otp-input::selection {
		background: transparent;
	}

	.otp-box {
		display: grid;
		place-items: center;
		height: 54px;
		border: 1px solid var(--border);
		border-radius: var(--radius-md, 8px);
		background: var(--surface-2, transparent);
		color: var(--text);
		font-family: var(--font-mono);
		font-size: 22px;
		font-weight: 600;
		transition:
			border-color var(--tr, 0.15s),
			box-shadow var(--tr, 0.15s);
	}

	.otp-filled {
		border-color: var(--text-3);
	}

	.otp-active {
		border-color: var(--accent);
		box-shadow: 0 0 0 3px var(--accent-ring, var(--accent-soft));
	}

	.otp-invalid .otp-box {
		border-color: var(--danger);
	}

	.otp-disabled {
		opacity: 0.6;
	}

	@media (max-width: 380px) {
		.otp {
			gap: var(--sp-3);
		}
		.otp-box {
			height: 48px;
			font-size: 20px;
		}
	}
</style>
