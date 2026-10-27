import { build } from 'esbuild';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

// One bundle keeps shared modules singleton and automatically includes new regression suites.
const suites = (await readdir('tests')).filter(file => file.endsWith('.test.ts')).sort();
if (!suites.length) throw new Error('No test suites found');
const directory = await mkdtemp(join(tmpdir(), 'mutant-game-tests-'));
try {
    const outfile = join(directory, 'tests.mjs');
    await build({
        stdin: { contents: suites.map(file => `import ${JSON.stringify(`./tests/${file}`)};`).join('\n'),
            resolveDir: process.cwd(), sourcefile: 'test-entry.ts', loader: 'ts' },
        outfile, bundle: true, platform: 'node', format: 'esm', tsconfig: 'tsconfig.json',
    });
    const result = spawnSync(process.execPath, ['--test', outfile], { stdio: 'inherit' });
    if (result.error) throw result.error;
    process.exitCode = result.status ?? 1;
} finally {
    await rm(directory, { recursive: true, force: true });
}
