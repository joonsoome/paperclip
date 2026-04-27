## Model Compatibility Policy (JOO-10)

OpenCode adapter enforces model compatibility guardrails to prevent runtime failures from unsupported or problematic models.

### Forbidden Models

The following models are blocked due to known issues:

| Model | Reason | Recommended Alternatives |
|-------|--------|-------------------------|
| `qwen/qwen3.5-122b` | Context size limits frequently exceeded; prone to MidStreamFallbackError | `qwen/qwen3.5-35b`, `qwen/qwen3-coder-next` |
| `litellm/qwen3.5-122b-a10b-instruct` | Context size limits frequently exceeded; prone to MidStreamFallbackError | `litellm/qwen3.5-35b-a3b-instruct`, `litellm/qwen3-coder-next-instruct` |

### Error Behavior

When a forbidden model is configured:
- **Before execution**: Preflight validation runs before `opencode run` invocation
- **Actionable error message** returned immediately (no retry loop):
  ```
  [JOO-10 Model Policy Violation] Model "litellm/qwen3.5-122b-a10b-instruct" is not allowed.
  Reason: Context size limits frequently exceeded; prone to MidStreamFallbackError
  Recommended alternatives: litellm/qwen3.5-35b-a3b-instruct, litellm/qwen3-coder-next-instruct
  ```
- **No automatic retries**: Unlike JOO-9 behavior that caused infinite retry loops on unsupported models
- **Adaptive fallback available via config**: Operators can specify `fallbackModels` in runtime config to auto-switch to alternatives

### Implementation Locations

- Policy definition: `/root/paperclip/packages/adapters/opencode-local/src/index.ts`
- Validation logic: `/root/paperclip/packages/adapters/opencode-local/src/server/models.ts`

### Updating the Policy

To add a new forbidden model or change recommendations:

1. Edit `MODEL_COMPATIBILITY_POLICY` in `/root/paperclip/packages/adapters/opencode-local/src/index.ts`
2. Update this documentation section
3. Commit changes with note about why the model was blocked
4. Deploy updated adapter (no database migration required)

---

pos
# Paperclip Deploy Operations

This deployment keeps runtime/config data inside `/root/paperclip`.

## Layout

- Runtime env: `/root/paperclip/deploy/.env`
- Live worktree: `/root/paperclip/deploy/live`
- Service unit source: `/root/paperclip/deploy/paperclip.service`
- Update script: `/root/paperclip/deploy/update-paperclip.sh`
- Example env template: `/root/paperclip/deploy/paperclip.env.example`

The live service runs from the dedicated `deploy/live` worktree, which should stay pinned to a clean `upstream/master` line. That keeps deployment separate from the main development checkout and avoids rebase churn from local feature work.
The update script bootstraps and refreshes that worktree, then syncs `/etc/systemd/system/paperclip.service` from the local deploy files before restarting.
The deploy helper files above are intentionally local-only and ignored by git in this fork. Only the deployment docs and example env stay tracked.
This deployment also pins the runtime PostgreSQL pool with `PAPERCLIP_DB_POOL_MAX=4` so the app stays below the reserved-slot ceiling of the hosted cluster.

## Install / Refresh Service

```bash
cd /root/paperclip
cp deploy/paperclip.env.example deploy/.env
/root/paperclip/deploy/update-paperclip.sh
systemctl enable --now paperclip
```

If you only changed the service unit, rerun the update script or copy the local service file to `/etc/systemd/system/paperclip.service`, then `systemctl daemon-reload` and restart `paperclip`.

## Initial Setup

```bash
cd /root/paperclip
cp deploy/paperclip.env.example deploy/.env
/root/paperclip/deploy/update-paperclip.sh
```

## Health Check

```bash
curl http://127.0.0.1:3100/api/health
curl -i http://127.0.0.1:3100/api/companies
```

`/api/companies` returning `403` is expected before board login in authenticated mode.

## External Domain (Nginx Proxy Manager / TLS)

Use these in `deploy/.env` for public DNS:

```bash
PAPERCLIP_DEPLOYMENT_EXPOSURE=public
PAPERCLIP_AUTH_BASE_URL_MODE=explicit
PAPERCLIP_PUBLIC_URL=https://<your-domain>
```

For the current public deployment, set:

```bash
PAPERCLIP_PUBLIC_URL=https://paper.joonsoo.me
```

If Postgres connection pressure returns, adjust `PAPERCLIP_DB_POOL_MAX` in `/root/paperclip/deploy/.env` first before touching the database server itself.

## Operational Checklist

### Before deploying a code change

1. Confirm the local `master` branch is the intended deployment base.
2. Check `git status --short --branch` and make sure only the intended changes are present.
3. If the change is upstreamable, move it to a fresh branch from `upstream/master` instead of deploying it directly from a messy branch.
4. Run the relevant verification for the change before restarting the service.

### During deployment

1. Update the checkout or pull the desired commit.
2. Run `pnpm build`.
3. Run `pnpm db:migrate` if schema changes are included.
4. Restart the `paperclip` service.

### After deployment

1. Check `http://127.0.0.1:3100/api/health`.
2. Check the public endpoint at `https://paper.joonsoo.me`.
3. Confirm the service logs show a clean startup.
4. Keep runtime state in `deploy/` and `instances/`, not in tracked source files.

## Manual Update

```bash
/root/paperclip/deploy/update-paperclip.sh
```

By default the update script pulls from the upstream default branch into the local `deploy/live` worktree. Set `PAPERCLIP_UPDATE_REMOTE=origin` if you need to follow the fork remote instead.
It refreshes the systemd unit from the local deploy file and reloads systemd before the restart step.
