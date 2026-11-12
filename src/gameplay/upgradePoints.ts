import type { ArsenalAllocation } from './arsenal';
import type { ImplantAllocation } from './implants';

// The approved drawers show 20 points in each section and 30 still available.
export const UPGRADE_POINT_BUDGET = 70;

export function remainingUpgradePoints(implants: ImplantAllocation, arsenal: ArsenalAllocation): number {
    const implantPoints = implants.health + implants.attackSpeed + implants.moveSpeed
        + (implants.damage ?? 0) + (implants.armor ?? 0);
    const arsenalPoints = Object.values(arsenal).reduce((sum, points) => sum + points, 0);
    // Older saves can exceed the shared budget under the previous independent limits.
    return Math.max(0, UPGRADE_POINT_BUDGET - implantPoints - arsenalPoints);
}
