import { CombatAudio } from '@/audio/CombatAudio';
import { emitSound, weaponSound, setPlasmaChargeSound } from '@/audio/SoundEvents';
import type { SoundId } from '@/audio/SoundEvents';
import { WEAPON_DEFINITIONS } from '@/gameplay/weapons';
import './sound-sandbox.css';

const audio = new CombatAudio();
const events = new AbortController();
const { signal } = events;
const list = document.querySelector<HTMLDivElement>('#weapons')!;
const name = document.querySelector<HTMLElement>('#selected-name')!;
const description = document.querySelector<HTMLElement>('#sound-description')!;
const kind = document.querySelector<HTMLElement>('#sound-kind')!;
const status = document.querySelector<HTMLElement>('#status')!;
const volume = document.querySelector<HTMLInputElement>('#volume')!;
const volumeValue = document.querySelector<HTMLOutputElement>('#volume-value')!;
const descriptions: Record<SoundId, string> = {
    pistol: 'Запись Walther PPQ', shotgun: 'Запись Mossberg', automatic: 'Запись АК-47 · вариант 1',
    m16: 'Запись AR-15', ak47: 'Запись АК-47 · вариант 2',
    crossbow: 'Запись настоящего арбалета', bazooka: 'Запись запуска РПГ', lightning: 'Электрический разряд',
    impulse: 'Короткий электрический треск', disc: 'Вылет вращающегося лезвия', explosion: 'Взрыв гранаты',
    skull: 'Свист черепа → хруст осколков', 'bone-break': 'Короткий костяной хруст',
    laser: 'Лазерный луч · peepholecircus, новый вариант',
    flame: 'Струя огнемёта · вариант 1',
    acid: 'Влажный плевок кислоты и шипение',
    plasma: 'Energy Shot · JC Sounds, вариант 1',
    'plasma-explosion': 'Взрыв плазмогранаты · короткий хлопок',
    'ice-explosion': 'Раскол льда и холодное шипение',
    gauss: 'Заряд 450 мс → выстрел рельсотрона', 'gauss-charge': 'Заряд плазмопушки',
};
let selected: SoundId = 'pistol';
let request = 0;
function stop() { request++; audio.setActive(false); status.textContent = 'Звук остановлен.'; }
async function play() {
    const version = ++request, sound = selected;
    audio.setActive(false);
    status.textContent = 'Подготовка звука…';
    const ready = await audio.prepare(sound);
    if (version !== request || signal.aborted || document.hidden) return;
    if (!ready) { status.textContent = 'Не удалось загрузить звук. Обнови страницу и попробуй снова.'; return; }
    audio.setActive(true);
    if (sound === 'gauss') {
        setPlasmaChargeSound({ progress: 0, durationMs: WEAPON_DEFINITIONS['plasma-cannon'].chargeMs! });
        window.setTimeout(() => {
            if (version !== request || signal.aborted || document.hidden) return;
            setPlasmaChargeSound(null);
            emitSound('gauss');
        }, WEAPON_DEFINITIONS['plasma-cannon'].chargeMs);
    } else emitSound(sound);
    if (sound === 'skull') window.setTimeout(() => {
        if (version === request && !signal.aborted && !document.hidden) emitSound('bone-break');
    }, 650);
    status.textContent = `Воспроизведено: ${name.textContent}.`;
}
function addChoice(title: string, sound: SoundId, placeholder = false, initial = false) {
    const button = document.createElement('button');
    button.className = 'weapon-choice';
    button.setAttribute('aria-pressed', String(initial));
    const text = document.createElement('span'); text.textContent = title;
    const tag = document.createElement('small'); tag.textContent = placeholder ? 'Пистолет · заглушка' : descriptions[sound];
    button.append(text, tag);
    button.addEventListener('click', () => {
        for (const other of list.querySelectorAll('button')) other.setAttribute('aria-pressed', 'false');
        button.setAttribute('aria-pressed', 'true');
        selected = sound; name.textContent = title;
        description.textContent = placeholder ? 'Временно используется звук пистолета' : descriptions[sound];
        kind.textContent = placeholder ? 'ВРЕМЕННЫЙ ЗВУК' : 'ЗВУК ОРУЖИЯ';
        void play();
    }, { signal });
    list.append(button);
}
for (const weapon of Object.values(WEAPON_DEFINITIONS)) {
    const sound = weapon.id === 'plasma-grenade' ? 'plasma-explosion' : weaponSound(weapon.id);
    addChoice(weapon.name, sound, sound === 'pistol' && weapon.id !== 'pistol', weapon.id === 'pistol');
}
addChoice('Взрыв гранаты', 'explosion');
addChoice('Взрыв ледяной бомбы', 'ice-explosion');
addChoice('Разлёт костяных осколков', 'bone-break');
document.querySelector('#play')!.addEventListener('click', () => { void play(); }, { signal });
document.querySelector('#stop')!.addEventListener('click', stop, { signal });
volume.addEventListener('input', () => {
    audio.setVolume(Number(volume.value) / 100);
    volumeValue.value = `${volume.value}%`;
}, { signal });
window.addEventListener('blur', stop, { signal });
document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); }, { signal });
function dispose() { request++; events.abort(); audio.dispose(); }
window.addEventListener('pagehide', dispose, { signal });
if (import.meta.hot) import.meta.hot.dispose(dispose);
