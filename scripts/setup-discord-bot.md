# Discord Bot Setup Guide

This guide will help you set up a Discord bot for the SomaTech integration.

## 1. Create Discord Application

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Click "New Application"
3. Name it "SomaTech Bot" (or your preferred name)
4. Go to the "Bot" section
5. Click "Add Bot"
6. Copy the **Bot Token** (you'll need this for `DISCORD_BOT_TOKEN`)

## 2. Configure Bot Permissions

In the Bot section, enable these permissions:
- ✅ Send Messages
- ✅ Manage Roles
- ✅ Read Message History
- ✅ Use Slash Commands

## 3. Get OAuth2 Credentials

1. Go to the "OAuth2" section
2. Copy the **Client ID** (you'll need this for `DISCORD_CLIENT_ID`)
3. Copy the **Client Secret** (you'll need this for `DISCORD_CLIENT_SECRET`)
4. Add redirect URI: `https://your-app.com/api/discord/callback`

## 4. Invite Bot to Server

1. In OAuth2 > URL Generator:
   - Select scopes: `bot`, `identify`
   - Select permissions: `Manage Roles`, `Send Messages`
2. Copy the generated URL and open it in your browser
3. Select your Discord server and authorize

## 5. Create Discord Role

1. In your Discord server, go to Server Settings > Roles
2. Create a new role called "SomaTech Pro" (or your preferred name)
3. Copy the **Role ID** (you'll need this for `DISCORD_ROLE_PRO_ID`)
4. Make sure the bot role is higher than the "SomaTech Pro" role

## 6. Get Server ID

1. Enable Developer Mode in Discord (User Settings > Advanced > Developer Mode)
2. Right-click on your server name
3. Click "Copy Server ID" (you'll need this for `DISCORD_GUILD_ID`)

## 7. Environment Variables

Add these to your environment:

```bash
DISCORD_CLIENT_ID=your_client_id_here
DISCORD_CLIENT_SECRET=your_client_secret_here
DISCORD_REDIRECT_URI=https://your-app.com/api/discord/callback
DISCORD_BOT_TOKEN=your_bot_token_here
DISCORD_GUILD_ID=your_server_id_here
DISCORD_ROLE_PRO_ID=your_role_id_here
```

## 8. Test the Integration

1. Deploy the Edge Functions
2. Set up the webhook
3. Create a test subscription
4. Verify the Discord role is assigned automatically

## Troubleshooting

### Bot doesn't have permission to manage roles
- Make sure the bot role is higher than the target role
- Check that "Manage Roles" permission is enabled

### OAuth redirect not working
- Verify the redirect URI matches exactly
- Check that the Discord application is configured correctly

### Role not being assigned
- Check the Discord role sync function logs
- Verify all environment variables are set correctly
- Make sure the user has linked their Discord account

## Security Notes

- Never commit bot tokens to version control
- Use environment variables for all sensitive data
- Regularly rotate bot tokens
- Monitor bot permissions and usage

