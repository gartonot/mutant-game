import type { StatModifier } from './stats';

export interface BonusDefinition {
    readonly id: string;
    readonly name: string;
    readonly maxStacks: number;
    readonly exclusiveGroup?: string;
    readonly modifiers: readonly StatModifier[];
}
export interface BonusSelection { readonly id: string; readonly stacks: number }
// No unapproved equipment bonuses are sold or granted by the prototype.
export const BONUS_DEFINITIONS: Readonly<Record<string, BonusDefinition>> = Object.freeze({});

export function resolveBonuses(selections: readonly BonusSelection[], catalog = BONUS_DEFINITIONS): StatModifier[] {
    const seen = new Set<string>();
    const groups = new Set<string>();
    const modifiers: StatModifier[] = [];
    for (const selection of selections) {
        const definition = Object.prototype.hasOwnProperty.call(catalog, selection.id) ? catalog[selection.id] : undefined;
        if (!definition || seen.has(selection.id) || !Number.isInteger(selection.stacks) ||
            selection.stacks < 1 || selection.stacks > definition.maxStacks) throw new Error(`Invalid bonus: ${selection.id}`);
        seen.add(selection.id);
        if (definition.exclusiveGroup) {
            if (groups.has(definition.exclusiveGroup)) throw new Error('Incompatible bonuses');
            groups.add(definition.exclusiveGroup);
        }
        for (const modifier of definition.modifiers) modifiers.push({ ...modifier, value: modifier.value * selection.stacks });
    }
    return modifiers;
}
