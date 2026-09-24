# Fix pack — "Something went wrong" and admin sign-in refused

Six files changed. Copy each one over the same path in your project, commit, and
let Vercel redeploy. Then open **`https://your-app.vercel.app/api/health`**.

| File | What changed |
|---|---|
| `app/api/health/route.js` | **NEW** — setup diagnostics. Tells you which variable is missing, whether the database is reachable, and whether your four admin accounts exist, are confirmed, and carry a `showroom_name`. Never prints a key's value. |
| `lib/env.js` | Added `env_requireAny()` so a variable can be satisfied by either of two names. |
| `lib/supabaseServer.js` | The Supabase URL and anon key now accept either the plain or the `NEXT_PUBLIC_` spelling. Setting only one of the pair used to fail as a fake "session expired". |
| `app/admin/page.js` | A verified-but-rejected session now says it is a configuration problem instead of silently bouncing back to the login screen, which looked exactly like a wrong password. |
| `components/AdminLogin.js` | "Invalid login credentials" now names the three setup mistakes that actually cause it. |
| `app/api/register/route.js` | A missing `QR_SECRET` no longer escapes as a bare 500; it is logged as `[REGISTER] ERROR could not sign QR token`. |

## Read the health report

`ok: true` means the configuration is sound. Otherwise read `problems` — it is
written in plain sentences. The parts to look at:

- **`env`** — `set: false` on anything means Vercel does not have it *in the
  running deployment*.
- **`database.reachable`** — `false` with a message like `relation "public.registrants"
  does not exist` means `schema.sql` ran in a different project than the keys point at.
- **`adminAccounts.users`** — this is the one that answers your login question.
  Each account shows `email_confirmed` and `showroom_name`. An empty list means
  the accounts are in a different Supabase project than this site is using.

## The four things that cause "invalid login credentials"

1. **The account was invited, not created with a password.** In Supabase,
   Authentication → Users → Add user offers "Create new user" *and* "Send
   invitation". An invited user has no password, so every sign-in is refused.
   Fix: open the user → Reset password, or delete and re-create with a password.
2. **The account is unconfirmed.** Create users with "Auto Confirm User" ticked.
   `adminAccounts.users[].email_confirmed` shows this.
3. **Two different Supabase projects.** The keys in Vercel belong to project A;
   the admin accounts were created in project B. `adminAccounts` will be empty.
4. **The password is genuinely different.** Reset it in the dashboard.

Note that a user created with `INSERT INTO auth.users` in the SQL editor can
never sign in — Supabase hashes passwords through its auth service, not through
SQL. The accounts must be made in the Authentication → Users screen. Only the
`update auth.users set raw_user_meta_data ...` statements at the bottom of
`schema.sql` should be run in SQL, and only *after* the users exist.

## Environment variables only apply to new deployments

This is the most common cause of both symptoms at once. Adding a variable in
Vercel → Settings → Environment Variables does **not** change the deployment
that is already running. After adding or editing any variable, go to
Deployments → the latest one → ⋯ → **Redeploy**.

`NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` matter most here:
they are compiled into the browser bundle at build time, so without a redeploy
the admin page is still running with no Supabase connection at all.

## After it works

`/api/health` lists your admin emails, so once setup is confirmed you can delete
`app/api/health/route.js` and redeploy if you would rather not leave it exposed.
