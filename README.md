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
| http://localhost:5173/superadmin | **Platform dashboard** |
| http://localhost:5173/superadmin/businesses | All businesses |
| http://localhost:5173/superadmin/businesses/new | Onboard a business (7-step wizard) |
| http://localhost:5173/superadmin/plans | Plans & subscriptions |
| http://localhost:5173/superadmin/iam | Users & IAM |
| http://localhost:5173/superadmin/providers | Providers & integrations |
| http://localhost:5173/superadmin/notifications | Platform notifications |
| http://localhost:5173/superadmin/activity | Activity feed |
| http://localhost:5173/superadmin/audit | Audit logs |
| http://localhost:5173/superadmin/health | System health |
| http://localhost:5173/superadmin/settings | General, branding, security, business types |
| http://{slug}.localhost:5173/ | Customer storefront |
| http://{slug}.localhost:5173/login | Tenant admin / staff login |
| http://{slug}.localhost:5173/shop | Tenant admin dashboard |
| http://{slug}.localhost:5173/kitchen | Kitchen board |
| http://{slug}.localhost:5173/setup-password?token=… | First-time password |

`/admin/*` redirects to `/superadmin/*` (legacy alias only). `/superadmin/tenants*`
and `/superadmin/users` redirect to their `businesses` / `iam` replacements, so older
links keep working.

### Business types

Onboarding starts from a business type — food shop, grocery, cafe, restaurant, hotel —
and that choice configures the new tenant's theme, storefront layout, product
terminology, starter categories, order workflow and payment methods in the same
transaction that creates it. The catalogue lives in the database
(Settings → Business types) and the per-type defaults live in one module,
`src/lib/admin/businessTypes.ts`. A type added to the catalogue without a matching
template still works: it falls back to neutral defaults rather than breaking a screen.

### Typical flow

1. Open http://localhost:5173/superadmin/login → complete **setup** on a fresh DB, then sign in.
2. You land on `/superadmin` (platform dashboard).
3. Onboard a business under **Businesses → Onboarding**.
4. Open the invite link on `{slug}.localhost` → set password.
5. Sign in at `{slug}.localhost/login` → `/shop`.

Leave `PUBLIC_API_URL` empty to use the Vite `/api` proxy, or set
`PUBLIC_API_URL=http://api.localhost:8080` so both platform and shop calls go to
the shared API host. Shop pages send `X-Tenant-Slug` from the browser hostname.

Modern browsers resolve `*.localhost` to 127.0.0.1 automatically.
