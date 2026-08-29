#!/bin/bash

# TW Ventures Supabase + Stripe + Discord Integration Deployment Script
# This script deploys all Edge Functions and sets up the integration

set -e

echo "🚀 Deploying TW Ventures Supabase Integration..."

# Check if Supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI is not installed. Please install it first:"
    echo "   npm install -g supabase"
    exit 1
fi

# Check if we're in a Supabase project
if [ ! -f "supabase/config.toml" ]; then
    echo "❌ Not in a Supabase project directory. Please run 'supabase init' first."
    exit 1
fi

echo "📋 Deploying database migrations..."
supabase db push

echo "🔧 Deploying Edge Functions..."

# Deploy checkout function
echo "  - Deploying checkout function..."
supabase functions deploy checkout

# Deploy billing portal function
echo "  - Deploying billing-portal function..."
supabase functions deploy billing-portal

# Deploy Stripe webhook function
echo "  - Deploying stripe-webhook function..."
supabase functions deploy stripe-webhook

# Deploy Discord role sync function
echo "  - Deploying discord-role-sync function..."
supabase functions deploy discord-role-sync

echo "🔐 Setting up environment variables..."
echo "Please set the following environment variables in your Supabase project:"
echo ""
echo "Required Stripe variables:"
echo "  - STRIPE_SECRET_KEY"
echo "  - STRIPE_WEBHOOK_SECRET"
echo "  - PRICE_PRO_MONTHLY"
echo "  - PRICE_PRO_ANNUAL"
echo "  - STRIPE_TIER1_PRICE_ID"
echo "  - STRIPE_TIER2_PRICE_ID"
echo "  - STRIPE_TIER3_PRICE_ID"
echo ""
echo "Required Discord variables:"
echo "  - DISCORD_CLIENT_ID"
echo "  - DISCORD_CLIENT_SECRET"
echo "  - DISCORD_REDIRECT_URI"
echo "  - DISCORD_BOT_TOKEN"
echo "  - DISCORD_GUILD_ID"
echo "  - DISCORD_ROLE_PRO_ID"
echo ""
echo "Required App variables:"
echo "  - APP_URL"
echo "  - SUPABASE_URL"
echo "  - SUPABASE_SERVICE_ROLE"
echo ""

# Function to set secrets
set_secret() {
    local key=$1
    local value=$2
    if [ -n "$value" ]; then
        echo "Setting $key..."
        supabase secrets set "$key=$value"
    else
        echo "⚠️  $key not set, skipping..."
    fi
}

# Check if .env file exists and load secrets
if [ -f "supabase/.env" ]; then
    echo "📝 Loading secrets from supabase/.env..."
    source supabase/.env
    
    set_secret "STRIPE_SECRET_KEY" "$STRIPE_SECRET_KEY"
    set_secret "STRIPE_WEBHOOK_SECRET" "$STRIPE_WEBHOOK_SECRET"
    set_secret "PRICE_PRO_MONTHLY" "$PRICE_PRO_MONTHLY"
    set_secret "PRICE_PRO_ANNUAL" "$PRICE_PRO_ANNUAL"
    set_secret "STRIPE_TIER1_PRICE_ID" "$STRIPE_TIER1_PRICE_ID"
    set_secret "STRIPE_TIER2_PRICE_ID" "$STRIPE_TIER2_PRICE_ID"
    set_secret "STRIPE_TIER3_PRICE_ID" "$STRIPE_TIER3_PRICE_ID"
    set_secret "DISCORD_CLIENT_ID" "$DISCORD_CLIENT_ID"
    set_secret "DISCORD_CLIENT_SECRET" "$DISCORD_CLIENT_SECRET"
    set_secret "DISCORD_REDIRECT_URI" "$DISCORD_REDIRECT_URI"
    set_secret "DISCORD_BOT_TOKEN" "$DISCORD_BOT_TOKEN"
    set_secret "DISCORD_GUILD_ID" "$DISCORD_GUILD_ID"
    set_secret "DISCORD_ROLE_PRO_ID" "$DISCORD_ROLE_PRO_ID"
    set_secret "APP_URL" "$APP_URL"
    set_secret "SUPABASE_URL" "$SUPABASE_URL"
    set_secret "SUPABASE_SERVICE_ROLE" "$SUPABASE_SERVICE_ROLE"
else
    echo "⚠️  No supabase/.env file found. Please set secrets manually:"
    echo "   supabase secrets set KEY=value"
fi

echo ""
echo "✅ Deployment complete!"
echo ""
echo "🔗 Next steps:"
echo "1. Set up Stripe webhook endpoint:"
echo "   URL: https://your-project.supabase.co/functions/v1/stripe-webhook"
echo "   Events: checkout.session.completed, customer.subscription.updated, customer.subscription.deleted, invoice.payment_failed"
echo ""
echo "2. Set up Discord bot with proper permissions:"
echo "   - Manage Roles permission"
echo "   - Add bot to your Discord server"
echo ""
echo "3. Set up scheduled function for Discord role sync:"
echo "   - Go to Supabase Dashboard > Edge Functions > Scheduled Functions"
echo "   - Create new scheduled function"
echo "   - Path: /functions/v1/discord-role-sync"
echo "   - Schedule: Every minute (* * * * *)"
echo ""
echo "4. Test the integration:"
echo "   - Create a test subscription"
echo "   - Verify Discord role assignment"
echo "   - Test billing portal access"
echo ""
echo "🎉 TW Ventures integration is ready!"
