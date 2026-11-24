# VibeChat Web Push — release checklist

This is a candidate, not an activated service. No secrets, scheduled worker, production subscription or delivery has been configured.

- Merge and apply the certified VibeChat conversation-tools dependencies first.
- Use the approved production migration process; do not repair history by hand.
- Set server-only VIBECHAT_PUSH_DISPATCH_SECRET (at least 32 random characters), VIBECHAT_VAPID_PRIVATE_KEY, VIBECHAT_VAPID_PUBLIC_KEY, VIBECHAT_VAPID_SUBJECT (mailto: contact); supply matching NEXT_PUBLIC_VIBECHAT_VAPID_PUBLIC_KEY on the web app.
- Deploy vibechat-push-dispatch with a secured server invocation; never expose the dispatch secret in the browser. The endpoint accepts POST and requires the secret even if the gateway verifies JWT. Commission a bounded scheduled dispatch only after exact-head tests and authorization.
- Run node --test scripts/test-vibechat-web-push.mjs; verify Deno/Web Crypto ES256 signing and actual delivery to Chrome Android, Firefox and installed iOS PWA. The design uses generic empty Web Push messages; confirm provider compatibility. Unsupported endpoints or permission denials must not be advertised as working.
- Verify two distinct accounts and devices; permission denied, muted, blocked, deleted, already read, revoked membership and signed-out session must suppress delivery. Test expiry, 429/5xx retry, lost worker lease and shared-browser sign-out.
- Confirm a background notification opens only /vibechat, contains no sender or text, and the opened app reauthenticates before revealing messages.
- Never claim background delivery until an actual closed-app notification is observed. In-app alerts are a separate fallback.
