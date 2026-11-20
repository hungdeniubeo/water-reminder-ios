const observed = { accepted: 0, redirects: 0, targets: 0 };

export default {
  async fetch(request) {
    const path = new URL(request.url).pathname;
    if (path === '/stats') return Response.json(observed);
    if (path === '/redirect-target') {
      observed.targets++;
      return new Response('Redirect destination must never be reached', { status: 418 });
    }
    const body = new Uint8Array(await request.arrayBuffer());
    const valid = request.method === 'POST' &&
      request.headers.get('content-encoding') === 'aes128gcm' &&
      request.headers.get('content-type') === 'application/octet-stream' &&
      request.headers.get('ttl') === '900' &&
      request.headers.get('authorization')?.startsWith('vapid t=') && body.byteLength === 4096;
    if (!valid) return new Response('Invalid Web Push request', { status: 400 });
    if (path === '/accepted') {
      observed.accepted++;
      return new Response(null, { status: 201 });
    }
    if (path === '/redirect-same-origin' || path === '/redirect-cross-origin') {
      observed.redirects++;
      const origin = path === '/redirect-same-origin' ? 'https://web.push.apple.com' : 'https://other.test.invalid';
      return new Response(null, { status: 302, headers: { Location: `${origin}/redirect-target` } });
    }
    return new Response('Unexpected mock request', { status: 500 });
  }
};
