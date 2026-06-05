#!/usr/bin/env bash
set -euo pipefail

echo "[start] DATABASE_URL present: $([ -n "${DATABASE_URL:-}" ] && echo yes || echo NO)"
echo "[start] RAILWAY_PUBLIC_DOMAIN: ${RAILWAY_PUBLIC_DOMAIN:-<unset>}"
echo "[start] PORT: ${PORT:-4000}"

for attempt in 1 2 3 4 5; do
  if npx prisma db push --accept-data-loss --skip-generate; then
    echo "[start] prisma db push ok (attempt $attempt)"
    break
  fi
  if [ "$attempt" -eq 5 ]; then
    echo "[start] prisma db push failed after 5 attempts"
    exit 1
  fi
  echo "[start] prisma db push attempt $attempt failed, retry in 5s..."
  sleep 5
done

exec node dist/index.js
