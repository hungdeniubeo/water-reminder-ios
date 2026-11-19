# Water Reminder — Privacy Notes (V1)

**Last updated:** November 19, 2026

Water Reminder is a static Progressive Web App (PWA) designed for personal hydration tracking.

## Data kept on your device

The app stores water entries, daily goal, reminder preferences, and a record of the last displayed in-app reminder in your device's browser storage. It uses local storage only; there is no account, database server, cloud sync, or analytics in V1.

No water-intake records or preferences are sent to the developer by app code.

## Hosting and network access

The static app is hosted on GitHub Pages. When you visit or update it, GitHub may process normal website requests according to GitHub's policies. The app downloads its own files (HTML, CSS, JavaScript, manifest, and icons). It does not embed third-party tracking scripts.

## Offline use and retention

A service worker caches the app's static files after an initial online visit. Data you enter is stored separately in browser local storage. Your data **may be lost** if you clear website data, remove the Home Screen app, switch devices, or the browser clears storage.

Use **Settings → Export data** to save a local JSON backup, and **Restore file** to restore that backup on a device. Backups are handled locally; they are not uploaded to a server by the app.

## Notifications

V1 does not register for remote push notifications and does not ask for iOS notification permission. Optional reminder nudges only appear while the app is open.

A future version may introduce opt-in Web Push; its privacy terms will be updated before collecting push subscriptions.

## Control and deletion

You can remove individual entries from the Today screen. You can also clear this site's browser data to remove all local entries and settings. Backups saved to Files or elsewhere must be deleted separately.

## Questions

For feedback or issues, please use this project's [GitHub Issues](https://github.com/hungdeniubeo/water-reminder-ios/issues).
