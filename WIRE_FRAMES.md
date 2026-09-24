# WIRE_FRAMES.md — Layout & Brand Reference

Wireframe and art-direction reference for the PIID Summit registration and
multi-showroom check-in app. Build Spec Sections 1 and 2.

---

## 1. Registrant Form — `/` (`app/page.js` + `components/RegistrationForm.js`)

Centered card on a light neutral canvas, with soft coloured accent washes behind it.

```
┌──────────────────────────────────────────────┐
│           ● ● ● ●   PIID SUMMIT              │  ← 4 accent dots + event name
│                                              │
│  ┌────────────────────────────────────────┐  │
│  │ WELCOME                                │  │  ← eyebrow, sky blue, tracked
│  │ Register now                           │  │  ← 48px extrabold
│  │ One form, one QR ticket…               │  │
│  │                                        │  │
│  │ ┌────────────────────────────────────┐ │  │
│  │ │ Full Name                          │ │  │  ← floating label (raised when filled)
│  │ │ Karylle Kho                        │ │  │
│  │ └────────────────────────────────────┘ │  │
│  │ ┌────────────────────────────────────┐ │  │
│  │ │ Interior Design Firm / Company     │ │  │
│  │ └────────────────────────────────────┘ │  │
│  │ ┌────────────────────────────────────┐ │  │
│  │ │ Profession / Position          ⌄   │ │  │  ← dropdown
│  │ └────────────────────────────────────┘ │  │
│  │ ┌────────────────────────────────────┐ │  │
│  │ │ Please specify your profession     │ │  │  ← ONLY when "Others" is chosen
│  │ └────────────────────────────────────┘ │  │
│  │ ┌────────────────────────────────────┐ │  │
│  │ │ Email Address                      │ │  │
│  │ └────────────────────────────────────┘ │  │
│  │  ⚠ Enter a valid email address         │  │  ← inline error, directly under its field
│  │ ┌────────────────────────────────────┐ │  │
│  │ │ Mobile Number                      │ │  │  ← auto-formats as 0917 123 4567
│  │ └────────────────────────────────────┘ │  │
│  │ ┌────────────────────────────────────┐ │  │
│  │ │ City or Area of Practice           │ │  │
│  │ └────────────────────────────────────┘ │  │
│  │ ┌────────────────────────────────────┐ │  │
│  │ │ ☐ I agree to the collection of…    │ │  │  ← required consent + privacy note
│  │ └────────────────────────────────────┘ │  │
│  │                                        │  │
│  │ [        S U B M I T        ]          │  │  ← disabled until every rule passes
│  └────────────────────────────────────────┘  │
└──────────────────────────────────────────────┘
```

**Success card** replaces the form in place: emerald check mark, `WELCOME, {FIRST NAME}!`,
the QR code on screen (so the guest has their ticket even if the email is slow),
and — when the email failed — an amber line telling them to see the registration desk.

---

## 2. Admin Scanner — `/admin` (`app/admin/page.js`)

### 2a. Sign-in

```
┌────────────────────────────────┐
│ ADMIN                          │
│ Sign in                        │
│ Use your showroom's account…   │
│ ┌────────────────────────────┐ │
│ │ Showroom Email             │ │
│ └────────────────────────────┘ │
│ ┌────────────────────────────┐ │
│ │ Password                   │ │
│ └────────────────────────────┘ │
│ [          E N T E R         ] │
└────────────────────────────────┘
```

The admin never picks their showroom here — it comes from their Supabase account
metadata, resolved server-side.

### 2b. Scanner (split layout: camera left/top, verdict right/bottom)

```
┌──────────────────────────────────────────────────────────────┐
│ SCANNING FOR            Showroom 2      CHECKED IN  47  [out] │
│ showroom2@piidsummit.com                                     │
└──────────────────────────────────────────────────────────────┘
┌───────────────────────────┐  ┌───────────────────────────────┐
│ LIVE CAMERA SCANNER    ●  │  │                               │
│ ┌───────────────────────┐ │  │            ✓                  │
│ │                       │ │  │   CLEARED FOR ENTRY           │
│ │   [ camera viewport ] │ │  │   WELCOME, MARIA!             │
│ │         (+)           │ │  │                               │
│ │   tap to activate     │ │  │   ← emerald, massive type     │
│ └───────────────────────┘ │  │                               │
│ [ Stop camera ]           │  └───────────────────────────────┘
└───────────────────────────┘
```

Status card states, all in the same slot:

| State | Colour | Headline |
|---|---|---|
| Ready | white / grey | Point the camera at a QR ticket |
| Checking | white / grey | Checking… (previous result cleared first) |
| Valid | emerald | WELCOME, {FIRST NAME}! |
| Already scanned here | rose | ALREADY CHECKED IN + original scan time |
| Unknown ticket | rose | TICKET NOT RECOGNIZED (no guest details shown) |
| Network / server error | amber | COULD NOT VERIFY — RETRY + retry button |

The amber state exists so that an offline moment never looks like a rejected guest.

---

## 3. Colour Palette

| Role | Colour | Token |
|---|---|---|
| Primary accent | Vibrant Sky Blue `#3b82f6` | `piid-blue` |
| Accent | Energetic Orange `#f97316` | `piid-orange` |
| Success | Deep Emerald `#10b981` | `piid-emerald` |
| Accent | Rich Magenta `#a855f7` | `piid-magenta` |
| Canvas | Light neutral `#f4f4f5` | `canvas` |
| Surfaces | White cards, `rounded-3xl`, `shadow-card` | — |
| Warning / already scanned | rose-50 / rose-500 ring | Tailwind default |
| Pending / retry | amber-50 / amber-500 ring | Tailwind default |

Status colours are used as dark text on a light tint with a coloured ring, which
keeps every combination above the WCAG AA 4.5:1 contrast threshold.

---

## 4. Motion & Interaction

- Floating labels glide up on focus or fill: `transition-all duration-300 ease-in-out`.
- New cards and revealed fields use `animate-pop-in` (fade + 12px rise, 300ms).
- Buttons lift 2px on hover; disabled buttons do not move.

## 5. Responsiveness & Accessibility

- Mobile-first. Single column under `lg`; the scanner splits into two columns above it.
- Verified: no horizontal overflow at 390px width.
- Every control is keyboard reachable with a visible focus ring — showroom staff may
  be on a tablet with a bluetooth scanner rather than a touchscreen.
- Floating labels are real `<label htmlFor>` elements, so they stay in the
  accessibility tree. Errors use `aria-invalid`, `aria-describedby` and `role="alert"`.
