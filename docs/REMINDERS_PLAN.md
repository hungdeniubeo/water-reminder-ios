# Background reminders — implementation plan

## Current scope (V1)

The PWA is hosted as static files on GitHub Pages. Users can set a start time, end time, and interval. While the PWA is **open and visible**, a JavaScript timer displays an in-app message when it reaches a scheduled minute. This is **not** an iOS push notification and is **not reliable when the PWA is closed, locked, or suspended**.

The interface deliberately communicates that limitation. Do not add a notification permission prompt until a working push backend exists.

## Goal for V2

Deliver opt-in iPhone lock-screen reminders at user-configured times, including when the Home Screen PWA is not open, with no mandatory subscription costs for a small personal deployment.

### Platform requirements

- iOS or iPadOS **16.4+** and a Home Screen-installed web app.
- HTTPS origin, a valid web app manifest, and a working service worker.
- The user explicitly taps **Enable notifications** (permission request must follow user interaction).
- Service worker handling for \`push\` and \`notificationclick\`.
- Push API subscription and a backend holding VAPID signing keys.
- A sender outside GitHub Pages. GitHub Pages can host a static frontend but cannot periodically send push notifications.

Reference: [WebKit: Web Push for Web Apps on iOS and iPadOS](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/) and [Apple: Sending web push notifications](https://developer.apple.com/documentation/usernotifications/sending-web-push-notifications-in-web-apps-and-browsers).

### Proposed free-tier architecture

\`\`\`text
iPhone Home Screen PWA (GitHub Pages)
    ├── saves water logs and goals locally
    └── subscribes to Web Push (explicit user action)
                    |
                    v
          Cloudflare Worker API
                    |
                    v
          Cloudflare D1 database
          subscription + timezone + schedule
                    ^
                    |
          Worker Cron Trigger
            checks due reminders
                    |
                    v
          standard Web Push endpoint
                    |
                    v
      iPhone lock screen / Notification Center
\`\`\`

Use a dedicated Cloudflare account's free tier for experimentation. Pricing, quotas, scheduled execution, and delivery times are **not guaranteed forever**. Inspect current free-tier quotas before enabling deployment. Do not store VAPID private keys or push subscriptions in a public GitHub repo.

### Suggested milestones

1. **Backend proof of concept:** Create VAPID keys; store the private key only as a backend secret. Send one manual encrypted test push to a subscribed test iPhone.
2. **Opt-in experience:** Show a clear explanation of why notifications are requested; only ask permission after the user taps Enable. Offer Disable and Re-enable actions.
3. **Subscription persistence:** Create a minimal Worker endpoint to register/update/delete a subscription, schedule, and IANA timezone (for example, \`Asia/Ho_Chi_Minh\`). Authenticate each installation with an unpredictable per-device secret, store only its hash server-side, and add rate limits / abuse controls.
4. **Scheduler:** Add a Cron Trigger that checks due reminders. Calculate times in each user's configured timezone, handle daylight saving changes, and deduplicate a \`subscription_id + local_time_slot\` before sending. Use delivery intervals compatible with scheduler resolution.
5. **Clean-up:** Delete subscriptions after push endpoint \`404\` or \`410\` responses and when a user disables reminders. Avoid sending repeated missed reminders after the device was offline.
6. **iPhone verification:** Test app closed, screen locked, offline/online transitions, iOS Focus, permission denied, reinstall, service-worker updates, and timezone changes.

### User privacy and security

- Water logs and daily totals remain local to the device.
- The server stores only the push endpoint, associated public encryption keys, opt-in state, timezone, and reminder schedule needed to deliver notifications.
- Provide a **delete subscription** action. Do not include personal health information in push messages.
- Protect registration endpoints against spam and unauthorized schedule modifications; do not expose VAPID private keys.
- Provide a clear privacy-policy update before enabling server-side storage.
- Allow the app to keep working if the push backend is down.

### Expected user-facing experience

- **Notifications off:** reminders are disabled.
- **In-app reminders:** work only while app is visible (V1 fallback).
- **Background push enabled:** iOS can show lock-screen notifications when delivery succeeds, subject to iOS notification permissions, Focus, connectivity, and platform scheduling behavior.
- **Push denied/unavailable:** present a helpful explanation instead of claiming background reminders work.

## V2 acceptance criteria

- Opt-in is only triggered by a user tap.
- A subscribed iPhone receives a manually triggered push after the PWA is closed.
- Scheduled pushes respect start, end, interval, and timezone.
- A given reminder slot is sent at most once per subscription.
- Disabling reminders stops further pushes and removes the server record.
- No water-intake history is uploaded.
- The free-tier service can be monitored for rate-limit or quota exhaustion.
