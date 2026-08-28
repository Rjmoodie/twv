-- Phase 2D: Advanced Analytics Schema
-- Adds analytics tables, functions, and indexes for market insights and predictive modeling

-- Analytics Tables
CREATE TABLE IF NOT EXISTS public.market_analytics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    market_id TEXT NOT NULL,
    area_name TEXT NOT NULL,
    total_properties INTEGER NOT NULL DEFAULT 0,
    average_price DECIMAL(12, 2) NOT NULL DEFAULT 0,
    average_price_per_sqft DECIMAL(8, 2) NOT NULL DEFAULT 0,
    average_days_on_market INTEGER NOT NULL DEFAULT 0,
    price_trend TEXT CHECK (price_trend IN ('increasing', 'decreasing', 'stable')),
    market_activity TEXT CHECK (market_activity IN ('high', 'medium', 'low')),
    investment_opportunities INTEGER NOT NULL DEFAULT 0,
    market_predictions JSONB,
    top_performing_areas JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.investment_analytics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    property_id UUID REFERENCES public.properties(id) ON DELETE CASCADE,
    investment_score DECIMAL(3, 1) NOT NULL DEFAULT 0,
    cash_on_cash_return DECIMAL(5, 2) NOT NULL DEFAULT 0,
    cap_rate DECIMAL(5, 2) NOT NULL DEFAULT 0,
    total_return DECIMAL(5, 2) NOT NULL DEFAULT 0,
    break_even_time DECIMAL(8, 2) NOT NULL DEFAULT 0,
    risk_score DECIMAL(3, 1) NOT NULL DEFAULT 10,
    market_percentile INTEGER NOT NULL DEFAULT 0,
    similar_properties_count INTEGER NOT NULL DEFAULT 0,
    recommendations TEXT[] DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.predictive_models (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    model_id TEXT UNIQUE NOT NULL,
    model_type TEXT NOT NULL CHECK (model_type IN ('price_prediction', 'investment_score', 'market_trend')),
    accuracy DECIMAL(3, 2) NOT NULL DEFAULT 0,
    features TEXT[] NOT NULL DEFAULT '{}',
    model_metadata JSONB,
    last_trained TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.model_predictions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    model_id UUID REFERENCES public.predictive_models(id) ON DELETE CASCADE,
    property_id UUID REFERENCES public.properties(id) ON DELETE CASCADE,
    predicted_value DECIMAL(12, 2) NOT NULL,
    confidence DECIMAL(3, 2) NOT NULL DEFAULT 0,
    prediction_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.market_insights (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    market_id TEXT NOT NULL,
    insight_type TEXT NOT NULL CHECK (insight_type IN ('trend', 'opportunity', 'risk', 'comparison')),
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    confidence DECIMAL(3, 2) NOT NULL DEFAULT 0,
    impact TEXT NOT NULL CHECK (impact IN ('high', 'medium', 'low')),
    data_points JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.analytics_cache (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cache_key TEXT UNIQUE NOT NULL,
    cache_data JSONB NOT NULL,
    ttl_seconds INTEGER NOT NULL DEFAULT 300,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL
);

-- County Assessor Integration Tables
CREATE TABLE IF NOT EXISTS public.county_assessor_data (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    property_id UUID REFERENCES public.properties(id) ON DELETE CASCADE,
    county_name TEXT NOT NULL,
    assessor_id TEXT,
    parcel_number TEXT,
    owner_name TEXT,
    owner_address TEXT,
    owner_city TEXT,
    owner_state TEXT,
    owner_zip TEXT,
    owner_phone TEXT,
    owner_email TEXT,
    assessed_value DECIMAL(12, 2),
    land_value DECIMAL(12, 2),
    improvement_value DECIMAL(12, 2),
    tax_year INTEGER,
    last_sale_date DATE,
    last_sale_price DECIMAL(12, 2),
    property_class TEXT,
    zoning TEXT,
    land_use TEXT,
    exemptions TEXT[],
    tax_delinquent BOOLEAN DEFAULT FALSE,
    tax_delinquent_amount DECIMAL(12, 2) DEFAULT 0,
    raw_data JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.county_sync_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    county_name TEXT NOT NULL,
    sync_type TEXT NOT NULL CHECK (sync_type IN ('full', 'incremental', 'manual')),
    records_processed INTEGER NOT NULL DEFAULT 0,
    records_added INTEGER NOT NULL DEFAULT 0,
    records_updated INTEGER NOT NULL DEFAULT 0,
    records_skipped INTEGER NOT NULL DEFAULT 0,
    errors TEXT[] DEFAULT '{}',
    processing_time_seconds INTEGER,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    status TEXT NOT NULL CHECK (status IN ('running', 'completed', 'failed')) DEFAULT 'running'
);

-- Indexes for Performance
CREATE INDEX IF NOT EXISTS idx_market_analytics_market_id ON public.market_analytics(market_id);
CREATE INDEX IF NOT EXISTS idx_market_analytics_area_name ON public.market_analytics(area_name);
CREATE INDEX IF NOT EXISTS idx_market_analytics_created_at ON public.market_analytics(created_at);

CREATE INDEX IF NOT EXISTS idx_investment_analytics_property_id ON public.investment_analytics(property_id);
CREATE INDEX IF NOT EXISTS idx_investment_analytics_investment_score ON public.investment_analytics(investment_score);
CREATE INDEX IF NOT EXISTS idx_investment_analytics_cash_on_cash_return ON public.investment_analytics(cash_on_cash_return);

CREATE INDEX IF NOT EXISTS idx_predictive_models_model_type ON public.predictive_models(model_type);
CREATE INDEX IF NOT EXISTS idx_predictive_models_last_trained ON public.predictive_models(last_trained);

CREATE INDEX IF NOT EXISTS idx_model_predictions_model_id ON public.model_predictions(model_id);
CREATE INDEX IF NOT EXISTS idx_model_predictions_property_id ON public.model_predictions(property_id);
CREATE INDEX IF NOT EXISTS idx_model_predictions_prediction_date ON public.model_predictions(prediction_date);

CREATE INDEX IF NOT EXISTS idx_market_insights_market_id ON public.market_insights(market_id);
CREATE INDEX IF NOT EXISTS idx_market_insights_insight_type ON public.market_insights(insight_type);
CREATE INDEX IF NOT EXISTS idx_market_insights_impact ON public.market_insights(impact);

CREATE INDEX IF NOT EXISTS idx_analytics_cache_key ON public.analytics_cache(cache_key);
CREATE INDEX IF NOT EXISTS idx_analytics_cache_expires_at ON public.analytics_cache(expires_at);

CREATE INDEX IF NOT EXISTS idx_county_assessor_data_property_id ON public.county_assessor_data(property_id);
CREATE INDEX IF NOT EXISTS idx_county_assessor_data_county_name ON public.county_assessor_data(county_name);
CREATE INDEX IF NOT EXISTS idx_county_assessor_data_parcel_number ON public.county_assessor_data(parcel_number);
CREATE INDEX IF NOT EXISTS idx_county_assessor_data_owner_name ON public.county_assessor_data(owner_name);

CREATE INDEX IF NOT EXISTS idx_county_sync_log_county_name ON public.county_sync_log(county_name);
CREATE INDEX IF NOT EXISTS idx_county_sync_log_status ON public.county_sync_log(status);
CREATE INDEX IF NOT EXISTS idx_county_sync_log_started_at ON public.county_sync_log(started_at);

-- Functions for Analytics Calculations

-- Function to calculate market analytics for a given area
CREATE OR REPLACE FUNCTION calculate_market_analytics(area_name TEXT DEFAULT NULL)
RETURNS TABLE (
    total_properties BIGINT,
    average_price DECIMAL(12, 2),
    average_price_per_sqft DECIMAL(8, 2),
    average_days_on_market DECIMAL(8, 2),
    price_trend TEXT,
    market_activity TEXT,
    investment_opportunities BIGINT
) AS $$
BEGIN
    RETURN QUERY
    WITH property_stats AS (
        SELECT 
            COUNT(*) as total_count,
            AVG(estimated_value) as avg_price,
            AVG(CASE WHEN square_feet > 0 THEN estimated_value / square_feet ELSE NULL END) as avg_price_per_sqft,
            AVG(days_on_market) as avg_dom,
            COUNT(CASE WHEN status = 'active' THEN 1 END) as active_count,
            COUNT(CASE WHEN investment_score > 7 AND equity_percent > 20 THEN 1 END) as investment_opps
        FROM public.properties
        WHERE (area_name IS NULL OR city = area_name)
    ),
    price_trend_calc AS (
        SELECT 
            CASE 
                WHEN recent_avg > older_avg * 1.02 THEN 'increasing'
                WHEN recent_avg < older_avg * 0.98 THEN 'decreasing'
                ELSE 'stable'
            END as trend
        FROM (
            SELECT 
                AVG(CASE WHEN last_updated > NOW() - INTERVAL '30 days' THEN estimated_value END) as recent_avg,
                AVG(CASE WHEN last_updated <= NOW() - INTERVAL '30 days' THEN estimated_value END) as older_avg
            FROM public.properties
            WHERE (area_name IS NULL OR city = area_name)
        ) trend_data
    ),
    activity_calc AS (
        SELECT 
            CASE 
                WHEN activity_pct > 30 THEN 'high'
                WHEN activity_pct > 15 THEN 'medium'
                ELSE 'low'
            END as activity
        FROM (
            SELECT (active_count::DECIMAL / total_count * 100) as activity_pct
            FROM property_stats
        ) activity_data
    )
    SELECT 
        ps.total_count,
        ps.avg_price,
        ps.avg_price_per_sqft,
        ps.avg_dom,
        pt.trend,
        ac.activity,
        ps.investment_opps
    FROM property_stats ps, price_trend_calc pt, activity_calc ac;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate investment analytics for a property
CREATE OR REPLACE FUNCTION calculate_investment_analytics(property_uuid UUID)
RETURNS TABLE (
    investment_score DECIMAL(3, 1),
    cash_on_cash_return DECIMAL(5, 2),
    cap_rate DECIMAL(5, 2),
    total_return DECIMAL(5, 2),
    break_even_time DECIMAL(8, 2),
    risk_score DECIMAL(3, 1),
    market_percentile INTEGER
) AS $$
DECLARE
    prop_record RECORD;
    down_payment DECIMAL(12, 2);
    annual_rent DECIMAL(12, 2);
    annual_expenses DECIMAL(12, 2);
    monthly_cash_flow DECIMAL(12, 2);
    value_appreciation DECIMAL(5, 2);
    percentile_rank INTEGER;
BEGIN
    -- Get property data
    SELECT * INTO prop_record
    FROM public.properties
    WHERE id = property_uuid;
    
    IF NOT FOUND THEN
        RETURN;
    END IF;
    
    -- Calculate investment metrics
    down_payment := prop_record.estimated_value * 0.25;
    annual_rent := COALESCE(prop_record.rental_estimate, 0) * 12;
    annual_expenses := annual_rent * 0.4;
    monthly_cash_flow := (annual_rent - annual_expenses) / 12;
    value_appreciation := CASE 
        WHEN prop_record.assessed_value > 0 THEN 
            ((prop_record.estimated_value - prop_record.assessed_value) / prop_record.assessed_value) * 100
        ELSE 0
    END;
    
    -- Calculate percentile rank
    SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY investment_score) INTO percentile_rank
    FROM public.properties
    WHERE city = prop_record.city;
    
    RETURN QUERY
    SELECT 
        COALESCE(prop_record.investment_score, 0),
        CASE WHEN down_payment > 0 THEN ((annual_rent - annual_expenses) / down_payment) * 100 ELSE 0 END,
        CASE WHEN prop_record.estimated_value > 0 THEN ((annual_rent - annual_expenses) / prop_record.estimated_value) * 100 ELSE 0 END,
        (value_appreciation + CASE WHEN down_payment > 0 THEN ((annual_rent - annual_expenses) / down_payment) * 100 ELSE 0 END),
        CASE WHEN monthly_cash_flow > 0 THEN down_payment / monthly_cash_flow ELSE 0 END,
        GREATEST(0, 10 - COALESCE(prop_record.investment_score, 0)),
        COALESCE(percentile_rank, 50);
END;
$$ LANGUAGE plpgsql;

-- Function to clean expired cache entries
CREATE OR REPLACE FUNCTION clean_expired_cache()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM public.analytics_cache
    WHERE expires_at < NOW();
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function to update county assessor data
CREATE OR REPLACE FUNCTION update_county_assessor_data()
RETURNS TRIGGER AS $$
BEGIN
    -- Update property with county assessor data
    UPDATE public.properties
    SET 
        owner_name = COALESCE(NEW.owner_name, owner_name),
        assessed_value = COALESCE(NEW.assessed_value, assessed_value),
        last_updated = NOW()
    WHERE id = NEW.property_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers
CREATE TRIGGER trigger_update_county_assessor_data
    AFTER INSERT OR UPDATE ON public.county_assessor_data
    FOR EACH ROW
    EXECUTE FUNCTION update_county_assessor_data();

-- Update timestamps trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers to new tables
CREATE TRIGGER trigger_update_market_analytics_updated_at
    BEFORE UPDATE ON public.market_analytics
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_update_investment_analytics_updated_at
    BEFORE UPDATE ON public.investment_analytics
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_update_predictive_models_updated_at
    BEFORE UPDATE ON public.predictive_models
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_update_market_insights_updated_at
    BEFORE UPDATE ON public.market_insights
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_update_county_assessor_data_updated_at
    BEFORE UPDATE ON public.county_assessor_data
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Sample data for testing
INSERT INTO public.predictive_models (model_id, model_type, accuracy, features, model_metadata) VALUES
('price_prediction_v1', 'price_prediction', 0.85, ARRAY['price', 'sqft', 'bedrooms', 'bathrooms', 'year_built', 'location'], '{"version": "1.0", "algorithm": "random_forest"}'),
('investment_score_v1', 'investment_score', 0.82, ARRAY['equity_percent', 'estimated_value', 'rental_estimate', 'days_on_market'], '{"version": "1.0", "algorithm": "gradient_boosting"}'),
('market_trend_v1', 'market_trend', 0.78, ARRAY['price_history', 'inventory_levels', 'days_on_market'], '{"version": "1.0", "algorithm": "time_series"}')
ON CONFLICT (model_id) DO NOTHING;

INSERT INTO public.market_insights (market_id, insight_type, title, description, confidence, impact, data_points) VALUES
('phoenix', 'trend', 'Price Appreciation Trend', 'Property values in Phoenix are showing consistent upward movement with 8.5% year-over-year growth', 0.85, 'high', '[]'),
('phoenix', 'opportunity', 'Investment Opportunity', 'High equity properties available with strong rental potential and 12% average cash-on-cash returns', 0.78, 'medium', '[]'),
('phoenix', 'risk', 'Market Risk Assessment', 'Moderate risk due to recent price volatility and increasing inventory levels', 0.72, 'medium', '[]'),
('dallas', 'trend', 'Market Stability', 'Dallas market showing stable growth with consistent demand and balanced inventory', 0.88, 'medium', '[]'),
('dallas', 'opportunity', 'Value Add Opportunities', 'Older properties in prime locations offer significant value-add potential', 0.81, 'high', '[]')
ON CONFLICT DO NOTHING;

-- Create a scheduled job to clean expired cache (runs every hour)
-- Note: cron extension must be enabled in Supabase
-- SELECT cron.schedule(
--     'clean-expired-cache',
--     '0 * * * *',
--     'SELECT clean_expired_cache();'
-- ); 