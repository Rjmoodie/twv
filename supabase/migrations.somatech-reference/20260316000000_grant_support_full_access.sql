-- Step 1: Create user_profiles table if it doesn't exist yet
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT NOT NULL,
  name TEXT,
  subscription_tier TEXT NOT NULL DEFAULT 'free'
    CHECK (subscription_tier IN ('free', 'tier1', 'tier2', 'tier3')),
  role TEXT NOT NULL DEFAULT 'user'
    CHECK (role IN ('user', 'admin', 'super_admin')),
  stripe_customer_id TEXT UNIQUE,
  discord_id TEXT UNIQUE,
  discord_username TEXT,
  subscription_status TEXT DEFAULT 'active'
    CHECK (subscription_status IN ('active', 'canceled', 'past_due', 'unpaid')),
  subscription_ends_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- RLS policies (idempotent via DROP IF EXISTS + CREATE)
DO $$ BEGIN
  DROP POLICY IF EXISTS "Users can view own profile"            ON public.user_profiles;
  DROP POLICY IF EXISTS "Users can update own profile"          ON public.user_profiles;
  DROP POLICY IF EXISTS "Users can insert own profile"          ON public.user_profiles;
  DROP POLICY IF EXISTS "Service role can manage all profiles"  ON public.user_profiles;
END $$;

CREATE POLICY "Users can view own profile"   ON public.user_profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.user_profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.user_profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Service role can manage all profiles" ON public.user_profiles FOR ALL USING (auth.role() = 'service_role');

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS handle_user_profiles_updated_at ON public.user_profiles;
CREATE TRIGGER handle_user_profiles_updated_at
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Auto-create profile on sign-up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, name, subscription_tier)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', NEW.email),
    'free'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Indexes
CREATE INDEX IF NOT EXISTS idx_user_profiles_subscription_tier  ON public.user_profiles(subscription_tier);
CREATE INDEX IF NOT EXISTS idx_user_profiles_stripe_customer_id ON public.user_profiles(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_role               ON public.user_profiles(role);

-- Step 2: Grant support@somatech.pro tier3 + admin
DO $$
DECLARE
  v_user_id UUID;
BEGIN
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE email = 'support@somatech.pro'
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE NOTICE 'support@somatech.pro not found in auth.users — sign up first, then re-run this script.';
    RETURN;
  END IF;

  INSERT INTO public.user_profiles (
    id, email, name, subscription_tier, role, subscription_status, created_at, updated_at
  ) VALUES (
    v_user_id, 'support@somatech.pro', 'SomaTech Support', 'tier3', 'admin', 'active', NOW(), NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    subscription_tier   = 'tier3',
    role                = 'admin',
    subscription_status = 'active',
    updated_at          = NOW();

  RAISE NOTICE 'Done — support@somatech.pro has tier3 + admin (user_id: %)', v_user_id;
END;
$$;
