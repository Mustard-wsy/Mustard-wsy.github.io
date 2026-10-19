import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync, unlinkSync } from 'node:fs';
import { join, resolve } from 'node:path';
import {
  gitClient,
  publishSite,
  waitForPages,
} from '../scripts/publish-site.mjs';

function setup() {
  mkdirSync('test-results', { recursive: true });
  const dir = mkdtempSync(resolve('test-results/site-publisher-'));
  const root = join(dir, 'site');
  const remote = join(dir, 'remote.git');
  mkdirSync(root);
  const git = gitClient(root);
  git('init', '-b', 'main');
  git('config', 'user.name', 'Publisher test');
  git('config', 'user.email', 'publisher@example.invalid');
  writeFileSync(join(root, 'site.txt'), 'initial');
  git('add', '.');
  git('commit', '-m', 'initial');
  git('init', '--bare', remote);
  git('remote', 'add', 'origin', remote);
  git('push', 'origin', 'main');
  return {
    root,
    remote,
    git,
    config: { remote, branch: 'main', siteUrl: 'https://example.invalid' },
  };
}

test('site publisher stops before commit and push on a failed check or changed source', async () => {
  const { root, git, config } = setup();
  const initial = git('rev-parse', 'HEAD');
  writeFileSync(join(root, 'site.txt'), 'changed');
  let waited = false;
  const wait = async () => {
    waited = true;
  };
  await assert.rejects(
    publishSite(root, config, {
      validate: async () => {
        throw new Error('invalid');
      },
      wait,
    }),
    /invalid/,
  );
  assert.equal(git('rev-parse', 'HEAD'), initial);
  assert.equal(git('diff', '--cached', '--name-only'), '');
  await assert.rejects(
    publishSite(root, config, {
      validate: async () => {
        writeFileSync(join(root, 'site.txt'), 'edited during checks');
      },
      wait,
    }),
    /检查期间/,
  );
  assert.equal(git('rev-parse', 'HEAD'), initial);
  assert.equal(waited, false);
});

test('site publisher includes code and new files, retries a failed push without a duplicate commit', async () => {
  const { root, remote, git, config } = setup();
  unlinkSync(join(root, 'site.txt'));
  writeFileSync(join(root, 'draft.md'), 'draft source');
  writeFileSync(join(remote, 'hooks/pre-receive'), '#!/bin/sh\nexit 1\n', {
    mode: 0o755,
  });
  let waited = false;
  const options = {
    validate: async () => {},
    wait: async (_config, sha) => {
      waited = true;
      assert.equal(sha, git('rev-parse', 'HEAD'));
    },
  };
  await assert.rejects(publishSite(root, config, options), /上传到 GitHub/);
  const committed = git('rev-parse', 'HEAD');
  assert.equal(waited, false);
  writeFileSync(join(remote, 'hooks/pre-receive'), '#!/bin/sh\nexit 0\n', {
    mode: 0o755,
  });
  await publishSite(root, config, options);
  assert.equal(git('rev-parse', 'HEAD'), committed);
  assert.equal(waited, true);
  assert.equal(
    execFileSync('git', ['--git-dir', remote, 'show', 'main:draft.md'], {
      encoding: 'utf8',
    }),
    'draft source',
  );
});

test('check-only leaves the index and remote alone and does not wait for deployment', async () => {
  const { root, git, config } = setup();
  writeFileSync(join(root, 'new.txt'), 'new');
  const head = git('rev-parse', 'HEAD');
  await publishSite(root, config, {
    checkOnly: true,
    validate: async () => {},
    wait: async () => {
      assert.fail('must not deploy');
    },
  });
  assert.equal(git('rev-parse', 'HEAD'), head);
  assert.equal(git('diff', '--cached', '--name-only'), '');
});

const config = { remote: 'https://github.com/owner/site.git', branch: 'main' };
const run = {
  id: 8,
  head_sha: 'abc',
  head_branch: 'main',
  event: 'push',
  run_attempt: 2,
  html_url: 'https://github.com/owner/site/actions/runs/8',
};

test('Pages monitor waits for the exact commit and propagates failed steps and log URL', async () => {
  let time = 0;
  let calls = 0;
  await assert.rejects(
    waitForPages(config, 'abc', {
      now: () => time,
      sleep: async (ms) => {
        time += ms;
      },
      request: async (url) => {
        if (url.includes('/attempts/2/jobs'))
          return {
            jobs: [
              {
                name: 'deploy',
                steps: [{ name: 'Deploy to Pages', conclusion: 'failure' }],
              },
            ],
          };
        calls++;
        assert.ok(url.includes('head_sha=abc'));
        if (calls === 1)
          return {
            workflow_runs: [
              {
                ...run,
                head_sha: 'other',
                status: 'completed',
                conclusion: 'success',
              },
            ],
          };
        return {
          workflow_runs: [
            { ...run, status: 'completed', conclusion: 'failure' },
          ],
        };
      },
    }),
    /deploy → Deploy to Pages.*https:\/\/github.com/,
  );
  assert.equal(calls, 2);
});

test('Pages monitor distinguishes success, API errors and timeout', async () => {
  const success = { ...run, status: 'completed', conclusion: 'success' };
  assert.equal(
    await waitForPages(config, 'abc', {
      request: async () => ({ workflow_runs: [success] }),
    }),
    success,
  );
  await assert.rejects(
    waitForPages(config, 'abc', {
      request: async () => {
        throw new Error('HTTP 403');
      },
    }),
    /HTTP 403/,
  );
  let time = 0;
  await assert.rejects(
    waitForPages(config, 'abc', {
      timeoutMs: 1,
      now: () => time,
      sleep: async (ms) => {
        time += ms;
      },
      request: async () => ({ workflow_runs: [] }),
    }),
    /超时/,
  );
});
