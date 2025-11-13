#!/bin/bash

# Test Edge Functions for EliteMC
# Make sure you have a valid user access token before running

SUPABASE_URL="https://riizybdrtikrcnrztcme.supabase.co"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "========================================="
echo "Testing EliteMC Edge Functions"
echo "========================================="
echo ""

# Check if ACCESS_TOKEN is set
if [ -z "$ACCESS_TOKEN" ]; then
    echo -e "${YELLOW}⚠️  No ACCESS_TOKEN set${NC}"
    echo "To test authenticated endpoints, run:"
    echo "  export ACCESS_TOKEN='your-user-jwt-token'"
    echo ""
    echo "You can get this token from your browser console after logging in:"
    echo "  const { data } = await supabase.auth.getSession()"
    echo "  console.log(data.session.access_token)"
    echo ""
    read -p "Press Enter to continue with basic tests..."
fi

echo ""
echo "1️⃣  Testing capture_order function..."
echo "-----------------------------------"
curl -X POST \
  "${SUPABASE_URL}/functions/v1/capture_order" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "order_id": "00000000-0000-0000-0000-000000000000",
    "idempotency_key": "test-key-' $(date +%s) '"
  }' 2>/dev/null | jq '.' || echo "Function not deployed or error occurred"

echo ""
echo ""
echo "2️⃣  Testing match_deposit function..."
echo "-----------------------------------"
curl -X POST \
  "${SUPABASE_URL}/functions/v1/match_deposit" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "deposit_id": "00000000-0000-0000-0000-000000000000"
  }' 2>/dev/null | jq '.' || echo "Function not deployed or error occurred"

echo ""
echo ""
echo "3️⃣  Testing calculate_dividends function..."
echo "-----------------------------------"
curl -X POST \
  "${SUPABASE_URL}/functions/v1/calculate_dividends" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "property_id": "00000000-0000-0000-0000-000000000000",
    "total_dividend_mur": "10000.00",
    "apply_to_balances": false
  }' 2>/dev/null | jq '.' || echo "Function not deployed or error occurred"

echo ""
echo "========================================="
echo "Test Complete"
echo "========================================="
echo ""
echo "Expected responses:"
echo "  ✅ 401/403 errors = Functions deployed correctly (need valid auth)"
echo "  ✅ 404 'Order not found' = Functions working (test data doesn't exist)"
echo "  ❌ 404 'Function not found' = Functions not deployed yet"
echo ""
