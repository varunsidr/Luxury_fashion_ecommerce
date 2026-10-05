# Security Policy

## Reporting a vulnerability

Please do not report security vulnerabilities in a public GitHub issue. Use GitHub's private security advisory feature or contact the repository owner through their GitHub profile with a clear description, reproduction steps, and potential impact.

## Deployment requirements

- Apply `supabase_security_hardening_migration.sql` after the review and checkout migrations, then run `npm run security:check-db` against the intended database. This read-only check needs `DATABASE_URL`.
- Configure a separate `ADMIN_CREDENTIALS` password hash for each administrator and an independent `ADMIN_SESSION_SECRET` of at least 32 characters. Production admin login does not use `DEV_CREATE_USER_KEY`.
- Configure a separate `RATE_LIMIT_SECRET` of at least 32 characters and a proxy that overwrites or appends `x-forwarded-for`; admin login, checkout, review creation/upload and restock subscription fail closed if their shared limiter is unavailable.
- Apply the migration that creates a private `review-images` Storage bucket. New review uploads stay private and moderators receive short-lived signed URLs. Existing files in the old public bucket require separate cleanup; orphan uploads still need a retention process.
- Set `SUPABASE_SERVICE_ROLE_KEY` only in server-side environment variables. Never use it in client components or expose it as a `NEXT_PUBLIC_*` variable.
- Keep `.env.local` and all production environment files out of version control.
- Disable or restrict `/api/dev/*` and `/api/test/*` routes for public production deployments unless they are required by an authenticated test environment.
- Review Supabase Row Level Security policies before deploying a new schema.

The repository includes `.env.example` with placeholder values for local setup.
