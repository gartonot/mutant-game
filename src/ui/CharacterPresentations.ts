import type { CharacterId } from '@/gameplay/ids';

export interface CharacterPresentation { id: CharacterId; name: string; image: string; thumbnail?: string; role: string; bonuses: string[]; penalty: string; ability: string; story: string[]; abilityDescription?: string; previewNote?: string; }

import assassin from '@/assets/portraits-runtime/full/assassin.webp';
import assassinThumbnail from '@/assets/portraits-runtime/thumbnail/assassin.webp';
import destroyer from '@/assets/portraits-runtime/full/destroyer.webp';
import destroyerThumbnail from '@/assets/portraits-runtime/thumbnail/destroyer.webp';
import mercenary from '@/assets/portraits-runtime/full/mercenary.webp';
import mercenaryThumbnail from '@/assets/portraits-runtime/thumbnail/mercenary.webp';
import hunter from '@/assets/portraits-runtime/full/hunter.webp';
import hunterThumbnail from '@/assets/portraits-runtime/thumbnail/hunter.webp';
import cyborg from '@/assets/portraits-runtime/full/cyborg.webp';
import cyborgThumbnail from '@/assets/portraits-runtime/thumbnail/cyborg.webp';
import telepath from '@/assets/portraits-runtime/full/telepath.webp';
import telepathThumbnail from '@/assets/portraits-runtime/thumbnail/telepath.webp';
import fanatic from '@/assets/portraits-runtime/full/fanatic.webp';
import fanaticThumbnail from '@/assets/portraits-runtime/thumbnail/fanatic.webp';
import witcher from '@/assets/portraits-runtime/full/witcher.webp';
import witcherThumbnail from '@/assets/portraits-runtime/thumbnail/witcher.webp';
import plasmaNuclear from '@/assets/portraits-runtime/full/plasma-nuclear.webp';
import plasmaNuclearThumbnail from '@/assets/portraits-runtime/thumbnail/plasma-nuclear.webp';
import nuclear from '@/assets/portraits-runtime/full/nuclear.webp';
import nuclearThumbnail from '@/assets/portraits-runtime/thumbnail/nuclear.webp';
import silverHunter from '@/assets/portraits-runtime/full/silver-hunter.webp';
import silverHunterThumbnail from '@/assets/portraits-runtime/thumbnail/silver-hunter.webp';
import goliath from '@/assets/portraits-runtime/full/goliath.webp';
import goliathThumbnail from '@/assets/portraits-runtime/thumbnail/goliath.webp';
import halfMutant from '@/assets/portraits-runtime/full/half-mutant.webp';
import halfMutantThumbnail from '@/assets/portraits-runtime/thumbnail/half-mutant.webp';
import unknownWhiteOutfit from '@/assets/portraits-runtime/full/unknown-white-outfit-v1.webp';
import unknownWhiteOutfitThumbnail from '@/assets/portraits-runtime/thumbnail/unknown-white-outfit-v1.webp';
import unknownCrossbow from '@/assets/portraits-runtime/full/unknown-crossbow-v3.webp';
import unknownCrossbowThumbnail from '@/assets/portraits-runtime/thumbnail/unknown-crossbow-v3.webp';

// All portrait-backed models are playable; numeric combat stats live in gameplay/characters.ts.
export const HUNTER_PRESENTATION: CharacterPresentation = {
    id: 'hunter', name: 'Охотник', image: hunter, thumbnail: hunterThumbnail, role: 'Доступен для игры',
    bonuses: ['+25% к длительности временных бонусов', '+10% к скорострельности', 'Двустволка (+24 патрона)'],
    penalty: '', ability: 'Плазменные капканы',
    story: [
        'С начала Заражения он отказался эвакуироваться вместе с остальными и прятаться в крепостях и лагерях. Охотник остался защищать своё жилище.',
        'За долгое время на заражённой территории он научился выживать, экономя еду, патроны и силы.',
    ],
};

const ADDITIONAL_CHARACTER_PRESENTATIONS: CharacterPresentation[] = [
    {
        id: 'half-mutant', name: 'Полумутант', image: halfMutant, thumbnail: halfMutantThumbnail, role: 'Доступен для игры',
        bonuses: ['+20 очков жизни', 'Восстановление жизни: 0,3 очка в секунду', 'Огнемёт (+100 патронов)'],
        penalty: '', ability: 'Превращение',
        abilityDescription: 'Один раз в минуту превращается на 7 секунд в монстра, который быстро передвигается и атакует врагов в ближнем бою. Эти атаки восстанавливают ему жизнь и увеличивают рейтинг выживания.',
        story: [],
    },
    {
        id: 'telepath', name: 'Телепат', image: telepath, thumbnail: telepathThumbnail, role: 'Доступен для игры',
        bonuses: ['+15% к скорости стрельбы', '+15% к скорости бега', 'АК-47 (+120 патронов)', 'Притягивание бонусов при наведении мышкой 3 сек.'],
        penalty: '', ability: 'Пирокинез',
        story: [
            'В первые дни Заражения военные пытались остановить распространение мутации ядерными ударами. Они сбрасывали боеголовки на эпицентры заражения, уничтожая и мутантов, и обычных людей.',
            'Девушка, которую любил Телепат, попала под ядерный удар.',
        ],
    },
    {
        id: 'cyborg', name: 'Киборг', image: cyborg, thumbnail: cyborgThumbnail, role: 'Доступен для игры',
        bonuses: ['+70 очков жизни', '+10% урона оружием', 'Плазмомёт (+120 патронов)'],
        penalty: '', ability: 'Гравитационный удар',
        story: [
            'Специальный армейский отряд, сформированный по заказу правительства ещё до Заражения, оказывал наибольшее сопротивление нашествию мутантов.',
            'В задачи суперсолдат входили защита правительства, спецоперации в эпицентре заражения и другие невыполнимые миссии.',
        ],
    },
    {
        id: 'goliath', name: 'Голиаф', image: goliath, thumbnail: goliathThumbnail, role: 'Доступен для игры',
        bonuses: ['+100 очков жизни', 'Пулемёт (+100 патронов)'],
        penalty: '', ability: 'Удар голиафа',
        abilityDescription: 'Один раз в 15 секунд бьёт руками об землю и наносит 5 очков урона всем рядом стоящим врагам.',
        story: [],
    },
    {
        id: 'fanatic', name: 'Фанатик', image: fanatic, thumbnail: fanaticThumbnail, role: 'Доступен для игры',
        bonuses: ['+30% к скорости бега', '+30% ко времени, которое бонусы лежат на земле', 'Электропушка (+25 патронов)'],
        penalty: '', ability: 'Шторм',
        abilityDescription: 'Один раз в минуту становится электрическим вихрем на 5 секунд, перемещается со скоростью молнии и поражает врагов вокруг себя электрическими разрядами.',
        story: [],
    },
    {
        id: 'nuclear', name: 'Ядерщик', image: nuclear, thumbnail: nuclearThumbnail, role: 'Доступен для игры',
        bonuses: ['+25% урона оружием', '+20 очков жизни', 'Электропушка (+25 патронов)'],
        penalty: '', ability: 'Плазменный шар',
        abilityDescription: 'Один раз в минуту выпускает плазменный шар, который следует за мышкой, замораживает врагов и наносит им 1 очко урона. Через 4 секунды шар взрывается, поражая врагов вокруг.',
        story: [],
    },
    {
        id: 'silver-hunter', name: 'Серебряный охотник', image: silverHunter, thumbnail: silverHunterThumbnail, role: 'Доступен для игры',
        bonuses: ['+25% к длительности временных бонусов', '+10% урона оружием', 'Двустволка (+24 патрона)', 'Невидимость во время способности'],
        penalty: '', ability: 'Плазменные капканы',
        abilityDescription: 'Один раз в минуту использует 3 плазменных капкана. Они срабатывают через 5 секунд или при приближении врага.',
        story: [],
    },
    {
        id: 'witcher', name: 'Ведьмак', image: witcher, thumbnail: witcherThumbnail, role: 'Доступен для игры',
        bonuses: ['+10% к скорости бега', 'Восстановление жизни: 0,8 очка в секунду', 'АК-47 (+120 патронов)', 'Лечение 3 очка в сек. при наведении мышкой'],
        penalty: '−30% от максимального количества очков жизни', ability: 'Рой жуков',
        story: [
            'В каждом лагере выживших был лидер, которому доверяли и подчинялись. До мутации Ведьмак тоже возглавлял один из лагерей.',
            'Из-за частых нападений мутантов он решил зачистить нору жуков. Но не все согласились с этим решением.',
        ],
    },
    {
        id: 'plasma-nuclear', name: 'Плазменный ядерщик', image: plasmaNuclear, thumbnail: plasmaNuclearThumbnail, role: 'Доступен для игры',
        bonuses: ['+25% урона оружием', '+20 очков жизни', 'Плазмопушка (+5 патронов)'],
        penalty: '', ability: 'Плазменный шар',
        story: [
            'Ещё в детстве он получил прозвище Ядерщик: его отец был учёным по ядерной физике и разрабатывал вооружение для армии.',
            'Когда началось Заражение, они вместе обороняли дом от мутантов. Отец погиб, когда через подвалы в дом пробился червь-мутант.',
        ],
    },
    HUNTER_PRESENTATION,
    {
        id: 'unknown-white-outfit', name: 'Неизвестный', image: unknownWhiteOutfit, thumbnail: unknownWhiteOutfitThumbnail, role: 'Пробный облик',
        bonuses: [], penalty: '', ability: '',
        previewNote: 'Пробный облик по фрагменту портрета. Имя, оружие, характеристики и способность пока неизвестны.',
        story: [],
    },
    {
        id: 'unknown-crossbow', name: 'Неизвестная', image: unknownCrossbow, thumbnail: unknownCrossbowThumbnail, role: 'Пробный облик',
        bonuses: [], penalty: '', ability: '',
        previewNote: 'Пробный облик по фрагменту портрета. Оружие — арбалет. Имя, характеристики и способность пока неизвестны.',
        story: [],
    },
];

export const CHARACTER_PRESENTATIONS: CharacterPresentation[] = [
    {
        id: 'destroyer' as const, name: 'Разрушитель', image: destroyer, thumbnail: destroyerThumbnail, role: 'Тяжёлая поддержка',
        bonuses: ['+50% к радиусу взрывов', 'Базука (+5 патронов)'], penalty: '−10% к скорости бега', ability: 'Удар артиллерии',
        abilityDescription: 'Множество взрывов накрывает весь экран. Каждый видимый враг получает 6 урона один раз. Перезарядка — 60 секунд.',
        story: [
            'Небольшие подразделения армии были единственным, что осталось от прежних государств после начала Заражения. Солдаты уцелевших частей строили крепости на развалинах городов и обороняли их от нашествия мутантов.',
            'Во время поисковой операции на отряд напал рой мутировавших жуков. Когда сержант увидел, как под их натиском рушится последняя линия обороны, он приказал бойцам отступать, а сам остался у разбитого бронетранспортёра. В его кузове ещё лежали снаряды.',
            'Грохот взрывов слышали даже в лагере за рекой. На рассвете сержант вернулся один: обожжённая форма, пустая базука и чужой жетон в кулаке. С тех пор его зовут Разрушителем. Он не любит рассказывать о той ночи. Зато прекрасно знает, как остановить следующую волну.',
        ],
    },
    {
        id: 'assassin' as const, name: 'Убийца', image: assassin, thumbnail: assassinThumbnail, role: 'Скорость и точность',
        bonuses: ['+30% к скорости стрельбы'], penalty: '−20 очков жизни', ability: 'Страх жертвы',
        abilityDescription: 'Пугает врагов в радиусе 315: они замирают и не атакуют 5 секунд. Над ними появляется значок испуга. Перезарядка — 30 секунд.',
        story: [
            'Даже после Заражения богатые и влиятельные выжившие продолжали сводить счёты. Когда нельзя было обратиться к военным или наёмникам, они нанимали тех, кто умел проникнуть в чужой лагерь незамеченным. Она появлялась под видом случайной гостьи, и охрана слишком поздно понимала, зачем пришла женщина в красном платье.',
            'Когда город охватила паника, старые заказчики исчезли вместе со своими деньгами и обещаниями. Впервые за долгие годы выбирать цель пришлось самой. Из горящего квартала она вывела целую группу выживших — и никому не объяснила, почему вернулась за ними.',
            'В лагере её называют Убийцей. Красное платье давно перестало быть маскировкой, но менять его на армейскую форму она не собирается. Мутанты быстрее людей, сильнее людей и не понимают угроз. Однако перед её выстрелом они замирают так, словно всё-таки умеют бояться.',
        ],
    },
    {
        id: 'mercenary' as const, name: 'Наёмник', image: mercenary, thumbnail: mercenaryThumbnail, role: 'Опытный боец',
        bonuses: ['+7% рейтинга за убийство мутантов', 'Автомат (+120 патронов)'], penalty: '', ability: 'Два оружия',
        abilityDescription: 'На 8 секунд появляется вторая копия выбранного оружия. Она стреляет одновременно с основным и не расходует дополнительные патроны. При смене оружия меняется и копия. Перезарядка — 45 секунд.',
        story: [
            'В разрушенном, заражённом мире быстро стали формироваться группировки бандитов. Для защиты своих лагерей выжившие нанимали людей с опытом вылазок на заражённую территорию. Их и называли наёмниками.',
            'Они собирали отряды из опытных сталкеров и добровольцев, умевших держать оружие. Иногда небольшие группы уходили далеко за периметр: искать лекарства, сопровождать караваны или возвращать тех, кого уже считали погибшими.',
            'Этот боец пришёл в лагерь перед самым закрытием ворот. Никто не видел его лица под противогазом, никто не знает, сколько контрактов осталось за его спиной. Он просит плату вперёд, проверяет каждый патрон и всегда занимает место последним в отступающей колонне. В мире, где обещания обесценились, его слово всё ещё чего-то стоит.',
        ],
    },
    ...ADDITIONAL_CHARACTER_PRESENTATIONS,
];

export const LOCKED_CHARACTER_PRESENTATIONS: CharacterPresentation[] = [];

