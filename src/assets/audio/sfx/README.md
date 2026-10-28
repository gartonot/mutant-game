# Weapon sound sources

## plasma-explosion.wav

Plasma blast.mp3 by MountLava, https://freesound.org/people/MountLava/sounds/581176/
CC0 https://creativecommons.org/publicdomain/zero/1.0/ . Commercial use and edits permitted.
User selected compact plasma grenade option1. Public HQ MP3 preview converted mono48kPCM16,
short edge fades, peak -1dBFS; shared runtime15% gain once. Duration .593s.
Triggered at plasma grenade detonation. Sandbox weapon entry auditions the explosion.
Reproduce: output/audio/plasma-grenade-v2/install.py.

## bazooka.wav

rpg launcher three shots.wav by klangfabrik:
https://freesound.org/people/klangfabrik/sounds/249298/
CC0 https://creativecommons.org/publicdomain/zero/1.0/ permits commercial use and modification.
Source describes exterior RPG launcher firings. Public HQ MP3 preview used;
original WAV requires login. Isolated first launch, 1.1 seconds, mono48kPCM16,
short edge fades, peak -1dBFS. Shared runtime volume15% applied once.
No pitch changes or additional synthesized layers. Impact explosion remains separate.
Prepared with output/audio/bazooka-v2/prepare.py; other downloaded candidates not used.

## acid.wav

Original procedural acid spit created for this project, without third-party recordings.
Filtered wet pressure burst, short descending bubble tones and a fading hiss.
0.36 seconds, mono48kPCM16, peak -1dBFS, shared runtime volume15%.
Triggered once per acid-gun shot; cadence unchanged.
Reproducible fixed-seed script: `output/audio/acid-spit/generate.py`.

## crossbow.wav

Crossbow Shoot.wav from Medieval sound effects — Weapon Textures.
Recorded by Ben Jaszczak and Brian Nelson.
Source: https://opengameart.org/content/medieval-sound-effects-weapon-textures
CC0: https://creativecommons.org/publicdomain/zero/1.0/
Original in medieval_sfx_textures_1_of_2.7z; retained under output/audio/crossbow-real/originals.
Selected first shot from .327542s, .7s duration; mono48k PCM16, edge fades,
peak -1dBFS. Shared volume15%, no pitch changes or synthesized layers.
Preparation script: output/audio/crossbow-real/prepare.py.

## ice-explosion.wav

Original procedural sound made for this project, without third-party recordings.
Layered filtered-noise fractures, inharmonic shard tones, a low impact and fading air.
1.15 seconds, mono 48 kHz PCM16, normalized peak -1 dBFS, shared runtime gain 15%.
Plays once on iceBlast activation (pickup or consumable); sandbox has a separate audition.
Reproducible fixed-seed script: `output/audio/ice-bomb/generate.py`.

## gauss-charge.wav, gauss.wav

Railgun_ChargeLoop and RailGun_Fire1 by BaggoNotes:
https://freesound.org/people/BaggoNotes/sounds/785400/
https://freesound.org/people/BaggoNotes/sounds/785380/
CC0 https://creativecommons.org/publicdomain/zero/1.0/ permits commercial use and edits without mandatory attribution.
Derived from public HQ MP3 previews, original WAV downloads require login.
Selected long-charge variant: rising charge pitch/amplitude plus reversed firing tail,
compressed from 850ms to 450ms with FFmpeg atempo; separate firing clip 858ms.
Mono 48k PCM16, shared peak normalization -1 dBFS retaining charge/shot balance;
shared runtime volume 15%. Charge playback follows actual weapon charge duration,
including attack-speed modifiers; shot emitted only with a spawned projectile.
Reproducible preparation: `output/audio/gauss-candidates/install.py`.

## plasma.wav

`Energy Shot_v1_01.wav` from **JC Sounds Sci-Fi Pack Vol 1** by **JC Sounds**.
Source: https://opengameart.org/content/jc-sounds-sci-fi-pack-vol-1
License: CC BY 4.0 — https://creativecommons.org/licenses/by/4.0/ .
Commercial use and modifications permitted with attribution, a license link,
and an indication of changes. Distribution attribution is in `public/audio-credits.txt`.
Selected by the user as plasma option 1 (approximately one second), used by `plasma-auto`.
Converted to mono 48 kHz PCM16 and peak-normalized to -1 dBFS; the full recording
is retained without trimming or pitch changes. Shared runtime output gain is 15%,
applied once; the quiet preview is not used as the runtime asset.

## flame.wav

Flamethrower_Weapon_Long_Bursts.wav by AslakHostaker.
Source: https://freesound.org/people/AslakHostaker/sounds/395039/
CC0: https://creativecommons.org/publicdomain/zero/1.0/ . Commercial use and edits allowed, attribution optional.
Prepared from public HQ MP3 preview, selected by user as flamethrower option 1.
First 6-second burst excerpt starting at 2.203354 seconds, mono 48 kHz PCM16,
peak -1 dBFS; 15% shared output gain applied once. Short edge fades and 80ms
crossfade into repeat point; gameplay loops from .25s to 5.5s while firing.
Sandbox plays the six-second excerpt once. Script: `output/audio/fire-candidates/install.py`.

## laser.wav

Replacement: laser beam by peepholecircus, https://freesound.org/people/peepholecircus/sounds/169991/ .
CC0 https://creativecommons.org/publicdomain/zero/1.0/ . Commercial use allowed, attribution optional.
Public HQ MP3 preview excerpt 1–5s; mono48k PCM16, lowpass4.8kHz,120ms crossfade.
Game loops .2–3.8s while firing. Peak -1dBFS, shared output15%.
Prepared with output/audio/laser-v2/prepare.py. Replaces rejected Crisheld sound.

## shotgun.wav

Recorded Mossberg shotgun, first shot from `Prepared SFX Library/Mossberg/N_26P.wav`.

- Collection: The Free Firearm Sound Library.
- Recordists: Ben Jaszczak, Brian Nelson, Kevin Heras, Matthew Nanney.
- Source and license declaration: https://opengameart.org/node/21826
- Original archive: https://opengameart.org/sites/default/files/Prepared%20SFX%20Library.7z
- License: CC0 1.0 — https://creativecommons.org/publicdomain/zero/1.0/
- Adaptation: removed leading silence, selected one 0.9-second shot, mixed stereo to mono,
  resampled 96 kHz to 48 kHz, normalized peak to -1 dBFS, added short edge fades.
- Used for both shotgun and double-barrel; no changes to weapon cadence.
- Prepared 2026-10-28 with `output/audio/shotgun-real/prepare_shotgun.py`.

## pistol.wav, automatic.wav, m16.wav, ak47.wav

Also sourced from the same CC0 Free Firearm Sound Library and recordists credited above:

| Asset | Recording | Selected shot |
| --- | --- | --- |
| pistol.wav | Walther PPQ/X_31P.wav | First shot |
| automatic.wav | AK-47/C_28P.wav | First shot |
| m16.wav | AR-15/D_24P.wav | First shot; AR-15 serves as the M16 sound |
| ak47.wav | AK-47/C_28P.wav | Second shot, distinct from automatic.wav |

Each asset contains one isolated shot with leading silence removed, stereo mixed to mono,
96 kHz resampled to 48 kHz, peak normalized to -1 dBFS and a short fade at the tail.
No pitch shifting or synthetic layering. The generic machine gun also uses automatic.wav;
weapons without a dedicated effect inherit pistol.wav. Output gain defaults to 15%.
Prepared 2026-10-28 with `output/audio/firearms-real/prepare.py`; precise offsets are in
`output/audio/firearms-real/preparation.json`.

Other WAV files in this directory are original procedural effects generated for this project.

## skull.wav, bone-break.wav

Original procedural effects made for this project, with no third-party samples.
Reproducible generator: `output/audio/skull-sfx/generate.py` (fixed random seed).
Skull launch: 0.58-second airy launch with a softer, lower falling tone; reduced high whistle and slower tonal attack.
Skull detonation: 0.28-second cluster of dry cracks with decreasing intensity.
Mono 48 kHz PCM16, peak -1 dBFS; game output uses the shared 15% gain.
The output folder holds quiet 15% previews; runtime assets are not attenuated twice.
