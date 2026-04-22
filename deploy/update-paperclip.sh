#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="/root/paperclip"
ENV_FILE="${REPO_ROOT}/deploy/.env"
SERVICE_NAME="paperclip"
SERVICE_UNIT_SRC="${REPO_ROOT}/deploy/${SERVICE_NAME}.service"
SERVICE_UNIT_DST="/etc/systemd/system/${SERVICE_NAME}.service"
API_BASE="http://127.0.0.1:3100"
PREFERRED_REMOTE="${PAPERCLIP_UPDATE_REMOTE:-upstream}"

cd "${REPO_ROOT}"

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "ERROR: ${ENV_FILE} not found"
  exit 1
fi

if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "ERROR: git working tree is not clean. Commit or stash changes before update."
  exit 1
fi

CURRENT_BRANCH="$(git rev-parse --abbrev-ref HEAD)"
PREV_COMMIT="$(git rev-parse HEAD)"
resolve_update_target() {
  local branch="${CURRENT_BRANCH}"
  local candidates=("${PREFERRED_REMOTE}")

  if [[ "${PREFERRED_REMOTE}" != "upstream" ]]; then
    candidates+=("upstream")
  fi
  if [[ "${PREFERRED_REMOTE}" != "origin" ]]; then
    candidates+=("origin")
  fi

  local remote
  for remote in "${candidates[@]}"; do
    if git remote get-url "${remote}" >/dev/null 2>&1 && \
      git ls-remote --exit-code --heads "${remote}" "${branch}" >/dev/null 2>&1; then
      printf '%s %s\n' "${remote}" "${branch}"
      return 0
    fi
  done

  local tracking_ref
  tracking_ref="$(git rev-parse --abbrev-ref --symbolic-full-name @{u} 2>/dev/null || true)"
  if [[ -n "${tracking_ref}" ]]; then
    printf '%s %s\n' "${tracking_ref%%/*}" "${tracking_ref#*/}"
    return 0
  fi

  return 1
}

if ! read -r REMOTE_NAME REMOTE_BRANCH < <(resolve_update_target); then
  echo "ERROR: could not determine a git remote to update from"
  exit 1
fi

HEALTH_TMP="$(mktemp)"
COMPANIES_TMP="$(mktemp)"
trap 'rm -f "${HEALTH_TMP}" "${COMPANIES_TMP}"' EXIT

health_check() {
  curl -fsS "${API_BASE}/api/health" >"${HEALTH_TMP}"
  if ! rg -q '"status"\s*:\s*"ok"' "${HEALTH_TMP}"; then
    echo "ERROR: /api/health did not report status=ok"
    cat "${HEALTH_TMP}"
    return 1
  fi

  local code
  code="$(curl -sS -o "${COMPANIES_TMP}" -w '%{http_code}' "${API_BASE}/api/companies")"
  if [[ "${code}" != "200" && "${code}" != "403" ]]; then
    echo "ERROR: /api/companies unexpected status code: ${code}"
    cat "${COMPANIES_TMP}"
    return 1
  fi
  return 0
}

rollback() {
  echo "[rollback] Resetting git to ${PREV_COMMIT}"
  git reset --hard "${PREV_COMMIT}"

  echo "[rollback] Reinstalling dependencies"
  pnpm install --frozen-lockfile

  echo "[rollback] Rebuilding"
  pnpm build

  echo "[rollback] Restoring service unit"
  if [[ -f "${SERVICE_UNIT_SRC}" ]]; then
    cp "${SERVICE_UNIT_SRC}" "${SERVICE_UNIT_DST}"
    systemctl daemon-reload
  fi

  echo "[rollback] Restarting service"
  systemctl restart "${SERVICE_NAME}"

  echo "[rollback] Running health checks"
  health_check
}

set +e

echo "[0/8] update target ${REMOTE_NAME}/${REMOTE_BRANCH}"

echo "[1/8] git fetch"
git fetch --prune "${REMOTE_NAME}" "${REMOTE_BRANCH}"
FETCH_RC=$?
if [[ ${FETCH_RC} -ne 0 ]]; then
  echo "ERROR: git fetch failed"
  exit 1
fi

echo "[2/8] change check"
LOCAL_COMMIT="$(git rev-parse HEAD)"
REMOTE_COMMIT="$(git rev-parse FETCH_HEAD)"
if [[ "${LOCAL_COMMIT}" == "${REMOTE_COMMIT}" ]]; then
  echo "No remote changes. Exiting without update."
  exit 0
fi

echo "[3/8] git fast-forward"
git merge --ff-only FETCH_HEAD
if [[ $? -ne 0 ]]; then
  echo "ERROR: git fast-forward failed"
  rollback
  exit 1
fi

echo "[4/8] pnpm install --frozen-lockfile"
pnpm install --frozen-lockfile
if [[ $? -ne 0 ]]; then
  echo "ERROR: pnpm install failed"
  rollback
  exit 1
fi

echo "[5/8] pnpm build"
pnpm build
if [[ $? -ne 0 ]]; then
  echo "ERROR: pnpm build failed"
  rollback
  exit 1
fi

echo "[6/8] pnpm db:migrate"
set -a
# shellcheck disable=SC1090
source "${ENV_FILE}"
set +a
pnpm db:migrate
if [[ $? -ne 0 ]]; then
  echo "ERROR: pnpm db:migrate failed"
  rollback
  exit 1
fi

echo "[7/8] sync service unit"
if [[ ! -f "${SERVICE_UNIT_SRC}" ]]; then
  echo "ERROR: service unit source not found: ${SERVICE_UNIT_SRC}"
  rollback
  exit 1
fi
cp "${SERVICE_UNIT_SRC}" "${SERVICE_UNIT_DST}"
systemctl daemon-reload

echo "[8/8] service restart"
systemctl restart "${SERVICE_NAME}"
if [[ $? -ne 0 ]]; then
  echo "ERROR: service restart failed"
  rollback
  exit 1
fi

echo "[9/9] health check"
health_check
if [[ $? -ne 0 ]]; then
  echo "ERROR: health check failed"
  rollback
  exit 1
fi

set -e

echo "Update completed successfully."
