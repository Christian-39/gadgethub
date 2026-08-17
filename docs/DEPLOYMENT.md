# GadgetHub Deployment Guide

## Overview
GadgetHub is deployed as two separate services:
- **Backend API** → Render (Django + Gunicorn)
- **Frontend** → Vercel (Static HTML/CSS/JS)

---

## Prerequisites
- Render account (free tier available)
- Vercel account (free tier available)
- Backblaze B2 account (for media storage)
- Payuee API credentials
- MySQL database (Render or external provider)

---

## Step 1: Database Setup

### Option A: Render MySQL (Recommended)
1. Go to Render Dashboard → New → MySQL
2. Name: `gadgethub-db`
3. Select plan (Starter $7/month or higher for production)
4. Copy the internal connection string
5. Set environment variables:
   - `DB_HOST` → internal host
   - `DB_NAME` → database name
   - `DB_USER` → username
   - `DB_PASSWORD` → password
   - `DB_PORT` → 3306

### Option B: External MySQL
Use any MySQL 8.0+ provider (AWS RDS, DigitalOcean, etc.) and set the connection details in environment variables.

---

## Step 2: Redis Setup (Render)
1. Render Dashboard → New → Redis
2. Name: `gadgethub-redis`
3. Copy the internal Redis URL
4. Set `REDIS_URL` environment variable

---

## Step 3: Backblaze B2 Setup
1. Create account at backblaze.com
2. Create a private bucket (e.g., `gadgethub-media`)
3. Generate Application Key with read/write access
4. Note down:
   - `keyID` → `B2_KEY_ID`
   - `applicationKey` → `B2_APPLICATION_KEY`
   - Endpoint (e.g., `https://s3.us-west-000.backblazeb2.com`) → `B2_ENDPOINT`
   - Region (e.g., `us-west-000`) → `B2_REGION`
   - Bucket name → `B2_BUCKET_NAME`
5. Set `USE_S3=True`

---

## Step 4: Backend Deployment (Render)

### 4.1 Create Web Service
1. Connect your GitHub repository
2. Select the `backend` directory as root
3. Runtime: Python 3
4. Build Command:
   ```bash
   pip install -r requirements.txt && python manage.py collectstatic --noinput && python manage.py migrate