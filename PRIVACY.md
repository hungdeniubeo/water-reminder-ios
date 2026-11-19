# Privacy — Water ♡ (Beo Edition)

Last updated: November 19, 2026

Water is a one-person, installable hydration journal designed for a single iPhone 12 Pro Max.

## Data stored on the iPhone

Water logs, chosen daily goal, check-in notes about symptoms, and local display/language settings are stored in this iPhone's browser storage. They are not sent to Cloudflare. You can export or import a local JSON backup. Deleting the app or clearing website data may delete your local history; keep a backup before doing so.

## Optional lock-screen notifications

Only after you voluntarily activate Web Push does the Cloudflare Worker store a random device ID, a hash of its access token, subscription endpoint and encryption public keys, the notification message, language, time zone, and reminder schedule. The Worker can then send an encrypted, user-visible push through your browser's push service. It does not need or collect water-log entries, symptom notes, or daily totals.

The private activation code and VAPID private key are stored as Cloudflare Worker Secrets and must never be committed or pasted into chat. Disable notifications from the app to remove its subscription, or disconnect the iPhone to delete its Cloudflare device row. The existing D1 database name is `water-couple` but only one device is supported by this app.

## Other requests

GitHub Pages handles standard requests for static application files. There are no analytics or ad integrations. The service worker caches assets for offline use.

## Contact

Please use the repository Issues page for feedback: https://github.com/hungdeniubeo/water-reminder-ios/issues