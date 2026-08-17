import hmac
import hashlib
import time
import uuid
import json
import logging
from django.conf import settings
import requests

logger = logging.getLogger('payuee')

class PayueeService:
    BASE_URL = settings.PAYUEE_BASE_URL
    PUBLIC_KEY = settings.PAYUEE_API_KEY
    SECRET_KEY = settings.PAYUEE_API_SECRET
    WEBHOOK_SECRET = settings.PAYUEE_WEBHOOK_SECRET

    def _generate_signature(self, method, path, body=''):
        timestamp = str(int(time.time()))
        payload = f"{timestamp}{method.upper()}{path}{body}"
        signature = hmac.new(
            self.SECRET_KEY.encode(),
            payload.encode(),
            hashlib.sha256
        ).hexdigest()
        return timestamp, signature

    def _headers(self, method, path, body=''):
        timestamp, signature = self._generate_signature(method, path, body)
        idempotency = str(uuid.uuid4())
        return {
            'Authorization': f'Bearer {self.SECRET_KEY}',
            'X-Payuee-Public-Key': self.PUBLIC_KEY,
            'X-Payuee-Timestamp': timestamp,
            'X-Payuee-Signature': signature,
            'X-Payuee-Idempotency-Key': idempotency,
            'Content-Type': 'application/json',
        }

    def _request(self, method, endpoint, data=None, params=None, retries=3):
        path = endpoint.replace(self.BASE_URL, '') if endpoint.startswith('http') else endpoint
        if not path.startswith('/'):
            path = '/' + path
        url = f"{self.BASE_URL}{path}"
        body = json.dumps(data) if data else ''
        headers = self._headers(method, path, body)

        for attempt in range(retries):
            try:
                if method.upper() == 'GET':
                    resp = requests.get(url, headers=headers, params=params, timeout=30)
                elif method.upper() == 'POST':
                    resp = requests.post(url, headers=headers, json=data, timeout=30)
                else:
                    raise ValueError(f"Unsupported method: {method}")

                if resp.status_code == 429:
                    wait = min(2 ** attempt * 1000, 30000)
                    time.sleep(wait / 1000)
                    continue
                if resp.status_code >= 500:
                    if attempt < retries - 1:
                        wait = min(2 ** attempt * 1000, 30000)
                        time.sleep(wait / 1000)
                        continue
                resp.raise_for_status()
                return resp.json()
            except requests.exceptions.RequestException as e:
                if attempt == retries - 1:
                    logger.error(f"Payuee API error after {retries} attempts: {e}")
                    raise
        return {}

    # === PRODUCTS ===
    def get_products(self, filters):
        return self._request('POST', '/products', data=filters)

    def search_products(self, filters):
        return self._request('POST', '/products/search', data=filters)

    def get_product_detail(self, product_id):
        return self._request('GET', f'/products/{product_id}')

    # === WALLET ===
    def get_wallet_balance(self):
        return self._request('GET', '/wallet/balance')

    def get_wallet_funding_details(self):
        return self._request('GET', '/wallet/fund')

    # === LOCATION ===
    def get_states(self):
        return self._request('GET', '/location/states')

    def get_cities(self, state):
        return self._request('GET', '/location/cities', params={'state': state})

    # === SHIPPING ===
    def calculate_shipping_fees(self, payload):
        return self._request('POST', '/order/shipping-fees', data=payload)

    # === ORDERS ===
    def create_order(self, trans_code, customer, cart_items, shipping, webhook_url):
        payload = {
            'trans_code': trans_code,
            'webhook_response_url': webhook_url,
            'customer': customer,
            'cart_items': cart_items,
            'shipping': shipping
        }
        return self._request('POST', '/order/create', data=payload)

    def get_order_detail(self, order_id):
        return self._request('GET', f'/order/{order_id}')

    def list_orders(self, page=1, limit=15):
        return self._request('GET', '/order/list', params={'page': page, 'limit': limit})

    def scan_qr(self, encrypted_payload):
        return self._request('POST', '/order/scan-qr', data={'encrypted': encrypted_payload})

    def verify_delivery(self, encrypted, customer_id, trans_code):
        return self._request('POST', '/order/verify', data={
            'encrypted': encrypted,
            'customer_id': customer_id,
            'trans_code': trans_code
        })

    def cancel_order(self, order_id, trans_code, report_note=''):
        return self._request('POST', '/order/cancel', data={
            'order_id': order_id,
            'trans_code': trans_code,
            'report_note': report_note
        })

    def report_order(self, order_id, report_note):
        return self._request('POST', '/order/report', data={
            'order_id': order_id,
            'report_note': report_note
        })

    # === REVIEWS ===
    def submit_review(self, product_id, user_id, name, email, review, rating):
        return self._request('POST', '/product/review', data={
            'product_id': product_id,
            'user_id': user_id,
            'name': name,
            'email': email,
            'review': review,
            'rating': rating
        })

    def get_reviews(self, product_id, page=1):
        return self._request('GET', f'/product/reviews/{page}/{product_id}')

    # === WEBHOOK VERIFICATION ===
    @classmethod
    def verify_webhook(cls, payload_bytes, signature, timestamp):
        if not cls.WEBHOOK_SECRET:
            return False
        signed_payload = f"{timestamp}.{payload_bytes.decode()}"
        expected = f"sha256={hmac.new(cls.WEBHOOK_SECRET.encode(), signed_payload.encode(), hashlib.sha256).hexdigest()}"
        return hmac.compare_digest(expected, signature)