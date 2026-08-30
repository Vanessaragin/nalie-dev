#!/usr/bin/env bash
set -euo pipefail

if rg -n --hidden \
  --glob '!node_modules/**' \
  --glob '!**/.next/**' \
  --glob '!**/.next*/**' \
  --glob '!apps/web/app/api/**' \
  'NEXT_PUBLIC_[A-Z0-9_]*SERVICE_ROLE|SUPABASE_SERVICE_ROLE_KEY' apps/web packages; then
  echo 'Server-only service-role key reference found in browser-owned code.' >&2
  exit 1
fi

echo 'No service-role key reference found in browser-owned code.'
