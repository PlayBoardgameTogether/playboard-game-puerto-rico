import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { publishRelease } from '../scripts/publish-release.mjs';

const commit = 'a'.repeat(40);
const tag = 'puerto-rico-v1.1.0';
const filename = 'puerto-rico-1.1.0.zip';
const notFound = () => Object.assign(new Error('not found'), { status: 1, stderr: 'gh: Not Found (HTTP 404)' });

async function fixture(t, responses = {}) {
  const directory = await mkdtemp(join(tmpdir(), 'puerto-rico-release-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const bytes = Buffer.from('already verified package fixture');
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  const configPath = join(directory, 'config.json');
  const manifest = {
    repository: 'PlayBoardgameTogether/playboard-game-puerto-rico', commit,
    packages: [{ gameId: 'online.puerto-rico', version: '1.1.0', tag, filename, sha256 }],
  };
  await writeFile(configPath, JSON.stringify({
    repository: manifest.repository, assets: [{ id: 'online.puerto-rico', archive: 'puerto-rico' }],
  }));
  await writeFile(join(directory, filename), bytes);
  await writeFile(join(directory, 'release.json'), JSON.stringify(manifest));
  await writeFile(join(directory, 'SHA256SUMS'), `${sha256}  ${filename}\n`);
  const calls = [];
  const options = {
    directory, configPath,
    env: { GH_REPO: manifest.repository, GITHUB_SHA: commit, GITHUB_EVENT_NAME: 'push', GITHUB_REF: 'refs/heads/main', GITHUB_REF_TYPE: 'branch' },
    run(args) {
      calls.push(args);
      if (args[0] === 'release') return 'https://example.test/release';
      const kind = args[1].includes('/releases/') ? 'release' : 'ref';
      if (responses[kind] instanceof Error) throw responses[kind];
      if (responses[kind]) return JSON.stringify(responses[kind]);
      throw notFound();
    },
    log() {},
  };
  return { options, calls, manifest, directory };
}

test('main publishes missing version and targets the exact checked commit', async (t) => {
  const { options, calls } = await fixture(t);
  assert.equal(await publishRelease(options), 'published');
  const publish = calls.find((args) => args[0] === 'release');
  assert.equal(publish[2], tag);
  assert.equal(publish[publish.indexOf('--target') + 1], commit);
  assert.ok(publish.some((arg) => arg.endsWith(filename)));
});

test('published versions skip without changing tags or attachments', async (t) => {
  const { options, calls } = await fixture(t, {
    release: { draft: false, prerelease: false, assets: [filename, 'release.json', 'SHA256SUMS'].map((name) => ({ name })) },
  });
  assert.equal(await publishRelease(options), 'skipped');
  assert.equal(calls.length, 1);
});

test('an existing tag must match the checked commit', async (t) => {
  const { options, calls } = await fixture(t, { ref: { object: { type: 'commit', sha: 'b'.repeat(40) } } });
  await assert.rejects(publishRelease(options), /different commit/);
  assert.ok(calls.every((args) => args[0] === 'api'));
});

test('an existing matching tag is verified when publishing', async (t) => {
  const { options, calls } = await fixture(t, { ref: { object: { type: 'commit', sha: commit } } });
  await publishRelease(options);
  assert.ok(calls.at(-1).includes('--verify-tag'));
});

test('authentication/network failures cannot be mistaken for missing releases', async (t) => {
  const { options, calls } = await fixture(t, { release: Object.assign(new Error('forbidden'), { status: 1, stderr: 'gh: Forbidden (HTTP 403)' }) });
  await assert.rejects(publishRelease(options), /forbidden/);
  assert.equal(calls.length, 1);
});

test('draft or incomplete releases require review and are never overwritten', async (t) => {
  for (const release of [{ draft: true }, { draft: false, prerelease: false, assets: [] }]) {
    const { options, calls } = await fixture(t, { release });
    await assert.rejects(publishRelease(options), /needs review|incomplete/);
    assert.equal(calls.length, 1);
  }
});

test('corrupted ZIP and wrong artifact commit fail before contacting GitHub', async (t) => {
  for (const mode of ['zip', 'commit']) {
    const { options, calls, directory, manifest } = await fixture(t);
    if (mode === 'zip') await writeFile(join(directory, filename), 'corrupted');
    else {
      manifest.commit = 'b'.repeat(40);
      await writeFile(join(directory, 'release.json'), JSON.stringify(manifest));
    }
    await assert.rejects(publishRelease(options), /checksum mismatch|checked commit/);
    assert.equal(calls.length, 0);
  }
});

test('PR and non-main manual runs cannot publish', async (t) => {
  for (const [event, ref] of [['pull_request', 'refs/pull/3/merge'], ['workflow_dispatch', 'refs/heads/feature']]) {
    const { options, calls } = await fixture(t);
    options.env.GITHUB_EVENT_NAME = event;
    options.env.GITHUB_REF = ref;
    await assert.rejects(publishRelease(options), /only allowed/);
    assert.equal(calls.length, 0);
  }
});

test('main manual retry publishes; mismatched pushed tag cannot publish', async (t) => {
  const { options } = await fixture(t);
  options.env.GITHUB_EVENT_NAME = 'workflow_dispatch';
  assert.equal(await publishRelease(options), 'published');
  options.env.GITHUB_EVENT_NAME = 'push';
  options.env.GITHUB_REF_TYPE = 'tag';
  options.env.GITHUB_REF_NAME = 'puerto-rico-v1.0.0';
  await assert.rejects(publishRelease(options));
});
