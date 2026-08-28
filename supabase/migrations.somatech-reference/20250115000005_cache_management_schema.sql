-- Cache Management Schema for Performance Monitoring and Persistence
-- Migration: 20250115000005_cache_management_schema.sql

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Cache Statistics Table
CREATE TABLE IF NOT EXISTS public.cache_statistics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cache_type VARCHAR(50) NOT NULL UNIQUE, -- Added UNIQUE constraint for ON CONFLICT
    total_requests BIGINT DEFAULT 0,
    cache_hits BIGINT DEFAULT 0,
    cache_misses BIGINT DEFAULT 0,
    hit_rate DECIMAL(5,2) DEFAULT 0.00,
    average_response_time_ms DECIMAL(10,2) DEFAULT 0.00,
    total_cache_size_bytes BIGINT DEFAULT 0,
    total_items INTEGER DEFAULT 0,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Cache Keys Tracking Table
CREATE TABLE IF NOT EXISTS public.cache_keys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cache_key VARCHAR(255) NOT NULL UNIQUE,
    cache_type VARCHAR(50) NOT NULL,
    data_size_bytes BIGINT DEFAULT 0,
    access_count INTEGER DEFAULT 0,
    last_accessed TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Cache Performance Logs Table
CREATE TABLE IF NOT EXISTS public.cache_performance_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cache_type VARCHAR(50) NOT NULL,
    operation_type VARCHAR(20) NOT NULL, -- 'get', 'set', 'delete', 'clear'
    response_time_ms DECIMAL(10,2) NOT NULL,
    cache_hit BOOLEAN DEFAULT false,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Cache Configuration Table
CREATE TABLE IF NOT EXISTS public.cache_configuration (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cache_type VARCHAR(50) NOT NULL UNIQUE,
    default_ttl_ms BIGINT DEFAULT 300000, -- 5 minutes
    max_size_mb INTEGER DEFAULT 100,
    cleanup_interval_ms BIGINT DEFAULT 60000, -- 1 minute
    enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Cache Invalidation Logs Table
CREATE TABLE IF NOT EXISTS public.cache_invalidation_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cache_type VARCHAR(50) NOT NULL,
    invalidation_type VARCHAR(20) NOT NULL, -- 'manual', 'automatic', 'expired'
    keys_affected INTEGER DEFAULT 0,
    invalidation_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_cache_statistics_type ON public.cache_statistics(cache_type);
CREATE INDEX IF NOT EXISTS idx_cache_keys_type ON public.cache_keys(cache_type);
CREATE INDEX IF NOT EXISTS idx_cache_keys_expires ON public.cache_keys(expires_at);
CREATE INDEX IF NOT EXISTS idx_cache_performance_logs_type ON public.cache_performance_logs(cache_type);
CREATE INDEX IF NOT EXISTS idx_cache_performance_logs_created ON public.cache_performance_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_cache_invalidation_logs_type ON public.cache_invalidation_logs(cache_type);

-- Function to update cache statistics
CREATE OR REPLACE FUNCTION update_cache_statistics(
    p_cache_type VARCHAR(50),
    p_total_requests BIGINT,
    p_cache_hits BIGINT,
    p_cache_misses BIGINT,
    p_average_response_time_ms DECIMAL(10,2),
    p_total_cache_size_bytes BIGINT,
    p_total_items INTEGER
) RETURNS VOID AS $$
BEGIN
    INSERT INTO public.cache_statistics (
        cache_type, total_requests, cache_hits, cache_misses, 
        hit_rate, average_response_time_ms, total_cache_size_bytes, total_items
    ) VALUES (
        p_cache_type, p_total_requests, p_cache_hits, p_cache_misses,
        CASE 
            WHEN p_total_requests > 0 THEN (p_cache_hits::DECIMAL / p_total_requests::DECIMAL) * 100
            ELSE 0
        END,
        p_average_response_time_ms, p_total_cache_size_bytes, p_total_items
    )
    ON CONFLICT (cache_type) DO UPDATE SET
        total_requests = EXCLUDED.total_requests,
        cache_hits = EXCLUDED.cache_hits,
        cache_misses = EXCLUDED.cache_misses,
        hit_rate = EXCLUDED.hit_rate,
        average_response_time_ms = EXCLUDED.average_response_time_ms,
        total_cache_size_bytes = EXCLUDED.total_cache_size_bytes,
        total_items = EXCLUDED.total_items,
        last_updated = NOW();
END;
$$ LANGUAGE plpgsql;

-- Function to log cache performance
CREATE OR REPLACE FUNCTION log_cache_performance(
    p_cache_type VARCHAR(50),
    p_operation_type VARCHAR(20),
    p_response_time_ms DECIMAL(10,2),
    p_cache_hit BOOLEAN DEFAULT false,
    p_error_message TEXT DEFAULT NULL
) RETURNS VOID AS $$
BEGIN
    INSERT INTO public.cache_performance_logs (
        cache_type, operation_type, response_time_ms, cache_hit, error_message
    ) VALUES (
        p_cache_type, p_operation_type, p_response_time_ms, p_cache_hit, p_error_message
    );
END;
$$ LANGUAGE plpgsql;

-- Function to log cache invalidation
CREATE OR REPLACE FUNCTION log_cache_invalidation(
    p_cache_type VARCHAR(50),
    p_invalidation_type VARCHAR(20),
    p_keys_affected INTEGER DEFAULT 0,
    p_invalidation_reason TEXT DEFAULT NULL
) RETURNS VOID AS $$
BEGIN
    INSERT INTO public.cache_invalidation_logs (
        cache_type, invalidation_type, keys_affected, invalidation_reason
    ) VALUES (
        p_cache_type, p_invalidation_type, p_keys_affected, p_invalidation_reason
    );
END;
$$ LANGUAGE plpgsql;

-- Function to clean up expired cache keys
CREATE OR REPLACE FUNCTION cleanup_expired_cache_keys() RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM public.cache_keys 
    WHERE expires_at IS NOT NULL AND expires_at < NOW();
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function to get cache performance summary
CREATE OR REPLACE FUNCTION get_cache_performance_summary(
    p_cache_type VARCHAR(50) DEFAULT NULL,
    p_hours_back INTEGER DEFAULT 24
) RETURNS TABLE (
    cache_type VARCHAR(50),
    total_operations BIGINT,
    average_response_time_ms DECIMAL(10,2),
    hit_rate DECIMAL(5,2),
    error_rate DECIMAL(5,2)
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        cpl.cache_type,
        COUNT(*)::BIGINT as total_operations,
        AVG(cpl.response_time_ms)::DECIMAL(10,2) as average_response_time_ms,
        (COUNT(*) FILTER (WHERE cpl.cache_hit = true)::DECIMAL / COUNT(*)::DECIMAL * 100)::DECIMAL(5,2) as hit_rate,
        (COUNT(*) FILTER (WHERE cpl.error_message IS NOT NULL)::DECIMAL / COUNT(*)::DECIMAL * 100)::DECIMAL(5,2) as error_rate
    FROM public.cache_performance_logs cpl
    WHERE cpl.created_at >= NOW() - INTERVAL '1 hour' * p_hours_back
    AND (p_cache_type IS NULL OR cpl.cache_type = p_cache_type)
    GROUP BY cpl.cache_type
    ORDER BY total_operations DESC;
END;
$$ LANGUAGE plpgsql;

-- Function to get cache hit rate trends
CREATE OR REPLACE FUNCTION get_cache_hit_rate_trends(
    p_cache_type VARCHAR(50) DEFAULT NULL,
    p_hours_back INTEGER DEFAULT 24
) RETURNS TABLE (
    hour_bucket TIMESTAMP WITH TIME ZONE,
    cache_type VARCHAR(50),
    total_requests BIGINT,
    cache_hits BIGINT,
    hit_rate DECIMAL(5,2)
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        date_trunc('hour', cpl.created_at) as hour_bucket,
        cpl.cache_type,
        COUNT(*)::BIGINT as total_requests,
        COUNT(*) FILTER (WHERE cpl.cache_hit = true)::BIGINT as cache_hits,
        (COUNT(*) FILTER (WHERE cpl.cache_hit = true)::DECIMAL / COUNT(*)::DECIMAL * 100)::DECIMAL(5,2) as hit_rate
    FROM public.cache_performance_logs cpl
    WHERE cpl.created_at >= NOW() - INTERVAL '1 hour' * p_hours_back
    AND (p_cache_type IS NULL OR cpl.cache_type = p_cache_type)
    GROUP BY date_trunc('hour', cpl.created_at), cpl.cache_type
    ORDER BY hour_bucket DESC, hit_rate DESC;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_cache_keys_updated_at
    BEFORE UPDATE ON public.cache_keys
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_cache_configuration_updated_at
    BEFORE UPDATE ON public.cache_configuration
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Insert initial cache configuration data
INSERT INTO public.cache_configuration (cache_type, default_ttl_ms, max_size_mb, cleanup_interval_ms) VALUES
    ('property', 300000, 200, 60000),
    ('mls', 600000, 150, 120000),
    ('analytics', 900000, 100, 300000),
    ('etl', 1800000, 50, 600000)
ON CONFLICT (cache_type) DO NOTHING;

-- Insert initial cache statistics
INSERT INTO public.cache_statistics (cache_type, total_requests, cache_hits, cache_misses, hit_rate) VALUES
    ('property', 0, 0, 0, 0.00),
    ('mls', 0, 0, 0, 0.00),
    ('analytics', 0, 0, 0, 0.00),
    ('etl', 0, 0, 0, 0.00)
ON CONFLICT (cache_type) DO NOTHING;

-- Create a scheduled job to clean up expired cache keys (commented out for now)
-- SELECT cron.schedule('cleanup-expired-cache-keys', '*/5 * * * *', 'SELECT cleanup_expired_cache_keys();');

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated; 