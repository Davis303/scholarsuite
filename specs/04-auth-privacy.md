# Spec 4 — Auth, Sessions & Privacy (both modules)

## Supabase Auth
- Sign up with email verification (redirect via `NEXT_PUBLIC_APP_URL`), sign in,
  forgot password, reset password, secure session handling, protected routes via
  `middleware.ts`, rate limiting on auth endpoints, input validation (zod).
- Passwords hashed by Supabase Auth (never handle raw passwords).
- **Remember-me**: "Keep me signed in" checkbox → persistent long-lived session;
  without it, shorter session lifetime. Implement via Supabase session persistence
  options; document behavior.
- **Per-device sessions**: account settings page lists active sessions (device info,
  IP, last active, current session highlighted) with per-session revoke and
  "Sign out of all devices".
- **Guest mode**: "Continue as guest" via Supabase anonymous sign-in. Guest data is
  session-scaped and temporary; auto-deleted on session end/expiry; UI shows upgrade
  prompts ("Create a free account to keep your work"). Guest → registered conversion
  via `supabase.auth.updateUser({ email, password })` preserving the user's rows
  (same `user_id`, so RLS keeps working).

## Privacy
- Strict per-user isolation via RLS on every table (`auth.uid() = user_id`).
- Private storage buckets; signed temporary download URLs only; no public file URLs.
- Server-side file validation: magic bytes + size limits (`MAX_UPLOAD_MB`), never
  trust extensions.
- `user_settings`: retention_days + auto_delete toggle; a scheduled cleanup route
  (`/api/cron/cleanup`, guarded by `CRON_SECRET`) deletes expired user data + storage
  objects; document it in DEPLOY.md (Vercel Cron).
- `audit_logs` entries for upload, delete, export, auth events.
- Privacy page: documents are private, belong to the user, never publicly accessible,
  deletable anytime, temp files auto-removed, never used for training without consent.
