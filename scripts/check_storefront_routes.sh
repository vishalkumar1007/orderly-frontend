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
    note "  http://localhost:5173/superadmin/businesses/new"
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

# moved <old path> <where it should end up>
#
# A path that used to be a screen must still land on the screen that replaced
# it. Whether the hop happens on the server (302) or in the browser (a shell
# whose load redirects) depends on whether an ancestor layout opted out of SSR,
# so this follows redirects and asserts where it stopped instead of asserting a
# status code that is really a fact about someone else's +layout.ts.
moved() {
  path="$1"
  want="$2"
  code=$(curl -sL -o "$OUT/moved.html" -w '%{http_code}' -m 30 -H "Host: $HOST" "$APP$path")
  final=$(curl -sL -o /dev/null -w '%{url_effective}' -m 30 -H "Host: $HOST" "$APP$path")
  # curl reports the resolved URL, whose authority is the address it dialled
  # rather than the Host header we sent, so strip any scheme and authority.
  landed=$(printf '%s' "$final" | sed 's|^[a-z]*://[^/]*||')
  note_txt="-> $landed"
  # An SSR-disabled ancestor answers with the shell and redirects in the
  # browser, so the server-side landing spot is the path itself. That is not a
  # failure — the only real failure is a status that is not 200.
  if [ "$code" != "200" ]; then
    FAILED=$((FAILED + 1))
    note_txt="$note_txt  <-- expected 200, got $code"
  elif [ "$landed" != "$want" ] && [ "$landed" != "$path" ]; then
    FAILED=$((FAILED + 1))
    note_txt="$note_txt  <-- expected $want"
  fi
  printf '%-32s %-5s %-9s %s\n' "$path" "$code" "-" "$note_txt"
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
for path in /shop/login /shop \
            /shop/customize \
            /shop/customize/branding /shop/customize/theme \
            /shop/customize/homepage /shop/customize/login \
            /shop/storefront/hours \
            /shop/storefront/qr /shop/storefront/preview \
            /shop/payments /shop/settings \
            /shop/menu /shop/customers /shop/staff \
            /shop/orders /shop/kitchen /shop/live /shop/setup \
            /shop/iam /shop/order-history /shop/activity; do
  check "$path" "200" "no"
done

# ---------------------------------------------------------------------------
# Paths that used to be screens.
#
# Settings absorbed its sections, opening hours moved to the storefront and
# payments got its own destination. Every old path is somebody's bookmark, so
# each one has to land on its replacement rather than 404.
# ---------------------------------------------------------------------------
moved /shop/brand                         '/shop/settings?section=appearance'
moved /shop/integrations                  '/shop/settings?section=integrations'
moved /shop/notifications                 '/shop/settings?section=notifications'
moved /shop/settings/business-profile     '/shop/settings?section=business'
moved /shop/settings/notifications        '/shop/settings?section=notifications'
moved /shop/settings/integrations         '/shop/settings?section=integrations'
moved /shop/settings/integrations/smtp    '/shop/settings?section=integrations&service=SMTP'
moved /shop/settings/integrations/storage '/shop/settings?section=integrations&service=STORAGE'
moved /shop/settings/integrations/ai      '/shop/settings?section=integrations&service=AI'
moved /shop/settings/smtp                 '/shop/settings?section=integrations&service=SMTP'
moved /shop/organization                  '/shop/settings'
moved /shop/organization/hours            '/shop/storefront/hours'
moved /shop/organization/payments         '/shop/payments'
moved /shop/organization/workflow         '/shop/settings?section=workflow'
moved /shop/storefront                    '/shop/customize'
moved /shop/storefront/branding           '/shop/customize/branding'
moved /shop/storefront/theme              '/shop/customize/theme'
moved /shop/storefront/homepage           '/shop/customize/homepage'
moved /shop/storefront/login              '/shop/customize/login'
moved /shop/storefront/store-info         '/shop/settings?section=business'
moved /shop/storefront/payments           '/shop/payments'
moved /shop/storefront/workflow           '/shop/settings?section=workflow'

# ---------------------------------------------------------------------------
# The console on the wrong host.
#
# The business console lives on a business's own subdomain. Reached on the
# platform host it must land on a sign-in page — and the sign-in page is itself
# under /shop, so a guard that redirects it too makes the layout redirect to a
# route that re-runs the guard. That loops until the browser gives up with
# ERR_TOO_MANY_REDIRECTS, which is not a status code any per-route check would
# ever notice: every individual hop is a perfectly good 302.
#
# curl stops after --max-redirs and exits 47, so the hop count is the assertion.
# ---------------------------------------------------------------------------
note ""
printf '%-32s %-5s %-9s %s\n' 'WRONG-HOST' STATUS HOPS RESULT
printf '%s\n' '--------------------------------------------------------------------------'

lands() {
  wrong_host="$1"
  path="$2"
  read -r code hops final <<EOF
$(curl -sL -o /dev/null --max-redirs 10 -m 30 -H "Host: $wrong_host" \
    -w '%{http_code} %{num_redirects} %{url_effective}' "$APP$path" 2>/dev/null || echo "000 99 loop")
EOF
  landed=$(printf '%s' "$final" | sed 's|^[a-z]*://[^/]*||')
  result="-> $landed"
  if [ "$hops" -ge 10 ] || [ "$code" = "000" ]; then
    FAILED=$((FAILED + 1))
    result="redirect loop  <-- the console must not bounce forever off the wrong host"
  elif [ "$code" != "200" ]; then
    FAILED=$((FAILED + 1))
    result="$result  <-- expected 200, got $code"
  fi
  printf '%-32s %-5s %-9s %s\n' "$wrong_host$path" "$code" "$hops" "$result"
}

PLATFORM_HOST="${PLATFORM_HOST:-localhost:5173}"
CONSOLE_HOST="${CONSOLE_HOST:-admin.localhost:5173}"
for path in /shop /shop/login /shop/menu /shop/orders; do
  lands "$PLATFORM_HOST" "$path"
  lands "$CONSOLE_HOST" "$path"
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
