#!/usr/bin/env bash
#
# Render every Super Admin route against a running dev server and report
# status, size and title.
#
# The console authenticates in the browser, so a server render can only prove
# that a route exists, resolves its layout and does not throw — which is
# exactly the class of failure a type check cannot see: a bad import, a missing
# page for a rail entry, a server load that redirects to the wrong place.
#
#   npm run dev                                   # in another terminal
#   bash scripts/check_superadmin_routes.sh
#
# APP overrides the origin (e.g. a preview build on :4173).
set -uo pipefail

APP="${APP:-http://localhost:5173}"

pass=0
fail=0

# Routes that must render. A signed-out browser gets the shell skeleton, which
# is still a 200 with a resolved layout.
ROUTES=(
  /superadmin
  /superadmin/businesses
  /superadmin/businesses/new
  /superadmin/plans
  /superadmin/iam
  /superadmin/providers
  /superadmin/providers/smtp
  /superadmin/providers/storage
  /superadmin/providers/ai
  /superadmin/notifications
  /superadmin/activity
  /superadmin/activity?tab=audit
  /superadmin/health
  /superadmin/settings
  /superadmin/settings?section=branding
  /superadmin/settings?section=security
  /superadmin/settings?section=business-types
  /superadmin/settings?section=profile
  /superadmin/login
)

# Legacy addresses that must keep working, and where they must land.
declare -a REDIRECTS=(
  "/superadmin/tenants|/superadmin/businesses"
  "/superadmin/tenants/new|/superadmin/businesses/new"
  "/superadmin/users|/superadmin/iam"
  "/superadmin/settings/smtp|/superadmin/providers/smtp"
  "/superadmin/settings/storage|/superadmin/providers/storage"
  "/superadmin/settings/ai|/superadmin/providers/ai"
  "/superadmin/audit|/superadmin/activity?tab=audit"
)

printf '%s\n' "Rendering Super Admin routes against ${APP}"
printf '%s\n' "----------------------------------------------------------------"

for route in "${ROUTES[@]}"; do
  body="$(curl -s -o /tmp/orderly-sa-body -w '%{http_code}' "${APP}${route}")"
  size="$(wc -c </tmp/orderly-sa-body | tr -d ' ')"
  title="$(grep -o '<title>[^<]*</title>' /tmp/orderly-sa-body | head -1 | sed 's/<[^>]*>//g')"
  if [ "$body" = "200" ]; then
    printf '  ok    %-44s %s  %6s bytes  %s\n' "$route" "$body" "$size" "$title"
    pass=$((pass + 1))
  else
    printf '  FAIL  %-44s %s\n' "$route" "$body"
    fail=$((fail + 1))
  fi
done

printf '%s\n' ""
printf '%s\n' "Legacy addresses still resolve"
printf '%s\n' "----------------------------------------------------------------"

for pair in "${REDIRECTS[@]}"; do
  from="${pair%%|*}"
  want="${pair##*|}"
  location="$(curl -s -o /dev/null -D - "${APP}${from}" | awk 'tolower($1)=="location:" {print $2}' | tr -d '\r')"
  if [ "$location" = "$want" ]; then
    printf '  ok    %-44s -> %s\n' "$from" "$location"
    pass=$((pass + 1))
  else
    printf '  FAIL  %-44s -> %s (want %s)\n' "$from" "${location:-no redirect}" "$want"
    fail=$((fail + 1))
  fi
done

rm -f /tmp/orderly-sa-body
printf '%s\n' ""
if [ "$fail" -eq 0 ]; then
  printf '%s\n' "all ${pass} route checks passed"
  exit 0
fi
printf '%s\n' "${fail} of $((pass + fail)) route checks FAILED"
exit 1
