import hashlib
import hmac
import json
import logging
import time
import uuid
from urllib.parse import urlsplit

import requests
from django.conf import settings


logger = logging.getLogger("payuee")


class PayueeService:
    BASE_URL = settings.PAYUEE_BASE_URL.rstrip("/")
    PUBLIC_KEY = settings.PAYUEE_API_KEY
    SECRET_KEY = settings.PAYUEE_API_SECRET
    WEBHOOK_SECRET = settings.PAYUEE_WEBHOOK_SECRET

    SENSITIVE_KEYS = {
        "password",
        "secret",
        "api_key",
        "api_secret",
        "authorization",
        "access_token",
        "refresh_token",
        "token",
        "signature",
        "encrypted",
        "webhook_secret",
        "private_key",
    }

    def _sanitize_data(self, value):
        """Recursively redact sensitive values before logging."""
        if isinstance(value, dict):
            result = {}
            for key, item in value.items():
                key_lower = str(key).lower()

                if (
                    key_lower in self.SENSITIVE_KEYS
                    or any(
                        sensitive in key_lower
                        for sensitive in self.SENSITIVE_KEYS
                    )
                ):
                    result[key] = "[REDACTED]"
                else:
                    result[key] = self._sanitize_data(item)

            return result

        if isinstance(value, list):
            return [self._sanitize_data(item) for item in value]

        if isinstance(value, tuple):
            return tuple(self._sanitize_data(item) for item in value)

        return value

    def _safe_json_for_log(self, value, max_length=4000):
        """Serialize data safely for logging."""
        try:
            sanitized = self._sanitize_data(value)

            text = json.dumps(
                sanitized,
                ensure_ascii=False,
                default=str,
            )

            if len(text) > max_length:
                return text[:max_length] + "...[TRUNCATED]"

            return text

        except Exception as exc:
            logger.exception(
                "Payuee logging serialization failed: %s",
                exc,
            )
            return "[UNABLE TO SERIALIZE DATA]"

    def _generate_signature(self, method, request_path, body=""):
        """
        Payuee signature format:

            timestamp + UPPERCASE(method) + request_path + request_body

        The request_path MUST include /v1, e.g. /v1/products.
        """
        timestamp = str(int(time.time()))

        payload = (
            f"{timestamp}"
            f"{method.upper()}"
            f"{request_path}"
            f"{body}"
        )

        logger.debug(
            "Payuee signature input | "
            "timestamp=%s | method=%s | request_path=%s | "
            "body_length=%s",
            timestamp,
            method.upper(),
            request_path,
            len(body),
        )

        if not self.SECRET_KEY:
            logger.error(
                "Payuee signature generation failed: "
                "PAYUEE_API_SECRET is empty."
            )
            raise ValueError(
                "PAYUEE_API_SECRET is not configured."
            )

        signature = hmac.new(
            self.SECRET_KEY.encode("utf-8"),
            payload.encode("utf-8"),
            hashlib.sha256,
        ).hexdigest()

        logger.debug(
            "Payuee signature generated successfully "
            "(signature value intentionally hidden)."
        )

        return timestamp, signature

    def _headers(self, method, request_path, body=""):
        timestamp, signature = self._generate_signature(
            method,
            request_path,
            body,
        )

        idempotency_key = str(uuid.uuid4())

        if not self.PUBLIC_KEY:
            logger.error(
                "Payuee authentication configuration error: "
                "PAYUEE_API_KEY is empty."
            )
            raise ValueError(
                "PAYUEE_API_KEY is not configured."
            )

        if not self.SECRET_KEY:
            logger.error(
                "Payuee authentication configuration error: "
                "PAYUEE_API_SECRET is empty."
            )
            raise ValueError(
                "PAYUEE_API_SECRET is not configured."
            )

        logger.debug(
            "Payuee authentication headers prepared | "
            "public_key_configured=%s | "
            "secret_configured=%s | "
            "signature_configured=%s | "
            "idempotency_key=%s",
            bool(self.PUBLIC_KEY),
            bool(self.SECRET_KEY),
            bool(signature),
            idempotency_key,
        )

        return {
            "Authorization": f"Bearer {self.SECRET_KEY}",
            "X-Payuee-Public-Key": self.PUBLIC_KEY,
            "X-Payuee-Timestamp": timestamp,
            "X-Payuee-Signature": signature,
            "X-Payuee-Idempotency-Key": idempotency_key,
            "Content-Type": "application/json",
        }

    def _parse_response(self, response):
        """Safely parse a Payuee response."""
        content_type = (
            response.headers.get("Content-Type", "")
            .lower()
        )

        if not response.content:
            logger.debug(
                "Payuee returned an empty response body."
            )
            return {}

        if "application/json" in content_type:
            try:
                return response.json()
            except ValueError:
                logger.error(
                    "Payuee returned invalid JSON | "
                    "status=%s | content_type=%s | body=%s",
                    response.status_code,
                    content_type,
                    response.text[:4000],
                )
                raise

        logger.warning(
            "Payuee returned non-JSON response | "
            "status=%s | content_type=%s | body=%s",
            response.status_code,
            content_type,
            response.text[:4000],
        )

        return response.text

    def _request(
        self,
        method,
        endpoint,
        data=None,
        params=None,
        retries=3,
    ):
        method = method.upper()

        try:
            if endpoint.startswith("http"):
                url = endpoint
            else:
                if not endpoint.startswith("/"):
                    endpoint = "/" + endpoint

                url = f"{self.BASE_URL}{endpoint}"

            parsed_url = urlsplit(url)
            request_path = parsed_url.path or "/"

            if data is not None:
                body = json.dumps(
                    data,
                    ensure_ascii=False,
                    separators=(",", ":"),
                )
            else:
                body = ""

            logger.info(
                "Payuee request started | "
                "method=%s | url=%s | request_path=%s | retries=%s",
                method,
                url,
                request_path,
                retries,
            )

            logger.debug(
                "Payuee request payload | %s",
                self._safe_json_for_log(data),
            )

            logger.debug(
                "Payuee request params | %s",
                self._safe_json_for_log(params),
            )

            headers = self._headers(
                method,
                request_path,
                body,
            )

        except Exception as exc:
            logger.exception(
                "Payuee request preparation failed | "
                "method=%s | endpoint=%s | error=%s",
                method,
                endpoint,
                exc,
            )
            raise

        last_exception = None

        for attempt in range(1, retries + 1):
            started_at = time.perf_counter()

            logger.info(
                "Payuee HTTP attempt %s/%s | "
                "method=%s | url=%s",
                attempt,
                retries,
                method,
                url,
            )

            try:
                # Send the exact same serialized body that was signed.
                if method == "GET":
                    response = requests.get(
                        url,
                        headers=headers,
                        params=params,
                        timeout=30,
                    )

                elif method == "POST":
                    response = requests.post(
                        url,
                        headers=headers,
                        params=params,
                        data=body.encode("utf-8"),
                        timeout=30,
                    )

                elif method == "PATCH":
                    response = requests.patch(
                        url,
                        headers=headers,
                        params=params,
                        data=body.encode("utf-8"),
                        timeout=30,
                    )

                elif method == "PUT":
                    response = requests.put(
                        url,
                        headers=headers,
                        params=params,
                        data=body.encode("utf-8"),
                        timeout=30,
                    )

                elif method == "DELETE":
                    response = requests.delete(
                        url,
                        headers=headers,
                        params=params,
                        data=body.encode("utf-8"),
                        timeout=30,
                    )

                else:
                    raise ValueError(
                        f"Unsupported HTTP method: {method}"
                    )

                elapsed = time.perf_counter() - started_at

                logger.info(
                    "Payuee HTTP response | "
                    "attempt=%s/%s | method=%s | "
                    "url=%s | status=%s | elapsed=%.3fs",
                    attempt,
                    retries,
                    method,
                    url,
                    response.status_code,
                    elapsed,
                )

                logger.debug(
                    "Payuee response metadata | "
                    "content_type=%s | content_length=%s",
                    response.headers.get("Content-Type"),
                    len(response.content),
                )

                if 200 <= response.status_code < 300:
                    result = self._parse_response(response)

                    logger.info(
                        "Payuee request successful | status=%s",
                        response.status_code,
                    )

                    logger.debug(
                        "Payuee response body | %s",
                        self._safe_json_for_log(result),
                    )

                    return result

                if response.status_code == 400:
                    logger.error(
                        "Payuee 400 Bad Request | "
                        "url=%s | response=%s",
                        url,
                        response.text[:4000],
                    )
                    response.raise_for_status()

                if response.status_code == 401:
                    logger.error(
                        "Payuee 401 Unauthorized | "
                        "Authentication was rejected."
                    )

                    logger.error(
                        "Payuee authentication diagnostics | "
                        "base_url=%s | request_path=%s | "
                        "method=%s | public_key_configured=%s | "
                        "secret_key_configured=%s | body_length=%s",
                        self.BASE_URL,
                        request_path,
                        method,
                        bool(self.PUBLIC_KEY),
                        bool(self.SECRET_KEY),
                        len(body),
                    )

                    logger.error(
                        "Payuee 401 response | %s",
                        response.text[:4000],
                    )

                    # Authentication errors are deterministic.
                    # Retrying the same invalid signature will not help.
                    response.raise_for_status()

                if response.status_code == 403:
                    logger.error(
                        "Payuee 403 Forbidden | "
                        "url=%s | response=%s",
                        url,
                        response.text[:4000],
                    )
                    response.raise_for_status()

                if response.status_code == 404:
                    logger.error(
                        "Payuee 404 Not Found | "
                        "url=%s | response=%s",
                        url,
                        response.text[:4000],
                    )
                    response.raise_for_status()

                if response.status_code == 409:
                    logger.error(
                        "Payuee 409 Conflict | "
                        "url=%s | response=%s",
                        url,
                        response.text[:4000],
                    )
                    response.raise_for_status()

                if response.status_code == 422:
                    logger.error(
                        "Payuee 422 Validation Error | "
                        "url=%s | response=%s",
                        url,
                        response.text[:4000],
                    )
                    response.raise_for_status()

                if response.status_code == 429:
                    retry_after = response.headers.get(
                        "Retry-After"
                    )

                    logger.warning(
                        "Payuee 429 Rate Limited | "
                        "attempt=%s/%s | retry_after=%s | "
                        "response=%s",
                        attempt,
                        retries,
                        retry_after,
                        response.text[:4000],
                    )

                    if attempt < retries:
                        try:
                            wait_seconds = float(
                                retry_after
                            ) if retry_after else 2 ** attempt
                        except ValueError:
                            wait_seconds = 2 ** attempt

                        wait_seconds = min(
                            wait_seconds,
                            30,
                        )

                        logger.info(
                            "Waiting %.2f seconds before "
                            "Payuee retry.",
                            wait_seconds,
                        )

                        time.sleep(wait_seconds)
                        continue

                    response.raise_for_status()

                if response.status_code >= 500:
                    logger.error(
                        "Payuee server error | "
                        "status=%s | attempt=%s/%s | response=%s",
                        response.status_code,
                        attempt,
                        retries,
                        response.text[:4000],
                    )

                    if attempt < retries:
                        wait_seconds = min(
                            2 ** (attempt - 1),
                            30,
                        )

                        logger.info(
                            "Retrying Payuee after %.2f seconds.",
                            wait_seconds,
                        )

                        time.sleep(wait_seconds)
                        continue

                    response.raise_for_status()

                logger.error(
                    "Unexpected Payuee HTTP status | "
                    "status=%s | method=%s | url=%s | response=%s",
                    response.status_code,
                    method,
                    url,
                    response.text[:4000],
                )

                response.raise_for_status()

            except requests.exceptions.Timeout as exc:
                last_exception = exc

                logger.error(
                    "Payuee timeout | "
                    "attempt=%s/%s | method=%s | url=%s | "
                    "error=%s",
                    attempt,
                    retries,
                    method,
                    url,
                    exc,
                    exc_info=True,
                )

                if attempt < retries:
                    time.sleep(
                        min(2 ** (attempt - 1), 30)
                    )
                    continue

                raise

            except requests.exceptions.ConnectionError as exc:
                last_exception = exc

                logger.error(
                    "Payuee connection error | "
                    "attempt=%s/%s | url=%s | error=%s",
                    attempt,
                    retries,
                    url,
                    exc,
                    exc_info=True,
                )

                if attempt < retries:
                    time.sleep(
                        min(2 ** (attempt - 1), 30)
                    )
                    continue

                raise

            except requests.exceptions.HTTPError as exc:
                last_exception = exc

                logger.error(
                    "Payuee HTTP error | "
                    "status=%s | method=%s | url=%s | error=%s",
                    getattr(
                        exc.response,
                        "status_code",
                        None,
                    ),
                    method,
                    url,
                    exc,
                    exc_info=True,
                )

                raise

            except requests.exceptions.RequestException as exc:
                last_exception = exc

                logger.error(
                    "Payuee request exception | "
                    "attempt=%s/%s | method=%s | url=%s | error=%s",
                    attempt,
                    retries,
                    method,
                    url,
                    exc,
                    exc_info=True,
                )

                if attempt < retries:
                    time.sleep(
                        min(2 ** (attempt - 1), 30)
                    )
                    continue

                raise

            except ValueError as exc:
                last_exception = exc

                logger.error(
                    "Payuee value/JSON error | "
                    "method=%s | url=%s | error=%s",
                    method,
                    url,
                    exc,
                    exc_info=True,
                )
                raise

            except Exception as exc:
                last_exception = exc

                logger.exception(
                    "Unexpected Payuee integration error | "
                    "method=%s | url=%s | error=%s",
                    method,
                    url,
                    exc,
                )
                raise

        if last_exception:
            raise last_exception

        return {}

    # ============================================================
    # AUTHENTICATION TEST
    # ============================================================

    def check_auth(self):
        """
        Test Payuee credentials using the documented auth-status
        endpoint.
        """
        logger.info(
            "Testing Payuee authentication..."
        )

        return self._request(
            "GET",
            "/auth-status",
        )

    # ============================================================
    # PRODUCTS
    # ============================================================

    def get_products(self, filters):
        logger.info(
            "Payuee get_products called | filters=%s",
            self._safe_json_for_log(filters),
        )

        return self._request(
            "POST",
            "/products",
            data=filters,
        )

    def search_products(self, filters):
        logger.info(
            "Payuee search_products called | filters=%s",
            self._safe_json_for_log(filters),
        )

        return self._request(
            "POST",
            "/products/search",
            data=filters,
        )

    def get_product_detail(self, product_id):
        logger.info(
            "Payuee get_product_detail called | "
            "product_id=%s",
            product_id,
        )

        # NOTE: the Payuee docs define this endpoint as singular
        # "/product/{id}" (unlike the plural "/products" list and
        # "/products/search" endpoints). Using "/products/{id}" here
        # was hitting a route that doesn't exist on Payuee and
        # returning 404s, which is why product detail / related
        # products failed to load.
        return self._request(
            "GET",
            f"/product/{product_id}",
        )

    # ============================================================
    # WALLET
    # ============================================================

    def get_wallet_balance(self):
        logger.info(
            "Payuee get_wallet_balance called"
        )

        return self._request(
            "GET",
            "/wallet/balance",
        )

    def get_wallet_funding_details(self):
        logger.info(
            "Payuee get_wallet_funding_details called"
        )

        return self._request(
            "GET",
            "/wallet/fund",
        )

    # ============================================================
    # LOCATION
    # ============================================================

    def get_states(self):
        logger.info(
            "Payuee get_states called"
        )

        return self._request(
            "GET",
            "/location/states",
        )

    def get_cities(self, state):
        logger.info(
            "Payuee get_cities called | state=%s",
            state,
        )

        return self._request(
            "GET",
            "/location/cities",
            params={"state": state},
        )

    # ============================================================
    # SHIPPING
    # ============================================================

    def calculate_shipping_fees(self, payload):
        logger.info(
            "Payuee calculate_shipping_fees called"
        )

        return self._request(
            "POST",
            "/order/shipping-fees",
            data=payload,
        )

    # ============================================================
    # ORDERS
    # ============================================================

    def create_order(
        self,
        trans_code,
        customer,
        cart_items,
        shipping,
        webhook_url,
    ):
        payload = {
            "trans_code": trans_code,
            "webhook_response_url": webhook_url,
            "customer": customer,
            "cart_items": cart_items,
            "shipping": shipping,
        }

        logger.info(
            "Payuee create_order called | "
            "trans_code=%s | cart_items_count=%s",
            trans_code,
            len(cart_items) if cart_items else 0,
        )

        return self._request(
            "POST",
            "/order/create",
            data=payload,
        )

    def get_order_detail(self, order_id):
        logger.info(
            "Payuee get_order_detail called | "
            "order_id=%s",
            order_id,
        )

        return self._request(
            "GET",
            f"/order/{order_id}",
        )

    def list_orders(self, page=1, limit=15):
        logger.info(
            "Payuee list_orders called | "
            "page=%s | limit=%s",
            page,
            limit,
        )

        return self._request(
            "GET",
            "/order/list",
            params={
                "page": page,
                "limit": limit,
            },
        )

    def scan_qr(self, encrypted_payload):
        logger.info(
            "Payuee scan_qr called"
        )

        return self._request(
            "POST",
            "/order/scan-qr",
            data={
                "encrypted": encrypted_payload,
            },
        )

    def verify_delivery(
        self,
        encrypted,
        customer_id,
        trans_code,
    ):
        logger.info(
            "Payuee verify_delivery called | "
            "customer_id=%s | trans_code=%s",
            customer_id,
            trans_code,
        )

        return self._request(
            "POST",
            "/order/verify",
            data={
                "encrypted": encrypted,
                "customer_id": customer_id,
                "trans_code": trans_code,
            },
        )

    def cancel_order(
        self,
        order_id,
        trans_code,
        report_note="",
    ):
        logger.info(
            "Payuee cancel_order called | "
            "order_id=%s | trans_code=%s",
            order_id,
            trans_code,
        )

        return self._request(
            "POST",
            "/order/cancel",
            data={
                "order_id": order_id,
                "trans_code": trans_code,
                "report_note": report_note,
            },
        )

    def report_order(
        self,
        order_id,
        report_note,
    ):
        logger.info(
            "Payuee report_order called | "
            "order_id=%s",
            order_id,
        )

        return self._request(
            "POST",
            "/order/report",
            data={
                "order_id": order_id,
                "report_note": report_note,
            },
        )

    # ============================================================
    # REVIEWS
    # ============================================================

    def submit_review(
        self,
        product_id,
        user_id,
        name,
        email,
        review,
        rating,
    ):
        logger.info(
            "Payuee submit_review called | "
            "product_id=%s | user_id=%s | rating=%s",
            product_id,
            user_id,
            rating,
        )

        return self._request(
            "POST",
            "/product/review",
            data={
                "product_id": product_id,
                "user_id": user_id,
                "name": name,
                "email": email,
                "review": review,
                "rating": rating,
            },
        )

    def get_reviews(self, product_id, page=1):
        logger.info(
            "Payuee get_reviews called | "
            "product_id=%s | page=%s",
            product_id,
            page,
        )

        return self._request(
            "GET",
            f"/product/reviews/{page}/{product_id}",
        )

    # ============================================================
    # WEBHOOK VERIFICATION
    # ============================================================

    @classmethod
    def verify_webhook(
        cls,
        payload_bytes,
        signature,
        timestamp,
    ):
        try:
            if not cls.WEBHOOK_SECRET:
                logger.error(
                    "Payuee webhook verification failed: "
                    "WEBHOOK_SECRET is not configured."
                )
                return False

            if not signature:
                logger.error(
                    "Payuee webhook verification failed: "
                    "signature is missing."
                )
                return False

            if not timestamp:
                logger.error(
                    "Payuee webhook verification failed: "
                    "timestamp is missing."
                )
                return False

            signed_payload = (
                f"{timestamp}."
                f"{payload_bytes.decode('utf-8')}"
            )

            expected = (
                "sha256="
                + hmac.new(
                    cls.WEBHOOK_SECRET.encode("utf-8"),
                    signed_payload.encode("utf-8"),
                    hashlib.sha256,
                ).hexdigest()
            )

            valid = hmac.compare_digest(
                expected,
                signature,
            )

            if valid:
                logger.info(
                    "Payuee webhook signature verified successfully."
                )
            else:
                logger.error(
                    "Payuee webhook signature verification failed."
                )

            return valid

        except UnicodeDecodeError as exc:
            logger.exception(
                "Payuee webhook payload decoding failed: %s",
                exc,
            )
            return False

        except Exception as exc:
            logger.exception(
                "Unexpected Payuee webhook verification error: %s",
                exc,
            )
            return False