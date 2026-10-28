import { build } from 'esbuild';
import { mkdtemp, rm, readdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const directory = await mkdtemp(join(tmpdir(), 'mutant-survival-'));
try {
    const outfile = join(directory, 'survival.mjs');
    const sources = (await readdir('src', { recursive: true })).filter(p => p.endsWith('.ts')).map(p => join('src', p));
    sources.push('scripts/balance/survival.ts', 'scripts/run-survival-balance.mjs');
    const provenance = join(directory, 'provenance.json');
    const sourceHashes = Object.fromEntries(await Promise.all(sources.map(async path => [path.replaceAll('\\', '/'),
        createHash('sha256').update(await readFile(path)).digest('hex')])));
    await writeFile(provenance, JSON.stringify({ capturedAt: new Date().toISOString(), timing: 'before bundling', sourceHashes }));
    await build({ entryPoints: ['scripts/balance/survival.ts'], outfile, bundle: true, platform: 'node',
        format: 'esm', tsconfig: 'tsconfig.json', plugins: [{ name: 'headless-art', setup(plugin) {
            plugin.onLoad({ filter: /[\\/]rendering[\\/]CharacterArt\.ts$/ }, () => ({
                contents: 'export function drawCharacter() {} export function drawGoliathSlam() {} export function drawStormCharacter() {}', loader: 'ts' }));
        } }] });
    const result = spawnSync(process.execPath, [outfile, ...process.argv.slice(2), `--provenance=${provenance}`], { stdio: 'inherit' });
    if (result.error) throw result.error;
    process.exitCode = result.status ?? 1;
} finally { await rm(directory, { recursive: true, force: true }); }
