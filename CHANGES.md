# GadgetHub — Fix Summary

Only modified/added files are included (same relative paths as the original project).
Nothing else in the codebase was touched.

## 1. Products not fetching correctly
- `backend/payuee/services.py` — `get_product_detail()` called `GET /products/{id}`
  (plural). Payuee's docs define this endpoint as singular: `GET /product/{id}`.
  The wrong path 404'd on every product-detail / related-products request. Fixed.
- `frontend/js/pages/products.js` — `loadProducts()` read `data.products`, but the
  API (backend passthrough of Payuee's `/v1/products` response) returns the array
  under `data.success`. This is why `/products.html` always rendered an empty grid
  even though the network call succeeded. `home.js` and `search.js` already used
  the correct key — only `products.js` had the mismatch. Fixed.

## 2. Profile image upload failing
- `frontend/js/pages/profile.js` — the upload handler referenced a bare `API_BASE`
  global that was never imported (it's a private `const` inside `api.js`), so every
  upload attempt threw a silent `ReferenceError` in the console before the request
  ever went out.
  - `frontend/js/core/api.js` now exports `API_BASE`.
  - `profile.js` imports it.
- `backend/utils/__init_.py` was misspelled (missing underscore), so `utils` wasn't
  a valid Python package on some platforms/import paths. Renamed to `__init__.py`.

## 3 & 9. Search not working / guests forced off products
Root cause (one bug, two symptoms): in `frontend/js/core/api.js`, **any** 401
response — including the routine "am I logged in?" check that runs on every page
load — immediately did `window.location.href = '/login.html'`. Guests always get a
401 from `/auth/profile/`, so **every guest visiting any page was redirected to
login before products or search results could ever load.**
- Added a `skipAuthRedirect` option to `API.request()`; `Auth.check()` now uses it,
  so a logged-out identity check just resolves to "no user" instead of bouncing the
  visitor to `/login.html`. Guests can now browse, search, and view products freely.
- `frontend/js/core/app.js` also called `debounce()` in the search-input handler
  without importing it from `api.js` — would have thrown as soon as someone typed,
  independent of the redirect bug. Fixed the import.
- The topbar search input (`#global-search`) only existed on `index.html`. Added to
  every page's header (see topbar section below) and wired up to navigate to
  `/search.html?q=...` on Enter, button click, or debounced typing.

## 4. Hard-coded template data → live Payuee data
No template in the project was found rendering hard-coded/mock product or order
data — `home.js`, `products.js`, `search.js`, and `product-detail.js` all already
call the Payuee-backed API endpoints. The only reason it *looked* hard-coded /
broken was the bugs above (empty grid from the wrong response key, and guests being
redirected away before any data-fetch could run). With those fixed, all product
surfaces now render live Payuee data end-to-end.

## 5, 6 & 7. Topbar / sidebar restructure
Applied consistently across all 18 storefront templates (every page except the
standalone auth pages and the admin dashboard, which don't use this chrome):
- **Topbar**: search bar on the left (next to the logo), theme toggle + profile /
  login-logout on the right, inside a shared `.header-actions` container. Several
  pages (`cart`, `checkout`, `orders`, `wallet`, `privacy`, `terms`, `returns`,
  `product-detail`, `profile`) were **missing the auth-links/login button
  entirely** — confirmed while auditing, now fixed along with the rest.
- **Old theme toggle removed** from the sidebar footer (`.sidebar-footer`) on every
  page — it now lives only in the topbar.
- **Sidebar user section**: added a `#sidebar-user` block under the sidebar logo
  that shows the logged-in user's avatar + full name (reusing the existing
  `.nav-user` styling already used in the topbar), or a "Sign in" prompt for
  guests.
- `frontend/js/core/app.js` (`updateNav`) now populates `#sidebar-user` the same
  way it already populated the topbar auth links.
- `frontend/css/main.css`: added `.sidebar-user` / `.sidebar-guest` styles, and
  restyled `.theme-toggle` from a full-width sidebar button into a compact icon
  button suited to the topbar.

## 8. Hide sidebar counts/badges when logged out
`App.updateCounts()` previously only ran `if (Auth.isAuthenticated())`, which meant
guests kept whatever the static HTML shipped with (visible "0" badges). It now
always runs, and explicitly hides the cart/wishlist badges whenever there's no
logged-in user.

## 10. White flash when navigating in dark mode
Classic FOUC: theme was only ever applied by `theme.js` after the page's JS
finished loading, so each navigation briefly painted the light theme first. Added a
small blocking inline `<script>` to every page's `<head>` (before first paint) that
reads the saved theme preference from `localStorage` and sets `data-theme`
immediately — `theme.js` still runs afterward as before, this just removes the gap.

## 11. Login/Register responsive
- `.form-group input/select/textarea` didn't have an explicit `width: 100%`
  (relied on flex-stretch, which is fragile) — made explicit.
- `.auth-page` / `.auth-container` now have `box-sizing: border-box` so padding is
  included in width calculations on narrow screens.
- Added a `max-width: 480px` tier that tightens `.auth-page`/`.auth-container`
  padding and shrinks the logo slightly for small phones, on top of the existing
  768px tablet breakpoint (which already collapses `register.html`'s two-column
  name fields to one column).

## 12. Validation / auth error messages
- `API.request()` in `api.js` only checked `data.error` / `data.detail`, so DRF
  field-validation responses (e.g. `{"email": ["This field is required."]}`) fell
  back to a generic "Request failed" toast with no useful information. Added
  `API.extractErrorMessage()` to build a readable message from field-level errors,
  `non_field_errors`, or a plain `message` key — this fixes error display for every
  form in the app (login, register, forgot/reset password, profile edit, password
  change, addresses, transaction PIN) since they all funnel through the same
  `API` class.
- `.toast` had no `max-width`/wrapping, so a long combined error message would
  overflow off-screen on mobile instead of being readable. Added `max-width`,
  `white-space: normal`, and `word-break` so long messages wrap and stay centered.
