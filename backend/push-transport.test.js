import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { build } from 'esbuild';

const require = createRequire(import.meta.url);
const backend = dirname(fileURLToPath(import.meta.url));

test('real push transport works in workerd and never follows provider redirects', { timeout: 45000 }, async () => {
  const temporary = await mkdtemp(join(tmpdir(), 'water-push-transport-'));
  try {
    const configuration = await readFile(join(backend, 'wrangler.jsonc'), 'utf8');
    const compatibilityDate = /"compatibility_date"\s*:\s*"([0-9-]+)"/.exec(configuration)?.[1];
    assert.ok(compatibilityDate, 'Use the production Worker compatibility date');
    const [transport, provider] = await Promise.all([
      'push-transport-worker.js', 'push-transport-provider.js'
    ].map(async name => {
      const result = await build({
        entryPoints: [join(backend, 'test-support', name)],
        bundle: true, write: false, format: 'esm', platform: 'neutral', target: 'es2022'
      });
      return result.outputFiles[0].text;
    }));
    // No listening sockets. Every outbound fetch goes to the local mock service,
    // including any unintended redirect; no real push endpoint is contacted.
    const config = `using Workerd = import "/workerd.capnp";
const config :Workerd.Config = (
  services = [
    (name = "transport", worker = (
      compatibilityDate = "${compatibilityDate}", globalOutbound = "push-mock",
      modules = [(name = "main.js", esModule = ${JSON.stringify(transport)})]
    )),
    (name = "push-mock", worker = (
      compatibilityDate = "${compatibilityDate}", globalOutbound = "push-mock",
      modules = [(name = "main.js", esModule = ${JSON.stringify(provider)})]
    ))
  ], sockets = []
);`;
    const path = join(temporary, 'transport.capnp');
    await writeFile(path, config);
    const result = spawnSync(require('workerd').default, [
      'test', '--no-verbose', '-I', dirname(require.resolve('workerd/workerd.capnp')), path, 'transport'
    ], { encoding: 'utf8', timeout: 30000 });
    assert.ifError(result.error);
    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.match(result.stdout, /PUSH_TRANSPORT_OK/);
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
});
