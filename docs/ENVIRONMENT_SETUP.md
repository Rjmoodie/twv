# 🔧 **Environment Variables Setup Guide**

## 🚨 **Current Issue:**
The Discord bot is failing because it can't find the Supabase URL and other environment variables.

## ✅ **Solution:**
Create a `.env` file in your `somatech` folder with the following content:

```bash
# =====================================================
# SOMA TECH - ENVIRONMENT VARIABLES
# =====================================================

# =====================================================
# SUPABASE CONFIGURATION
# =====================================================
VITE_SUPABASE_URL=https://dkxqmiamrnphjoaznpuo.supabase.co
VITE_SUPABASE_ANON_KEY=SUPABASE_ANON_KEY_REDACTED
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
SUPABASE_DB_URL=your_database_url_here

# =====================================================
# STRIPE CONFIGURATION
# =====================================================
STRIPE_SECRET_KEY=your_stripe_secret_key_here
VITE_STRIPE_PUBLISHABLE_KEY=pk_live_51S46RcFEc5eCCZt3h49zIS9EoV3ESWNqJKLOYnXLmw9KnU6hONezDt58dJYzrL8BdZ2U9FtBSEaqds3vD6ePLAWL004elvA0OE
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret_here

# =====================================================
# DISCORD CONFIGURATION
# =====================================================
DISCORD_BOT_TOKEN=your_discord_bot_token_here
DISCORD_SERVER_ID=your_discord_server_id_here

# =====================================================
# OTHER API KEYS
# =====================================================
ALPHA_VANTAGE_API_KEY=your_alpha_vantage_key_here
MAPBOX_PUBLIC_TOKEN=your_mapbox_token_here

# =====================================================
# SERVER CONFIGURATION
# =====================================================
PORT=3001
NODE_ENV=development
```

## 📋 **Steps to Create .env File:**

### **Step 1: Create the File**
1. In your `somatech` folder, create a new file called `.env`
2. Copy the template above and paste it

### **Step 2: Fill in Missing Values**
Replace these placeholders with your actual values:

- `your_service_role_key_here` → Get from Supabase Dashboard → Settings → API
- `your_database_url_here` → Get from Supabase Dashboard → Settings → Database
- `your_discord_bot_token_here` → Get from Discord Developer Portal
- `your_discord_server_id_here` → Get from Discord Server Settings
- `whsec_your_webhook_secret_here` → Get from Stripe Dashboard (when you create webhook)
- `your_alpha_vantage_key_here` → Get from Alpha Vantage
- `your_mapbox_token_here` → Get from Mapbox

### **Step 3: Save the File**
Save the `.env` file in your `somatech` folder

## 🚀 **After Creating .env File:**

1. **Test Discord Bot:**
   ```bash
   node discord-bot.js
   ```

2. **Test Webhook Handler:**
   ```bash
   node webhook-handler.js
   ```

3. **Test Development Server:**
   ```bash
   npm run dev
   ```

## ⚠️ **Important Notes:**

- **Never commit `.env` to git** (it should be in `.gitignore`)
- **VITE_ variables** are safe for client-side
- **Non-VITE variables** are server-side only (keep secret!)

## 🎯 **Expected Result:**
After creating the `.env` file, all your services should start without environment variable errors!
