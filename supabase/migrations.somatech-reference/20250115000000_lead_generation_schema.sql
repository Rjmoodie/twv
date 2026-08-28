-- Lead Generation Module - Complete Schema
-- This migration creates all necessary tables for the lead generation system

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Properties table (main property data)
CREATE TABLE IF NOT EXISTS public.properties (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    address TEXT NOT NULL,
    city TEXT NOT NULL,
    state TEXT NOT NULL,
    zip TEXT NOT NULL,
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    owner_name TEXT,
    owner_type TEXT CHECK (owner_type IN ('individual', 'absentee', 'llc', 'corporation', 'trust')),
    property_type TEXT DEFAULT 'residential',
    bedrooms INTEGER,
    bathrooms DECIMAL(3, 1),
    square_feet INTEGER,
    lot_size INTEGER,
    year_built INTEGER,
    assessed_value DECIMAL(12, 2),
    estimated_value DECIMAL(12, 2),
    equity_percent DECIMAL(5, 2),
    mortgage_status TEXT DEFAULT 'unknown',
    lien_status TEXT DEFAULT 'none',
    tags TEXT[] DEFAULT '{}',
    status TEXT DEFAULT 'active',
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_properties_state ON public.properties(state);
CREATE INDEX IF NOT EXISTS idx_properties_city ON public.properties(city);
CREATE INDEX IF NOT EXISTS idx_properties_zip ON public.properties(zip);
CREATE INDEX IF NOT EXISTS idx_properties_owner_type ON public.properties(owner_type);
CREATE INDEX IF NOT EXISTS idx_properties_status ON public.properties(status);
CREATE INDEX IF NOT EXISTS idx_properties_equity_percent ON public.properties(equity_percent);
CREATE INDEX IF NOT EXISTS idx_properties_assessed_value ON public.properties(assessed_value);

-- Insert sample data for testing
INSERT INTO public.properties (
    address, city, state, zip, latitude, longitude, owner_name, owner_type,
    property_type, bedrooms, bathrooms, square_feet, lot_size, year_built,
    assessed_value, estimated_value, equity_percent, mortgage_status, lien_status,
    tags, status
) VALUES 
    ('123 Main St', 'New York', 'NY', '10001', 40.7128, -74.0060, 'John Doe', 'individual', 'residential', 3, 2, 1500, 5000, 1985, 350000, 400000, 75, 'active', 'none', ARRAY['distressed', 'vacant'], 'active'),
    ('456 Oak Ave', 'Los Angeles', 'CA', '90210', 34.0522, -118.2437, 'Jane Smith', 'absentee', 'residential', 4, 3, 2200, 8000, 1990, 550000, 650000, 60, 'active', 'none', ARRAY['high_equity'], 'active'),
    ('789 Elm St', 'Houston', 'TX', '77001', 29.7604, -95.3698, 'ABC Properties LLC', 'llc', 'residential', 2, 1.5, 1200, 4000, 1975, 250000, 300000, 80, 'paid_off', 'none', ARRAY['llc_owned'], 'active'),
    ('321 Beach Blvd', 'Miami', 'FL', '33139', 25.7617, -80.1918, 'Maria Rodriguez', 'absentee', 'residential', 3, 2.5, 1800, 6000, 1988, 450000, 550000, 70, 'active', 'none', ARRAY['absentee'], 'active'),
    ('654 Palm Dr', 'Phoenix', 'AZ', '85001', 33.4484, -112.0740, 'Trust Properties Inc', 'corporation', 'residential', 5, 3.5, 2800, 10000, 2000, 600000, 750000, 65, 'active', 'none', ARRAY['high_value'], 'active')
ON CONFLICT DO NOTHING; 