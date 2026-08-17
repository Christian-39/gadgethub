# GadgetHub

Enterprise-grade e-commerce platform powered by Payuee escrow infrastructure.

## Tech Stack

- **Backend:** Django 5 + Django REST Framework
- **Frontend:** Vanilla HTML, CSS, JavaScript (No frameworks)
- **Database:** MySQL
- **Media Storage:** Backblaze B2
- **Payment/Escrow:** Payuee API
- **Cache:** Redis
- **Deployment:** Render (Backend) + Vercel (Frontend)

## Quick Start

### Backend Setup

```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Create .env file with required variables
python manage.py migrate
python manage.py runserver