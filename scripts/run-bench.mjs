import { build } from 'esbuild';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const directory = await mkdtemp(join(tmpdir(), 'mutant-bench-'));
try {
    const outfile = join(directory, 'bench.mjs');
    const entry = process.argv[2] === 'baseline' ? 'baseline' : 'comparison';
    await build({ entryPoints: [`scripts/bench/${entry}.ts`], outfile, bundle: true, platform: 'node', format: 'esm', tsconfig: 'tsconfig.json' });
    process.exitCode = spawnSync(process.execPath, [outfile], { stdio: 'inherit' }).status ?? 1;
} finally {
    await rm(directory, { recursive: true, force: true });
}
