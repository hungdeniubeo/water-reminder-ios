import { generateKeyPairSync } from 'node:crypto';
const { publicKey, privateKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
const jwk = privateKey.export({ format: 'jwk' });
const x = Buffer.from(jwk.x, 'base64url');
const y = Buffer.from(jwk.y, 'base64url');
const pub = Buffer.concat([Buffer.from([4]), x, y]).toString('base64url');
console.log('\nVAPID_PUBLIC_KEY (public, add to wrangler.jsonc [vars]):\n' + pub);
console.log('\nVAPID_PRIVATE_KEY (private, set with `npx wrangler secret put VAPID_PRIVATE_KEY`; NEVER commit):\n' + jwk.d);
console.log('\nKeep your private key safe. Losing it requires all phones to re-enable push.\n');