# Orderly Frontend

SvelteKit + TypeScript + Tailwind. Host-based multi-tenant portals.

## Run

```bash
cp .env.example .env
npm install
npm run dev
```

## Local URLs

| Host / path | Purpose |
|-------------|---------|
| http://localhost:5173/ | Redirects to Super Admin login |
| http://localhost:5173/superadmin/login | **Super Admin login** |
| http://localhost:5173/superadmin/setup | **First-time Super Admin setup** |
| http://localhost:5173/superadmin | **Super Admin dashboard** |
| http://localhost:5173/superadmin/tenants | Tenant management |
| http://{slug}.localhost:5173/ | Customer storefront |
| http://{slug}.localhost:5173/login | Tenant admin / staff login |
| http://{slug}.localhost:5173/shop | Tenant admin dashboard |
| http://{slug}.localhost:5173/kitchen | Kitchen board |
| http://{slug}.localhost:5173/setup-password?token=… | First-time password |

`/admin/*` redirects to `/superadmin/*` (legacy alias only).

### Typical flow

1. Open http://localhost:5173/superadmin/login → complete **setup** on a fresh DB, then sign in.
2. You land on `/superadmin` (platform dashboard).
3. Onboard a tenant under **Onboard Tenant**.
4. Open the invite link on `{slug}.localhost` → set password.
5. Sign in at `{slug}.localhost/login` → `/shop`.

Set `PUBLIC_API_URL=http://api.localhost:8080` (or `http://localhost:8080`).

Modern browsers resolve `*.localhost` to 127.0.0.1 automatically.
