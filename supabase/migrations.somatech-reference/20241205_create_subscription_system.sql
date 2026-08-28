-- Create subscription system tables
-- Enable RLS
ALTER TABLE auth.users ENABLE ROW LEVEL SECURITY;

-- Create user_profiles table
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT NOT NULL,
  name TEXT,
  subscription_tier TEXT NOT NULL DEFAULT 'free' CHECK (subscription_tier IN ('free', 'tier1', 'tier2', 'tier3')),
  stripe_customer_id TEXT UNIQUE,
  discord_id TEXT UNIQUE,
  discord_username TEXT,
  subscription_status TEXT DEFAULT 'active' CHECK (subscription_status IN ('active', 'canceled', 'past_due', 'unpaid')),
  subscription_ends_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create subscription_history table
CREATE TABLE IF NOT EXISTS public.subscription_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  stripe_subscription_id TEXT,
  tier TEXT NOT NULL CHECK (tier IN ('free', 'tier1', 'tier2', 'tier3')),
  status TEXT NOT NULL,
  amount INTEGER, -- in cents
  currency TEXT DEFAULT 'usd',
  interval TEXT, -- 'month' or 'year'
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create discord_sync_logs table
CREATE TABLE IF NOT EXISTS public.discord_sync_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  action TEXT NOT NULL, -- 'add_role', 'remove_role', 'sync_roles'
  old_tier TEXT,
  new_tier TEXT,
  discord_id TEXT,
  success BOOLEAN NOT NULL,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create LMS access table
CREATE TABLE IF NOT EXISTS public.lms_access (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  lms_user_id TEXT,
  access_granted_at TIMESTAMPTZ DEFAULT NOW(),
  access_revoked_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_user_profiles_subscription_tier ON public.user_profiles(subscription_tier);
CREATE INDEX IF NOT EXISTS idx_user_profiles_stripe_customer_id ON public.user_profiles(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_discord_id ON public.user_profiles(discord_id);
CREATE INDEX IF NOT EXISTS idx_subscription_history_user_id ON public.subscription_history(user_id);
CREATE INDEX IF NOT EXISTS idx_discord_sync_logs_user_id ON public.discord_sync_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_lms_access_user_id ON public.lms_access(user_id);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER handle_user_profiles_updated_at
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- RLS Policies
-- User profiles can be read by the user themselves
CREATE POLICY "Users can view own profile" ON public.user_profiles
  FOR SELECT USING (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Users can update own profile" ON public.user_profiles
  FOR UPDATE USING (auth.uid() = id);

-- Users can insert their own profile
CREATE POLICY "Users can insert own profile" ON public.user_profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Subscription history can be read by the user
CREATE POLICY "Users can view own subscription history" ON public.subscription_history
  FOR SELECT USING (auth.uid() = user_id);

-- Discord sync logs can be read by the user
CREATE POLICY "Users can view own discord sync logs" ON public.discord_sync_logs
  FOR SELECT USING (auth.uid() = user_id);

-- LMS access can be read by the user
CREATE POLICY "Users can view own LMS access" ON public.lms_access
  FOR SELECT USING (auth.uid() = user_id);

-- Admin policies (for service role)
CREATE POLICY "Service role can manage all profiles" ON public.user_profiles
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role can manage subscription history" ON public.subscription_history
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role can manage discord sync logs" ON public.discord_sync_logs
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role can manage LMS access" ON public.lms_access
  FOR ALL USING (auth.role() = 'service_role');

-- Create function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, name, subscription_tier)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
    'free'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
