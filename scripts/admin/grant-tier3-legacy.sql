-- Grant Tier 3 ("Complete") to redacted@example.com
--
-- The live gating path is:
--   useSubscription / useSubscriptionGating
--     -> SubscriptionService.getUserProfile()
--       -> public.user_profiles.subscription_tier
-- and SubscriptionTier is 'free' | 'tier1' | 'tier2' | 'tier3'
-- (src/types/subscription.ts). moduleAccess.ts ranks them via tierOrder, so
-- 'tier3' is the value that actually unlocks every module.
--
-- Note there is a SECOND, legacy path -- public.subscribers, written by the
-- check-subscription edge function, using 'free' | 'professional' |
-- 'enterprise'. That feeds only the older enterprise/SubscriptionStatus
-- component. Writing 'enterprise' there does NOT grant access in the current
-- app; this script deliberately targets user_profiles instead.
--
-- isActive requires subscription_status IN ('active','past_due') AND tier
-- <> 'free' (services/subscription.ts), so status is set explicitly.

update public.user_profiles
set subscription_tier    = 'tier3',
    subscription_status  = 'active',
    subscription_ends_at = now() + interval '1 year',
    updated_at           = now()
where id = '00000000-0000-0000-0000-000000000000';

-- Verify: expect tier3 / active / one year out
select id, email, subscription_tier, subscription_status, subscription_ends_at, role
from public.user_profiles
where id = '00000000-0000-0000-0000-000000000000';
