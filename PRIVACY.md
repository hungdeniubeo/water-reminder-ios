# Privacy notes — Water ♡ (Couple Edition V2)

_Last updated 19 November 2026_

Water is a personal hydration tracker for two people. It is a static PWA hosted on GitHub Pages and may optionally connect to a Cloudflare Worker to support Web Push and pairing.

## Without the optional backend

All water log entries, daily goal, language choice, message draft, reminder schedule and backups are stored locally on your device (localStorage). No personal data is sent by the app to a server. GitHub Pages processes standard website requests to serve static files under its own platform policies. No analytics, third-party trackers or advertising scripts are included.

## If you enable the couple connection

On explicit pairing, the Cloudflare Worker stores the minimal information required for two devices to coordinate:

- each person's display name, language, personal reminder schedule and IANA timezone;
- message each person chooses to send in the partner's reminder;
- today's **total** water intake and daily goal (not individual drink log entries);
- Web Push endpoint and public encryption keys for deliveries, notification opt-in state and deduplication timestamps;
- a one-way hash of each device's private token.

The device authentication token itself is stored locally and is **not** included in JSON backups. The secret VAPID private key and owner setup passphrase stay on the Cloudflare Worker as secrets.

Only paired devices with valid credentials should be able to read couple information. The service is intended for a private 2-person project, not a public social network. Cloudflare may log operational metadata subject to its terms.

## Notifications

Browser notification permission is requested only when you tap **Enable notifications** from the installed Home Screen app. Disable them in the app, or revoke permission in iPhone Settings. The server may still temporarily retain records if you stop using the app without disconnecting; use **Disconnect this device** to delete the server registration.

## Backups, clearing and deletion

Use **Settings → Export data** to save your detailed water history as a local JSON file. **Restore** replaces current logs and preferences. Removing the app, clearing browser data or switching devices can erase local records, so keep your own backup if needed. Delete backup files separately in Files/iCloud Drive if no longer wanted.

You can delete drink entries inside Today. You can disconnect your device in the Couple tab, which deletes its server record and push subscription; the remaining partner can pair another device. The server room disappears when both devices disconnect.

For questions, use [GitHub Issues](https://github.com/hungdeniubeo/water-reminder-ios/issues).