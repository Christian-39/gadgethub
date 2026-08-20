# GadgetHub — Fix Summary (this pass)

Only modified/created files are included.

## Bugs fixed en route to the requested items

- **`settings` not defined on Place Order** — `django.conf.settings`
  was never imported in `orders/views.py`, but used to build the
  Payuee webhook URL. Fixed.
- **Backend never actually verified the transaction PIN** —
  `CreateOrderView` only checked that a PIN existed, then forwarded
  whatever the user typed straight to Payuee with no local check at
  all. Added an authoritative `check_password()` gate before any
  order/Payuee calls happen.
- **`/auth/verify-pin/` existed but was never called from anywhere** —
  now wired into checkout for real-time validation.
- **`.address-card` was defined twice for two different components**
  — checkout's radio-select card (flex-row: radio + info) and
  profile's management card (stacked: header/4 paragraphs/actions)
  shared one class name. The second definition never overrode
  `display: flex`, so profile's 6-child card was being forced into a
  horizontal row — the actual cause of the address section's mobile
  horizontal scroll. Renamed profile's version to
  `.address-manage-card` so the two can't collide again.
- **Edit button on saved addresses did nothing** — `.btn-edit-address`
  was rendered but never had a click handler. Implemented a full
  edit flow (see below).
- **`.main-content`'s mobile padding-bottom was being wiped out** —
  the `@media (max-width:768px)` rule's `padding: 16px` shorthand
  reset all four sides, silently discarding the base rule's reserved
  space for the fixed bottom nav. This is why content was rendering
  underneath it on mobile.
- **`.lazy-img` had no CSS at all** — no reserved size, no fade-in,
  so images popped in abruptly instead of loading smoothly.

## 1. Cart mobile responsiveness
`.cart-item` had no mobile override at all - image + info + qty
controls + total + remove button all had to fit in one fixed-width
row, forcing horizontal scroll on any phone. Added a `max-width:640px`
rule that wraps into two rows (product on top, quantity/total/remove
below) with `min-width:0`/`overflow-wrap` on the title so long names
wrap instead of overflowing.

## 2. Mobile topbar alignment
Root cause: the header's `1fr auto 1fr` grid columns had no width
floor, so on a narrow phone the left column (menu button + page name)
could grow past its fair share and push the right column (profile/
auth) out of place. Changed both outer columns to `minmax(0, 1fr)` so
they're always genuinely equal regardless of content, and hid the
profile name text under 480px so the right side never needs to
squeeze in the first place.

## 3. Mobile bottom navigation
Fixed the padding-bottom bug above (content no longer hides behind
it), and gave each `.mobile-nav a` `flex:1; height:100%;` so the
whole cell is tappable instead of just the icon+label - a much bigger
tap target without growing the bar's height.

## 4. Wishlist removed from mobile bottom nav
Replaced with Search (which didn't previously appear there at all)
across all 18 storefront pages. Wishlist itself is untouched -
`wishlist.html`, the API, and the topbar/profile access to it all
still work exactly as before.

## 5. Transaction PIN immediate validation
`checkout.js` now verifies the PIN via `/auth/verify-pin/` as soon as
6 digits are entered (not on every keystroke before that), shows
inline valid/invalid styling + a message, and re-verifies if the user
edits the value afterward. A network failure while checking is
treated as "unknown" (not "wrong") so Place Order still gets a real
answer from the server rather than a false rejection. Place Order
itself still performs the full flow regardless of the live check's
result — and now, per the backend fix above, that flow includes a
real server-side PIN check for the first time.

## 6. Payuee states/cities for addresses
`payuee.get_states()`/`get_cities()` already existed in the service
layer but nothing called them. Added `GET /api/auth/states/` and
`GET /api/auth/cities/?state=` (both cached 24h - this data changes
essentially never). `profile.html`'s address form now uses selects
instead of free-text inputs: City stays disabled until a State is
picked, changing State clears and reloads City, and the returned
per-ward latitude/longitude gets captured into hidden fields and
submitted with the address (the model already had `latitude`/
`longitude` columns, previously unused by this form) — which also
improves shipping-fee accuracy at checkout, since it no longer has to
fall back to a hardcoded Lagos coordinate for addresses added this
way.

Also implemented the previously-missing address **edit** flow: the
same form repopulates with the address's saved values, awaits the
correct state's cities before trying to select the saved city
(avoiding the race condition), and submits a PATCH instead of a POST.
A Cancel button returns the form to "add new" mode.

## 7. Profile address responsiveness
Covered by the `.address-card` collision fix above, plus
`overflow-wrap: break-word` on address text and `flex-wrap: wrap` on
the header/actions rows so long addresses/phone numbers and the
button row don't force overflow.

## 8. Profile summary cards
Cart/Wishlist/Orders cards used `justify-content: space-around` with
`min-width: auto` on mobile - nothing stopped them from being
squeezed arbitrarily thin. Switched to a `grid-template-columns:
repeat(3, 1fr)` layout so each card gets an equal, roomy share of the
width instead of shrinking to fit.

## 9. Profile name/email/phone alignment
The mobile rule centered `.profile-header` as a whole (avatar and
text both), with `text-align: center` cascading into the name/email/
phone. Kept the avatar centered (normal for this layout) but gave
`.profile-info` its own full-width, explicitly left-aligned block so
the text no longer inherits the centering. Desktop is unchanged.

## 10. General responsive audit
Also fixed while sweeping the affected pages:
- `.checkout-item`'s info div had no `min-width:0`, so a long product
  title could push the row wider than the sticky checkout sidebar.
- `.order-header` (order ID + status badge) had no `flex-wrap`, so a
  long order ID could force the badge off-row on narrow screens.
- Confirmed `.filters-panel`, `.cart-summary`/`.checkout-summary`
  sticky positioning, and `.products-page`'s grid already correctly
  drop to `position: static` / single column at ≤1024px (existing
  rule, no change needed).

## Also (from the previous message, finished here)
- Category product counts: `GET /products/categories/` now returns a
  cached `count` per category (from Payuee's `pagination.AllRecords`),
  rendered in both `home.js`'s strip and `categories.html`'s full grid.
- `.lazy-img` fade-in/reserved-space fix (see above).
