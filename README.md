# GadgetHub

Enterprise-grade e-commerce storefront powered by [Payuee](https://payuee.com/doc/documentation)'s escrow infrastructure. Django REST Framework API on the backend, a dependency-free HTML/CSS/JS storefront on the frontend.

## Tech Stack

- **Backend:** Django 5 + Django REST Framework, JWT auth (cookie-based)
- **Frontend:** Vanilla HTML, CSS, JavaScript (ES modules, no build step, no framework)
- **Database:** MySQL
- **Cache:** Redis (`django-redis`)
- **Media Storage:** Backblaze B2 (S3-compatible), optional — falls back to local storage when disabled
- **Payments / Escrow / Products / Wallet:** Payuee API
- **Background jobs:** Celery
- **Deployment:** Render (backend) + Vercel (frontend)

## Project Structure

```
gadgethub-main/
├── backend/
│   ├── accounts/       # Users, auth, addresses, transaction PIN
│   ├── products/       # Product list/search/detail, cart, wishlist, categories
│   ├── orders/         # Checkout, shipping fees, order history
│   ├── wallet/         # Wallet balance, funding details, transactions
│   ├── notifications/  # In-app notifications
│   ├── support/        # Contact / support tickets
│   ├── dashboard/      # Aggregate stats for the admin dashboard
│   ├── webhooks/       # Payuee webhook receiver
│   ├── payuee/         # Payuee API client (auth signing, retries, all endpoints)
│   ├── utils/          # Shared helpers (e.g. media storage)
│   └── gadgethub/      # Django project settings/urls
└── frontend/
    ├── css/            # main.css, dark-mode.css
    ├── js/
    │   ├── core/       # api.js, app.js, auth.js, theme.js, ui.js
    │   └── pages/      # One module per page (home, products, cart, wallet, ...)
    ├── admin/          # Admin dashboard
    └── *.html          # One page per route (static, no routing framework)
```

## Backend Setup

```bash
cd backend
python -m venv venv
source venv/bin/activate      # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

Create `backend/.env` with the variables below, then:

```bash
python manage.py migrate
python manage.py runserver
```

The API is served at `http://localhost:8000/api/`.

### Environment Variables

| Variable | Required | Description |
|---|---|---|
| `SECRET_KEY` | Yes | Django secret key |
| `DEBUG` | No (default `False`) | `True` for local development |
| `ALLOWED_HOSTS` | No (default `localhost,127.0.0.1`) | Comma-separated hostnames |
| `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_HOST` | Yes | MySQL connection |
| `DB_PORT` | No (default `3306`) | MySQL port |
| `REDIS_URL` | No (default `redis://127.0.0.1:6379/0`) | Cache backend |
| `CORS_ALLOWED_ORIGINS` | Yes (prod) | Comma-separated frontend origins |
| `PAYUEE_API_KEY`, `PAYUEE_API_SECRET` | Yes | Payuee API credentials |
| `PAYUEE_BASE_URL` | No (default `https://escrow.payuee.com/v1`) | Payuee API base URL |
| `WEBHOOK_SECRET` | Yes | Verifies incoming Payuee webhooks |
| `PAYUEE_WEBHOOK_URL` | No | URL registered with Payuee for webhook delivery |
| `USE_S3` | No | `True` to store media on Backblaze B2 instead of locally |
| `B2_KEY_ID`, `B2_APPLICATION_KEY`, `B2_BUCKET_NAME`, `B2_ENDPOINT`, `B2_REGION` | Only if `USE_S3=True` | Backblaze B2 credentials |

## Frontend Setup

The frontend is static — no build step. Serve the `frontend/` directory with any static file server and point it at the backend API, e.g.:

```bash
cd frontend
python -m http.server 5500
```

Then open `http://localhost:5500`.

## Key API Endpoints

| Endpoint | Notes |
|---|---|
| `POST /api/products/list/` | Product listing, filters/sorts via Payuee, cached |
| `POST /api/products/search/` | Product search, cached |
| `GET /api/products/categories/` | Fixed Payuee category taxonomy (single source of truth for the storefront) |
| `GET /api/products/detail/<id>/` | Single product, cached |
| `GET/POST /api/products/wishlist/` | Wishlist (auth required) |
| `GET/POST/PATCH/DELETE /api/products/cart/` | Cart (auth required) |
| `GET/POST /api/auth/addresses/` | Saved delivery addresses (auth required) |
| `GET /api/wallet/balance/` | Live escrow wallet balance, short-lived cache |
| `GET /api/wallet/funding-details/` | Bank/account funding details, long-lived cache |
| `POST /api/orders/create/` | Places an order via Payuee |

## Notes for Contributors

- Every generic DRF list view (`ListCreateAPIView`, etc.) inherits the project's global `PAGE_SIZE=20` pagination unless it explicitly sets `pagination_class = None`. Small per-user lists with no pagination UI on the frontend (wishlist, addresses) must opt out, or the frontend will receive a paginated `{count, results}` object instead of the plain array it expects.
- Cache keys built from request bodies must use a stable hash (e.g. `hashlib.md5` over sorted JSON) — Python's built-in `hash()` is randomized per-process and will silently defeat caching across worker processes.
- Payuee has no "list categories" endpoint; the category taxonomy is a fixed set of values documented for the `category` filter. `ProductCategoriesView` is the single source of truth for it — don't hardcode category lists in the frontend.
