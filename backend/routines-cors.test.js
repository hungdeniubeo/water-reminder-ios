import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorker, ORIGIN } from './worker.js';

const path = 'https://test.invalid/api/admin/routines/go-work';

test('daily reminder edits and deletes pass browser CORS preflight', async () => {
  const worker = createWorker();
  for (const method of ['PATCH', 'DELETE']) {
    const response = await worker.fetch(new Request(path, {
      method: 'OPTIONS',
      headers: {
        Origin: ORIGIN,
        'Access-Control-Request-Method': method,
        'Access-Control-Request-Headers': 'authorization,content-type'
      }
    }), {});
    assert.equal(response.status, 204);
    assert.equal(response.headers.get('Access-Control-Allow-Origin'), ORIGIN);
    const methods = response.headers.get('Access-Control-Allow-Methods').split(',').map(value => value.trim());
    for (const required of ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS']) {
      assert.ok(methods.includes(required), 'Missing allowed method: ' + required);
    }
    const headers = response.headers.get('Access-Control-Allow-Headers').toLowerCase().split(',').map(value => value.trim());
    assert.ok(headers.includes('authorization'));
    assert.ok(headers.includes('content-type'));
  }
});

test('reminder preflight still rejects untrusted origins', async () => {
  const response = await createWorker().fetch(new Request(path, {
    method: 'OPTIONS',
    headers: {
      Origin: 'https://untrusted.example',
      'Access-Control-Request-Method': 'PATCH'
    }
  }), {});
  assert.equal(response.status, 403);
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), null);
});
