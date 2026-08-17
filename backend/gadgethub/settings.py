from pathlib import Path
from datetime import timedelta
from decouple import config
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent

load_dotenv(BASE_DIR / ".env")

SECRET_KEY = config("SECRET_KEY")
DEBUG = config("DEBUG", default=False, cast=bool)

ALLOWED_HOSTS = config(
    "ALLOWED_HOSTS",
    default="localhost,127.0.0.1",
).split(",")

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "rest_framework",
    "rest_framework_simplejwt",
    "rest_framework_simplejwt.token_blacklist",
    "corsheaders",
    "accounts",
    "products",
    "orders",
    "wallet",
    "notifications",
    "support",
    "dashboard",
    "webhooks",
    "payuee",
]

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [
            BASE_DIR / "templates",
        ],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

ROOT_URLCONF = "gadgethub.urls"
WSGI_APPLICATION = "gadgethub.wsgi.application"

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.mysql",
        "NAME": config("DB_NAME"),
        "USER": config("DB_USER"),
        "PASSWORD": config("DB_PASSWORD"),
        "HOST": config("DB_HOST"),
        "PORT": config("DB_PORT", default="3306"),
        "OPTIONS": {
            "init_command": "SET sql_mode='STRICT_TRANS_TABLES'",
            "charset": "utf8mb4",
        },
    }
}

CACHES = {
    "default": {
        "BACKEND": "django_redis.cache.RedisCache",
        "LOCATION": config(
            "REDIS_URL",
            default="redis://127.0.0.1:6379/0",
        ),
        "OPTIONS": {
            "CLIENT_CLASS": "django_redis.client.DefaultClient",
            "IGNORE_EXCEPTIONS": True,
        },
        "TIMEOUT": 300,
    }
}

AUTH_PASSWORD_VALIDATORS = [
    {
        "NAME": (
            "django.contrib.auth.password_validation."
            "UserAttributeSimilarityValidator"
        ),
    },
    {
        "NAME": (
            "django.contrib.auth.password_validation."
            "MinimumLengthValidator"
        ),
    },
    {
        "NAME": (
            "django.contrib.auth.password_validation."
            "CommonPasswordValidator"
        ),
    },
    {
        "NAME": (
            "django.contrib.auth.password_validation."
            "NumericPasswordValidator"
        ),
    },
]

LANGUAGE_CODE = "en-us"
TIME_ZONE = "Africa/Lagos"
USE_I18N = True
USE_TZ = True

STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"

MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"

STATICFILES_STORAGE = (
    "whitenoise.storage.CompressedManifestStaticFilesStorage"
)

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
AUTH_USER_MODEL = "accounts.User"

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "accounts.authentication.CookieJWTAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
    ],
    "DEFAULT_PAGINATION_CLASS": (
        "rest_framework.pagination.PageNumberPagination"
    ),
    "DEFAULT_FILTER_BACKENDS": [
        "django_filters.rest_framework.DjangoFilterBackend",
    ],
    "PAGE_SIZE": 20,
}

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=15),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=7),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
    "ALGORITHM": "HS256",
    "SIGNING_KEY": SECRET_KEY,
    "AUTH_HEADER_TYPES": ("Bearer",),
    "AUTH_COOKIE": "access_token",
    "AUTH_COOKIE_REFRESH": "refresh_token",
    "AUTH_COOKIE_SECURE": not DEBUG,
    "AUTH_COOKIE_HTTP_ONLY": True,
    "AUTH_COOKIE_PATH": "/",
    "AUTH_COOKIE_SAMESITE": "None" if not DEBUG else "Lax",
}

CORS_ALLOWED_ORIGINS = [
    origin.strip()
    for origin in config(
        "CORS_ALLOWED_ORIGINS",
        default="",
    ).split(",")
    if origin.strip()
]

CSRF_TRUSTED_ORIGINS = [
    origin.strip()
    for origin in config(
        "CSRF_TRUSTED_ORIGINS",
        default="",
    ).split(",")
    if origin.strip()
]

CORS_ALLOW_CREDENTIALS = True
CORS_ALLOW_ALL_ORIGINS = False

ALLOWED_HOSTS = [
    host.strip()
    for host in ALLOWED_HOSTS
    if host.strip()
]

USE_S3 = config(
    "USE_S3",
    default=False,
    cast=bool,
)

if USE_S3:
    DEFAULT_FILE_STORAGE = "utils.storage.BackblazeB2Storage"
    AWS_ACCESS_KEY_ID = config("B2_KEY_ID")
    AWS_SECRET_ACCESS_KEY = config("B2_APPLICATION_KEY")
    AWS_STORAGE_BUCKET_NAME = config("B2_BUCKET_NAME")
    AWS_S3_ENDPOINT_URL = config("B2_ENDPOINT")
    AWS_S3_REGION_NAME = config("B2_REGION")
    AWS_S3_SIGNATURE_VERSION = "s3v4"

PAYUEE_API_KEY = config(
    "PAYUEE_API_KEY",
    default="",
)

PAYUEE_API_SECRET = config(
    "PAYUEE_API_SECRET",
    default="",
)

PAYUEE_BASE_URL = config(
    "PAYUEE_BASE_URL",
    default="https://escrow.payuee.com/v1",
)

PAYUEE_WEBHOOK_SECRET = config(
    "WEBHOOK_SECRET",
    default="",
)

PAYUEE_WEBHOOK_URL = config(
    "PAYUEE_WEBHOOK_URL",
    default="",
)

SECURE_SSL_REDIRECT = not DEBUG
SECURE_PROXY_SSL_HEADER = (
    "HTTP_X_FORWARDED_PROTO",
    "https",
)
SESSION_COOKIE_SECURE = not DEBUG
CSRF_COOKIE_SECURE = not DEBUG
X_FRAME_OPTIONS = "DENY"
SECURE_BROWSER_XSS_FILTER = True
SECURE_CONTENT_TYPE_NOSNIFF = True

LOG_DIR = BASE_DIR / "logs"
LOG_DIR.mkdir(
    parents=True,
    exist_ok=True,
)

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "verbose": {
            "format": (
                "{levelname} {asctime} "
                "{module} {process:d} {thread:d} "
                "{message}"
            ),
            "style": "{",
        },
        "simple": {
            "format": "{levelname} {message}",
            "style": "{",
        },
    },
    "handlers": {
        "file": {
            "level": "INFO",
            "class": "logging.FileHandler",
            "filename": LOG_DIR / "gadgethub.log",
            "formatter": "verbose",
        },
        "console": {
            "level": "INFO",
            "class": "logging.StreamHandler",
            "formatter": "simple",
        },
    },
    "loggers": {
        "payuee": {
            "handlers": [
                "file",
                "console",
            ],
            "level": "INFO",
            "propagate": False,
        },
    },
}