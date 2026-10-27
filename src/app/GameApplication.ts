import { weaponHUDTarget } from '@/ui/WeaponHUDLayout';
import { GameSession } from '@/app/GameSession';
import { setupModeDescriptions } from '@/ui/ModeDescriptions';
import { startGameLoop } from '@/core/GameLoop';
import { FpsCounter } from '@/ui/FpsCounter.ts';
import { createGameWorld } from '@/GameRuntime';
import { ProgressStore, bonusesOf } from '@/progression/Achievements';
import { RewardsScreen } from '@/ui/RewardsScreen';
import { CharacterScreen } from '@/ui/CharacterScreen';


export function createGameApplication(): () => void {
    const applicationEvents = new AbortController();
    const { signal } = applicationEvents;
    // Covers dynamically created portraits and weapon icons as well.
    document.addEventListener('dragstart', event => {
        if (event.target instanceof HTMLImageElement) event.preventDefault();
    }, { signal });

    const canvas = document.querySelector<HTMLCanvasElement>('#game')!;
    const ctx = canvas.getContext('2d')!;
    const menu = document.querySelector<HTMLElement>('#menu')!;
    const backButton = document.querySelector<HTMLButtonElement>('#back-to-menu')!;
    const pauseDialog = document.querySelector<HTMLDialogElement>('#pause-dialog')!;
    const resumeButton = document.querySelector<HTMLButtonElement>('#resume-game')!;
    const survivalButton = document.querySelector<HTMLButtonElement>('#survival')!;
    const progressStore = new ProgressStore();
    const rewards = new RewardsScreen(showMenu);
    const characters = new CharacterScreen(showMenu, startSurvival);
    const session = new GameSession(loadout => createGameWorld(bonusesOf(progressStore.totals), loadout.character, loadout));
    const hideDescription = setupModeDescriptions(signal);
    const fpsCounter = new FpsCounter();

    function resizeCanvas() {
        const dpr = window.devicePixelRatio || 1;
        canvas.width = window.innerWidth * dpr;
        canvas.height = window.innerHeight * dpr;
        canvas.style.width = `${window.innerWidth}px`;
        canvas.style.height = `${window.innerHeight}px`;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        // Resizing clears the canvas, even while the simulation is paused.
        if (session.paused && session.world) {
            session.world.draw(ctx);
            session.world.getPlayerController().draw(ctx);
        }
    }
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas, { signal });

    function pauseGame() {
        if (!session.pause()) return;
        pauseDialog.showModal();
        resumeButton.focus();
    }

    function resumeGame() {
        if (!session.resume()) return;
        pauseDialog.close();
        backButton.blur();
    }

    pauseDialog.addEventListener('cancel', event => {
        event.preventDefault();
        resumeGame();
    }, { signal });
    resumeButton.addEventListener('click', resumeGame, { signal });
    document.querySelector('#restart-game')!.addEventListener('click', () => {
        if (!session.restart()) return;
        resumeGame();
    }, { signal });
    document.querySelector('#pause-main-menu')!.addEventListener('click', showMenu, { signal });

    function showMenu() {
        pauseDialog.close();
        characters.hide();
        session.showMenu();
        menu.hidden = false;
        canvas.hidden = true;
        backButton.hidden = true;
        document.body.classList.remove('playing');
        survivalButton.focus();
    }

    function startSurvival() {
        session.start(characters.selectedLoadout);
        menu.hidden = true;
        canvas.hidden = false;
        backButton.hidden = false;
        document.body.classList.add('playing');
        survivalButton.blur();
    }
    survivalButton.addEventListener('click', () => {
        menu.hidden = true;
        hideDescription();
        characters.show();
    }, { signal });
    backButton.addEventListener('click', pauseGame, { signal });
    window.addEventListener('keydown', (event) => {
        if (!session.playing) return;
        if (event.key === 'Escape') {
            event.preventDefault();
            if (!event.repeat) { if (session.paused) resumeGame(); else pauseGame(); }
            return;
        }
        if (session.paused) return;
        if (event.code === 'KeyQ' || event.code === 'KeyE') {
            event.preventDefault();
            if (!event.repeat) session.world!.getPlayerController().cycleWeapon(event.code === 'KeyQ' ? -1 : 1);
        }
    }, { signal });
    canvas.addEventListener('mousedown', event => {
        if (!session.active || event.button !== 0) return;
        const target = weaponHUDTarget(event.clientX, event.clientY, window.innerWidth, window.innerHeight);
        if (!target.inside) return;
        // Consume panel clicks before they reach the window's shooting listener.
        event.preventDefault(); event.stopPropagation();
        const controller = session.world!.getPlayerController();
        controller.stopShooting();
        if (target.slot !== null) controller.switchToWeapon(target.slot);
    }, { signal });
    canvas.addEventListener('mousemove', event => {
        if (!session.active) return;
        const target = weaponHUDTarget(event.clientX, event.clientY, window.innerWidth, window.innerHeight);
        canvas.style.cursor = target.slot === null ? '' : 'pointer';
    }, { signal });
    canvas.addEventListener('wheel', event => {
        if (!session.active || event.ctrlKey || event.deltaY === 0) return;
        event.preventDefault();
        session.world!.getPlayerController().cycleWeapon(event.deltaY > 0 ? 1 : -1);
    }, { passive: false, signal });
    window.addEventListener('blur', pauseGame, { signal });
    document.addEventListener('visibilitychange', () => { if (document.hidden) pauseGame(); }, { signal });

    document.querySelector('#achievements')!.addEventListener('click', () => {
        menu.hidden = true;
        rewards.showAchievements(progressStore.totals, progressStore.storageAvailable);
    }, { signal });
    canvas.hidden = true;

    const stopLoop = startGameLoop(ctx, [{
        update(deltaMs) {
            const gameWorld = session.world;
            if (!session.active || !gameWorld) return;
            gameWorld.update(deltaMs);
            if (gameWorld.getPlayerController().getPlayer().currentHp <= 0) {
                const run = gameWorld.getRunStats();
                const { before, after } = progressStore.record(run);
                session.dispose();
                backButton.hidden = true;
                document.body.classList.remove('playing');
                rewards.showResults(run, before, after, progressStore.storageAvailable);
                return;
            }
        },
        draw(context) {
            const gameWorld = session.world;
            if (!session.active || !gameWorld) return;
            fpsCounter.update();
            gameWorld.draw(context);
            gameWorld.getPlayerController().draw(context);
            fpsCounter.draw(context);
        },
    }], { isActive: () => session.active });


    return () => {
        stopLoop();
        applicationEvents.abort();
        session.dispose();
        characters.dispose();
        rewards.dispose();
        pauseDialog.close();
        canvas.hidden = true;
        backButton.hidden = true;
        menu.hidden = false;
        document.body.classList.remove('playing');
    };
}
