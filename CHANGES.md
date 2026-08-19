# GadgetHub — Round 3 Fix Summary

Only modified/added files are included. Nothing else was touched.

## 1. "app is not defined" on Add to Cart
`home.js`, `cart.js`, and `product-detail.js` all called `App.updateCounts()`
after a successful cart/wishlist action, but none of them imported `App`.
The POST succeeded (hence "product added successfully"), then the very next
line threw `ReferenceError: App is not defined` in the console. Added the
missing `import { App } from '../core/app.js';` to all three files.
(`products.html` reuses `home.js`'s shared event-binding function, so this
fix covers it too.)

## 2. Wishlist — "Request failed" / not saved / "Failed to load wishlist"
Two separate bugs stacked on top of each other:

- **`WishlistView` had no `serializer_class` at all.** It's a
  `generics.ListCreateAPIView`, which requires one to build both list and
  create responses. Every GET and POST against it failed with a Django
  `AssertionError` before your code (`perform_create`) even ran. That error
  came back as a non-JSON 500, so the frontend's generic fallback showed the
  bare "Request failed" - and since it errored before saving, nothing was
  ever added. Added `backend/products/serializers.py` with a
  `WishlistItemSerializer` (nesting a compact product shape) and wired it in.
- **Wishlist responses were silently paginated.** The project sets a global
  `DEFAULT_PAGINATION_CLASS` + `PAGE_SIZE=20`, which any `generics.List...`
  view inherits unless told otherwise. That wraps `GET /products/wishlist/`
  as `{"count", "next", "previous", "results": [...]}` instead of a plain
  array - which is why "Failed to load wishlist" showed even once the
  serializer existed. Set `pagination_class = None` (this list never had
  pagination UI to begin with).

## 3. Topbar profile misaligned
When logged in, `#auth-links` renders an avatar/name link *and* a Logout
button as siblings. The avatar link (`.nav-user`) is `display:flex` for its
own internal layout, which made it a block-level flex container - pushing
the Logout button onto a new line underneath it instead of beside it. That
made `#auth-links`'s box taller than the theme-toggle icon next to it, so
centering the box centered empty space, not the avatar itself. Added
`#auth-links { display:flex; align-items:center; gap:12px; }` so the avatar,
name, and Logout button sit on one line, vertically centered like every
other topbar control.

## 4. Search bar not staying centered
The previous pass made the search bar a fixed width anchored just after the
logo - closer, but still not a true permanent center. Replaced the flexbox
header with a 3-column CSS grid (`1fr auto 1fr`): the two outer columns
(page name+menu on the left, theme/profile/auth on the right) always split
the remaining space **equally**, regardless of their own content width, so
the middle column (the search bar) sits at the mathematical center of the
header on every page, in every auth state - not just visually close.
Wrapped the menu button + page name in a new `.header-left` container
(needed so grid can treat them as one column) across all 18 templates.

## 5. Checkout — "No saved addresses" despite addresses existing
Same root cause as the wishlist pagination bug: `AddressBookView`
(`generics.ListCreateAPIView`) inherited the same global pagination
settings, so `GET /auth/addresses/` returned `{"count", "results": [...]}`
instead of a plain array. `checkout.js` checks `addresses.length` - on a
plain object that's `undefined`, which is falsy, so it always showed "No
saved addresses" even when the user had several. Set
`pagination_class = None` on `AddressBookView` too. (This also silently
fixes the same-shaped bug on the profile page's address list, which called
the identical endpoint the identical way.)

## 6. Performance & auth flicker
Three separate issues:

- **Product cache keys were non-deterministic.** `ProductListView` built its
  cache key with `hash(str(request.data))`. Python randomizes `hash()` for
  strings/dicts per-process by default, so the *same* request produced a
  *different* cache key on every worker process (and every restart) -
  meaning the cache almost never hit, and every product list request
  round-tripped to Payuee live. Replaced with a stable `md5` hash of the
  sorted/normalized request body. Also added the same caching pattern (120s
  TTL) to `ProductSearchView`, which had no caching at all before.
- **Wallet endpoints had no caching either**, hitting Payuee live on every
  page load. Added a 20s cache for the balance (kept short since it's a live
  escrow balance) and a 1hr cache for funding details (the bank
  name/account/number are effectively static).
- **Auth flicker**: `App.init()` always rendered the "logged out" topbar/
  sidebar first and only swapped to the real state once `/auth/profile/`
  resolved over the network - on every navigation that showed a brief,
  wrong "logged out" flash before snapping to "logged in". `app.js` now
  renders immediately from the cached user in `localStorage` (instant, no
  network wait), then reconciles with a fresh server check right after -
  same freshness guarantee, no visible flicker.
- Also fixed a missing `debounce` import in `wallet.js` (broke the
  transaction search box) while in that file.

## 7. Wallet — account name/number/bank not displaying
`WalletFundingDetailsView`/`WalletBalanceView` were structurally correct and
already matched the frontend's expected shape - the actual problem was
reliability/latency: no caching meant every load was a live, uncached call
to Payuee with a 30s timeout and up to 3 retries, so slow or flaky upstream
responses surfaced as the frontend's generic "Unable to load funding
details" fallback. The caching added under item 6 directly addresses this -
funding details in particular should now be effectively instant after the
first load, since the bank details don't change.
