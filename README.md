<p align="center">
  <img src="./assets/water-reminder-hero.svg" alt="Water Reminder illustration" width="100%" />
</p>

<div align="center">

# Water Reminder

**Small sips. Better days.**

A lightweight hydration tracker you can add to your iPhone Home Screen. No account, no subscription, no backend.

![PWA](https://img.shields.io/badge/Platform-iPhone%20PWA-102D39?style=flat-square)
![Version](https://img.shields.io/badge/Version-1.0-0C9B9C?style=flat-square)
![Cost](https://img.shields.io/badge/Hosting-GitHub%20Pages-657A83?style=flat-square)

[App](#try-the-app) · [Features](#features) · [Install](#install-on-iphone) · [Reminders](#notifications) · [Development](#development)

</div>

---

## Try the app

**[Open Water Reminder ↗](https://hungdeniubeo.github.io/water-reminder-ios/)**

> **Publishing note:** The link works after GitHub Pages has been enabled for this repository under **Settings → Pages**. The project is built and committed to \`main\`; Pages activation is a separate repository setting.

## Features

- **Quick logging.** Add 150, 250, or 500 ml with one tap, or enter a custom amount.
- **Daily goal.** Choose your own water target and follow a live progress ring.
- **History.** See your last seven days as a chart and review daily totals.
- **Local reminders.** Optional gentle in-app nudges at chosen times **while the app is open**.
- **Offline-first.** After the first visit, the service worker caches the app for offline use.
- **Backup and restore.** Export your entries and preferences as JSON and restore them later.
- **On-device data.** Your logs and settings stay in your browser's local storage. No sign-in or analytics.

This is a **Progressive Web App**, not a native iOS app or an App Store release.

## Install on iPhone

1. Open the published link in **Safari** on your iPhone.
2. Tap **Share** → **Add to Home Screen**.
3. Choose **Add**. Then open Water Reminder from its Home Screen icon.
4. Visit once while online so the app's assets can be cached for offline use.

Your history is stored locally. **Use Settings → Export data to keep a backup.** Removing the app or clearing website data can erase your logs. The app does not sync between devices.

## Notifications

**V1 reminder behavior:** When you leave Water Reminder open, it can display an in-app nudge at your chosen interval. It **cannot** send scheduled iPhone lock-screen notifications after you close it.

For true background notifications on iOS 16.4+, the installed PWA needs Web Push (Push API, service worker, user permission) plus a server that sends notifications. GitHub Pages cannot do the sending alone.

See **[Background notification plan](./docs/REMINDERS_PLAN.md)** for a proposed free-tier implementation.

## Development

No package install, server-side code or frontend build tool is required for the static app.

\`\`\`bash
git clone https://github.com/hungdeniubeo/water-reminder-ios.git
cd water-reminder-ios
python3 -m http.server 8000
\`\`\`

Visit [http://localhost:8000](http://localhost:8000). Service workers work on localhost or over HTTPS.

To run the pure logic tests, install Node.js 20+ and run:

\`\`\`bash
npm test
\`\`\`

### Publish with GitHub Pages

1. Make sure the GitHub repository is **public** (GitHub Pages is included for public repositories on GitHub Free).
2. Open **Settings → Pages** for this repository.
3. Under **Build and deployment**, select **Deploy from a branch**.
4. Select **\`main\`** and **\`/(root)\`**, then click **Save**.
5. Once GitHub finishes publishing, visit **https://hungdeniubeo.github.io/water-reminder-ios/**.

The app uses relative asset paths so it works at the GitHub Pages project URL. No custom domain is required.

## Project structure

\`\`\`text
index.html               Interface
styles.css               iPhone-first styling
app.js                   UI and browser persistence
logic.js                 Testable date, goal, and reminder logic
sw.js                    Offline asset caching
manifest.webmanifest     Installable PWA metadata
assets/                  App icons and README banner
tests/                   Node.js logic tests
docs/REMINDERS_PLAN.md   Background Web Push proposal
PRIVACY.md               Local storage and privacy details
\`\`\`

## Roadmap

- [x] Offline-ready PWA shell
- [x] Water logging, goals, and history
- [x] On-device storage and JSON backups
- [x] Foreground-only in-app nudges
- [ ] Background Web Push with an opt-in subscription
- [ ] Test and polish installation, icon appearance, and notifications on a physical iPhone
- [ ] Optional device-to-device sync

## Privacy

Read the [privacy notes](./PRIVACY.md). No third-party analytics, account system, or cloud storage is included in V1.

<sub>**License:** No license is currently specified. All rights reserved unless a license is added.</sub>
