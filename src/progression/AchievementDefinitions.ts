import type { Achievement } from './AchievementTypes';

// Screenshot goals repeat at each level until the original level progression is known.
// Pending counters are intentionally not substituted with unrelated gameplay stats.
export const achievements: Achievement[] = [
    {
        id: 'lucky', name: 'Удачливый', metric: 'offscreenKills', goal: 1000,
        requirement: '1000 мутантов погибнут из-за твоей интуиции, даже не появившись в обзоре.',
        bonus: '+1 к очкам жизни за уровень', effect: 'health', perLevel: 1,
        icon: 'lucky', tracking: 'pending',
    },
    {
        id: 'strategist', name: 'Стратег', metric: 'bonusKills', goal: 1000,
        requirement: 'Убей 1000 мутантов, используя бонусы взрыва и заморозки с умом.',
        bonus: '+3% к радиусу бонусов за уровень', effect: 'bonusRadius', perLevel: .03,
        icon: 'strategist', tracking: 'pending',
    },
    {
        id: 'zombie-exterminator', name: 'Истребитель зомби', metric: 'zombieKills', goal: 5000,
        requirement: 'Предай забвению 5000 зомби.',
        bonus: '+3% обычных патронов за уровень', effect: 'normalAmmo', perLevel: .03,
        icon: 'zombie', tracking: 'pending',
    },
    {
        id: 'wavekeeper', name: 'Сдерживающий волну', metric: 'seconds', goal: 120 * 60,
        displayDivisor: 60, unit: 'мин.',
        requirement: 'Продержись 120 минут в режиме «Выживание». Время суммируется за все бои, без учёта пауз.',
        bonus: '+3 жизни в аптечке за уровень', effect: 'medkitHealing', perLevel: 3,
        icon: 'wavekeeper', tracking: 'active',
    },
    {
        id: 'mutant-hunter', name: 'Охотник на мутантов', metric: 'kills', goal: 5000,
        requirement: 'Убей 5000 мутантов в режиме «Выживание».',
        bonus: '+3 очка покупки за уровень', effect: 'purchasePoints', perLevel: 3,
        icon: 'hunter', tracking: 'active',
    },
    {
        id: 'collector', name: 'Собиратель', metric: 'equipment', goal: 50000,
        requirement: 'Заработай 50 000 очков снаряжения.',
        bonus: '+5% снаряжения при сборе за уровень', effect: 'equipmentGather', perLevel: .05,
        icon: 'collector', tracking: 'pending',
    },
    // Keep the two existing prototype rewards until their originals are specified.
    {
        id: 'dodger', name: 'Ловкач', metric: 'seconds', thresholds: [60, 180, 600, 1800, 3600], unit: 'сек.',
        requirement: 'Продержись в выживании. Время суммируется за все бои, без учёта пауз.',
        bonus: '+1 к очкам жизни за уровень', effect: 'health', perLevel: 1,
        icon: 'dodger', tracking: 'active',
    },
    {
        id: 'steel', name: 'Стальной', metric: 'damage', thresholds: [100, 300, 1000, 3000, 10000],
        requirement: 'Принимай урон в бою. Учитываются только действительно потерянные очки жизни.',
        bonus: '+5 к очкам жизни за уровень', effect: 'health', perLevel: 5,
        icon: 'steel', tracking: 'active',
    },
];
