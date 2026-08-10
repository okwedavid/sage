#!/usr/bin/env bash
# SAGE end-to-end smoke test — auth, password reset, conversation persistence.
set -u
BASE="http://localhost:4000"
EMAIL="smoke-$(date +%s)@user.dev"
PASS_OLD="old-password-1"
PASS_NEW="new-password-2"

pass() { echo "  ✅ $1"; }
fail() { echo "  ❌ $1"; exit 1; }

echo "== Register =="
REG=$(curl -s -m 10 -X POST "$BASE/api/auth/register" -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS_OLD\",\"name\":\"Smoke User\"}")
TOKEN=$(echo "$REG" | sed -n 's/.*"token":"\([^"]*\)".*/\1/p')
[ -n "$TOKEN" ] && pass "registered $EMAIL" || fail "register failed: $REG"

echo "== Forgot password (dev mode returns reset link) =="
FORGOT=$(curl -s -m 10 -X POST "$BASE/api/auth/forgot-password" -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL\"}")
RESET_URL=$(echo "$FORGOT" | sed -n 's/.*"devResetUrl":"\([^"]*\)".*/\1/p')
[ -n "$RESET_URL" ] && pass "reset link issued" || fail "no devResetUrl: $FORGOT"
TOKEN_RAW=$(echo "$RESET_URL" | sed -n 's/.*reset_token=\([^&]*\).*/\1/p')

echo "== Forgot password for unknown email (no enumeration) =="
GHOST=$(curl -s -m 10 -X POST "$BASE/api/auth/forgot-password" -H 'Content-Type: application/json' \
  -d '{"email":"ghost-'$(date +%s)'@nowhere.dev"}')
echo "$GHOST" | grep -q 'If an account exists' && pass "generic response, no link" || fail "leaked: $GHOST"

echo "== Reset password =="
RESET=$(curl -s -m 10 -X POST "$BASE/api/auth/reset-password" -H 'Content-Type: application/json' \
  -d "{\"token\":\"$TOKEN_RAW\",\"password\":\"$PASS_NEW\"}")
echo "$RESET" | grep -q 'Password updated' && pass "password updated" || fail "reset failed: $RESET"

echo "== Token is single-use =="
REUSE=$(curl -s -m 10 -X POST "$BASE/api/auth/reset-password" -H 'Content-Type: application/json' \
  -d "{\"token\":\"$TOKEN_RAW\",\"password\":\"$PASS_NEW\"}")
echo "$REUSE" | grep -q 'Invalid or expired' && pass "reuse rejected" || fail "reuse accepted: $REUSE"

echo "== Login with new password =="
LOGIN_NEW=$(curl -s -m 10 -X POST "$BASE/api/auth/login" -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS_NEW\"}")
NEW_TOKEN=$(echo "$LOGIN_NEW" | sed -n 's/.*"token":"\([^"]*\)".*/\1/p')
[ -n "$NEW_TOKEN" ] && pass "login with new password OK" || fail "login failed: $LOGIN_NEW"

echo "== Login with old password fails =="
LOGIN_OLD=$(curl -s -m 10 -X POST "$BASE/api/auth/login" -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS_OLD\"}")
echo "$LOGIN_OLD" | grep -q 'Invalid credentials' && pass "old password rejected" || fail "old password still works"

AUTH="Authorization: Bearer $NEW_TOKEN"

echo "== Conversation lifecycle =="
CONV=$(curl -s -m 10 -X POST "$BASE/api/conversations" -H "$AUTH" -H 'Content-Type: application/json' \
  -d '{"title":"New Conversation"}')
CONV_ID=$(echo "$CONV" | sed -n 's/.*"id":"\([^"]*\)".*/\1/p')
[ -n "$CONV_ID" ] && pass "conversation created" || fail "create failed: $CONV"

curl -s -m 10 -X POST "$BASE/api/conversations/$CONV_ID/messages" -H "$AUTH" -H 'Content-Type: application/json' \
  -d '{"role":"user","content":"Build a pricing page for my SaaS"}' > /dev/null
curl -s -m 10 -X POST "$BASE/api/conversations/$CONV_ID/messages" -H "$AUTH" -H 'Content-Type: application/json' \
  -d '{"role":"assistant","content":"Here is a pricing page plan."}' > /dev/null

FETCHED=$(curl -s -m 10 "$BASE/api/conversations/$CONV_ID" -H "$AUTH")
echo "$FETCHED" | grep -q 'Build a pricing page for my SaaS' && pass "message persisted + auto-titled" || fail "messages missing: $(echo "$FETCHED" | head -c 200)"
echo "$FETCHED" | grep -q 'Here is a pricing page plan' && pass "assistant message restored" || fail "assistant msg missing"

LIST=$(curl -s -m 10 "$BASE/api/conversations" -H "$AUTH")
echo "$LIST" | grep -q 'Build a pricing page for my SaaS' && pass "auto-title visible in list" || fail "title not in list: $(echo "$LIST" | head -c 200)"

echo "== User isolation =="
OTHER=$(curl -s -m 10 -X POST "$BASE/api/auth/register" -H 'Content-Type: application/json' \
  -d '{"email":"other-'$(date +%s)'@user.dev","password":"other-pass-1","name":"Other"}')
OTHER_TOKEN=$(echo "$OTHER" | sed -n 's/.*"token":"\([^"]*\)".*/\1/p')
FOREIGN=$(curl -s -m 10 "$BASE/api/conversations/$CONV_ID" -H "Authorization: Bearer $OTHER_TOKEN")
echo "$FOREIGN" | grep -q 'Conversation not found' && pass "cross-user access blocked" || fail "isolation broken: $FOREIGN"

echo "== Billing + provider catalog =="
curl -s -m 10 "$BASE/api/billing/plans" | grep -q '"pro"' && pass "billing plans OK" || fail "plans missing"
curl -s -m 10 "$BASE/api/billing/plan" -H "$AUTH" | grep -q '"id":"free"' && pass "billing plan (free) OK" || fail "plan endpoint failed"
curl -s -m 10 "$BASE/api/providers/catalog" -H "$AUTH" | grep -q 'openai-compatible' && pass "provider catalog OK" || fail "catalog missing"

echo ""
echo "🎉 ALL SMOKE CHECKS PASSED"
