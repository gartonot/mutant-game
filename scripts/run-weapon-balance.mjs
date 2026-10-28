import { build } from 'esbuild';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const directory = await mkdtemp(join(tmpdir(), 'mutant-weapon-balance-'));
try {
    const outfile = join(directory, 'weapon-balance.mjs');
    await build({ entryPoints: ['scripts/balance/weapon-bench.ts'], outfile,
        bundle: true, platform: 'node', format: 'esm', tsconfig: 'tsconfig.json' });
    const { runWeaponBench } = await import(pathToFileURL(outfile).href);
    await runWeaponBench(resolve(process.argv[2] ?? 'docs/balance/weapon-baseline.json'));
} finally {
    await rm(directory, { recursive: true, force: true });
}
