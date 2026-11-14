# CivicFlow Frontend

React + Vite frontend for the CivicFlow platform.

## Prerequisites
- Node.js ≥ 18
- A running CivicFlow backend (`npm start` in `/backend`)
- Firebase project (same one the backend uses)

## Setup

```bash
cd "CIVICFLOW MODEL/frontend"
npm install
cp .env.example .env
# Fill in .env with your Firebase config and backend URL
npm run dev
```

App runs at `http://localhost:3000`.

## Environment Variables

| Variable | Description |
|---|---|
| `VITE_API_BASE_URL` | Backend base URL (default: `http://localhost:8080`) |
| `VITE_FIREBASE_API_KEY` | Firebase Web API key |
| `VITE_FIREBASE_AUTH_DOMAIN` | Firebase auth domain |
| `VITE_FIREBASE_PROJECT_ID` | Firebase project ID |
| `VITE_FIREBASE_APP_ID` | Firebase App ID |

## Pages & Routes

| Route | Role | Description |
|---|---|---|
| `/auth` | Public | Login / Register via Firebase |
| `/dashboard` | CITIZEN | Citizen overview – stats, recent reports |
| `/reports` | All | List own reports with status filter |
| `/reports/new` | All | Submit new civic issue (image + location) |
| `/reports/:id` | All | Report detail + AI analysis + actions |
| `/rewards` | CITIZEN | EcoCoins wallet, catalog, redemption, history |
| `/notifications` | All | Notification centre + activity stream |
| `/profile` | All | Edit display name & contact info |
| `/worker/tasks` | WORKER | Assigned tasks – start & resolve |
| `/admin/reports` | ADMIN + | Full report management + worker assignment |
| `/admin/users` | ADMIN + | User management, role + status changes |
| `/admin/analytics` | ADMIN + | KPIs, category breakdown, worker leaderboard |
| `/admin/audit` | SUPER_ADMIN | Immutable audit log |

## API Endpoints Wired

All 25+ backend endpoints are connected through `src/lib/api.js`:

- `POST /auth/sync` — sync Firebase user to backend profile  
- `GET  /auth/me` — load current user profile  
- `PATCH /auth/me` — update profile  
- `GET  /users` — list users (admin)  
- `GET  /users/:id` — get user  
- `PATCH /users/:id/role` — change role  
- `PATCH /users/:id/status` — activate/deactivate  
- `POST /reports/upload-signature` — Cloudinary signed upload  
- `POST /reports` — create report  
- `GET  /reports` — list reports  
- `GET  /reports/:id` — report detail  
- `PATCH /reports/:id/assign` — assign to worker  
- `PATCH /reports/:id/status` — update status  
- `GET  /rewards/catalog` — reward items  
- `GET  /rewards/wallet` — EcoCoin balance  
- `GET  /rewards/history` — transaction history  
- `POST /rewards/redeem` — redeem reward  
- `GET  /citizen/dashboard` — citizen stats  
- `GET  /worker/tasks` — worker task list  
- `GET  /worker/stats` — worker stats  
- `GET  /worker/tasks/:id` — task detail  
- `PATCH /worker/tasks/:id/start` — start task  
- `PATCH /worker/tasks/:id/resolve` — resolve task  
- `GET  /analytics/overview` — overview KPIs  
- `GET  /analytics/by-category` — category breakdown  
- `GET  /analytics/heatmap` — heatmap data  
- `GET  /analytics/workers` — worker leaderboard  
- `GET  /notifications` — notifications list  
- `GET  /notifications/stream` — activity stream  
- `PATCH /notifications/read-all` — mark all read  
- `PATCH /notifications/:id/read` — mark one read  
- `GET  /audit` — audit log (super admin)  
- `GET  /health/liveness` — health check  
- `GET  /health/readiness` — readiness check  
