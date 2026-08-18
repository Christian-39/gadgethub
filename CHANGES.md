# GadgetHub — Fix Summary

Only modified/added files are included (same relative paths as the original project).
Nothing else in the codebase was touched.

## Round 2 additions (this pass)

### Static topbar (search doesn't move, theme/profile/auth stay pinned right)
The topbar previously used `.mobile-logo { }` (no fixed width) followed by
`.search-bar { flex: 1 }`. Since every page had different text there
("⚡ GadgetHub" almost everywhere, but "Cart"/"Categories" on two pages), the
search bar's left edge - and everything after it - shifted position from page
to page. `.header-actions` was only "pinned right" as a side effect of the
search bar's flex-grow eating the remaining space.
- `css/main.css`: the page-name slot (`.main-header .mobile-logo`) is now a
  fixed `max-width: 200px` (140px at tablet) with ellipsis overflow, so its
  width never varies with the text. `.search-bar` is now a fixed width
  (420px, 260px at tablet) instead of `flex: 1`, so it never resizes either.
  `.header-actions` now has `margin-left: auto`, so it's explicitly pinned to
  the right edge of the header regardless of anything else on the page -
  rather than relying on the search bar's grow behavior to push it there.

### Logo/page-name reflects the current page
Only 2 of 18 pages showed a page-specific name in the topbar; the rest all
said the sitewide brand ("⚡ GadgetHub"), which is redundant with the sidebar
logo. Updated all 18 storefront pages so the topbar's fixed-width slot shows
the current page's name instead (Home, Products, Cart, Checkout, Wallet,
etc.) with a consistent "⚡" prefix.
- `product-detail.js` now updates that slot to the actual product's title
  once it loads (starts as the generic "Product" label so it's never blank).
- `search.html`'s inline script now updates it to show the active search
  query once a search has been run.

### Hardcoded categories removed
Payuee's docs don't expose a "list categories" endpoint - the category
taxonomy is a fixed, documented set of values (`outfits`, `jewelry`,
`kids-accessories`, `cars-car-parts`, `tools`, `gadgets`, `others`) accepted
by the `category` filter on `/v1/products` and `/v1/products/search`. Three
different files each hardcoded their own (inconsistent) copy of this list:
`home.js`'s homepage strip, `categories.html`'s full grid, and
`products.html`'s filter dropdown.
- Added `GET /api/products/categories/` (`ProductCategoriesView` in
  `backend/products/views.py`) as the single source of truth for this
  taxonomy, backed directly by Payuee's documented category values.
- `home.js`, `categories.html` (now JS-populated instead of static markup),
  and `products.js` (filter dropdown) all fetch from this one endpoint
  instead of hardcoding their own lists.
- `products.js` also now sets the category `<select>`'s value from the URL
  *after* its options are populated (previously would've silently failed to
  reflect a category coming in from a category-card link).

### Two more bugs found in passing (same files being edited)
- `products.js` called `HomePage.bindProductEvents(container)` after every
  product load, but never imported `HomePage` - this threw silently and
  meant Add to Cart / Wishlist / click-to-detail never got wired up on
  `/products.html`. Fixed the import.
- `product-detail.js`'s `loadRelated()` called `lazyLoadImages()` without
  importing it - related-product images never lazy-loaded. Fixed the import.

---

## Round 1 (previous pass)

### 1. Products not fetching correctly
- `backend/payuee/services.py`: `get_product_detail()` called `GET /products/{id}`
  (plural). Payuee's docs define this endpoint as singular: `GET /product/{id}`.
  The wrong path 404'd on every product-detail / related-products request.
- `frontend/js/pages/products.js`: `loadProducts()` read `data.products`, but the
  API returns the array under `data.success`. This is why `/products.html`
  always rendered an empty grid even though the network call succeeded.

### 2. Profile image upload failing
- `frontend/js/pages/profile.js` referenced a bare `API_BASE` global that was
  never imported. `api.js` now exports `API_BASE`; `profile.js` imports it.
- `backend/utils/__init_.py` was misspelled (missing underscore) - renamed to
  `__init__.py`.

### 3 & 9. Search not working / guests forced off products
Root cause: in `js/core/api.js`, any 401 - including the routine "am I logged
in?" check on every page load - immediately redirected to `/login.html`.
Guests always get a 401 from `/auth/profile/`, so every guest visiting any
page was bounced to login before products/search could load.
- Added `skipAuthRedirect` to `API.request()`, used by `Auth.check()`, so a
  logged-out identity check resolves to "no user" instead of redirecting.
- `app.js` also called `debounce()` without importing it.
- The topbar search input only existed on `index.html` - now on every page.

### 4. Hard-coded template data → live Payuee data
`home.js`, `products.js`, `search.js`, `product-detail.js` already called the
Payuee-backed endpoints; the only reason it looked hardcoded was the bugs
above. (This pass also removed the hardcoded *categories* - see Round 2.)

### 5, 6 & 7. Topbar / sidebar restructure
Search bar + theme toggle + profile/login-logout standardized across all 18
storefront templates (several pages were missing auth-links entirely). Old
theme toggle removed from the sidebar footer. Added a `#sidebar-user` block
(avatar + full name for logged-in users, "Sign in" prompt for guests),
populated by `app.js`.

### 8. Hide sidebar counts/badges when logged out
`App.updateCounts()` now always runs and explicitly hides cart/wishlist
badges when there's no logged-in user, instead of leaving default "0"s
visible.

### 10. White flash when navigating in dark mode
Added a blocking inline `<script>` in every page's `<head>` that applies the
saved theme from `localStorage` before first paint.

### 11. Login/Register responsive
Explicit `width: 100%` + `box-sizing: border-box` on auth inputs/containers,
plus a `max-width: 480px` tier tightening padding for small phones.

### 12. Validation / auth error messages
`API.request()` only checked `data.error`/`data.detail`. Added
`API.extractErrorMessage()` to build a readable message from DRF field
validation errors, `non_field_errors`, etc. - fixes error display across
every form (login, register, password reset, profile, checkout, etc.) since
they all go through the same `API` class. Also widened `.toast` to wrap long
messages instead of overflowing off-screen on mobile.
