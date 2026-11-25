<img src="assets/icon.svg" alt="Beo Daily app icon" width="88" align="right">

# Beo Daily

A private daily reminder app for one iPhone, with a mobile-first admin dashboard and scheduled Web Push notifications.

[![PWA checks](https://github.com/hungdeniubeo/water-reminder-ios/actions/workflows/check.yml/badge.svg?branch=main)](https://github.com/hungdeniubeo/water-reminder-ios/actions/workflows/check.yml)
![Source version](https://img.shields.io/badge/Source_version-5.0.0-24292f?style=flat-square)
![Platform](https://img.shields.io/badge/Platform-iOS_PWA-24292f?style=flat-square)
![Frontend](https://img.shields.io/badge/Frontend-GitHub_Pages-24292f?style=flat-square)
![Backend](https://img.shields.io/badge/Backend-Cloudflare_Workers-F38020?style=flat-square)
![Database](https://img.shields.io/badge/Database-Cloudflare_D1-F38020?style=flat-square)

[Open app](https://hungdeniubeo.github.io/water-reminder-ios/) · [Admin dashboard](https://hungdeniubeo.github.io/water-reminder-ios/admin.html) · [Setup guide](docs/ADMIN_SETUP.md) · [Issues](https://github.com/hungdeniubeo/water-reminder-ios/issues)

## Overview

Beo Daily provides a simple way to manage personal reminders remotely and deliver them to a paired iPhone. Originally built for hydration reminders, it now supports everyday routines, custom messages and scheduled events.

The recipient uses an installable web app, while the administrator manages schedules, messages and device connections from a separate dashboard. No native iOS build is required.

## Features

| Feature | Description |
| --- | --- |
| Flexible schedules | Fixed times, repeating intervals, randomized daily times and date-specific reminders. |
| Custom messages | Fixed notification content or up to 10 message variations per schedule. |
| Quick templates | Prefill reminders for work, lunch, rest and bedtime without automatically saving them. |
| Instant notifications | Compose, preview and send a message directly to the paired iPhone. |
| Upcoming reminders | Preview the next three scheduled times in the configured time zone. |
| Device management | Pair, replace or disconnect the recipient's iPhone using a separate admin session. |
| Delivery history | Track push acceptance, device receipts and notification opens when reported. |
| System management | Monitor D1 storage, configure history retention, export records and clean up expired entries. |

### iPhone experience

- Installable Progressive Web App (PWA) with Home Screen access.
- Daily greeting, personal notes and the latest received message.
- Web Push notifications without keeping the app open.
- A lightweight interface designed for a single recipient.

### Admin experience

- Mobile-first dashboard with bottom navigation and bottom-sheet forms.
- Two-column desktop layout with drawer-based editing.
- Independent controls for each reminder schedule.
- Live notification preview and delivery tracking while the dashboard is open.

## Architecture

```mermaid
flowchart LR
    A[Admin dashboard] --> W[Cloudflare Worker]
    C[Cron triggers] --> W
    W <--> D[(Cloudflare D1)]
    W --> P[Web Push service]
    P --> I[iPhone PWA]
    I -->|Receipts and open events| W
```

| Layer | Technology |
| --- | --- |
| Frontend | HTML, CSS, JavaScript, GitHub Pages |
| Mobile app | PWA, Web App Manifest, Service Worker |
| API and scheduling | Cloudflare Workers, Cron Triggers |
| Storage | Cloudflare D1 |
| Notifications | Web Push with VAPID |

## Repository structure

```text
water-reminder-ios/
├── index.html              # Recipient app entry point
├── admin.html              # Admin dashboard entry point
├── receiver.js             # Recipient and device connection logic
├── admin.js                # Admin dashboard logic
├── routines-admin.js       # Reminder schedule management
├── routine-schedule.js     # Shared scheduling logic
├── sw.js                   # Service worker and notification handling
├── manifest.webmanifest    # PWA installation metadata
├── assets/                 # App icons and illustrations
├── backend/                # Worker API, D1 schema and migrations
├── tests/                  # Frontend and service worker tests
├── docs/                   # Setup and technical documentation
└── .github/workflows/      # Automated checks
```

## Requirements

| Use case | Requirements |
| --- | --- |
| Receive reminders | iPhone running iOS 16.4 or later, Home Screen installation, internet access and notification permission |
| Manage reminders | A modern web browser and authorized administrator credentials |
| Local development | Node.js 22.18 or later and npm |
| Self-host the backend | Cloudflare account, Workers, D1, Wrangler and configured VAPID keys |

## Connect an iPhone

1. Sign in to the admin dashboard and generate a pairing code.
2. Open the recipient app in Safari on the target iPhone.
3. Select **Share → Add to Home Screen**.
4. Launch the installed app and enter the pairing code.
5. Enable notifications and grant permission.
6. Send a test message from the dashboard and verify it on the iPhone.

Pairing codes are separate from administrator credentials. Keep the existing installed PWA and device connection when updating the app.

## Development

Requires Node.js 22.18 or later.

```bash
git clone https://github.com/hungdeniubeo/water-reminder-ios.git
cd water-reminder-ios
npm ci --prefix backend
npm run check
npm test
```

The test suite covers scheduling, time zones, device pairing, notification states and frontend behavior. Actual notification delivery must be verified on a physical iPhone.

### Continuous integration

The [PWA checks workflow](https://github.com/hungdeniubeo/water-reminder-ios/actions/workflows/check.yml) runs on pushes to `main` and on pull requests. GitHub Actions installs backend dependencies, checks JavaScript syntax and runs the frontend and backend tests using Node.js 24.

The backend uses Wrangler for local development and deployment, and `@block65/webcrypto-web-push` for Web Push encryption and delivery.

To check the Worker bundle without deploying:

```bash
cd backend
npx wrangler deploy --dry-run
```

## Deployment

The frontend is hosted on GitHub Pages from the `main` branch. The Worker and D1 database are deployed separately.

For an existing configured Cloudflare environment, install the backend dependencies and apply only the outstanding migrations in order before deploying the Worker.

```bash
cd backend
npm ci
```

| Migration | Command | Purpose |
| --- | --- | --- |
| 0002 | `npm run db:upgrade` | Administrator and recipient separation |
| 0003 | `npm run db:routines` | Additional reminder schedules |
| 0004 | `npm run db:reminders` | Flexible reminder scheduling |
| 0005 | `npm run db:system` | Notification history retention policy |

For a new environment, follow the [push setup guide](docs/SETUP_PUSH.md) to configure D1, the Worker and its secrets before initializing the database. Once the required migrations are complete, deploy the Worker:

```bash
npm run deploy
```

Do not replace existing VAPID keys or device credentials during routine updates. Frontend changes on GitHub Pages do not deploy the Worker automatically.

## Scheduling and delivery

- All schedules use their saved time zone. Randomized daily times are deterministic for each schedule and day, with at least 15 minutes between generated times.
- Invalid calendar dates are skipped. Delayed cron runs catch up only the most recent eligible occurrence within 14 minutes.
- Message variations rotate to reduce repetition during the day.
- Upcoming times and notification previews are estimates or simulations, not delivery confirmations.
- Push service acceptance does not guarantee that a notification appeared on the iPhone. Device receipts and open events are tracked separately.
- History retention supports 30, 60 or 90 days. Cleanup removes expired notification history, not schedules or paired devices. JSON export includes up to 5,000 recent records; manual cleanup handles up to 1,000 expired records per run.

## Security and privacy

- Administrator credentials are stored as server-side secrets and must never be committed to the repository or included in public URLs.
- Device pairing uses a separate, single-use code that expires after 10 minutes.
- Web Push encrypts notification payloads in transit; device receipts are reported separately.
- The system stores reminder settings, a paired device subscription and notification history. It does not require water intake or health tracking data.
- No third-party advertising or user analytics are included, as described in the [privacy policy](PRIVACY.md).

## Version and updates

| Component | Source version |
| --- | --- |
| PWA frontend | `5.0.0` |
| Worker backend | `2.0.0` |

Versions are taken from the respective package manifests. These identify the source code, not a published release or a guarantee that production is running the same build.

The `main` branch is the primary source of updates. See the [commit history](https://github.com/hungdeniubeo/water-reminder-ios/commits/main/) for changes.

## Limitations

- The system is designed for one administrator and one paired iPhone, rather than multiple users or shared accounts.
- iOS controls notification presentation, sound, Focus modes and delivery behavior.
- A push receipt does not establish that a reminder was read or acted upon.
- Keep the installed Home Screen app during routine updates to avoid losing the existing device connection.

## Documentation

| Guide | Purpose |
| --- | --- |
| [Admin setup](docs/ADMIN_SETUP.md) | Administrator access, device pairing and troubleshooting |
| [Push setup](docs/SETUP_PUSH.md) | Web Push and Cloudflare configuration |
| [Reminder plan](docs/REMINDERS_PLAN.md) | Reminder scheduling design |
| [Privacy](PRIVACY.md) | Data handling and privacy information |

## Support

Use [GitHub Issues](https://github.com/hungdeniubeo/water-reminder-ios/issues) to report bugs or request improvements. Include the affected component, steps to reproduce, expected behavior and relevant browser or device information. Never include admin secrets, pairing codes or private notification content.

---

Designed for personal use with one administrator and one recipient.
