import test from 'node:test';
import assert from 'node:assert/strict';
import { backendConfigured, getSession, clearSession } from '../couple.js';

test('push backend is not misreported as configured before setup', () => {
  assert.equal(backendConfigured(), false);
});

test('missing and malformed stored device sessions fail closed', () => {
  const previous = globalThis.localStorage;
  const map = new Map();
  globalThis.localStorage = {
    getItem: key => map.get(key) ?? null,
    setItem: (key, value) => map.set(key, value),
    removeItem: key => map.delete(key)
  };
  try {
    assert.equal(getSession(), null);
    map.set('water-couple-session-v2', '{not json');
    assert.equal(getSession(), null);
    map.set('water-couple-session-v2', JSON.stringify({ id: 'device', secret: 'private-token' }));
    assert.deepEqual(getSession(), { id: 'device', secret: 'private-token' });
    clearSession();
    assert.equal(getSession(), null);
  } finally {
    if (previous === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = previous;
  }
});