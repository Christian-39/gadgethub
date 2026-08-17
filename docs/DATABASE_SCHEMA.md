# GadgetHub Database Schema

## Entity Relationship Overview
[User] 1--* [AddressBook]
[User] 1--* [WishlistItem] --1 [ProductCache]
[User] 1-- [CartItem] --1 [ProductCache]
[User] 1-- [Order] 1--* [OrderItem]
[Order] 1--* [OrderTimeline]
[User] 1--* [WalletTransaction]
[User] 1--* [Notification]
[User] 1--* [SupportTicket]

---

## Table Definitions

### 1. accounts_user
Custom user model extending AbstractUser.

| Column | Type | Constraints |
|--------|------|-------------|
| id | CHAR(36) | PK, UUID |
| email | VARCHAR(254) | UNIQUE, NOT NULL |
| username | VARCHAR(150) | UNIQUE, NOT NULL |
| first_name | VARCHAR(150) | |
| last_name | VARCHAR(150) | |
| phone_number | VARCHAR(17) | |
| profile_picture | VARCHAR(200) | URL to B2 |
| address | TEXT | |
| city | VARCHAR(100) | |
| state | VARCHAR(100) | |
| transaction_pin | VARCHAR(255) | Hashed |
| pin_created | BOOLEAN | DEFAULT FALSE |
| account_number | VARCHAR(20) | Payuee funding |
| bank_name | VARCHAR(100) | |
| bank_code | VARCHAR(10) | |
| theme_preference | VARCHAR(10) | DEFAULT 'system' |
| is_staff | BOOLEAN | |
| is_active | BOOLEAN | |
| date_joined | DATETIME | |
| created_at | DATETIME | auto_now_add |
| updated_at | DATETIME | auto_now |

**Indexes:** email, username

---

### 2. accounts_addressbook
User delivery addresses.

| Column | Type | Constraints |
|--------|------|-------------|
| id | CHAR(36) | PK, UUID |
| user_id | CHAR(36) | FK → accounts_user.id, CASCADE |
| label | VARCHAR(50) | DEFAULT 'Home' |
| full_name | VARCHAR(255) | |
| phone_number | VARCHAR(17) | |
| address_1 | VARCHAR(255) | NOT NULL |
| address_2 | VARCHAR(255) | |
| city | VARCHAR(100) | NOT NULL |
| state | VARCHAR(100) | NOT NULL |
| latitude | FLOAT | |
| longitude | FLOAT | |
| is_default | BOOLEAN | DEFAULT FALSE |
| created_at | DATETIME | auto_now_add |

**Indexes:** user_id, is_default

---

### 3. products_productcache
Cached Payuee product data.

| Column | Type | Constraints |
|--------|------|-------------|
| id | INT | PK, auto_increment |
| payuee_id | INT | UNIQUE, NOT NULL |
| title | VARCHAR(500) | NOT NULL |
| description | TEXT | |
| selling_price | DECIMAL(12,2) | NOT NULL |
| currency | VARCHAR(10) | DEFAULT 'NGN' |
| category | VARCHAR(100) | INDEX |
| stock_remaining | INT | DEFAULT 0 |
| stock_status | VARCHAR(50) | |
| vendor_id | INT | INDEX |
| vendor_type | VARCHAR(50) | |
| product_url_id | VARCHAR(255) | |
| images | JSON | DEFAULT [] |
| sizes | VARCHAR(255) | |
| weight | FLOAT | DEFAULT 0 |
| estimated_delivery | INT | DEFAULT 7 |
| featured | BOOLEAN | DEFAULT FALSE |
| on_sale | BOOLEAN | DEFAULT FALSE |
| sales_count | INT | DEFAULT 0 |
| rating_avg | FLOAT | DEFAULT 0 |
| review_count | INT | DEFAULT 0 |
| cached_at | DATETIME | auto_now |

**Indexes:** category, vendor_id, selling_price, featured

---

### 4. products_wishlistitem

| Column | Type | Constraints |
|--------|------|-------------|
| id | CHAR(36) | PK, UUID |
| user_id | CHAR(36) | FK → accounts_user.id, CASCADE |
| product_id | INT | FK → products_productcache.id, CASCADE |
| created_at | DATETIME | auto_now_add |

**Unique:** (user_id, product_id)

---

### 5. products_cartitem

| Column | Type | Constraints |
|--------|------|-------------|
| id | CHAR(36) | PK, UUID |
| user_id | CHAR(36) | FK → accounts_user.id, CASCADE |
| product_id | INT | FK → products_productcache.id, CASCADE |
| quantity | INT | DEFAULT 1 |
| size | VARCHAR(50) | |
| ordered | BOOLEAN | DEFAULT FALSE |
| created_at | DATETIME | auto_now_add |

**Unique:** (user_id, product_id, size)

---

### 6. orders_order

| Column | Type | Constraints |
|--------|------|-------------|
| id | CHAR(36) | PK, UUID |
| user_id | CHAR(36) | FK → accounts_user.id, CASCADE |
| payuee_order_ids | JSON | DEFAULT [] |
| status | VARCHAR(20) | DEFAULT 'pending' |
| total_cost | DECIMAL(12,2) | NOT NULL |
| shipping_cost | DECIMAL(12,2) | NOT NULL |
| subtotal | DECIMAL(12,2) | NOT NULL |
| customer_email | VARCHAR(254) | |
| customer_name | VARCHAR(255) | |
| customer_phone | VARCHAR(17) | |
| delivery_state | VARCHAR(100) | |
| delivery_city | VARCHAR(100) | |
| delivery_address | TEXT | |
| delivery_latitude | FLOAT | |
| delivery_longitude | FLOAT | |
| transaction_code | VARCHAR(6) | |
| shipping_method | VARCHAR(50) | |
| shipping_company | VARCHAR(100) | |
| estimated_delivery_days | INT | DEFAULT 7 |
| qr_scanned | BOOLEAN | DEFAULT FALSE |
| delivered_at | DATETIME | NULL |
| cancelled_at | DATETIME | NULL |
| report_note | TEXT | |
| receipt_data | JSON | DEFAULT {} |
| created_at | DATETIME | auto_now_add |
| updated_at | DATETIME | auto_now |

**Indexes:** user_id, status, created_at

---

### 7. orders_orderitem

| Column | Type | Constraints |
|--------|------|-------------|
| id | CHAR(36) | PK, UUID |
| order_id | CHAR(36) | FK → orders_order.id, CASCADE |
| product_id | INT | |
| title | VARCHAR(500) | |
| quantity | INT | |
| unit_price | DECIMAL(12,2) | |
| total_price | DECIMAL(12,2) | |
| size | VARCHAR(50) | |
| image_url | VARCHAR(200) | |

**Indexes:** order_id

---

### 8. orders_ordertimeline

| Column | Type | Constraints |
|--------|------|-------------|
| id | INT | PK, auto_increment |
| order_id | CHAR(36) | FK → orders_order.id, CASCADE |
| status | VARCHAR(50) | |
| description | TEXT | |
| created_at | DATETIME | auto_now_add |

**Indexes:** order_id, created_at

---

### 9. wallet_wallettransaction

| Column | Type | Constraints |
|--------|------|-------------|
| id | CHAR(36) | PK, UUID |
| user_id | CHAR(36) | FK → accounts_user.id, CASCADE |
| transaction_type | VARCHAR(20) | |
| amount | DECIMAL(12,2) | |
| balance_after | DECIMAL(12,2) | |
| description | TEXT | |
| reference | VARCHAR(255) | |
| payuee_order_id | VARCHAR(50) | |
| created_at | DATETIME | auto_now_add |

**Indexes:** user_id, transaction_type, created_at

---

### 10. notifications_notification

| Column | Type | Constraints |
|--------|------|-------------|
| id | CHAR(36) | PK, UUID |
| user_id | CHAR(36) | FK → accounts_user.id, CASCADE |
| title | VARCHAR(255) | |
| message | TEXT | |
| notification_type | VARCHAR(20) | |
| is_read | BOOLEAN | DEFAULT FALSE |
| action_url | VARCHAR(500) | |
| created_at | DATETIME | auto_now_add |

**Indexes:** user_id, is_read, created_at

---

### 11. support_supportticket

| Column | Type | Constraints |
|--------|------|-------------|
| id | CHAR(36) | PK, UUID |
| user_id | CHAR(36) | FK → accounts_user.id, CASCADE |
| subject | VARCHAR(255) | |
| category | VARCHAR(20) | |
| message | TEXT | |
| status | VARCHAR(20) | DEFAULT 'open' |
| admin_response | TEXT | |
| created_at | DATETIME | auto_now_add |
| updated_at | DATETIME | auto_now |

**Indexes:** user_id, status, created_at

---

### 12. webhooks_webhooklog

| Column | Type | Constraints |
|--------|------|-------------|
| id | CHAR(36) | PK, UUID |
| event_type | VARCHAR(50) | |
| order_id | VARCHAR(50) | |
| payload | JSON | |
| signature | VARCHAR(255) | |
| timestamp | VARCHAR(20) | |
| status | VARCHAR(20) | DEFAULT 'pending' |
| error_message | TEXT | |
| created_at | DATETIME | auto_now_add |

**Indexes:** event_type, order_id, created_at

---

## Relationships Summary

| Parent | Child | Type | On Delete |
|--------|-------|------|-----------|
| User | AddressBook | 1:N | CASCADE |
| User | WishlistItem | 1:N | CASCADE |
| User | CartItem | 1:N | CASCADE |
| User | Order | 1:N | CASCADE |
| User | WalletTransaction | 1:N | CASCADE |
| User | Notification | 1:N | CASCADE |
| User | SupportTicket | 1:N | CASCADE |
| ProductCache | WishlistItem | 1:N | CASCADE |
| ProductCache | CartItem | 1:N | CASCADE |
| Order | OrderItem | 1:N | CASCADE |
| Order | OrderTimeline | 1:N | CASCADE |