import { existsSync } from 'node:fs';
import net from 'node:net';
import path from 'node:path';

import { getSharedCheckoutRoot } from './env-bootstrap.mjs';
import { redactSensitiveText } from './github-app-auth.mjs';

export const GITHUB_BROKER_REQUEST_TIMEOUT_MS = 60000;

export function githubBrokerSocketPath(repoRoot, _env = process.env) {
  return defaultGithubBrokerSocketPath(repoRoot);
}

function defaultGithubBrokerSocketPath(repoRoot) {
  return path.join(canonicalGithubBrokerRoot(repoRoot), '.agents', 'runtime', 'github-broker.sock');
}

function canonicalGithubBrokerRoot(repoRoot) {
  try {
    return getSharedCheckoutRoot(repoRoot) || repoRoot;
  } catch {
    return repoRoot;
  }
}

export function isGithubBrokerAvailable(repoRoot, env = process.env) {
  return existsSync(githubBrokerSocketPath(repoRoot, env));
}

export function callGithubBroker({
  env = process.env,
  repoRoot,
  request,
  timeoutMs = GITHUB_BROKER_REQUEST_TIMEOUT_MS,
}) {
  const socketPath = githubBrokerSocketPath(repoRoot, env);

  return new Promise((resolve, reject) => {
    const socket = net.createConnection(socketPath);
    const timeout = setTimeout(() => {
      socket.destroy();
      reject(new Error(`GitHub broker timed out after ${timeoutMs}ms`));
    }, timeoutMs);
    let responseText = '';

    socket.setEncoding('utf8');
    socket.on('connect', () => {
      socket.write(`${JSON.stringify(request)}\n`);
    });
    socket.on('data', (chunk) => {
      responseText += chunk;
    });
    socket.on('error', (error) => {
      clearTimeout(timeout);
      reject(new Error(redactSensitiveText(`GitHub broker connection failed: ${error.message}`)));
    });
    socket.on('end', () => {
      clearTimeout(timeout);
      try {
        resolve(JSON.parse(responseText));
      } catch {
        reject(new Error('GitHub broker returned malformed JSON'));
      }
    });
  });
}
