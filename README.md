# PIID Registration & Multi-Showroom Check-In

Event registration for 500+ guests with QR ticketing and independent check-in at
four showrooms. Next.js (App Router) on Vercel, Supabase Postgres, Resend for email.

Built to the "PIID Registration & Multi-Showroom Check-In System" build spec,
Revision 2. Section numbers referenced in the code comments point back to it.

---

## What's here

```
app/
  page.js                    Guest registration page  ("/")
  admin/page.js              Showroom admin: sign-in → scanner  ("/admin")
  layout.js, globals.css     Shell, Tailwind layer, floating-label + status-card styles
  api/register/route.js      POST — validate, dedupe, insert, sign QR, email ticket
  api/check-in/route.js      POST — verify QR + log one scan.  GET — whose showroom is this?
  api/admin/export/route.js  GET  — organiser CSV export (token-gated)
components/
  RegistrationForm.js        The guest form and all of its states
  FormFields.js              Floating-label input / select / consent checkbox
  AdminLogin.js              Supabase Auth sign-in for showroom admins
  ScannerPanel.js            Camera + check-in request + running count
  ScanStatusCard.js          The big emerald / rose / amber verdict card
lib/
  supabaseServer.js          Service-role client + every database call  (server only)
  supabaseBrowser.js         Anon client — used ONLY to sign admins in
  qrToken.js                 HMAC-signed token create / verify / render
  validation.js              Every field rule; runs in the browser AND on the server
  professions.js             Dropdown options
  email.js                   Resend ticket email, retries once, never blocks success
  rateLimit.js               Token bucket for /api/register and /api/check-in
  adminAuth.js               Session → showroom resolution
  env.js, logger.js, showrooms.js
supabase/schema.sql          Run this once in the Supabase SQL editor
WIRE_FRAMES.md               Layout + brand reference
.env.example                 Every environment variable, annotated
```

Code conventions (build spec Section 15): every file opens with a header comment,
every function has a JSDoc block, long files are divided by
`// ===== SECTION: NAME =====` bookmarks, and functions are prefixed by role —
`db_` database, `api_` route handlers, `ui_` component helpers, `val_` validation,
`qr_`, `email_`, `rl_`, `env_`, `log_`. React components use `Ui` (capitalised,
because JSX only treats capitalised names as components).

Server logs are labelled for event day: `[REGISTER]`, `[CHECK-IN]`, `[EMAIL]`,
`[EXPORT]`, `[AUTH]` — searchable in Vercel → Deployments → Functions.

---

## Setup — start to finish

### A. Supabase

1. Create a project at supabase.com. From **Project Settings → API**, copy the
   **Project URL**, the **anon** key and the **service_role** key.
2. Open **SQL Editor → New query**, paste all of `supabase/schema.sql`, and Run.
   That creates both tables, both unique constraints, the reporting view, and
   turns on Row Level Security with no public policies.
3. **Authentication → Users → Add user** four times — one account per showroom
   (e.g. `showroom1@piidsummit.com`). Tick **Auto Confirm User**.
4. Back in the SQL Editor, run the four `update auth.users …` statements at the
   bottom of `supabase/schema.sql`, with your actual emails, to tag each account
   with its `showroom_name`. Verify with the `select` underneath them.
   **An account without this tag cannot scan** — the app will say so rather than
   guessing a showroom.
5. Before the event, upgrade to **Supabase Pro**. Free projects auto-pause after
   inactivity, and a paused database on the morning of the summit means no door.

### B. Resend (email)

1. Create a Resend account, add your sending domain, and add the SPF/DKIM records
   it gives you at your DNS provider. Generate an API key.
2. Test this **at least a week ahead**. An unverified domain lands in spam, and a
   spam-foldered ticket for a paid summit is a real problem, not a small one.
3. `RESEND_FROM` must use the verified domain, e.g. `PIID Summit <tickets@yourdomain.com>`.

### C. Git

```bash
git init && git add . && git commit -m "PIID registration app"
git remote add origin <your-repo-url> && git push -u origin main
```

`.env.local` is already in `.gitignore` — no keys will be committed.

### D. Vercel

1. **Add New → Project**, import the repo. The Next.js preset is detected; leave
   the build settings alone.
2. **Settings → Environment Variables** — add every variable from `.env.example`,
   to **Production, Preview and Development**. Do this *before* the first deploy.
3. Deploy. Use **Vercel Pro** for a client-facing event (Hobby restricts
   commercial use and custom domains).

### E. Verify on the live URL

1. Register a real test guest → the row appears in `registrants` and the ticket
   email arrives.
2. Sign in at `/admin` as Showroom 1 → the header must show **Showroom 1**.
3. Scan the ticket → emerald "WELCOME, {name}!" and a new `showroom_logs` row.
4. Scan the *same* ticket again → rose "ALREADY CHECKED IN" with the original time,
   and still only one row.
5. Sign in as Showroom 2 and scan the same ticket → emerald again. Guests check
   into each showroom independently; that is the design.
6. Turn wifi off and scan → **amber** "COULD NOT VERIFY — RETRY", never rose.
7. Register the same email twice → the inline "You're already registered" message
   under the Email field.

### F. Local development

```bash
npm install
vercel link              # connect this folder to the Vercel project
vercel env pull .env.local
npm run dev              # http://localhost:3000
```

Camera access needs HTTPS or localhost. To test the scanner from a phone, use the
deployed Vercel URL — a `http://192.168.x.x` address will not get camera permission.

### G. Export the guest list

```
https://your-app.vercel.app/api/admin/export?token=YOUR_ADMIN_EXPORT_TOKEN
```

Downloads a CSV of every registrant with a per-showroom scan-time column. This is
gated by `ADMIN_EXPORT_TOKEN`, deliberately separate from the showroom logins — a
door admin should not be able to download the whole guest list.

---

## Decisions worth knowing

**QR codes are signed, not just random.** The QR encodes `v1.<uuid>.<HMAC-SHA256>`.
`/api/check-in` verifies the signature before touching the database, so a forged or
copied-format code is rejected instantly. Keep `QR_SECRET` stable — changing it
after tickets are sent invalidates every ticket already in a guest's inbox.

**"Already checked in" is enforced by the database.** A unique index on
`(registrant_id, showroom_name)` is what decides it; the API treats the constraint
violation as the answer. Two tablets scanning the same ticket at the same instant
still produce exactly one row.

**The showroom comes from the session, never the browser.** `/api/check-in` reads
`showroom_name` from the signed-in admin's Supabase metadata, so scans cannot be
filed under the wrong showroom.

**Email never blocks registration.** If Resend fails, the guest still gets the
success card, their QR is shown on screen, `email_status` is set to `failed` in the
database, and `[EMAIL] ERROR …` appears in the logs with the registrant id so the
front desk can resend.

**RLS is on with zero policies.** The browser's anon key can do exactly one thing:
sign an admin in. All guest data moves through the serverless functions using the
service_role key, which never reaches the client bundle.

**Rate limiting is in-memory.** Good enough to stop bot floods and double-submits
without a paid dependency. If real bot traffic shows up in testing, swap the Map in
`lib/rateLimit.js` for Upstash Redis or add Cloudflare Turnstile to the form.

---

## Before the event

- [ ] Supabase upgraded to Pro so the database cannot auto-pause
- [ ] Sending domain verified and a real ticket email tested to Gmail *and* a work address
- [ ] All four showroom accounts signed in on their actual tablets, each showing the right showroom
- [ ] Full flow tested **on the venue wifi** — camera plus a flaky connection is the
      most likely real-world failure, and the amber retry state is what saves it
- [ ] Under the Data Privacy Act of 2012, check with the organisers whether the
      collection needs NPC registration at this scale. That's an organisational
      decision, not a code change, but it can affect what you're allowed to collect.
