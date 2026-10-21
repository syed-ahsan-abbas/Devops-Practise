# DevOps Lab

A small full-stack app (Node.js + Express backend, static HTML/CSS/JS frontend) built only as a target for DevOps practice.
It contains **no** Docker, CI or infra files on purpose. You add those.

## Run locally
```bash
npm install
cp .env.example .env      # optional
npm start                 # http://localhost:3000
npm test                  # unit/API tests (Node built-in runner)
```

## Endpoints
| Path | Purpose |
|------|---------|
| `GET /health` | Liveness probe |
| `GET /ready` | Readiness probe (503 when toggled off) |
| `GET /metrics` | Prometheus metrics |
| `GET /api/info` | Version, env, hostname, uptime |
| `GET/POST /api/tasks`, `PATCH/DELETE /api/tasks/:id` | Sample CRUD |
| `POST /api/chaos/crash`, `POST /api/chaos/unready`, `GET /api/chaos/slow`, `GET /api/chaos/load` | Only when `ENABLE_CHAOS=true` |

## Environment variables
`PORT`, `NODE_ENV`, `APP_VERSION`, `ENABLE_CHAOS`, `DATA_FILE` (see `.env.example`).

## Practice ideas
1. **Docker**: write a Dockerfile (multi-stage, non-root user, HEALTHCHECK on `/health`), then docker-compose.
2. **CI**: GitHub Actions running `npm ci && npm test`, then build and push the image.
3. **CD**: deploy to a VM over SSH, or to Kubernetes with liveness (`/health`) and readiness (`/ready`) probes.
4. **Persistence**: set `DATA_FILE=/data/tasks.json` and mount a volume.
5. **Monitoring**: scrape `/metrics` with Prometheus, build a Grafana dashboard.
6. **Resilience**: use the chaos buttons to test restart policies, rollouts and autoscaling (HPA).
7. **Config/secrets**: inject `APP_VERSION` from the git tag or commit SHA in your pipeline.
8. **Security**: add Trivy/Snyk image scans, `npm audit`, and Dependabot.
