# Web Push status — Water Couple V2

The push frontend, Worker sender, D1 schema, per-device schedules and private pairing flow are implemented in source code. **Deployment has not been completed**: Cloudflare must be set up and `PUSH_API_URL` configured before real lock-screen notifications work.

See the actionable one-time steps in **[SETUP_PUSH.md](./SETUP_PUSH.md)**.

Acceptance tests still to complete on actual iPhones:

- [ ] Cloudflare Worker/D1 deployed and a test push accepted by Apple's push service.
- [ ] Two Home Screen iOS 16.4+ PWAs paired using the 8-character code.
- [ ] Notifications permitted on each phone and test push received while phone is locked.
- [ ] Schedule and timezone verified, including after switching between VI/EN.
- [ ] Disable/re-enable notifications, Focus mode, offline recovery, reinstall and unpairing tested.

Until then, the fallback reminder is an in-app message only when Water is visible.