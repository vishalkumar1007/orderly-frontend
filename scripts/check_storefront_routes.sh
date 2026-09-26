#!/usr/bin/env bash
# Renders every storefront route and reports the status, size and title.
# A route that 500s, or renders an error page, is a broken route.
#
# The customer routes are server-rendered with real data, so a 200 with a
# plausible byte count means the loader worked. The admin routes gate on a token
# that lives in the browser, so their server render is the shell skeleton; a 200
# there means the route and its module graph are sound, and the data layer is
# covered by backend/scripts/smoke_storefront.sh instead.
set -uo pipefail
APP="${APP:-http://127.0.0.1:5173}"
HOST="${HOST:-momo-magic.localhost:5173}"
OUT="$(mktemp -d)"
FAILED=0

printf '%-32s %-5s %-9s %s\n' ROUTE STATUS BYTES TITLE
printf '%s\n' '--------------------------------------------------------------------------'

check() {
  path="$1"
  expect="$2"
  code=$(curl -s -o "$OUT/page.html" -w '%{http_code}' -m 30 -H "Host: $HOST" "$APP$path")
  size=$(wc -c < "$OUT/page.html" | tr -d ' ')
  title=$(grep -o '<title>[^<]*' "$OUT/page.html" | head -1 | sed 's/<title>//')
  if [ "$code" != "$expect" ]; then
    FAILED=$((FAILED + 1))
    title="$title  <-- expected $expect"
  fi
  printf '%-32s %-5s %-9s %s\n' "$path" "$code" "$size" "$title"
}

# Customer storefront.
for path in '/' '/menu' '/menu?q=momo' '/menu?q=zzzz' '/cart' '/checkout' '/orders' \
            '/profile' '/login' '/login?next=%2Fcheckout' '/verify-otp' '/order/1' \
            '/order/0' '/product/does-not-exist' '/nope'; do
  case "$path" in
    /order/0|/product/does-not-exist|/nope) expect="404" ;;
    *) expect="200" ;;
  esac
  check "$path" "$expect"
done

# Admin storefront control. One entry per screen, so a screen that fails to
# compile or throws during load is named rather than hidden behind a group.
for path in /shop/login /shop /shop/storefront \
            /shop/storefront/branding /shop/storefront/theme \
            /shop/storefront/homepage /shop/storefront/store-info \
            /shop/storefront/hours /shop/storefront/login \
            /shop/storefront/payments /shop/storefront/workflow \
            /shop/storefront/qr /shop/storefront/preview; do
  check "$path" "200"
done

rm -rf "$OUT"
printf '%s\n' '--------------------------------------------------------------------------'
if [ "$FAILED" -eq 0 ]; then
  echo 'all routes rendered as expected'
else
  echo "$FAILED route(s) did not behave as expected"
fi
exit "$FAILED"
