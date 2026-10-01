# BugTracker Pro

Real-time issue tracker: Django REST + Channels backend, React (Vite) frontend, static landing page.

## Run locally

```bash
# backend (Python 3.12+)
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.template .env
python manage.py migrate
daphne -p 8000 bug_tracker_backend.asgi:application   # serves HTTP + websockets

# frontend
cd frontend && npm install && npm run dev               # http://localhost:5173
```

Tests: `python manage.py test` · Lint/build: `cd frontend && npm run lint && npm run build`

## Configuration

| Variable | Where | Purpose |
|---|---|---|
| `DJANGO_SECRET_KEY` | backend | required when `DJANGO_DEBUG` is off |
| `DJANGO_DEBUG` | backend | `True` for development |
| `ALLOWED_HOSTS`, `CORS_ALLOWED_ORIGINS`, `CSRF_TRUSTED_ORIGINS` | backend | comma-separated lists |
| `DATABASE_URL` | backend | Postgres in production (SQLite otherwise) |
| `VITE_API_URL` | frontend | backend base URL |
| `VITE_MSAL_CLIENT_ID`, `VITE_MSAL_TENANT_ID` | frontend | optional Microsoft sign-in (button hidden when unset) |

## Roles

Admin and Manager manage projects, tags and invites; only Admin changes roles and the organization name.
Testers can edit any bug; Developers see and edit bugs assigned to or filed by them.
Public mail domains (gmail.com, outlook.com…) each get a private workspace; company domains share one organization, and later colleagues join by invite.

> Uploaded attachments are stored on the server's local disk. On hosts with ephemeral disks (e.g. Render free tier) they are lost on redeploy; use a persistent disk or object storage for production.
