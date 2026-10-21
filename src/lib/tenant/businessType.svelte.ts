import {
	termsFor,
	quickActionsFor,
	hasModule,
	modulesFor,
	type ModuleKey,
	type Terminology
} from '$lib/admin/businessTypes';
import { moduleForPath } from '$lib/tenant/nav';

/**
 * What kind of business this console belongs to, and what it has switched on.
 *
 * Both arrive with the identity, once, in the shop layout. Every screen
 * beneath it needs the same answer: the kitchen board to know whether it is a
 * kitchen, a bar or a packing bench; the catalogue to know whether its groups
 * are categories, aisles or courses: and none of them should re-fetch it or
 * receive it as a prop threaded through layouts that do not care.
 *
 * The type decides the words. The capability list (tenant_capabilities, as
 * the API reports it) decides which modules exist: a GENERAL business that
 * turned on appointments has them, a barber that turned on a catalogue has
 * one, whatever the type's template says. The template only stands in when
 * the API sent no list.
 *
 * It is deliberately a plain module rune rather than context: the value is
 * resolved asynchronously after the layout mounts, so a context read at child
 * init would capture an empty string and never update. A module rune updates
 * every reader the moment the layout sets it.
 *
 * Before it resolves this is an empty string, which `termsFor` answers with the
 * neutral defaults. Screens therefore render correct-looking generic wording
 * for one frame instead of flashing placeholder text.
 */
let current = $state('');
let capabilities = $state<string[] | null>(null);

/** Called by the shop layout as soon as the signed-in tenant is known. */
export function setBusinessType(
	code: string | null | undefined,
	enabled?: readonly string[] | null
): void {
	current = code ?? '';
	capabilities = enabled ? [...enabled] : null;
}

/** The raw type code, e.g. `CAFE`. Empty until the identity resolves. */
export function businessType(): string {
	return current;
}

/** This business's vocabulary: what it calls an item, a group, a station. */
export function terms(): Terminology {
	return termsFor(current);
}

/** The modules this business has, for screens that list rather than ask. */
export function modules(): ModuleKey[] {
	return modulesFor(current, capabilities);
}

/** Does this business have this capability at all? */
export function hasBusinessModule(module: ModuleKey): boolean {
	return hasModule(current, module, capabilities);
}

/** Is a capability code switched on? Null list (older API) answers false. */
export function hasCapability(code: string): boolean {
	return capabilities?.includes(code) ?? false;
}

/**
 * Does this business run on orders at all? False for the booking and stay
 * shapes: their dashboard/selling data would otherwise show real-looking
 * zeros for a flow the business doesn't use.
 */
export function orderingEnabled(): boolean {
	return hasBusinessModule('station');
}

/**
 * The shortcuts this kind of business actually starts its day with, minus any
 * that point at a module it has switched off.
 */
export function quickActions() {
	return quickActionsFor(current).filter((a) => {
		const module = moduleForPath(a.href.split('?')[0]);
		return !module || hasBusinessModule(module);
	});
}
