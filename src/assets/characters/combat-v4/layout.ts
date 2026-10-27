import previous from '../combat-v3/layout';

// Orthographic replacements; palms are measured once per sprite, shared by every weapon.
export const redrawnLayouts = {
  "half-mutant": {
    "headOcclusion": { "x": 556, "y": 622, "rx": 108, "ry": 99 },
    "x": 100,
    "y": 306,
    "width": 1082,
    "height": 654,
    "drawX": -37.08687615526802,
    "drawY": -25.70055452865065,
    "drawWidth": 88,
    "rotation": -0.24330921559601026,
    "hands": [
      {
        "x": 809,
        "y": 656,
        "rx": 30,
        "ry": 16
      },
      {
        "x": 1091,
        "y": 726,
        "rx": 30,
        "ry": 16
      }
    ]
  },
  "goliath": {
    "headOcclusion": { "x": 584, "y": 612, "rx": 97, "ry": 94 },
    "x": 72,
    "y": 255,
    "width": 1143,
    "height": 754,
    "drawX": -40.31496062992126,
    "drawY": -28.11023622047244,
    "drawWidth": 90,
    "rotation": -0.34019108680886573,
    "hands": [
      {
        "x": 822,
        "y": 622,
        "rx": 30,
        "ry": 16
      },
      {
        "x": 1113,
        "y": 725,
        "rx": 30,
        "ry": 16
      }
    ]
  },
  "fanatic": {
    "x": 49,
    "y": 226,
    "width": 1173,
    "height": 827,
    "drawX": -22.010230179028135,
    "drawY": -28.194373401534527,
    "drawWidth": 78,
    "rotation": 0.04051835247834694,
    "hands": [
      {
        "x": 814,
        "y": 677,
        "rx": 30,
        "ry": 16
      },
      {
        "x": 1110,
        "y": 665,
        "rx": 30,
        "ry": 16
      }
    ]
  },
  "silver-hunter": {
    "x": 17,
    "y": 277,
    "width": 1219,
    "height": 730,
    "drawX": -42.08695652173913,
    "drawY": -21.87366694011485,
    "drawWidth": 88,
    "rotation": 0,
    "hands": [
      {
        "x": 1000,
        "y": 610,
        "rx": 30,
        "ry": 16
      },
      {
        "x": 1170,
        "y": 610,
        "rx": 30,
        "ry": 16
      }
    ]
  },
  "nuclear": {
    "x": 108,
    "y": 88,
    "width": 1373,
    "height": 855,
    "drawX": -23.714493809176986,
    "drawY": -22.25782957028405,
    "drawWidth": 80,
    "rotation": 0.25732371497108864,
    "hands": [
      {
        "x": 1000,
        "y": 570,
        "rx": 30,
        "ry": 16
      },
      {
        "x": 1380,
        "y": 470,
        "rx": 30,
        "ry": 16
      }
    ]
  },
  "witcher": {
    "x": 106,
    "y": 118,
    "width": 1380,
    "height": 792,
    "drawX": -25.78840579710145,
    "drawY": -22.104347826086958,
    "drawWidth": 82,
    "rotation": 0.33029735482925365,
    "hands": [
      {
        "x": 1020,
        "y": 630,
        "rx": 30,
        "ry": 16
      },
      {
        "x": 1370,
        "y": 510,
        "rx": 30,
        "ry": 16
      }
    ]
  }
};

export default { ...previous, ...redrawnLayouts };
