-- PostGIS and Geospatial Features Migration
-- Enables advanced spatial queries and location-based search

-- Enable PostGIS extension
CREATE EXTENSION IF NOT EXISTS postgis;

-- Add geometry column to properties table for spatial queries
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS location GEOMETRY(POINT, 4326);

-- Create spatial index for efficient geospatial queries
CREATE INDEX IF NOT EXISTS idx_properties_location ON public.properties USING GIST (location);

-- Create function to update location geometry from lat/lng
CREATE OR REPLACE FUNCTION update_property_location()
RETURNS TRIGGER AS $$
BEGIN
    -- Update location geometry when latitude or longitude changes
    IF NEW.latitude IS NOT NULL AND NEW.longitude IS NOT NULL THEN
        NEW.location = ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326);
    ELSE
        NEW.location = NULL;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update location geometry
DROP TRIGGER IF EXISTS trigger_update_property_location ON public.properties;
CREATE TRIGGER trigger_update_property_location
    BEFORE INSERT OR UPDATE ON public.properties
    FOR EACH ROW
    EXECUTE FUNCTION update_property_location();

-- Update existing properties with location data
UPDATE public.properties 
SET location = ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)
WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

-- Create function for radius search
CREATE OR REPLACE FUNCTION search_properties_by_radius(
    center_lat DECIMAL,
    center_lng DECIMAL,
    radius_miles DECIMAL
)
RETURNS TABLE (
    id UUID,
    address TEXT,
    city TEXT,
    state TEXT,
    zip TEXT,
    latitude DECIMAL,
    longitude DECIMAL,
    distance_miles DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id,
        p.address,
        p.city,
        p.state,
        p.zip,
        p.latitude,
        p.longitude,
        ST_Distance(
            p.location::geography,
            ST_SetSRID(ST_MakePoint(center_lng, center_lat), 4326)::geography
        ) / 1609.34 as distance_miles
    FROM public.properties p
    WHERE p.location IS NOT NULL
    AND ST_DWithin(
        p.location::geography,
        ST_SetSRID(ST_MakePoint(center_lng, center_lat), 4326)::geography,
        radius_miles * 1609.34
    )
    ORDER BY distance_miles;
END;
$$ LANGUAGE plpgsql;

-- Create function for polygon search
CREATE OR REPLACE FUNCTION search_properties_in_polygon(
    polygon_coords TEXT -- WKT format: 'POLYGON((lng1 lat1, lng2 lat2, ...))'
)
RETURNS TABLE (
    id UUID,
    address TEXT,
    city TEXT,
    state TEXT,
    zip TEXT,
    latitude DECIMAL,
    longitude DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id,
        p.address,
        p.city,
        p.state,
        p.zip,
        p.latitude,
        p.longitude
    FROM public.properties p
    WHERE p.location IS NOT NULL
    AND ST_Contains(
        ST_GeomFromText(polygon_coords, 4326),
        p.location
    );
END;
$$ LANGUAGE plpgsql;

-- Create function for nearest neighbor search
CREATE OR REPLACE FUNCTION find_nearest_properties(
    center_lat DECIMAL,
    center_lng DECIMAL,
    limit_count INTEGER DEFAULT 10
)
RETURNS TABLE (
    id UUID,
    address TEXT,
    city TEXT,
    state TEXT,
    zip TEXT,
    latitude DECIMAL,
    longitude DECIMAL,
    distance_miles DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id,
        p.address,
        p.city,
        p.state,
        p.zip,
        p.latitude,
        p.longitude,
        ST_Distance(
            p.location::geography,
            ST_SetSRID(ST_MakePoint(center_lng, center_lat), 4326)::geography
        ) / 1609.34 as distance_miles
    FROM public.properties p
    WHERE p.location IS NOT NULL
    ORDER BY p.location <-> ST_SetSRID(ST_MakePoint(center_lng, center_lat), 4326)
    LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;

-- Create function for market analysis by area
CREATE OR REPLACE FUNCTION get_market_analysis_by_radius(
    center_lat DECIMAL,
    center_lng DECIMAL,
    radius_miles DECIMAL
)
RETURNS TABLE (
    total_properties INTEGER,
    avg_price DECIMAL,
    avg_price_per_sqft DECIMAL,
    avg_investment_score DECIMAL,
    avg_equity_percent DECIMAL,
    property_types JSONB,
    price_ranges JSONB
) AS $$
BEGIN
    RETURN QUERY
    WITH property_stats AS (
        SELECT 
            p.*,
            ST_Distance(
                p.location::geography,
                ST_SetSRID(ST_MakePoint(center_lng, center_lat), 4326)::geography
            ) / 1609.34 as distance_miles
        FROM public.properties p
        WHERE p.location IS NOT NULL
        AND ST_DWithin(
            p.location::geography,
            ST_SetSRID(ST_MakePoint(center_lng, center_lat), 4326)::geography,
            radius_miles * 1609.34
        )
    )
    SELECT 
        COUNT(*)::INTEGER as total_properties,
        AVG(estimated_value) as avg_price,
        AVG(price_per_sqft) as avg_price_per_sqft,
        AVG(investment_score) as avg_investment_score,
        AVG(equity_percent) as avg_equity_percent,
        jsonb_object_agg(property_type, COUNT(*)) as property_types,
        jsonb_build_object(
            'under_100k', COUNT(*) FILTER (WHERE estimated_value < 100000),
            '100k_200k', COUNT(*) FILTER (WHERE estimated_value >= 100000 AND estimated_value < 200000),
            '200k_300k', COUNT(*) FILTER (WHERE estimated_value >= 200000 AND estimated_value < 300000),
            '300k_500k', COUNT(*) FILTER (WHERE estimated_value >= 300000 AND estimated_value < 500000),
            'over_500k', COUNT(*) FILTER (WHERE estimated_value >= 500000)
        ) as price_ranges
    FROM property_stats;
END;
$$ LANGUAGE plpgsql;

-- Add full-text search index for address and owner search
CREATE INDEX IF NOT EXISTS idx_properties_address_fts ON public.properties USING GIN (to_tsvector('english', address || ' ' || city || ' ' || state || ' ' || zip));
CREATE INDEX IF NOT EXISTS idx_properties_owner_fts ON public.properties USING GIN (to_tsvector('english', owner_name));

-- Create function for full-text search
CREATE OR REPLACE FUNCTION search_properties_fulltext(
    search_query TEXT,
    limit_count INTEGER DEFAULT 50
)
RETURNS TABLE (
    id UUID,
    address TEXT,
    city TEXT,
    state TEXT,
    zip TEXT,
    owner_name TEXT,
    estimated_value DECIMAL,
    investment_score DECIMAL,
    rank REAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id,
        p.address,
        p.city,
        p.state,
        p.zip,
        p.owner_name,
        p.estimated_value,
        p.investment_score,
        ts_rank(
            to_tsvector('english', p.address || ' ' || p.city || ' ' || p.state || ' ' || p.zip || ' ' || COALESCE(p.owner_name, '')),
            plainto_tsquery('english', search_query)
        ) as rank
    FROM public.properties p
    WHERE to_tsvector('english', p.address || ' ' || p.city || ' ' || p.state || ' ' || p.zip || ' ' || COALESCE(p.owner_name, '')) @@ plainto_tsquery('english', search_query)
    ORDER BY rank DESC
    LIMIT limit_count;
END;
$$ LANGUAGE plpgsql; 