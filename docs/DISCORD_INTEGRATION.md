# Discord Bot Setup Guide

## Environment Variables Required

Create a `.env` file in the root directory with the following variables:

```bash
# Discord Bot Configuration
DISCORD_BOT_TOKEN=your_discord_bot_token_here
DISCORD_GUILD_ID=your_guild_id_here

# Discord Role IDs
DISCORD_FREE_ROLE_ID=your_free_role_id_here
DISCORD_TIER1_ROLE_ID=your_tier1_role_id_here
DISCORD_TIER2_ROLE_ID=your_tier2_role_id_here
DISCORD_TIER3_ROLE_ID=your_tier3_role_id_here

# Supabase Configuration (same as your main app)
VITE_SUPABASE_URL=https://dkxqmiamrnphjoaznpuo.supabase.co
VITE_SUPABASE_ANON_KEY=SUPABASE_ANON_KEY_REDACTED
```

## How to Get Discord Bot Token

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Create a new application
3. Go to "Bot" section
4. Click "Add Bot"
5. Copy the token and add it to your `.env` file

## How to Get Guild ID

1. Enable Developer Mode in Discord (User Settings > Advanced > Developer Mode)
2. Right-click on your server name
3. Click "Copy Server ID"

## How to Get Role IDs

1. Enable Developer Mode in Discord
2. Go to Server Settings > Roles
3. Right-click on each role and "Copy Role ID"

## Running the Bot

```bash
node discord-bot.js
```

The bot will now properly validate environment variables and provide helpful error messages if anything is missing.