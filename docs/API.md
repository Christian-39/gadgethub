# GadgetHub API Reference

Base URL: `/api/`

All endpoints return JSON. Authenticated endpoints use an HttpOnly JWT
cookie (`access_token` / `refresh_token`) set by `/auth/login/` — no
`Authorization` header is required from the frontend. Unless noted
otherwise, an endpoint requires authentication (the project's DRF
default is `IsAuthenticated`); endpoints explicitly marked **Public**
allow guests.

Some list endpoints intentionally disable DRF's default pagination
(`pagination_class = None`) because the frontend expects a plain
array, not a `{count, next, previous, results}` object — this is
called out per-endpoint below.

---

## Auth — `/api/auth/`

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/register/` | Public | Create an account |
| POST | `/login/` | Public | Sets `access_token`/`refresh_token` cookies |
| POST | `/logout/` | ✓ | Clears auth cookies |
| POST | `/refresh/` | Public | Rotates the access token from the refresh cookie |
| GET | `/profile/` | ✓ | Current user's profile |
| PATCH | `/profile/` | ✓ | Update profile fields |
| POST | `/profile/picture/` | ✓ | Multipart upload — replaces `profile_picture` |
| GET/POST | `/addresses/` | ✓ | List/add saved delivery addresses. **Not paginated** — returns a plain array |
| GET/PATCH/DELETE | `/addresses/<id>/` | ✓ | Manage a single address |
| POST | `/change-password/` | ✓ | Requires current + new password |
| POST | `/forgot-password/` | Public | Sends a reset token/email |
| POST | `/reset-password/` | Public | Consumes a reset token |
| POST | `/transaction-pin/` | ✓ | Sets the 6-digit wallet transaction PIN |
| POST | `/verify-pin/` | ✓ | Verifies the PIN (used before placing an order) |

---

## Products — `/api/products/`

Product data is sourced live from Payuee and mirrored into a local
`ProductCache` table on read (list/search/detail) so cart, wishlist,
and orders can reference a stable local record. List/search/detail
responses are cached in Redis to avoid round-tripping to Payuee on
every request.

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/list/` | Public | Filtered/sorted product listing (body: category, sort, price range, page). Cached 5 min |
| POST | `/search/` | Public | Free-text product search. Cached 2 min |
| GET | `/categories/` | Public | Fixed category taxonomy (Payuee has no live "list categories" endpoint — this is the single source of truth for the storefront's category filters) |
| GET | `/detail/<product_id>/` | Public | Full product detail. Cached 10 min |
| GET | `/reviews/<product_id>/?page=` | Public | Product reviews (paginated by Payuee, not DRF) |
| POST | `/reviews/<product_id>/` | ✓ | Submit a review |
| GET/POST | `/wishlist/` | ✓ | List/add wishlist items. **Not paginated** — returns a plain array of `{id, product, created_at}` |
| DELETE | `/wishlist/` | ✓ | Body: `{ "product_id": <id> }` |
| GET | `/cart/` | ✓ | Current user's cart |
| POST | `/cart/` | ✓ | Body: `{ product_id, quantity, size? }` |
| PATCH | `/cart/<item_id>/` | ✓ | Update quantity |
| DELETE | `/cart/<item_id>/` | ✓ | Remove an item |

### `POST /products/list/` request body

```json
{
  "category": "gadgets",
  "sort_option": 5,
  "min_price": 0,
  "max_price": 1000000,
  "page": 1
}
```

### Wishlist item shape (`GET /products/wishlist/`)

```json
{
  "id": "…",
  "created_at": "…",
  "product": {
    "payuee_id": 92,
    "title": "…",
    "selling_price": "12500.00",
    "currency": "NGN",
    "images": ["…"],
    "stock_remaining": 4,
    "stock_status": "in-stock"
  }
}
```

---

## Orders — `/api/orders/`

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/shipping-fees/` | ✓ | Quote shipping per vendor for the current cart + a delivery address |
| POST | `/create/` | ✓ | Places the order. Requires a verified transaction PIN. May return `status: "hold"` if the wallet balance is insufficient |
| GET | `/list/` | ✓ | Order history |
| GET | `/detail/<order_id>/` | ✓ | Single order |
| POST | `/detail/<order_id>/cancel/` | ✓ | Cancel (where still allowed) |
| POST | `/detail/<order_id>/report/` | ✓ | Report an issue with an order |
| GET | `/detail/<order_id>/receipt/` | ✓ | Download the receipt |

---

## Wallet — `/api/wallet/`

The wallet is the shop's single Payuee escrow wallet (not per-user) —
funding it is how orders placed "on hold" get released. Both read
endpoints are cached: balance briefly, funding details much longer
since the bank account details don't change.

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/balance/` | ✓ | `{ balance, currency, formatted }`. Cached 20s |
| GET | `/funding-details/` | ✓ | Bank name / account number / account name to fund the wallet. Cached 1hr |
| GET | `/transactions/` | ✓ | Wallet transaction history |
| GET | `/receipt/<transaction_id>/` | ✓ | Download a transaction receipt |

---

## Notifications — `/api/notifications/`

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/` | ✓ | List notifications |
| POST | `/<notification_id>/read/` | ✓ | Mark one as read |
| POST | `/read-all/` | ✓ | Mark all as read |

---

## Support — `/api/support/`

| Method | Path | Auth | Description |
|---|---|---|---|
| GET/POST | `/tickets/` | ✓ | List/open support tickets |
| GET | `/faqs/` | Public | FAQ list |

---

## Dashboard — `/api/dashboard/`

Admin-only aggregate views backing `frontend/admin/`.

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/stats/` | ✓ (staff) | Headline metrics |
| GET | `/charts/` | ✓ (staff) | Chart data series |
| GET | `/recent-orders/` | ✓ (staff) | Recent order feed |
| GET | `/support-tickets/` | ✓ (staff) | Open support tickets |
| GET | `/webhook-logs/` | ✓ (staff) | Recent Payuee webhook deliveries |

---

## Webhooks — `/api/webhooks/`

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/payuee/` | Signature | Receives Payuee escrow/order events. Verified against `PAYUEE_WEBHOOK_SECRET`, not user auth |

---

## Error shape

Non-2xx responses generally look like one of:

```json
{ "error": "message" }
{ "detail": "message" }
{ "field_name": ["This field is required."] }
```

The frontend's `API.extractErrorMessage()` (`frontend/js/core/api.js`)
handles all three shapes, including DRF's per-field validation-error
format, and falls back to a generic message only when the response
body itself couldn't be parsed as JSON.
