# Water ♡ — Dành cho Beo

A private notification app with **one receiver, Beo**, and a separate admin page for the owner.

- **iPhone app:** a small personal home screen, a Classic Pink drop button, the latest message and one-time notification setup.
- **Admin:** sign in, edit the recipient name/home text, set a reminder schedule, write a custom notification and send it.
- **No daily water totals, intake forms, journal or settings tabs in the receiving app.**

The iPhone app stays at `https://hungdeniubeo.github.io/water-reminder-ios/`. The admin page is `admin.html` on the same site. Access to all admin data and actions is checked by the backend, not by hiding the URL.

## Setup and update

Follow [the admin and iPhone setup guide](docs/ADMIN_SETUP.md). **Upgrade the database and deploy the Worker before publishing the new receiving app.** The old server exposes `mode: "single-device"`; the replacement exposes `apiVersion: 2` and `mode: "admin-receiver"`.

Existing `OWNER_SETUP_CODE`, VAPID keys, D1 binding, manifest identity and an existing sole device session are preserved. Beo never needs the admin secret: the owner creates an eight-digit, ten-minute, one-use pairing code. Explicit replacement disconnects the old receiver only after a new iPhone has successfully paired.

## How notifications work

The owner sends a message from the admin page, or the server's cron sends the configured reminder. Cloudflare encrypts it with Web Push and delivers it to the phone's push service. The same-origin service worker displays it while the app is closed. There is no foreground timer used as a substitute for push.

The admin distinguishes:

- **Đã chuyển đi:** the push provider accepted the request.
- **iPhone đã nhận:** the service worker processed the message, completed `showNotification()` and returned a receipt. This does not prove a person read it or that Focus allowed a banner.
- **Đã mở:** the notification was tapped.
- **Gửi chưa được / Sẽ thử lại:** a failed attempt, with its reason and retry state.

Receipts are best-effort: loss of a receipt does not mean the notification was not displayed. Notifications use stable per-message tags so a retry replaces its own message; separate messages do not all replace one shared notification. Manual requests use an idempotency key. Transient failures retry at most three times within 15 minutes. The cron can catch up a reminder missed by up to 14 minutes. Schedules are interpreted in the selected IANA time zone.

## Development

Requires Node.js 22.18+ (CI uses Node 24).

```bash
npm test
npm run check
cd backend
npm ci
npx wrangler deploy --dry-run
```

The active entry points are `index.html` / `receiver.js` / `receiver.css` and `admin.html` / `admin.js` / `admin.css`. The supplied Classic Pink design is in `classic-pink-button.css` and `classic-pink-button.js`.

The active test command covers the new receiver, admin, service worker and backend. Older tracker modules/tests remain as migration reference and are not loaded by the new app; the pre-redesign version is also retained in Git history. Existing local tracker data is not erased by the redesign.

The integration suite uses real SQLite semantics and mocked push transport. It covers permissions, migration, pairing races, idempotency, receipt progression, retry recovery and receiver flows. A real iPhone remains necessary to verify actual iOS notification delivery.
