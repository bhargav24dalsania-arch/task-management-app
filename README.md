# Task Management App

Production-ready full-stack version of the original local HTML task management prototype.

## Stack

- Frontend: React with Next.js
- Backend: Node.js with Express
- Database: PostgreSQL
- ORM: Prisma
- Authentication: Email/password with JWT and bcrypt password hashing

## Structure

```text
frontend/          Next.js application
backend/           Express API
backend/prisma/    Prisma schema, migrations, and seed data
outputs/           Original local HTML prototype kept for reference
```

## Environment

Copy `.env.example` to `.env` and update the values:

```bash
DATABASE_URL="postgresql://taskflow_user:taskflow_password@localhost:5432/taskflow_enterprise?schema=public"
JWT_SECRET="replace-with-a-long-random-secret"
PORT="4000"
CORS_ORIGIN="http://localhost:3000,http://127.0.0.1:3000"
NEXT_PUBLIC_API_URL="http://localhost:4000/api"
```

## Local Setup

```bash
npm install
npx prisma generate --schema backend/prisma/schema.prisma
npx prisma migrate deploy --schema backend/prisma/schema.prisma
npm run db:seed
npm run dev:backend
npm run dev:frontend
```

Frontend: `http://localhost:3000`

Backend health check: `http://localhost:4000/api/health`

## Production Scripts

```bash
npm install
npm run build
npm run start
npx prisma generate --schema backend/prisma/schema.prisma
npx prisma migrate deploy --schema backend/prisma/schema.prisma
```

`npm run start` starts the backend API. Deploy the Next.js frontend separately with `npm run start:frontend` or through a managed frontend host.

## Main API Modules

All API routes are available under `/api`.

- `POST /api/auth/login`
- `GET /api/auth/me`
- `/api/users`
- `/api/roles`
- `/api/companies`
- `/api/clients`
- `/api/projects`
- `/api/scopes`
- `/api/tasks`
- `/api/recurring-tasks`
- `/api/timers`
- `/api/comments`
- `/api/notifications`
- `/api/time-logs`
- `/api/audit-logs`

## Persistence

Business data is stored permanently in PostgreSQL through Prisma. The frontend uses React state only after loading data from the backend. It does not store important business records in browser state, JavaScript variables, or local browser storage. The only browser storage used is the JWT token for session continuity.

Database-backed modules include users, companies, clients, projects, scopes, tasks, recurring tasks, timer sessions, time logs, comments, status history, notifications, audit logs, roles, and permissions.

## Demo Login

After seeding:

- Email: `master.admin@taskflow.local`
- Password: `demo`

Seeded demo users use the password `demo`.

## AWS Deployment Outline

1. Create a PostgreSQL database with Amazon RDS.
2. Set `DATABASE_URL` to the RDS connection string.
3. Deploy `backend/` to ECS, Elastic Beanstalk, EC2, or App Runner.
4. Configure backend environment variables: `DATABASE_URL`, `JWT_SECRET`, `PORT`, and `CORS_ORIGIN`.
5. Run:

```bash
npm install
npx prisma generate --schema backend/prisma/schema.prisma
npx prisma migrate deploy --schema backend/prisma/schema.prisma
npm run build
npm run start
```

6. Deploy `frontend/` to Amplify, S3 plus CloudFront, Vercel, or another Next.js host.
7. Set `NEXT_PUBLIC_API_URL` to the public backend URL ending in `/api`.
8. Set `CORS_ORIGIN` on the backend to the public frontend URL.
9. Verify `GET /api/health`.
10. Create real Master Admin credentials and rotate `JWT_SECRET`.

## Persistence Test

1. Start PostgreSQL, backend, and frontend.
2. Log in.
3. Create a client, project, scope, task, timer entry, or user.
4. Refresh the browser, close and reopen it, then log in again.
5. Confirm the record is still visible.

If a save fails, the frontend shows the backend error message and does not treat the record as saved.
