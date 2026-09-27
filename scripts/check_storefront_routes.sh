#!/usr/bin/env bash
# Renders every storefront route and reports the status, size and title.
# A route that 500s, or renders an error page, is a broken route.
#
# Two kinds of check, kept separate on purpose:
#
#   Precondition — a shop must exist on the host under test. A storefront with
#   nothing behind it still returns 200 with a complete-looking shell, so every
#   per-route assertion below would pass while testing an empty page. That is
#   worse than no check at all, because it looks like coverage.
#
#   Routes       — status, size, title, and that the page says it is being served
#   as the tenant the host names. The admin routes authenticate in the browser,
#   so their server render is only the shell skeleton; their data layer is covered
#   by backend/scripts/smoke_storefront.sh instead.
#
# Set EXPECT_TENANT=0 to check the empty state deliberately.
set -uo pipefail
APP="${APP:-http://127.0.0.1:5173}"
API="${API:-http://127.0.0.1:8080}"
HOST="${HOST:-momo-magic.localhost:5173}"
EXPECT_TENANT="${EXPECT_TENANT-1}"
OUT="$(mktemp -d)"
FAILED=0

# The tenant slug is the first label of HOST: "momo-magic.localhost:5173" is
# momo-magic. The API resolves a tenant from the host too, and without the port.
SLUG="${HOST%%.*}"
API_HOST="${HOST%%:*}"

note() { printf '%s\n' "$*"; }

# ---------------------------------------------------------------------------
# Precondition: is there actually a shop here?
# ---------------------------------------------------------------------------
probe=$(curl -s -o "$OUT/probe.json" -w '%{http_code}' -m 30 \
  -H "Host: $API_HOST" "$API/api/v1/public/store")

if [ "$probe" != "200" ]; then
  if [ "$EXPECT_TENANT" = "0" ]; then
    note "note: no shop on $API_HOST ($probe) — checking the empty state as asked"
  else
    reason=$(sed -n 's/.*"message":"\([^"]*\)".*/\1/p' "$OUT/probe.json" | head -1)
    note "FAIL precondition: no shop is configured for $API_HOST (GET /public/store -> $probe${reason:+: $reason})"
    note ""
    note "Onboard a tenant first, or re-run with EXPECT_TENANT=0 to check that the"
    note "empty state renders without errors:"
    note ""
    note "  http://localhost:5173/superadmin/login   (first run: creates the Super Admin)"
    note "  http://localhost:5173/superadmin/tenants/new"
    note ""
    note "Every route below would otherwise pass while rendering an empty page."
    rm -rf "$OUT"
    exit 1
  fi
fi

printf '%-32s %-5s %-9s %s\n' ROUTE STATUS BYTES TITLE
printf '%s\n' '--------------------------------------------------------------------------'

# check <path> <expected status> <require tenant: yes|no>
check() {
  path="$1"
  expect="$2"
  tenant_required="$3"
  code=$(curl -s -o "$OUT/page.html" -w '%{http_code}' -m 30 -H "Host: $HOST" "$APP$path")
  size=$(wc -c < "$OUT/page.html" | tr -d ' ')
  title=$(grep -o '<title>[^<]*' "$OUT/page.html" | head -1 | sed 's/<title>//')
  if [ "$code" != "$expect" ]; then
    FAILED=$((FAILED + 1))
    title="$title  <-- expected $expect"
  fi
  # The storefront root names the tenant the server resolved, so a page served
  # for the wrong shop is caught rather than quietly counted as coverage.
  if [ "$tenant_required" = "yes" ] && [ "$EXPECT_TENANT" != "0" ]; then
    slug=$(grep -o 'data-sf-tenant="[^"]*"' "$OUT/page.html" | head -1 |
      sed 's/.*="//; s/"$//')
    if [ "$slug" != "$SLUG" ]; then
      FAILED=$((FAILED + 1))
      title="$title  <-- served as tenant '${slug:-none}', expected '$SLUG'"
    fi
  fi
  printf '%-32s %-5s %-9s %s\n' "$path" "$code" "$size" "$title"
}

# Customer storefront.
for path in '/' '/menu' '/menu?q=momo' '/menu?q=zzzz' '/cart' '/checkout' '/orders' \
            '/profile' '/login' '/login?next=%2Fcheckout' '/verify-otp' '/order/1' \
            '/order/0' '/product/does-not-exist' '/nope'; do
  case "$path" in
    # 404 is the correct answer for a missing order or product, so these prove
    # the route works and its lookup fails cleanly, with no tenant needed.
    /order/0|/product/does-not-exist|/nope)
      check "$path" "404" "no"
      ;;
    *)
      check "$path" "200" "yes"
      ;;
  esac
done

# Admin storefront control. One entry per screen, so a screen that fails to
# compile or throws during load is named rather than hidden behind a group.
for path in /shop/login /shop /shop/storefront \
            /shop/customize \
            /shop/customize/branding /shop/customize/theme \
            /shop/customize/homepage /shop/customize/login \
            /shop/storefront/branding /shop/storefront/theme \
            /shop/storefront/homepage /shop/storefront/store-info \
            /shop/storefront/login \
            /shop/storefront/qr /shop/storefront/preview \
            /shop/organization /shop/organization/hours \
            /shop/organization/payments /shop/organization/workflow \
            /shop/settings /shop/settings/integrations \
            /shop/settings/integrations/smtp \
            /shop/settings/integrations/storage \
            /shop/settings/integrations/ai; do
  check "$path" "200" "no"
done

# ---------------------------------------------------------------------------
# The sign-in page must be branded in its very first frame.
#
# It renders precisely when nobody is signed in, so it cannot read the
# authenticated tenant API. If the brand stops reaching it the page still renders
# and still returns 200 — it just comes out the platform's indigo on an orange
# shop, which no status check would ever notice.
# ---------------------------------------------------------------------------
if [ "$EXPECT_TENANT" != "0" ]; then
  curl -s -o "$OUT/login.html" -m 30 -H "Host: $HOST" "$APP/shop/login"
  # Scoped to the element's own style attribute. A whole-file grep would happily
  # report the stylesheet's default indigo and look like it had found the brand.
  brand=$(grep -oE '<(main|div)[^>]*style="[^"]*--accent:[^;"]*' "$OUT/login.html" |
    head -1 | grep -oE '\-\-accent:[^;"]*' | head -1)
  if [ -n "$brand" ]; then
    printf '%-32s %-5s %-9s %s\n' '/shop/login (brand)' "200" "-" "$brand in the first frame"
  else
    FAILED=$((FAILED + 1))
    printf '%-32s %-5s %-9s %s\n' '/shop/login (brand)' "200" "-" "no --accent in the first frame"
    note ""
    note "The sign-in page is not picking up the shop's brand. It has no token, so it"
    note "reads GET /api/v1/public/theme during SSR and writes the tokens onto its"
    note "root element. Check that endpoint still returns this shop's theme."
  fi
fi

rm -rf "$OUT"
printf '%s\n' '--------------------------------------------------------------------------'
if [ "$EXPECT_TENANT" = "0" ]; then
  # Say what was actually verified, or this line becomes a claim the run did not
  # earn.
  if [ "$FAILED" -eq 0 ]; then
    echo "all routes responded as expected (no shop behind $HOST, so route checks only)"
  else
    echo "$FAILED route(s) did not behave as expected"
  fi
elif [ "$FAILED" -eq 0 ]; then
  echo "all routes rendered as expected (tenant: $SLUG)"
else
  echo "$FAILED route(s) did not behave as expected"
fi
exit "$FAILED"
