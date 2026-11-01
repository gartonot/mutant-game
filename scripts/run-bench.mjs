import { build } from 'esbuild';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const directory = await mkdtemp(join(tmpdir(), 'mutant-bench-'));
try {
    const outfile = join(directory, 'bench.mjs');
    const entry = ['baseline', 'crowd'].includes(process.argv[2]) ? process.argv[2] : 'comparison';
    await build({ entryPoints: [`scripts/bench/${entry}.ts`], outfile, bundle: true, platform: 'node', format: 'esm', tsconfig: 'tsconfig.json',
        plugins: entry === 'crowd' ? [{ name: 'headless-character-rendering', setup(plugin) {
            plugin.onLoad({ filter: /[\\/]rendering[\\/]CharacterArt\.ts$/ }, () => ({
                contents: 'export function drawCharacter() {} export function drawGoliathSlam() {} export function drawStormCharacter() {}', loader: 'ts',
            }));
        } }] : [],
    });
    process.exitCode = spawnSync(process.execPath, [outfile], { stdio: 'inherit' }).status ?? 1;
} finally {
    await rm(directory, { recursive: true, force: true });
}
