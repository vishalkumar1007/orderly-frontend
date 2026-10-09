import {
	termsFor,
	quickActionsFor,
	hasModule,
	templateFor,
	type ModuleKey,
	type Terminology
} from '$lib/admin/businessTypes';

/**
 * What kind of business this console belongs to.
 *
 * The type arrives with the identity, once, in the shop layout. Every screen
 * beneath it needs the same answer — the kitchen board to know whether it is a
 * kitchen, a bar or a packing bench; the catalogue to know whether its groups
 * are categories, aisles or courses — and none of them should re-fetch it or
 * receive it as a prop threaded through layouts that do not care.
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

/** Called by the shop layout as soon as the signed-in tenant is known. */
export function setBusinessType(code: string | null | undefined): void {
	current = code ?? '';
}

/** The raw type code, e.g. `CAFE`. Empty until the identity resolves. */
export function businessType(): string {
	return current;
}

/** This business's vocabulary: what it calls an item, a group, a station. */
export function terms(): Terminology {
	return termsFor(current);
}

/** Does this business have this capability at all? */
export function hasBusinessModule(module: ModuleKey): boolean {
	return hasModule(current, module);
}

/**
 * Does this business type run on orders at all? False for the capability-driven
 * types (appointments, reservations, ...) — their dashboard/selling data would
 * otherwise show real-looking zeros for a flow the business doesn't use.
 */
export function orderingEnabled(): boolean {
	return templateFor(current).behaviour.ordering_enabled;
}

/** The shortcuts this kind of business actually starts its day with. */
export function quickActions() {
	return quickActionsFor(current);
}
