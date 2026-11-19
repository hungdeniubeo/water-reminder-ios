/** Generate a VAPID keypair without printing or committing the private key. */
import { generateKeyPairSync } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const keyDir = join(homedir(), '.water-beo');
const privatePath = join(keyDir, 'vapid-private-key');
mkdirSync(keyDir, { recursive: true, mode: 0o700 });

const { privateKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
const jwk = privateKey.export({ format: 'jwk' });
const x = Buffer.from(jwk.x, 'base64url');
const y = Buffer.from(jwk.y, 'base64url');
const publicKey = Buffer.concat([Buffer.from([4]), x, y]).toString('base64url');

try {
  // Never replace a previously created private key by accident.
  writeFileSync(privatePath, jwk.d + '\n', { flag: 'wx', mode: 0o600 });
} catch (error) {
  if (error.code === 'EEXIST') {
    console.error('A VAPID private key already exists at ' + privatePath + '. Do not rotate keys accidentally.');
    process.exit(1);
  }
  throw error;
}

console.log('VAPID_PUBLIC_KEY (safe to share):\n' + publicKey);
console.log('\nThe private key was saved securely at ' + privatePath + '.');
console.log('Do NOT send or commit the private key.');
console.log('When ready, run: npx wrangler secret put VAPID_PRIVATE_KEY < ~/.water-beo/vapid-private-key');
