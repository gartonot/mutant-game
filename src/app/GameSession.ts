import type { Loadout } from '@/gameplay/loadout';
import { loadoutKey } from '@/gameplay/EquipmentDraft';

/** The session owns a world; screens only request transitions. No DOM or rendering dependencies. */
export interface SessionWorld {
    resume(): void;
    dispose?(): void;
    getPlayerController(): {
        resetInput(): void;
        switchToWeapon(index: number): void;
        dispose(): void;
    };
}
export type SessionPhase = 'menu' | 'playing' | 'paused';

export class GameSession<T extends SessionWorld> {
    private currentWorld?: T;
    private currentLoadout?: Loadout;
    private currentKey?: string;
    private currentPhase: SessionPhase = 'menu';

    constructor(private readonly createWorld: (loadout: Loadout) => T) {}

    get world(): T | undefined { return this.currentWorld; }
    get phase(): SessionPhase { return this.currentPhase; }
    get playing(): boolean { return this.currentPhase !== 'menu'; }
    get paused(): boolean { return this.currentPhase === 'paused'; }
    get active(): boolean { return this.currentPhase === 'playing'; }

    start(loadout: Loadout): T {
        const key = loadoutKey(loadout);
        if (!this.currentWorld || this.currentKey !== key) this.replaceWorld(loadout, key);
        const world = this.currentWorld!;
        // Menu/dialog key presses must never leak into a resumed run.
        world.getPlayerController().resetInput();
        world.getPlayerController().switchToWeapon(0);
        world.resume();
        this.currentPhase = 'playing';
        return world;
    }

    pause(): boolean {
        if (!this.active) return false;
        this.currentWorld!.getPlayerController().resetInput();
        this.currentPhase = 'paused';
        return true;
    }

    resume(): boolean {
        if (!this.paused) return false;
        this.currentWorld!.getPlayerController().resetInput();
        this.currentWorld!.resume();
        this.currentPhase = 'playing';
        return true;
    }

    /** Keep the paused run for the same loadout, including health and ammunition. */
    showMenu(): void {
        this.currentWorld?.getPlayerController().resetInput();
        this.currentPhase = 'menu';
    }

    /** Construct before disposing: a failed factory must not destroy the previous run. */
    restart(): boolean {
        if (!this.paused || !this.currentLoadout) return false;
        this.replaceWorld(this.currentLoadout, this.currentKey!);
        return true;
    }

    /** Called on death and application teardown. Safe to call more than once. */
    dispose(): void {
        this.currentWorld?.dispose?.();
        this.currentWorld?.getPlayerController().dispose();
        this.currentWorld = undefined;
        this.currentLoadout = undefined;
        this.currentKey = undefined;
        this.currentPhase = 'menu';
    }

    private replaceWorld(loadout: Loadout, key: string): void {
        const snapshot = structuredClone(loadout);
        const next = this.createWorld(structuredClone(snapshot));
        this.currentWorld?.dispose?.();
        this.currentWorld?.getPlayerController().dispose();
        this.currentWorld = next;
        this.currentLoadout = snapshot;
        this.currentKey = key;
    }
}
