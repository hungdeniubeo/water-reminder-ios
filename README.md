<p align="center"><img src="./assets/water-reminder-hero.svg" alt="Water — Dành cho Beo" width="100%"></p>

<div align="center">

# Water ♡ — Dành cho Beo

*A little sip, a little love.*

**A personal, offline-first hydration journal designed for one iPhone 12 Pro Max.**

[Open the app](https://hungdeniubeo.github.io/water-reminder-ios/) · [Install](#install-on-iphone) · [Enable push reminders](./docs/SETUP_PUSH.md)

</div>

## What it does

- **Today:** Add 150, 250, 500 ml or a custom amount, and review daily progress.
- **Journal:** Calendar, past-day logs, seven completed-day summaries and local symptom check-ins.
- **Gentle reminders:** Foreground nudges, or optional lock-screen Web Push after Cloudflare setup.
- **Just one device:** No couple pairing, no accounts, no sign-in forms, no second phone.
- **VI / EN:** Language switch remains available.
- **Private history:** All drink entries and self-reported symptoms remain on the iPhone. Export/restore a local JSON backup.

The wellness notes are educational and describe logged habits, **not a diagnosis of dehydration**.

## Install on iPhone

Open [the app](https://hungdeniubeo.github.io/water-reminder-ios/) in **Safari**, tap **Share → Add to Home Screen → Add**, then launch Water from its Home Screen icon. This PWA does not require an App Store developer membership.

The layout is tailored to the iPhone 12 Pro Max **428 × 926 CSS-pixel portrait viewport**, with native font fallback and safe-area-aware bottom navigation. Browser pinch-zoom/double-tap zoom is suppressed for this dedicated one-device experience; the iPhone's system accessibility Zoom is separate.

## Enable real notifications

The GitHub Pages frontend cannot send scheduled notifications while closed. A separate Cloudflare Worker + D1 backend is included under [`backend/`](./backend). The existing D1 database named `water-couple` can be reused; **do not create another database**.

See [setup guide](./docs/SETUP_PUSH.md). Once configured, open **Settings → Reminders for Beo**, enter your private activation code, enable notifications and send a test notification.

## Development and tests

```bash
python3 -m http.server 8000
npm test
```

The app uses plain HTML/CSS/JavaScript with no frontend build dependency. Node.js 22+ is recommended for the tests and Cloudflare tooling.

## Privacy

No analytics, no sign-in and no cloud sync of water history or health notes. Cloudflare D1 stores only an opaque device identifier, a hash of its access token, notification schedule, message and Web Push subscription. Read [PRIVACY.md](./PRIVACY.md).

## Notes

This is an original visual design inspired by gentle wellness journaling patterns, not a reproduction of Flo branding or screens. No license has been granted for redistribution.