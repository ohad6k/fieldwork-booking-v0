#!/usr/bin/env bash
set -euo pipefail

# Disposable database for the migration contract. No host ports or volumes.
container=$(docker run --detach --rm --network none \
  --env POSTGRES_HOST_AUTH_METHOD=trust \
  public.ecr.aws/supabase/postgres:17.12.0.000)
trap 'docker rm -f "$container" >/dev/null 2>&1 || true' EXIT

sql() {
  docker exec -i "$container" psql -XAtq -v ON_ERROR_STOP=1 -U postgres
}
for attempt in {1..60}; do
  if docker exec "$container" pg_isready -h 127.0.0.1 -U postgres >/dev/null 2>&1; then break; fi
  sleep 1
done
for migration in supabase/migrations/*.sql; do sql < "$migration"; done
sql < supabase/seed.sql
result=$(sql < supabase/tests/workshop.test.sql)
echo "$result"
plan=$(sed -n 's/^1\.\.\([0-9][0-9]*\)$/\1/p' <<< "$result")
passed=$(grep -c '^ok [0-9]' <<< "$result" || true)
[[ -n "$plan" && "$plan" -gt 0 && "$passed" -eq "$plan" ]]
! grep -Eq '^(not ok|Bail out!)' <<< "$result"
