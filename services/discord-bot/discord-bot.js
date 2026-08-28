import { Client, GatewayIntentBits } from 'discord.js';
import { createClient } from '@supabase/supabase-js';

const LOG_LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };
const logLevelName = (process.env.SUBSCRIPTION_BOT_LOG_LEVEL ?? 'info').toLowerCase();
const logThreshold = LOG_LEVELS[logLevelName] ?? LOG_LEVELS.info;

const log = (level, message, meta) => {
    const numericLevel = LOG_LEVELS[level] ?? LOG_LEVELS.info;
    if (numericLevel > logThreshold) return;
    const serializedMeta = meta ? ` ${typeof meta === 'string' ? meta : JSON.stringify(meta)}` : '';
    if (level === 'error') {
        console.error(`[${level.toUpperCase()}] ${message}${serializedMeta}`);
    } else if (level === 'warn') {
        console.warn(`[${level.toUpperCase()}] ${message}${serializedMeta}`);
    } else {
        console.log(`[${level.toUpperCase()}] ${message}${serializedMeta}`);
    }
};

const DISCORD_TOKEN = process.env.DISCORD_BOT_TOKEN;
const GUILD_ID = process.env.DISCORD_GUILD_ID;

if (!DISCORD_TOKEN || !GUILD_ID) {
    log('error', 'Missing required Discord configuration', { hasToken: Boolean(DISCORD_TOKEN), hasGuildId: Boolean(GUILD_ID) });
    process.exit(1);
}

// Supabase Configuration
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    log('error', 'Missing Supabase environment variables', { hasUrl: Boolean(supabaseUrl), hasKey: Boolean(supabaseKey) });
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false },
});

const rawRoleMappings = {
    free: process.env.DISCORD_FREE_ROLE_ID,
    tier1: process.env.DISCORD_TIER1_ROLE_ID,
    tier2: process.env.DISCORD_TIER2_ROLE_ID,
    tier3: process.env.DISCORD_TIER3_ROLE_ID,
};

const ROLE_MAPPINGS = Object.freeze(
    Object.fromEntries(
        Object.entries(rawRoleMappings).filter(([tier, roleId]) => {
            if (!roleId) {
                log('warn', 'Role ID not configured for subscription tier', { tier });
                return false;
            }
            return true;
        }),
    ),
);

const SUBSCRIPTION_ROLES = new Set(Object.values(ROLE_MAPPINGS));

const MAX_CONCURRENT_ROLE_UPDATES = Math.max(
    Number.parseInt(process.env.DISCORD_ROLE_SYNC_CONCURRENCY ?? '5', 10) || 5,
    1,
);

// Create Discord client
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages
    ]
});

let cachedGuild = null;

const ensureGuild = async () => {
    if (cachedGuild) return cachedGuild;
    const existing = client.guilds.cache.get(GUILD_ID);
    if (existing) {
        cachedGuild = existing;
        return cachedGuild;
    }

    try {
        cachedGuild = await client.guilds.fetch(GUILD_ID);
        return cachedGuild;
    } catch (error) {
        log('error', 'Failed to fetch Discord guild', { guildId: GUILD_ID, error: error.message });
        throw error;
    }
};

const runWithConcurrency = async (items, limit, worker) => {
    const executing = new Set();
    const results = [];
    for (const item of items) {
        const task = Promise.resolve().then(() => worker(item));
        results.push(task);
        executing.add(task);
        task.finally(() => executing.delete(task));
        if (executing.size >= limit) {
            await Promise.race(executing);
        }
    }
    return Promise.allSettled(results);
};

// Bot ready event
client.once('ready', async () => {
    log('info', `Discord bot logged in as ${client.user.tag}`, { userId: client.user.id });
    log('info', `Connected to ${client.guilds.cache.size} servers`);
    try {
        await ensureGuild();
    } catch (error) {
        log('error', 'Unable to resolve configured guild on startup', { error: error.message });
    }
});

// Function to sync user roles based on subscription
async function syncUserRoles(discordId, subscriptionTier) {
    try {
        const guild = await ensureGuild();
        if (!guild) {
            log('error', 'Configured guild unavailable when syncing roles');
            return false;
        }

        const member = await guild.members.fetch({ user: discordId, force: false }).catch(() => null);
        if (!member) {
            log('warn', 'Member not found in guild for role sync', { discordId });
            return false;
        }

        for (const roleId of SUBSCRIPTION_ROLES) {
            if (member.roles.cache.has(roleId)) {
                await member.roles.remove(roleId);
                log('debug', 'Removed subscription role from member', { discordId, roleId });
            }
        }

        const newRoleId = ROLE_MAPPINGS[subscriptionTier];
        if (!newRoleId) {
            log('warn', 'Subscription tier not mapped to a Discord role', { discordId, subscriptionTier });
            return true;
        }

        await member.roles.add(newRoleId);
        log('info', 'Applied subscription role', { discordId, subscriptionTier, roleId: newRoleId });
        return true;
    } catch (error) {
        log('error', 'Error syncing user roles', { discordId, subscriptionTier, error: error.message });
        return false;
    }
}

// Function to handle subscription updates
async function handleSubscriptionUpdate(userId, newTier) {
    try {
        // Get user's Discord ID from database
        const { data: profile, error } = await supabase
            .from('user_profiles')
            .select('discord_id')
            .eq('user_id', userId)
            .single();

        if (error || !profile?.discord_id) {
            log('warn', 'No Discord ID found for subscription update', { userId });
            return;
        }

        // Sync roles
        const success = await syncUserRoles(profile.discord_id, newTier);
        if (success) {
            log('info', 'Synced roles for user', { userId, newTier });
        }
    } catch (error) {
        log('error', 'Error handling subscription update', { userId, newTier, error: error.message });
    }
}

// Function to sync all users (for manual sync)
async function syncAllUsers() {
    try {
        log('info', 'Starting full user sync');

        const { data: profiles, error } = await supabase
            .from('user_profiles')
            .select(`
                user_id,
                discord_id,
                subscription_tier
            `)
            .not('discord_id', 'is', null);

        if (error) {
            log('error', 'Error fetching user profiles', { error: error.message });
            return;
        }

        const actionableProfiles = (profiles ?? []).filter(
            (profile) => profile.discord_id && profile.subscription_tier,
        );

        const results = await runWithConcurrency(
            actionableProfiles,
            MAX_CONCURRENT_ROLE_UPDATES,
            (profile) => syncUserRoles(profile.discord_id, profile.subscription_tier),
        );

        const successes = results.filter((result) => result.status === 'fulfilled' && result.value).length;
        const failures = results.length - successes;

        log('info', 'Completed full user sync', {
            total: actionableProfiles.length,
            successes,
            failures,
            concurrency: MAX_CONCURRENT_ROLE_UPDATES,
        });
    } catch (error) {
        log('error', 'Error in full sync', { error: error.message });
    }
}

// Slash command to manually sync a user
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === 'syncuser') {
        const userId = interaction.options.getString('userid');

        try {
            const { data: profile, error } = await supabase
                .from('user_profiles')
                .select('discord_id, subscription_tier')
                .eq('user_id', userId)
                .single();

            if (error || !profile) {
                await interaction.reply('❌ User not found');
                return;
            }

            if (!profile.discord_id) {
                await interaction.reply('❌ User has no Discord ID linked');
                return;
            }

            const success = await syncUserRoles(profile.discord_id, profile.subscription_tier);
            if (success) {
                await interaction.reply(`✅ Synced roles for user ${userId} to ${profile.subscription_tier}`);
                log('info', 'Manual syncuser command completed', { userId, tier: profile.subscription_tier });
            } else {
                await interaction.reply('❌ Failed to sync roles');
                log('warn', 'Manual syncuser command failed to update roles', { userId, tier: profile.subscription_tier });
            }
        } catch (error) {
            log('error', 'Error in syncuser command', { userId, error: error.message });
            await interaction.reply('❌ Error syncing user');
        }
    }

    if (interaction.commandName === 'syncall') {
        await interaction.reply('🔄 Starting full sync...');
        await syncAllUsers();
        await interaction.followUp('✅ Full sync completed');
        log('info', 'Manual syncall command completed');
    }
});

// Register slash commands
async function registerCommands() {
    const commands = [
        {
            name: 'syncuser',
            description: 'Sync a specific user\'s Discord roles',
            options: [
                {
                    name: 'userid',
                    description: 'The user ID to sync',
                    type: 3, // STRING
                    required: true
                }
            ]
        },
        {
            name: 'syncall',
            description: 'Sync all users\' Discord roles'
        }
    ];

    try {
        const guild = await ensureGuild();
        await guild.commands.set(commands);
        log('info', 'Slash commands registered', { guildId: guild.id });
    } catch (error) {
        log('error', 'Error registering commands', { error: error.message });
    }
}

const startBot = async () => {
    try {
        await client.login(DISCORD_TOKEN);
        await registerCommands();
        log('info', 'Discord subscription bot started');
    } catch (error) {
        log('error', 'Failed to start Discord bot', { error: error.message });
        process.exit(1);
    }
};

void startBot();

// Export functions for use in other parts of your app
export { syncUserRoles, handleSubscriptionUpdate, syncAllUsers };
