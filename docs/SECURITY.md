# 🔒 Security Configuration Guide

## 🚨 **Critical Security Steps**

### **1. Create Environment Variables File**

Create a `.env` file in your `somatech` directory with the following content:

```bash
# Supabase Configuration
VITE_SUPABASE_URL=https://dkxqmiamrnphjoaznpuo.supabase.co
VITE_SUPABASE_ANON_KEY=SUPABASE_ANON_KEY_REDACTED

# Stripe Configuration (Get these from your Stripe Dashboard)
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key_here
STRIPE_PUBLIC_KEY=pk_test_your_stripe_public_key_here
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret_here

# Discord Bot Configuration
DISCORD_BOT_TOKEN=your_discord_bot_token_here
DISCORD_CLIENT_ID=your_discord_client_id_here
DISCORD_SERVER_ID=your_discord_server_id_here
DISCORD_BOT_SECRET=your_discord_bot_secret_here

# Alpha Vantage API (for stock data)
ALPHA_VANTAGE_API_KEY=your_alpha_vantage_api_key_here
```

### **2. Supabase Security Advisor Review**

Visit your Supabase Security Advisor:
**🔗 https://supabase.com/dashboard/project/dkxqmiamrnphjoaznpuo/settings/security**

Common warnings you might see:

#### **A. Function Search Path Mutable**
- **Issue**: Functions with mutable search_path can be exploited
- **Fix**: Set `search_path` to empty string in function definitions
- **Example**:
  ```sql
  CREATE OR REPLACE FUNCTION my_function()
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = ''
  AS $$
  BEGIN
    -- function body
  END;
  $$;
  ```

#### **B. Extension in Public Schema**
- **Issue**: Extensions in public schema can be security risk
- **Fix**: Move extensions to dedicated schema
- **Example**:
  ```sql
  CREATE SCHEMA extensions;
  ALTER EXTENSION supabase-dbdev SET SCHEMA extensions;
  ```

#### **C. Missing RLS Policies**
- **Issue**: Tables without RLS allow unrestricted access
- **Fix**: Enable RLS and create appropriate policies
- **Example**:
  ```sql
  ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
  
  CREATE POLICY "Users can view own profile" ON user_profiles
    FOR SELECT USING (auth.uid() = id);
  ```

### **3. Database Security Setup**

Run the subscription system migration to create secure tables:

```bash
# Option 1: Use the SQL file directly in Supabase SQL Editor
# Go to: https://supabase.com/dashboard/project/dkxqmiamrnphjoaznpuo/sql
# Copy and paste the contents of create-subscription-tables.sql

# Option 2: Use the setup script
node setup-subscription-db.js
```

### **4. API Key Security**

#### **✅ DO:**
- Use anon key for client-side operations
- Store service role key in environment variables only
- Use HTTPS for all communications
- Regularly rotate API keys

#### **❌ DON'T:**
- Never expose service role key in client code
- Never commit API keys to version control
- Never use service role key in frontend applications

### **5. Row Level Security (RLS) Implementation**

Once your tables are created, implement RLS policies:

```sql
-- Enable RLS on all user data tables
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE discord_sync_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE lms_access ENABLE ROW LEVEL SECURITY;

-- Create policies for user access
CREATE POLICY "Users can view own profile" ON user_profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON user_profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can view own subscription history" ON subscription_history
  FOR SELECT USING (auth.uid() = user_id);

-- Service role policies for admin operations
CREATE POLICY "Service role can manage all profiles" ON user_profiles
  FOR ALL USING (auth.role() = 'service_role');
```

## 🔍 **Security Monitoring**

### **Regular Security Checks:**

1. **Weekly**:
   - Review Supabase Security Advisor
   - Check for new security warnings
   - Monitor failed authentication attempts

2. **Monthly**:
   - Rotate API keys
   - Review user access logs
   - Update security policies

3. **Quarterly**:
   - Full security audit
   - Review and update RLS policies
   - Test incident response procedures

### **Security Dashboard Links:**

- **Security Advisor**: https://supabase.com/dashboard/project/dkxqmiamrnphjoaznpuo/settings/security
- **RLS Policies**: https://supabase.com/dashboard/project/dkxqmiamrnphjoaznpuo/auth/policies
- **API Keys**: https://supabase.com/dashboard/project/dkxqmiamrnphjoaznpuo/settings/api
- **Database Settings**: https://supabase.com/dashboard/project/dkxqmiamrnphjoaznpuo/settings/database
- **Auth Settings**: https://supabase.com/dashboard/project/dkxqmiamrnphjoaznpuo/auth/settings

## 🚨 **Emergency Security Procedures**

### **If API Keys are Compromised:**

1. **Immediate Actions**:
   - Rotate all compromised keys in Supabase dashboard
   - Update environment variables
   - Review access logs for suspicious activity

2. **Investigation**:
   - Check for unauthorized data access
   - Review recent user activities
   - Monitor for unusual patterns

3. **Recovery**:
   - Update all client applications
   - Notify users if necessary
   - Implement additional monitoring

### **If Database is Compromised:**

1. **Immediate Actions**:
   - Change all database passwords
   - Review and update RLS policies
   - Check for unauthorized data modifications

2. **Investigation**:
   - Review database logs
   - Check for data exfiltration
   - Identify attack vectors

3. **Recovery**:
   - Restore from clean backup if necessary
   - Implement additional security measures
   - Update incident response procedures

## 📋 **Security Checklist**

### **Initial Setup**
- [ ] Create `.env` file with all required variables
- [ ] Review Supabase Security Advisor
- [ ] Create subscription system database tables
- [ ] Implement RLS policies
- [ ] Test security configurations

### **Ongoing Security**
- [ ] Regular security reviews
- [ ] API key rotation
- [ ] Monitor access logs
- [ ] Update security policies
- [ ] Test incident response

### **Production Deployment**
- [ ] Use production API keys
- [ ] Enable all security features
- [ ] Set up monitoring and alerting
- [ ] Implement backup procedures
- [ ] Create incident response plan

## 🆘 **Support and Resources**

- **Supabase Security Docs**: https://supabase.com/docs/guides/auth/row-level-security
- **Security Best Practices**: https://supabase.com/docs/guides/platform/security
- **Community Support**: https://github.com/supabase/supabase/discussions
- **Security Issues**: security@supabase.com

---

**Remember**: Security is an ongoing process, not a one-time setup. Regular reviews and updates are essential for maintaining a secure application.
