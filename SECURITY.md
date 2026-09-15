# Security Policy

## Reporting a vulnerability

Please do not report security vulnerabilities in a public GitHub issue. Use GitHub's private security advisory feature or contact the repository owner through their GitHub profile with a clear description, reproduction steps, and potential impact.

## Deployment requirements

- Set `DEV_CREATE_USER_KEY` to a long, unique random value. It is the password for the admin login and signs admin session tokens.
- Set `SUPABASE_SERVICE_ROLE_KEY` only in server-side environment variables. Never use it in client components or expose it as a `NEXT_PUBLIC_*` variable.
- Keep `.env.local` and all production environment files out of version control.
- Disable or restrict `/api/dev/*` and `/api/test/*` routes for public production deployments unless they are required by an authenticated test environment.
- Review Supabase Row Level Security policies before deploying a new schema.

The repository includes `.env.example` with placeholder values for local setup.