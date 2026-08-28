import { supabase } from '@/integrations/supabase/client';

export interface DiscordProfile {
  discord_id: string;
  username: string;
  avatar?: string;
  subscription_tier: string;
}

export class DiscordService {
  /**
   * Link Discord account to user profile
   */
  static async linkDiscordAccount(discordId: string, username: string, avatar?: string): Promise<boolean> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      const { error } = await supabase
        .from('user_profiles')
        .upsert({
          user_id: user.id,
          discord_id: discordId,
          discord_username: username,
          discord_avatar: avatar,
          updated_at: new Date().toISOString()
        });

      if (error) {
        console.error('Error linking Discord account:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error linking Discord account:', error);
      return false;
    }
  }

  /**
   * Get user's Discord profile
   */
  static async getDiscordProfile(userId: string): Promise<DiscordProfile | null> {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('discord_id, discord_username, discord_avatar, subscription_tier')
        .eq('user_id', userId)
        .single();

      if (error || !data?.discord_id) {
        return null;
      }

      return {
        discord_id: data.discord_id,
        username: data.discord_username || 'Unknown',
        avatar: data.discord_avatar,
        subscription_tier: data.subscription_tier || 'free'
      };
    } catch (error) {
      console.error('Error getting Discord profile:', error);
      return null;
    }
  }

  /**
   * Check if user has Discord linked
   */
  static async hasDiscordLinked(userId: string): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('discord_id')
        .eq('user_id', userId)
        .single();

      return !error && !!data?.discord_id;
    } catch (error) {
      console.error('Error checking Discord link:', error);
      return false;
    }
  }

  /**
   * Unlink Discord account
   */
  static async unlinkDiscordAccount(userId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({
          discord_id: null,
          discord_username: null,
          discord_avatar: null,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId);

      if (error) {
        console.error('Error unlinking Discord account:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error unlinking Discord account:', error);
      return false;
    }
  }

  /**
   * Get Discord server invite link
   */
  static getDiscordInviteLink(): string {
    return 'https://discord.gg/pBbgaBPGAq';
  }

  /**
   * Get Discord role information for subscription tiers
   */
  static getDiscordRoleInfo(tier: string): { name: string; description: string; color: string } {
    const roleInfo = {
      free: {
        name: 'Free',
        description: 'Basic access to SomaTech features',
        color: '#95a5a6'
      },
      tier1: {
        name: 'Tier 1 - Options Trading',
        description: 'Access to options trading Discord channels',
        color: '#3498db'
      },
      tier2: {
        name: 'Tier 2 - Advanced Analytics',
        description: 'Access to advanced analytics and Tier 1 features',
        color: '#9b59b6'
      },
      tier3: {
        name: 'Tier 3 - Complete Package',
        description: 'Full access to all features and exclusive content',
        color: '#f39c12'
      }
    };

    return roleInfo[tier as keyof typeof roleInfo] || roleInfo.free;
  }

  /**
   * Sync user roles with Discord (calls the SQL function)
   */
  static async syncUserRoles(userId: string): Promise<boolean> {
    try {
      const { error } = await supabase.rpc('sync_discord_roles', {
        target_user_id: userId
      });

      if (error) {
        console.error('Error syncing Discord roles:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error syncing Discord roles:', error);
      return false;
    }
  }

  /**
   * Sync all user roles with Discord
   */
  static async syncAllUserRoles(): Promise<{success: number, failed: number}> {
    try {
      // Get all users with Discord accounts linked
      const { data: users, error } = await supabase
        .from('user_profiles')
        .select('user_id, discord_id, subscription_tier')
        .not('discord_id', 'is', null);

      if (error) {
        console.error('Error fetching users for Discord sync:', error);
        return { success: 0, failed: 0 };
      }

      if (!users || users.length === 0) {
        console.log('No users with Discord accounts found');
        return { success: 0, failed: 0 };
      }

      let successCount = 0;
      let failedCount = 0;

      // Sync each user's role
      for (const user of users) {
        try {
          const success = await this.syncUserRoles(user.user_id);
          if (success) {
            successCount++;
            console.log(`✅ Synced Discord role for user ${user.user_id} (${user.subscription_tier})`);
          } else {
            failedCount++;
            console.error(`❌ Failed to sync Discord role for user ${user.user_id}`);
          }
        } catch (error) {
          failedCount++;
          console.error(`❌ Error syncing Discord role for user ${user.user_id}:`, error);
        }
      }

      console.log(`🔄 Discord sync completed: ${successCount} successful, ${failedCount} failed`);
      return { success: successCount, failed: failedCount };
    } catch (error) {
      console.error('Error in syncAllUserRoles:', error);
      return { success: 0, failed: 0 };
    }
  }
}