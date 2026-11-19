import test from 'node:test';
import assert from 'node:assert/strict';
import { decodeVapidPublicKey } from '../solo.js';

test('VAPID base64url key converts to an uncompressed P-256 key for iPhone PushManager', () => {
  const uncompressed = new Uint8Array(65);uncompressed[0] = 4;
  for(let i=1;i<65;i++)uncompressed[i]=i;
  const encoded=Buffer.from(uncompressed).toString('base64url');
  assert.deepEqual(decodeVapidPublicKey(encoded),uncompressed);
});

test('invalid VAPID keys are rejected before subscribing', () => {
  assert.throws(() => decodeVapidPublicKey('not a key'), /Invalid/);
});