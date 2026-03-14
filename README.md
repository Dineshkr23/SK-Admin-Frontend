# SK Super TMT Admin Frontend

Next.js admin panel with Material UI (M3-style theme).

## Setup

1. Copy `.env.example` to `.env.local` and set `NEXT_PUBLIC_API_URL` to your backend URL (e.g. http://localhost:3000).
2. `npm run dev` — development; `npm run build && npm run start` — production.

## Routes

- `/login` — Admin login (stores JWT in localStorage).
- `/` — Redirects to `/login` or `/submissions`.
- `/submissions` — Table of form submissions with search, filters (profession type, status flags), pagination, and “View” detail dialog. Logout in header.
