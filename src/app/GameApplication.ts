import { weaponHUDTarget } from '@/ui/WeaponHUDLayout';
import { GameSession } from '@/app/GameSession';
import { setupModeDescriptions } from '@/ui/ModeDescriptions';
import { startGameLoop } from '@/core/GameLoop';
import { FpsCounter } from '@/ui/FpsCounter.ts';
import { createGameWorld } from '@/GameRuntime';
import { ProgressStore, bonusesOf } from '@/progression/Achievements';
import { RewardsScreen } from '@/ui/RewardsScreen';
import { CharacterScreen } from '@/ui/CharacterScreen';
import { ensureCharacterArt } from '@/rendering/CharacterArt';
import { weaponSpritesReady } from '@/rendering/WeaponSprites';
import { enemyArtReady } from '@/rendering/EnemyArt';
import { MusicTrack } from '@/audio/MusicTrack';
import { MusicSettings } from '@/ui/MusicSettings';
import { CombatAudio } from '@/audio/CombatAudio';
import battleMusicUrl from '@/assets/audio/battle-temporary.webm?url';
import menuMusicUrl from '@/assets/audio/menu-temporary.webm?url';
import './battle-preparation.css';


export function createGameApplication(): () => void {
    const applicationEvents = new AbortController();
    const { signal } = applicationEvents;
    const combatAudio = new CombatAudio();
    const unlockCombatAudio = () => combatAudio.unlock();
    window.addEventListener('pointerdown', unlockCombatAudio, { signal });
    window.addEventListener('keydown', unlockCombatAudio, { signal });
    const battleMusic = new MusicTrack(battleMusicUrl, 'battle');
    const menuMusic = new MusicTrack(menuMusicUrl, 'menu');
    const musicSettings = new MusicSettings();
    for (const id of ['menu-music-settings', 'pause-music-settings']) {
        document.getElementById(id)!.addEventListener('click', () => musicSettings.show(), { signal });
    }
    let menuMusicActive = true;
    function playMenuMusic() {
        if (menuMusicActive && !document.hidden && document.hasFocus()) menuMusic.play();
    }
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
    let characters: CharacterScreen | undefined;
    const preparation = document.createElement('dialog');
    preparation.className = 'battle-preparation';
    preparation.setAttribute('aria-labelledby', 'battle-preparation-status');
    preparation.innerHTML = '<p id="battle-preparation-status" role="status" aria-live="polite"></p><button type="button" data-retry hidden>Повторить</button><button type="button" data-cancel>Назад</button>';
    document.body.append(preparation);
    const preparationStatus = preparation.querySelector<HTMLElement>('[role="status"]')!;
    const retryPreparation = preparation.querySelector<HTMLButtonElement>('[data-retry]')!;
    let preparationVersion = 0;
    let preparing = false;
    function cancelPreparation() {
        preparationVersion++;
        preparing = false;
        preparation.close();
    }
    preparation.querySelector('[data-cancel]')!.addEventListener('click', cancelPreparation, { signal });
    preparation.addEventListener('cancel', event => { event.preventDefault(); cancelPreparation(); }, { signal });
    retryPreparation.addEventListener('click', () => { void startSurvival(); }, { signal });
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
        }
    }
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas, { signal });

    function pauseGame() {
        if (!session.pause()) return;
        combatAudio.setActive(false);
        battleMusic.pause();
        pauseDialog.showModal();
        resumeButton.focus();
    }

    function resumeGame() {
        if (!session.resume()) return;
        combatAudio.setActive(true);
        battleMusic.play();
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
        battleMusic.stop();
        resumeGame();
    }, { signal });
    document.querySelector('#pause-main-menu')!.addEventListener('click', showMenu, { signal });

    function showMenu() {
        combatAudio.setActive(false);
        battleMusic.stop();
        pauseDialog.close();
        cancelPreparation();
        characters?.hide();
        session.showMenu();
        menu.hidden = false;
        canvas.hidden = true;
        backButton.hidden = true;
        document.body.classList.remove('playing');
        survivalButton.focus();
        menuMusicActive = true;
        playMenuMusic();
    }

    async function startSurvival() {
        if (preparing || !characters || signal.aborted) return;
        const loadout = structuredClone(characters.selectedLoadout);
        const version = ++preparationVersion;
        preparing = true;
        retryPreparation.hidden = true;
        preparationStatus.textContent = 'Подготовка боя…';
        preparation.setAttribute('aria-busy', 'true');
        if (!preparation.open) preparation.showModal();
        try {
            const [hero, weapons, enemies] = await Promise.all([
                ensureCharacterArt(loadout.character), weaponSpritesReady(), enemyArtReady(),
            ]);
            if (version !== preparationVersion || signal.aborted) return;
            if (!hero || !weapons.every(Boolean) || !enemies.every(Boolean)) throw new Error('Battle artwork unavailable');
            session.start(loadout);
        } catch {
            if (version !== preparationVersion || signal.aborted) return;
            preparing = false;
            preparation.removeAttribute('aria-busy');
            preparationStatus.textContent = 'Не удалось загрузить картинки. Проверь соединение и попробуй ещё раз.';
            retryPreparation.hidden = false;
            retryPreparation.focus();
            return;
        }
        menuMusicActive = false;
        menuMusic.stop();
        preparing = false;
        preparation.removeAttribute('aria-busy');
        preparation.close();
        characters.hide();
        menu.hidden = true;
        canvas.hidden = false;
        backButton.hidden = false;
        document.body.classList.add('playing');
        survivalButton.blur();
        combatAudio.setActive(true);
        if (document.hidden || !document.hasFocus()) pauseGame();
        else battleMusic.play();
    }
    survivalButton.addEventListener('click', () => {
        menu.hidden = true;
        hideDescription();
        characters ??= new CharacterScreen(showMenu, () => { void startSurvival(); });
        characters.show();
    }, { signal });
    backButton.addEventListener('click', pauseGame, { signal });
    window.addEventListener('keydown', (event) => {
        if (musicSettings.isOpen) return;
        if (!session.playing) return;
        if (event.key === 'Escape') {
            event.preventDefault();
            if (!event.repeat) { if (session.paused) resumeGame(); else pauseGame(); }
            return;
        }
        if (session.paused) return;
        if (event.code === 'KeyF') {
            event.preventDefault();
            if (!event.repeat && !event.ctrlKey && !event.altKey && !event.metaKey) session.world!.activateAbility();
            return;
        }
        const consumableKey = /^(?:Digit|Numpad)([1-6])$/.exec(event.code);
        if (consumableKey) {
            event.preventDefault();
            if (!event.repeat && !event.ctrlKey && !event.altKey && !event.metaKey) {
                session.world!.activateConsumable(Number(consumableKey[1]) - 1);
            }
            return;
        }
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
    window.addEventListener('blur', () => { pauseGame(); menuMusic.pause(); }, { signal });
    window.addEventListener('focus', playMenuMusic, { signal });
    // Browsers may require a click/key press before allowing either soundtrack.
    const retryMusic = () => {
        if (session.active) battleMusic.play();
        else playMenuMusic();
    };
    window.addEventListener('pointerdown', retryMusic, { signal });
    window.addEventListener('keydown', retryMusic, { signal });
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) { pauseGame(); menuMusic.pause(); }
        else playMenuMusic();
    }, { signal });

    document.querySelector('#achievements')!.addEventListener('click', () => {
        menu.hidden = true;
        rewards.showAchievements(progressStore.totals, progressStore.storageAvailable);
    }, { signal });
    canvas.hidden = true;
    playMenuMusic();

    const stopLoop = startGameLoop(ctx, [{
        update(deltaMs) {
            const gameWorld = session.world;
            if (!session.active || !gameWorld) return;
            gameWorld.update(deltaMs);
            if (gameWorld.isVictory || gameWorld.getPlayerController().getPlayer().currentHp <= 0) {
                const run = gameWorld.getRunStats();
                const { before, after } = progressStore.record(run);
                session.dispose();
                combatAudio.setActive(false);
                battleMusic.stop();
                backButton.hidden = true;
                document.body.classList.remove('playing');
                rewards.showResults(run, before, after, progressStore.storageAvailable, gameWorld.isVictory);
                return;
            }
        },
        draw(context) {
            const gameWorld = session.world;
            if (!session.active || !gameWorld) return;
            fpsCounter.update();
            gameWorld.draw(context);
            fpsCounter.draw(context);
        },
    }], { isActive: () => session.active });


    return () => {
        cancelPreparation();
        preparation.remove();
        stopLoop();
        applicationEvents.abort();
        combatAudio.dispose();
        battleMusic.dispose();
        menuMusic.dispose();
        musicSettings.dispose();
        session.dispose();
        characters?.dispose();
        rewards.dispose();
        pauseDialog.close();
        canvas.hidden = true;
        backButton.hidden = true;
        menu.hidden = false;
        document.body.classList.remove('playing');
    };
}
