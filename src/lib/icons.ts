import type Bell from '@tabler/icons-svelte/icons/bell';

/**
 * The type of a Tabler icon component. The console uses one icon family (Tabler
 * outline, ui_rules.md); anything that stores an icon in data — a nav entry, a
 * settings section — types it with this rather than Svelte's `Component`, which
 * Tabler's class-style components do not satisfy.
 */
export type IconComponent = typeof Bell;
