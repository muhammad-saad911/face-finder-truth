# Face Finder Truth

Deepfake and AI-generated image/video detection app.

## Backend

The recommended backend for this UI is the FastAPI service in `../backend`.

Why this one:

- It supports both image and video detection.
- It runs a pretrained PyTorch Xception model locally.
- It is lighter than the Django/Forensica backend in `../backend 2`, which is video-focused and adds more moving parts than this UI needs.

What it does:

- Detects deepfake artifacts in uploaded images.
- Samples and analyzes uploaded videos.
- Provides auth endpoints for sign-in and sign-up.
- Supports per-user scan history when available, with a local fallback in the UI.

API endpoints used by the frontend:

- `POST /auth/register`
- `POST /auth/login`
- `GET /auth/me`
- `POST /detect/image`
- `POST /detect/video`
- `GET /health`
- `GET /docs`

## Run it locally

Use two terminals:

1. Python backend

```bash
cd "D:\my projects\saad\backend"
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
set APP_SECRET=change-this-in-production
uvicorn app.main:app --reload --host 127.0.0.1 --port 8787
```

2. Frontend

```bash
cd "D:\my projects\face-finder-truth"
npm run dev
```

## Frontend integration

The frontend uploads the original file directly to the backend.

The backend returns:

- `verdict`
- `deepfake_probability`
- `confidence`
- `summary`
- `observations`
- `ai_probability`
- `real_probability`

## Login and user data

- Login and sign-up are handled by the Python backend.
- Each scan is saved under the signed-in user when backend history is available.
- The history panel falls back to local browser storage if `/analyses` is not implemented.

## Environment

Frontend `.env`:

- `VITE_BACKEND_URL="http://127.0.0.1:8787"`

Backend:

- `PORT` optional, defaults to `8787`
- `HF_HOME` optional cache directory override
- `APP_SECRET` recommended, used to sign auth tokens
