import { ARSENAL_CATEGORIES, ARSENAL_LIMIT, ARSENAL_STEP, EMPTY_ARSENAL, validateArsenal } from '@/gameplay/arsenal';
import type { ArsenalAllocation } from '@/gameplay/arsenal';
import { EMPTY_IMPLANTS, IMPLANT_LIMIT, IMPLANT_STEP, validateImplants } from '@/gameplay/implants';
import type { ImplantAllocation } from '@/gameplay/implants';

export type UpgradeSection = 'weapons' | 'implants';
const implantIds: readonly (keyof ImplantAllocation)[] = ['health', 'attackSpeed', 'damage', 'moveSpeed', 'armor'];

/** Drawer edits never change the saved allocations consumed by a battle. */
export class UpgradeDraft {
    private savedImplants: ImplantAllocation;
    private savedArsenal: ArsenalAllocation;
    private workingImplants?: ImplantAllocation;
    private workingArsenal?: ArsenalAllocation;
    section?: UpgradeSection;

    constructor(implants: ImplantAllocation = EMPTY_IMPLANTS, arsenal: ArsenalAllocation = EMPTY_ARSENAL) {
        validateImplants(implants);
        validateArsenal(arsenal);
        this.savedImplants = { ...implants, damage: implants.damage ?? 0, armor: implants.armor ?? 0 };
        this.savedArsenal = { ...arsenal };
    }

    get implants(): ImplantAllocation { return { ...this.savedImplants }; }
    get arsenal(): ArsenalAllocation { return { ...this.savedArsenal }; }
    get draftImplants(): ImplantAllocation { return { ...(this.workingImplants ?? this.savedImplants) }; }
    get draftArsenal(): ArsenalAllocation { return { ...(this.workingArsenal ?? this.savedArsenal) }; }
    get limit(): number { return this.section === 'weapons' ? ARSENAL_LIMIT : IMPLANT_LIMIT; }
    get total(): number {
        const allocation = this.section === 'weapons' ? this.draftArsenal : this.draftImplants;
        return Object.values(allocation).reduce((sum, value) => sum + value, 0);
    }
    get remaining(): number { return this.limit - this.total; }

    open(section: UpgradeSection): void {
        this.cancel();
        this.section = section;
        if (section === 'weapons') this.workingArsenal = this.arsenal;
        else this.workingImplants = this.implants;
    }

    change(id: string, delta: number): boolean {
        if (!this.section) return false;
        const step = this.section === 'weapons' ? ARSENAL_STEP : IMPLANT_STEP;
        if (delta !== step && delta !== -step) return false;
        if (this.section === 'weapons') {
            if (!ARSENAL_CATEGORIES.includes(id as keyof ArsenalAllocation)) return false;
            const key = id as keyof ArsenalAllocation;
            const next = { ...this.draftArsenal, [key]: this.draftArsenal[key] + delta };
            try { validateArsenal(next); } catch { return false; }
            this.workingArsenal = next;
        } else {
            if (!implantIds.includes(id as keyof ImplantAllocation)) return false;
            const key = id as keyof ImplantAllocation;
            const next = { ...this.draftImplants, [key]: (this.draftImplants[key] ?? 0) + delta };
            try { validateImplants(next); } catch { return false; }
            this.workingImplants = next;
        }
        return true;
    }

    save(): UpgradeSection | undefined {
        const section = this.section;
        if (section === 'weapons') {
            validateArsenal(this.draftArsenal);
            this.savedArsenal = this.draftArsenal;
        } else if (section === 'implants') {
            validateImplants(this.draftImplants);
            this.savedImplants = this.draftImplants;
        }
        this.cancel();
        return section;
    }

    cancel(): void {
        this.section = undefined;
        this.workingArsenal = undefined;
        this.workingImplants = undefined;
    }
}
