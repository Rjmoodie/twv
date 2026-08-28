-- Enhanced Property Schema for Lead Generation
-- Adds comprehensive property data and related tables

-- Enhanced properties table with more fields
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS market_value DECIMAL(12, 2);
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS last_sale_date DATE;
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS last_sale_price DECIMAL(12, 2);
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS property_condition TEXT CHECK (property_condition IN ('excellent', 'good', 'fair', 'poor', 'unknown'));
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS roof_condition TEXT;
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS hvac_condition TEXT;
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS foundation_condition TEXT;
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS lot_shape TEXT;
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS zoning TEXT;
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS flood_zone TEXT;
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS school_district TEXT;
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS crime_rate DECIMAL(5, 2);
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS walk_score INTEGER;
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS transit_score INTEGER;
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS bike_score INTEGER;
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS days_on_market INTEGER;
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS price_per_sqft DECIMAL(8, 2);
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS rental_estimate DECIMAL(10, 2);
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS investment_score DECIMAL(3, 1);
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS arv_estimate DECIMAL(12, 2);
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS rehab_cost_estimate DECIMAL(10, 2);
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS cash_on_cash_return DECIMAL(5, 2);
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS cap_rate DECIMAL(5, 2);
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS gross_rent_multiplier DECIMAL(5, 2);
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS data_source TEXT;
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS data_confidence DECIMAL(3, 2);
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS last_data_update TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Owner contact information table
CREATE TABLE IF NOT EXISTS public.owner_contacts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    property_id UUID REFERENCES public.properties(id) ON DELETE CASCADE,
    owner_name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    mailing_address TEXT,
    mailing_city TEXT,
    mailing_state TEXT,
    mailing_zip TEXT,
    is_absentee BOOLEAN DEFAULT false,
    contact_preference TEXT CHECK (contact_preference IN ('phone', 'email', 'mail', 'unknown')),
    last_contact_date DATE,
    contact_status TEXT CHECK (contact_status IN ('new', 'contacted', 'interested', 'not_interested', 'sold')),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Property photos table
CREATE TABLE IF NOT EXISTS public.property_photos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    property_id UUID REFERENCES public.properties(id) ON DELETE CASCADE,
    photo_url TEXT NOT NULL,
    photo_type TEXT CHECK (photo_type IN ('exterior', 'interior', 'aerial', 'street_view')),
    caption TEXT,
    is_primary BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Market comparables table
CREATE TABLE IF NOT EXISTS public.comparable_sales (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    property_id UUID REFERENCES public.properties(id) ON DELETE CASCADE,
    comp_address TEXT NOT NULL,
    comp_city TEXT,
    comp_state TEXT,
    comp_zip TEXT,
    sale_date DATE,
    sale_price DECIMAL(12, 2),
    square_feet INTEGER,
    bedrooms INTEGER,
    bathrooms DECIMAL(3, 1),
    distance_miles DECIMAL(5, 2),
    similarity_score DECIMAL(3, 2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Property history table
CREATE TABLE IF NOT EXISTS public.property_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    property_id UUID REFERENCES public.properties(id) ON DELETE CASCADE,
    event_type TEXT CHECK (event_type IN ('sale', 'listing', 'price_change', 'status_change', 'tax_assessment')),
    event_date DATE NOT NULL,
    old_value TEXT,
    new_value TEXT,
    description TEXT,
    source TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Saved searches table
CREATE TABLE IF NOT EXISTS public.saved_searches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID,
    search_name TEXT NOT NULL,
    filters JSONB NOT NULL,
    is_active BOOLEAN DEFAULT true,
    last_run TIMESTAMP WITH TIME ZONE,
    result_count INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Saved properties table
CREATE TABLE IF NOT EXISTS public.saved_properties (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID,
    property_id UUID REFERENCES public.properties(id) ON DELETE CASCADE,
    notes TEXT,
    priority TEXT CHECK (priority IN ('high', 'medium', 'low')),
    status TEXT CHECK (status IN ('interested', 'contacted', 'offered', 'under_contract', 'closed', 'passed')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_properties_market_value ON public.properties(market_value);
CREATE INDEX IF NOT EXISTS idx_properties_investment_score ON public.properties(investment_score);
CREATE INDEX IF NOT EXISTS idx_properties_equity_percent ON public.properties(equity_percent);
CREATE INDEX IF NOT EXISTS idx_properties_data_source ON public.properties(data_source);
CREATE INDEX IF NOT EXISTS idx_properties_last_data_update ON public.properties(last_data_update);

CREATE INDEX IF NOT EXISTS idx_owner_contacts_property_id ON public.owner_contacts(property_id);
CREATE INDEX IF NOT EXISTS idx_owner_contacts_is_absentee ON public.owner_contacts(is_absentee);
CREATE INDEX IF NOT EXISTS idx_owner_contacts_contact_status ON public.owner_contacts(contact_status);

CREATE INDEX IF NOT EXISTS idx_property_photos_property_id ON public.property_photos(property_id);
CREATE INDEX IF NOT EXISTS idx_comparable_sales_property_id ON public.comparable_sales(property_id);
CREATE INDEX IF NOT EXISTS idx_property_history_property_id ON public.property_history(property_id);

CREATE INDEX IF NOT EXISTS idx_saved_searches_user_id ON public.saved_searches(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_properties_user_id ON public.saved_properties(user_id);

-- Add sample data for testing
INSERT INTO public.properties (
    address, city, state, zip, latitude, longitude, owner_name, owner_type,
    property_type, bedrooms, bathrooms, square_feet, lot_size, year_built,
    assessed_value, estimated_value, equity_percent, mortgage_status, lien_status,
    tags, status, market_value, property_condition, investment_score, arv_estimate
) VALUES 
    ('123 Main St', 'New York', 'NY', '10001', 40.7128, -74.0060, 'John Doe', 'individual', 'residential', 3, 2, 1500, 5000, 1985, 350000, 400000, 75, 'active', 'none', ARRAY['distressed', 'vacant'], 'active', 425000, 'fair', 7.5, 450000),
    ('456 Oak Ave', 'Los Angeles', 'CA', '90210', 34.0522, -118.2437, 'Jane Smith', 'absentee', 'residential', 4, 3, 2200, 8000, 1990, 550000, 650000, 60, 'active', 'none', ARRAY['high_equity'], 'active', 675000, 'good', 8.2, 725000),
    ('789 Elm St', 'Houston', 'TX', '77001', 29.7604, -95.3698, 'ABC Properties LLC', 'llc', 'residential', 2, 1.5, 1200, 4000, 1975, 250000, 300000, 80, 'paid_off', 'none', ARRAY['llc_owned'], 'active', 325000, 'excellent', 9.1, 375000),
    ('321 Beach Blvd', 'Miami', 'FL', '33139', 25.7617, -80.1918, 'Maria Rodriguez', 'absentee', 'residential', 3, 2.5, 1800, 6000, 1988, 450000, 550000, 70, 'active', 'none', ARRAY['absentee'], 'active', 575000, 'good', 7.8, 625000),
    ('654 Palm Dr', 'Phoenix', 'AZ', '85001', 33.4484, -112.0740, 'Trust Properties Inc', 'corporation', 'residential', 5, 3.5, 2800, 10000, 2000, 600000, 750000, 65, 'active', 'none', ARRAY['high_value'], 'active', 775000, 'excellent', 8.5, 825000)
ON CONFLICT DO NOTHING; 