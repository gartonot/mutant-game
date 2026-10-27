import type { CharacterId } from '@/gameplay/ids';

type AdditionalCharacterId = Exclude<CharacterId, 'mercenary' | 'assassin' | 'destroyer'>;
type CharacterLayout = {
  x: number; y: number; width: number; height: number;
  drawX: number; drawY: number; drawWidth: number; rotation: number;
  hands: { x: number; y: number; rx: number; ry: number }[];
};

// Per-character source crop, body rotation, palm anchors, and finger overlays.
export default {
  "half-mutant": {
    "x": 69,
    "y": 233,
    "width": 1125,
    "height": 825,
    "drawX": -35.27822222222222,
    "drawY": -20.88533333333333,
    "drawWidth": 88,
    "rotation": 0.4714599500609072,
    "hands": [
      {
        "x": 850,
        "y": 732,
        "rx": 30,
        "ry": 16
      },
      {
        "x": 1105,
        "y": 604,
        "rx": 30,
        "ry": 16
      }
    ]
  },
  "telepath": {
    "x": 87,
    "y": 277,
    "width": 1111,
    "height": 669,
    "drawX": -28.293429342934292,
    "drawY": -24.08100810081008,
    "drawWidth": 78,
    "rotation": 0,
    "hands": [
      {
        "x": 885,
        "y": 637,
        "rx": 30,
        "ry": 16
      },
      {
        "x": 1135,
        "y": 639,
        "rx": 30,
        "ry": 16
      }
    ]
  },
  "cyborg": {
    "x": 22,
    "y": 157,
    "width": 1212,
    "height": 970,
    "drawX": -36.4009900990099,
    "drawY": -34.98184818481848,
    "drawWidth": 86,
    "rotation": 0.30400093934014455,
    "hands": [
      {
        "x": 885,
        "y": 802,
        "rx": 30,
        "ry": 16
      },
      {
        "x": 1140,
        "y": 724,
        "rx": 30,
        "ry": 16
      }
    ]
  },
  "goliath": {
    "x": 123,
    "y": 238,
    "width": 1078,
    "height": 707,
    "drawX": -39.823747680890534,
    "drawY": -31.89239332096475,
    "drawWidth": 90,
    "rotation": 0,
    "hands": [
      {
        "x": 895,
        "y": 637,
        "rx": 30,
        "ry": 16
      },
      {
        "x": 1135,
        "y": 639,
        "rx": 30,
        "ry": 16
      }
    ]
  },
  "fanatic": {
    "x": 53,
    "y": 50,
    "width": 1436,
    "height": 927,
    "drawX": -21.020891364902507,
    "drawY": -20.0974930362117,
    "drawWidth": 78,
    "rotation": 0.4738513364947603,
    "hands": [
      {
        "x": 1000,
        "y": 682,
        "rx": 30,
        "ry": 16
      },
      {
        "x": 1390,
        "y": 484,
        "rx": 30,
        "ry": 16
      }
    ]
  },
  "nuclear": {
    "x": 216,
    "y": 37,
    "width": 1299,
    "height": 936,
    "drawX": -26.11239414934565,
    "drawY": -13.117782909930716,
    "drawWidth": 80,
    "rotation": 0.21608497229678642,
    "hands": [
      {
        "x": 990,
        "y": 602,
        "rx": 30,
        "ry": 16
      },
      {
        "x": 1400,
        "y": 514,
        "rx": 30,
        "ry": 16
      }
    ]
  },
  "silver-hunter": {
    "x": 11,
    "y": 109,
    "width": 1501,
    "height": 851,
    "drawX": -47.51165889407062,
    "drawY": -10.24983344437042,
    "drawWidth": 85,
    "rotation": 0.25168997175818675,
    "hands": [
      {
        "x": 1060,
        "y": 622,
        "rx": 30,
        "ry": 16
      },
      {
        "x": 1410,
        "y": 534,
        "rx": 30,
        "ry": 16
      }
    ]
  },
  "witcher": {
    "x": 19,
    "y": 118,
    "width": 1497,
    "height": 838,
    "drawX": -34.56379425517702,
    "drawY": -17.090180360721444,
    "drawWidth": 82,
    "rotation": 0.4423742229767449,
    "hands": [
      {
        "x": 1010,
        "y": 702,
        "rx": 30,
        "ry": 16
      },
      {
        "x": 1390,
        "y": 524,
        "rx": 30,
        "ry": 16
      }
    ]
  },
  "plasma-nuclear": {
    "x": 51,
    "y": 259,
    "width": 1179,
    "height": 776,
    "drawX": -21.104325699745544,
    "drawY": -17.267175572519083,
    "drawWidth": 78,
    "rotation": 0.16935770201524555,
    "hands": [
      {
        "x": 684,
        "y": 739,
        "rx": 30,
        "ry": 16
      },
      {
        "x": 1146,
        "y": 662,
        "rx": 30,
        "ry": 16
      }
    ]
  },
  "hunter": {
    "x": 41,
    "y": 243,
    "width": 1186,
    "height": 808,
    "drawX": -27.49072512647555,
    "drawY": -16.468802698145026,
    "drawWidth": 76,
    "rotation": 0.3001711708301121,
    "hands": [
      {
        "x": 792,
        "y": 703,
        "rx": 30,
        "ry": 16
      },
      {
        "x": 1128,
        "y": 601,
        "rx": 30,
        "ry": 16
      }
    ]
  },
  "unknown-crossbow": {
    "x": 56,
    "y": 173,
    "width": 1171,
    "height": 916,
    "drawX": -29.57472245943638,
    "drawY": -18.450896669513238,
    "drawWidth": 78,
    "rotation": 0.1240214388553293,
    "hands": [
      {
        "x": 795,
        "y": 696,
        "rx": 30,
        "ry": 16
      },
      {
        "x": 1164,
        "y": 652,
        "rx": 30,
        "ry": 16
      }
    ]
  },
  "unknown-white-outfit": {
    "x": 71,
    "y": 222,
    "width": 1117,
    "height": 802,
    "drawX": -25.10653536257833,
    "drawY": -21.636526410026857,
    "drawWidth": 76,
    "rotation": 0.22974174715074666,
    "hands": [
      {
        "x": 863,
        "y": 693,
        "rx": 30,
        "ry": 16
      },
      {
        "x": 1111,
        "y": 637,
        "rx": 30,
        "ry": 16
      }
    ]
  }
} satisfies Record<AdditionalCharacterId, CharacterLayout>;

