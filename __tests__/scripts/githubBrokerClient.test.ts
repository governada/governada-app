import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import net from 'node:net';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  GITHUB_BROKER_REQUEST_TIMEOUT_MS,
  callGithubBroker,
  githubBrokerSocketPath,
} from '@/scripts/lib/github-broker-client.mjs';

const tempRoots: string[] = [];

function tempRepoRoot() {
  const root = mkdtempSync(path.join('/tmp', 'gov-broker-client-'));
  spawnSync('git', ['init'], { cwd: root, stdio: 'ignore' });
  tempRoots.push(root);
  return root;
}

async function withBrokerServer(
  handler: (socket: net.Socket) => void,
  test: ({ repoRoot }: { repoRoot: string }) => Promise<void>,
) {
  const repoRoot = tempRepoRoot();
  const socketPath = githubBrokerSocketPath(repoRoot);
  mkdirSync(path.dirname(socketPath), { mode: 0o700, recursive: true });
  const server = net.createServer(handler);

  const listenResult = await new Promise<
    { ok: true } | { error: NodeJS.ErrnoException; ok: false }
  >((resolve, reject) => {
    const onError = (error: NodeJS.ErrnoException) => {
      if (error.code === 'EPERM' || error.code === 'EINVAL') {
        resolve({ error, ok: false });
        return;
      }

      reject(error);
    };

    server.once('error', onError);
    server.listen(socketPath, () => {
      server.off('error', onError);
      resolve({ ok: true });
    });
  });

  if (!listenResult.ok) {
    console.warn(`Skipping Unix socket broker client test: ${listenResult.error.message}`);
    return;
  }

  try {
    await test({ repoRoot });
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

afterEach(() => {
  while (tempRoots.length > 0) {
    const root = tempRoots.pop();
    if (root) {
      rmSync(root, { force: true, recursive: true });
    }
  }
});

describe('github broker client', () => {
  it('keeps the default broker request timeout long enough for token minting and GitHub probes', () => {
    expect(GITHUB_BROKER_REQUEST_TIMEOUT_MS).toBeGreaterThanOrEqual(60000);
  });

  it('round-trips broker responses over the repo runtime socket', async () => {
    await withBrokerServer(
      (socket) => {
        socket.setEncoding('utf8');
        socket.on('data', () => {
          socket.end(`${JSON.stringify({ ok: true, status: 200 })}\n`);
        });
      },
      async ({ repoRoot }) => {
        await expect(
          callGithubBroker({
            repoRoot,
            request: { kind: 'status' },
            timeoutMs: 1000,
          }),
        ).resolves.toEqual({ ok: true, status: 200 });
      },
    );
  });

  it('fails with a bounded timeout when the broker does not answer', async () => {
    await withBrokerServer(
      (socket) => {
        socket.resume();
      },
      async ({ repoRoot }) => {
        await expect(
          callGithubBroker({
            repoRoot,
            request: { kind: 'status' },
            timeoutMs: 25,
          }),
        ).rejects.toThrow('GitHub broker timed out after 25ms');
      },
    );
  });
});
