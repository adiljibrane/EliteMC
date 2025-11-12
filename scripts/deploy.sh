#!/bin/bash

# =====================================================
# EliteMC Deployment Script
# Quick deploy script for Supabase Edge Functions
# =====================================================

set -e

echo "🚀 EliteMC Deployment Script"
echo "============================="
echo ""

# Check if supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI not found. Install it with:"
    echo "   npm install -g supabase"
    exit 1
fi

# Check if logged in
if ! supabase projects list &> /dev/null; then
    echo "❌ Not logged in to Supabase. Run:"
    echo "   supabase login"
    exit 1
fi

echo "✅ Supabase CLI found"
echo ""

# Get project ref
echo "📋 Enter your Supabase project reference:"
echo "   (Found in: Settings → General → Reference ID)"
read -p "Project ref: " PROJECT_REF

if [ -z "$PROJECT_REF" ]; then
    echo "❌ Project ref is required"
    exit 1
fi

echo ""
echo "🔗 Linking to project: $PROJECT_REF"
supabase link --project-ref "$PROJECT_REF"

echo ""
echo "📦 Deploying Edge Functions..."
echo ""

# Deploy each function
echo "  → Deploying capture_order..."
supabase functions deploy capture_order

echo "  → Deploying match_deposit..."
supabase functions deploy match_deposit

echo "  → Deploying calculate_dividends..."
supabase functions deploy calculate_dividends

echo ""
echo "🔐 Setting environment secrets..."
echo ""

# Get Supabase URL
read -p "Enter Supabase URL (https://xxxxx.supabase.co): " SUPABASE_URL
if [ -z "$SUPABASE_URL" ]; then
    echo "❌ Supabase URL is required"
    exit 1
fi

# Get Service Role Key
echo ""
echo "⚠️  WARNING: Keep your service role key SECRET!"
read -sp "Enter Service Role Key: " SERVICE_ROLE_KEY
echo ""

if [ -z "$SERVICE_ROLE_KEY" ]; then
    echo "❌ Service role key is required"
    exit 1
fi

# Set secrets
supabase secrets set SUPABASE_URL="$SUPABASE_URL"
supabase secrets set SUPABASE_SERVICE_ROLE_KEY="$SERVICE_ROLE_KEY"

echo ""
echo "✅ Secrets configured"
echo ""

# List deployed functions
echo "📋 Deployed Functions:"
supabase functions list

echo ""
echo "🎉 Deployment Complete!"
echo ""
echo "Next steps:"
echo "  1. Update frontend/js/supabaseClient.js with your credentials"
echo "  2. Deploy frontend to Vercel: vercel --prod"
echo "  3. Update Supabase redirect URLs with production URL"
echo "  4. Create admin user and test the platform"
echo ""
echo "Need help? Check DEPLOYMENT.md for detailed guide"
