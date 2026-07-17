#!/usr/bin/env bash
# Render start script — retries Prisma migrate for Neon cold starts.
set -euo pipefail

SCHEMA="apps/api-gateway/prisma/schema.prisma"
MAX_RETRIES="${MIGRATE_RETRIES:-5}"
RETRY_DELAY="${MIGRATE_RETRY_DELAY:-15}"

migrate() {
  npx prisma migrate deploy --schema="$SCHEMA"
}

echo "🔄 Running database migrations..."
for attempt in $(seq 1 "$MAX_RETRIES"); do
  if migrate; then
    echo "✅ Migrations applied"
    break
  fi
  if [[ "$attempt" -eq "$MAX_RETRIES" ]]; then
    echo "❌ Migration failed after ${MAX_RETRIES} attempts"
    echo "   Check DATABASE_URL / DIRECT_DATABASE_URL on Render (Neon requires sslmode=require)"
    exit 1
  fi
  echo "⏳ Attempt ${attempt}/${MAX_RETRIES} failed — retrying in ${RETRY_DELAY}s (Neon may be waking)..."
  sleep "$RETRY_DELAY"
done

echo "🚀 Starting api-gateway..."
exec node apps/api-gateway/dist/index.js
