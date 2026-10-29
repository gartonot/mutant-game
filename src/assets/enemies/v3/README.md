# Enemy raster models v3

Generated with the built-in image generation tool on 2026-10-29, one request per asset. Original ordinary grunt is retained from combat-runtime. These are original models informed by the user's video screenshots, not extracted game sprites.

All PNGs have real alpha. Runtime copies are alpha-cropped, resized to 384px maximum occupied dimension and padded by 12 transparent pixels; exact crops are in bounds.json. EnemyArt prepares status overlays once before the battle. Animations combine per-species gait deformation with gameplay jump, attack, emergence and death transforms.

The previous tracked v2 source files remain untouched for the legacy lossless combat export pipeline. Every selected generated deliverable is saved here in the workspace; generated originals also remain under the built-in tool's default generated_images directory.

## Prompt set

Common generation specification: single isolated overhead 2D shooter enemy, facing right, head to right/rear to left, full body, transparent margin, detailed painterly pre-rendered dark survival-shooter style, clear silhouette at game size, no text/frame/floor/background.

- boss: massive slate-blue armored mutant, exposed ridged blue brain, small pale face, two thick clawed arms.
- steroid: grey-green muscular mutant, one gigantic arm/fist and opposite skinny arm, green pustules, small bald head.
- tentacle: bulky brown-red mutant, leathery folds, short clawed arms, green head and four long grasping tentacles extending right.
- worm: red burrowing worm, curved segmented body, tan ridged underside, large round tooth-lined mouth.
- slower: lime-green slimy zombie, reaching arms, bald green head and torn moss-green clothes.
- cyan: turquoise zombie, ordinary mutant physique, dark teal ragged clothes.
- armored: forest-green mutant, overlapping olive organic armor, pale small bald head, broad plate-covered shoulders and arms.
- runner: lean crimson zombie, long forward arms, maroon ragged trousers, no weapon or tail.
- tank: very fat round pale-green zombie, spherical bloated torso, tiny bald head, short arms and legs.
- bug: tiny insect, luminous green round abdomen, six brown legs, dark head with short mandibles.
- beetle: elongated grey plated beetle, pointed rear, six dark articulated legs, green eyes and mandibles.
- leech: single icy-blue translucent leech, thin curved body, tail left and sucker right, no limbs.
- spitter: squat toad-turtle, grey-green plated back with seven bright green pustules, four splayed limbs and frog mouth.
- jumper: dark chitin jumping insect, bright green central sac, four strong spring-like bent legs.
- fat-corpse: headless round bloated green corpse, limp short arms/legs, closed neck stump, no blood.
- tank-green: image edit of tank, preserve silhouette/pose/framing, recolor skin saturated emerald/moss green.
- fat-corpse-green: image edit of fat-corpse, preserve headless body and transparency, recolor saturated emerald/moss green.

The two fat colors have identical gameplay stats. Boss entry audio remains a future task.

2026-10-29 final posture revision: tank and tank-green redrawn again as a compact rounded upright body, head closer to the center of the shoulders, short arms resting at the sides instead of reaching forward. Built-in imagegen edit and green recolor edit. Alpha-cropped at alpha > 8 and resized to 384 × 356 / 384 × 355 with 12px transparent padding. Living speed remains .65 versus the grunt's 1. Headless remains keep their existing fallen pose.

Headless remains revised to match the compact fat body; both generated cutouts have transparent backgrounds verified in-browser on a checkerboard. Crops: 384x344 and 384x341, 12px padding. Replaces the old green corpse with its dark rectangular matte.
