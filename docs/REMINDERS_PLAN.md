# One-iPhone reminder architecture

Water ♡ runs on GitHub Pages and stores drinking history and symptom notes only on the iPhone. Real lock-screen notifications require an opt-in Web Push subscription and Cloudflare Worker.

- `backend/worker.js` handles one private device, VAPID signing/encryption, and scheduled sends.
- A D1 database named `water-couple` is reused solely for device registration, schedule, and subscription. The couple pairing endpoints and second-device features are removed.
- Cron runs every minute (Cloudflare plan limits apply). Duplicates are suppressed with last sent slot.
- `OWNER_SETUP_CODE` is a Worker Secret used once to activate the iPhone. It is not public or committed.
- Disable notifications to remove the subscription; disconnect device to free the single activation slot.
- No history, amounts, daily totals, or health symptoms are transmitted to the Worker.

See [SETUP_PUSH.md](./SETUP_PUSH.md) for the complete one-time setup. Web Push is supported for Home Screen web apps on iOS 16.4+, subject to platform permissions and delivery conditions.