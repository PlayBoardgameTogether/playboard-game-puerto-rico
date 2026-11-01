import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

function gh(args) {
  return execFileSync('gh', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

// Only an actual GitHub 404 means absent. Authentication/network errors must fail closed.
function optionalJson(run, endpoint) {
  try {
    return JSON.parse(run(['api', endpoint]));
  } catch (error) {
    if (error.status && /\(HTTP 404\)/.test(String(error.stderr))) return null;
    throw error;
  }
}

export async function publishRelease({
  directory = 'dist/release',
  configPath = 'release.config.json',
  env = process.env,
  run = gh,
  log = console.log,
} = {}) {
  const repository = env.GH_REPO;
  const commit = env.GITHUB_SHA;
  assert.match(repository ?? '', /^[\w.-]+\/[\w.-]+$/);
  assert.match(commit ?? '', /^[a-f0-9]{40}$/);
  assert.ok(
    (env.GITHUB_EVENT_NAME === 'push' &&
      (env.GITHUB_REF === 'refs/heads/main' || env.GITHUB_REF_TYPE === 'tag')) ||
      (env.GITHUB_EVENT_NAME === 'workflow_dispatch' && env.GITHUB_REF === 'refs/heads/main'),
    'publishing is only allowed from main or a pushed version tag',
  );
  const config = JSON.parse(await readFile(configPath, 'utf8'));
  const manifest = JSON.parse(await readFile(resolve(directory, 'release.json'), 'utf8'));
  assert.equal(config.repository, repository);
  assert.equal(manifest.repository, repository);
  assert.equal(manifest.commit, commit, 'release artifact must belong to this checked commit');
  // This repository owns one game. Reject unexpected extra packages instead of publishing them.
  assert.equal(config.assets.length, 1);
  assert.equal(manifest.packages.length, 1);
  const asset = manifest.packages[0];
  assert.equal(asset.gameId, config.assets[0].id);
  assert.match(asset.version, /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/);
  assert.match(config.assets[0].archive, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
  assert.equal(asset.tag, `${config.assets[0].archive}-v${asset.version}`);
  assert.equal(asset.filename, `${config.assets[0].archive}-${asset.version}.zip`);
  if (env.GITHUB_REF_TYPE === 'tag') assert.equal(asset.tag, env.GITHUB_REF_NAME);
  assert.match(asset.sha256, /^[a-f0-9]{64}$/);
  const archive = resolve(directory, asset.filename);
  const digest = createHash('sha256').update(await readFile(archive)).digest('hex');
  assert.equal(digest, asset.sha256, 'ZIP checksum mismatch');
  assert.equal(
    await readFile(resolve(directory, 'SHA256SUMS'), 'utf8'),
    `${digest}  ${asset.filename}\n`,
    'checksum list must match the verified package',
  );

  const endpoint = `repos/${repository}`;
  const release = optionalJson(run, `${endpoint}/releases/tags/${asset.tag}`);
  if (release) {
    assert.ok(!release.draft && !release.prerelease, 'existing draft/prerelease needs review');
    const names = new Set(release.assets.map((item) => item.name));
    for (const name of [asset.filename, 'release.json', 'SHA256SUMS']) {
      assert.ok(names.has(name), `existing release is incomplete: ${name}`);
    }
    log(`Already published: ${asset.tag}; existing tag and assets preserved.`);
    return 'skipped';
  }

  let ref = optionalJson(run, `${endpoint}/git/ref/tags/${asset.tag}`);
  // Existing annotated tags are supported without moving or rewriting any ref.
  for (let depth = 0; ref?.object.type === 'tag' && depth < 5; depth++) {
    ref = { object: JSON.parse(run(['api', `${endpoint}/git/tags/${ref.object.sha}`])).object };
  }
  if (ref) {
    assert.equal(ref.object.type, 'commit');
    assert.equal(ref.object.sha, commit, 'existing tag points to a different commit');
  }
  run([
    'release', 'create', asset.tag,
    archive, resolve(directory, 'SHA256SUMS'), resolve(directory, 'release.json'),
    '--repo', repository,
    '--target', commit,
    ...(ref ? ['--verify-tag'] : []),
    '--title', asset.tag,
    '--generate-notes',
  ]);
  log(`Published: ${asset.tag} from ${commit}.`);
  return 'published';
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await publishRelease();
}
