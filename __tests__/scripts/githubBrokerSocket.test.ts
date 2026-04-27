import { EventEmitter } from 'node:events';

import { describe, expect, it } from 'vitest';

import {
  attachBrokerSocketErrorHandler,
  sendBrokerSocketResponse,
} from '@/scripts/lib/github-broker-socket.mjs';

class FakeSocket extends EventEmitter {
  destroyed = false;
  endCalls = 0;
  failOnEnd = false;
  payload = '';

  end(payload: string, callback: () => void) {
    this.endCalls += 1;
    this.payload = payload;
    if (this.failOnEnd) {
      this.emit('error', Object.assign(new Error('write EPIPE'), { code: 'EPIPE' }));
      return;
    }
    callback();
  }
}

describe('github broker socket response helpers', () => {
  it('writes a JSON response and settles once', () => {
    const socket = new FakeSocket();
    let settled = 0;

    sendBrokerSocketResponse({
      onSettled: () => {
        settled += 1;
      },
      response: { ok: true, status: 200 },
      socket,
    });

    expect(socket.endCalls).toBe(1);
    expect(socket.payload).toBe('{"ok":true,"status":200}\n');
    expect(settled).toBe(1);
  });

  it('settles write errors instead of throwing unhandled socket errors', () => {
    const socket = new FakeSocket();
    socket.failOnEnd = true;
    let settled = 0;

    expect(() =>
      sendBrokerSocketResponse({
        onSettled: () => {
          settled += 1;
        },
        response: { ok: false, status: 0 },
        socket,
      }),
    ).not.toThrow();

    expect(socket.endCalls).toBe(1);
    expect(settled).toBe(1);
  });

  it('absorbs early client disconnect errors on the broker socket', () => {
    const socket = new FakeSocket();

    attachBrokerSocketErrorHandler(socket);

    expect(() =>
      socket.emit('error', Object.assign(new Error('socket hang up'), { code: 'ECONNRESET' })),
    ).not.toThrow();
  });

  it('settles without writing when the socket is already destroyed', () => {
    const socket = new FakeSocket();
    socket.destroyed = true;
    let settled = 0;

    sendBrokerSocketResponse({
      onSettled: () => {
        settled += 1;
      },
      response: { ok: true },
      socket,
    });

    expect(socket.endCalls).toBe(0);
    expect(settled).toBe(1);
  });
});
