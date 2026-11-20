import { sendWebPush } from '../worker.js';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
function base64url(value) {
  let binary = '';
  for (const byte of new Uint8Array(value)) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export default {
  async test() {
    // Synthetic keys only: this fixture never reads deployment credentials.
    const vapid = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
    const privateKey = await crypto.subtle.exportKey('jwk', vapid.privateKey);
    const env = {
      VAPID_SUBJECT: 'https://test.invalid/',
      VAPID_PUBLIC_KEY: base64url(await crypto.subtle.exportKey('raw', vapid.publicKey)),
      VAPID_PRIVATE_KEY: privateKey.d
    };
    const receiver = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
    const subscription = {
      endpoint: 'https://web.push.apple.com/accepted', expirationTime: null,
      keys: {
        p256dh: base64url(await crypto.subtle.exportKey('raw', receiver.publicKey)),
        auth: base64url(crypto.getRandomValues(new Uint8Array(16)))
      }
    };
    const payload = { id: crypto.randomUUID(), title: 'Water ♡', body: 'Beo ơi, uống nước nha ♡', receiptToken: '1'.repeat(64) };
    const accepted = await sendWebPush({ env, subscription, payload });
    assert(accepted.status === 201, `Expected provider acceptance, got ${accepted.status}`);
    await accepted.text();

    for (const route of ['redirect-same-origin', 'redirect-cross-origin']) {
      const response = await sendWebPush({ env, subscription: {
        ...subscription, endpoint: `https://web.push.apple.com/${route}`
      }, payload });
      assert(response.status === 302, `Redirect ${route} was followed or hidden: ${response.status}`);
      await response.text();
    }
    const observed = await (await fetch('https://web.push.apple.com/stats')).json();
    assert(observed.accepted === 1, 'Expected exactly one successful provider call');
    assert(observed.redirects === 2, 'Expected both redirect responses');
    assert(observed.targets === 0, 'A redirect destination received a request');
    console.log('PUSH_TRANSPORT_OK: 201 accepted; both 302 responses returned; redirect targets untouched');
  }
};
