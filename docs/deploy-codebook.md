# Deploy codebook (private) — Frontend ef3 / x7

Owner/developer documentation only. Do **not** put semantic words like
`frontend`, `backend`, or `orderly` into AWS resource names.

## Private codebook

| Code | Meaning |
|------|---------|
| `fs-A1-d3e4` | Project |
| `ef3` | Frontend (semantic component) |
| `fe4b` | Backend (semantic component) |
| `x7` | Frontend runtime / UI |
| `k9` | Backend runtime / API |
| `n2` | Docker network |
| `p5` | PostgreSQL |
| `v8` | PostgreSQL volume |
| `i6` | Image/archive storage |
| `u4` | Deployment user |

## Hierarchy

```text
fs-A1-d3e4
├── ef3
│   └── x7
├── fe4b
│   └── k9
├── n2
├── p5
├── v8
├── i6
└── u4
```

Runtime Docker relationship:

```text
fs-A1-d3e4-n2
├── fs-A1-d3e4-x7
├── fs-A1-d3e4-k9
└── fs-A1-d3e4-p5
    └── fs-A1-d3e4-v8
```

Infrastructure resource names (opaque):

| Role | Name |
|------|------|
| Frontend runtime | `fs-A1-d3e4-x7` |
| Backend runtime | `fs-A1-d3e4-k9` |
| Network | `fs-A1-d3e4-n2` |
| PostgreSQL | `fs-A1-d3e4-p5` |
| Volume | `fs-A1-d3e4-v8` |
| Deploy user | `fs-A1-d3e4-u4` |
| Images (x7) | `/opt/fs-A1-d3e4/x7/images/` |
| Images (k9) | `/opt/fs-A1-d3e4/k9/images/` |

### Semantic vs runtime

| Layer | Frontend | Backend |
|-------|----------|---------|
| Semantic (docs only) | `ef3` | `fe4b` |
| Runtime (AWS/Docker) | `x7` | `k9` |

- `ef3` → Frontend → `x7` → frontend runtime
- `fe4b` → Backend → `k9` → backend/API runtime

**Never use as resource names:** `frontend`, `backend`, `api`, `web`, `orderly`,
`fs-A1-d3e4-frontend`, `fs-A1-d3e4-backend`, `/opt/fs-A1-d3e4/frontend/`,
`/opt/fs-A1-d3e4/backend/`.

## Current CI scope (this repository)

Workflow: `.github/workflows/ci-deploy.yml` (**CI Deploy**)

Five jobs: Checks → Build → Create Docker Image → SSH Access → Deployment

Deploys **Frontend only** (`ef3` → `x7`). No registry. Transfer: image → tar →
gzip → Actions artifact → SCP → `docker load`.

| Kind | Value |
|------|--------|
| Image | `fs-A1-d3e4-x7:<github-sha>` |
| Container | `fs-A1-d3e4-x7` |
| Archive | `fs-A1-d3e4-x7-<sha>.tar.gz` |
| Artifact | `fs-A1-d3e4-x7-<sha>` |
| Network | `fs-A1-d3e4-n2` |
| Env file | `/opt/fs-A1-d3e4/config/x7.env` |
| Images dir | `/opt/fs-A1-d3e4/x7/images/` |
| Internal listen | `:3000` (`HOST=0.0.0.0`, `PORT=3000`) |

**No host port publish** (`-p` forbidden). Reverse proxy comes later.

This workflow must **never** modify: `fs-worker`, Trino, Ollama, `fs-A1-d3e4-k9`,
`fs-A1-d3e4-p5`.

## PostgreSQL (outside CI)

`fs-A1-d3e4-p5` / `fs-A1-d3e4-v8` are provisioned outside this workflow.
Frontend CI must never create, replace, stop, or remove PostgreSQL.

## NO ROLLBACK

- Archives under `/opt/fs-A1-d3e4/x7/images/` (latest 5) are **not** a rollback system.
- No automatic rollback, rollback job, rollback script, or restore-on-failure.
- If deployment fails, the workflow fails; unrelated resources stay untouched.
- The target container is stopped/replaced only after its configured image
  identity is verified to start with `fs-A1-d3e4-x7:`.
- Post-deploy check: target container is running (`docker ps`) only.

## Server layout (shared with Backend)

```text
/opt/fs-A1-d3e4/
├── k9/images/
├── x7/images/
└── config/
    ├── k9.env
    └── x7.env
```

## Container start

```bash
docker run -d \
  --name fs-A1-d3e4-x7 \
  --restart unless-stopped \
  --network fs-A1-d3e4-n2 \
  --env-file /opt/fs-A1-d3e4/config/x7.env \
  fs-A1-d3e4-x7:<sha>
```

## `x7.env` keys (from application)

Runtime public env (SvelteKit `$env/dynamic/public`):

```env
# Reach API on the private Docker network (no host port on k9).
PUBLIC_API_URL=http://fs-A1-d3e4-k9:8080
PUBLIC_BASE_DOMAIN=orderly.qd.je
HOST=0.0.0.0
PORT=3000
NODE_ENV=production
```

`HOST`/`PORT` are also set in the Dockerfile; repeating them in `x7.env` is fine.

Browser clients eventually need a public API URL via reverse proxy — that comes
later. Until then, SSR on the same Docker network can call `fs-A1-d3e4-k9:8080`.

## GitHub secrets

Same secrets as Backend (configure on **orderly-frontend** repo as well):

| Secret | Value |
|--------|--------|
| `FS_A1_D3E4_DEPLOY_HOST` | AWS host |
| `FS_A1_D3E4_DEPLOY_USER` | `fs-A1-d3e4-u4` |
| `FS_A1_D3E4_DEPLOY_SSH_KEY` | private key |
| `FS_A1_D3E4_SSH_KNOWN_HOSTS` | pinned known_hosts |

## One-time AWS extras for x7

Assuming Backend bootstrap already created user, network, and `/opt/fs-A1-d3e4`:

```bash
# Ensure x7 image dir exists (usually already created)
mkdir -p /opt/fs-A1-d3e4/x7/images

# Create x7.env (owned by fs-A1-d3e4-u4)
cat > /opt/fs-A1-d3e4/config/x7.env <<'EOF'
PUBLIC_API_URL=http://fs-A1-d3e4-k9:8080
PUBLIC_BASE_DOMAIN=orderly.qd.je
HOST=0.0.0.0
PORT=3000
NODE_ENV=production
EOF
```

Checklist before first Frontend deploy:

- [ ] Secrets set on `orderly-frontend` GitHub repo
- [ ] `/opt/fs-A1-d3e4/x7/images` exists
- [ ] `/opt/fs-A1-d3e4/config/x7.env` exists
- [ ] Network `fs-A1-d3e4-n2` exists
- [ ] Preferably `fs-A1-d3e4-k9` already running if SSR needs the API
- [ ] Push to `main` or run **CI Deploy** via `workflow_dispatch`
