-- MLS Integration Schema for Phase 2C
-- Adds MLS-specific fields and tables for comprehensive listing data

-- Add MLS-specific fields to properties table
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS mls_id TEXT;
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS mls_source TEXT;
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS listing_status TEXT CHECK (listing_status IN ('active', 'pending', 'sold', 'withdrawn', 'expired', 'unknown'));
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS listing_date DATE;
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS original_listing_price DECIMAL(12, 2);
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS current_listing_price DECIMAL(12, 2);
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS price_reductions INTEGER DEFAULT 0;
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS total_price_reduction DECIMAL(12, 2);
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS listing_agent TEXT;
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS listing_office TEXT;
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS showing_instructions TEXT;
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS virtual_tour_url TEXT;
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS property_description TEXT;
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS features TEXT[];
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS appliances TEXT[];
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS parking_type TEXT;
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS garage_spaces INTEGER;
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS pool BOOLEAN DEFAULT false;
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS fireplace BOOLEAN DEFAULT false;
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS central_air BOOLEAN DEFAULT false;
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS heating_type TEXT;
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS cooling_type TEXT;
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS roof_type TEXT;
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS exterior_material TEXT;
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS foundation_type TEXT;
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS lot_features TEXT[];
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS hoa_fee DECIMAL(8, 2);
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS hoa_frequency TEXT CHECK (hoa_frequency IN ('monthly', 'quarterly', 'annually', 'unknown'));
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS tax_year INTEGER;
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS annual_taxes DECIMAL(10, 2);
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS insurance_cost DECIMAL(8, 2);
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS utilities_cost DECIMAL(8, 2);
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS monthly_payment_estimate DECIMAL(10, 2);
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS down_payment_estimate DECIMAL(10, 2);
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS closing_cost_estimate DECIMAL(10, 2);

-- MLS Listings table for tracking listing history
CREATE TABLE IF NOT EXISTS public.mls_listings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    property_id UUID REFERENCES public.properties(id) ON DELETE CASCADE,
    mls_id TEXT NOT NULL,
    mls_source TEXT NOT NULL,
    listing_status TEXT NOT NULL CHECK (listing_status IN ('active', 'pending', 'sold', 'withdrawn', 'expired', 'unknown')),
    listing_date DATE NOT NULL,
    listing_price DECIMAL(12, 2) NOT NULL,
    listing_agent TEXT,
    listing_office TEXT,
    showing_instructions TEXT,
    virtual_tour_url TEXT,
    property_description TEXT,
    features TEXT[],
    appliances TEXT[],
    parking_type TEXT,
    garage_spaces INTEGER,
    pool BOOLEAN DEFAULT false,
    fireplace BOOLEAN DEFAULT false,
    central_air BOOLEAN DEFAULT false,
    heating_type TEXT,
    cooling_type TEXT,
    roof_type TEXT,
    exterior_material TEXT,
    foundation_type TEXT,
    lot_features TEXT[],
    hoa_fee DECIMAL(8, 2),
    hoa_frequency TEXT CHECK (hoa_frequency IN ('monthly', 'quarterly', 'annually', 'unknown')),
    tax_year INTEGER,
    annual_taxes DECIMAL(10, 2),
    insurance_cost DECIMAL(8, 2),
    utilities_cost DECIMAL(8, 2),
    monthly_payment_estimate DECIMAL(10, 2),
    down_payment_estimate DECIMAL(10, 2),
    closing_cost_estimate DECIMAL(10, 2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- MLS Price History table for tracking price changes
CREATE TABLE IF NOT EXISTS public.mls_price_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    mls_listing_id UUID REFERENCES public.mls_listings(id) ON DELETE CASCADE,
    price_change_date DATE NOT NULL,
    old_price DECIMAL(12, 2),
    new_price DECIMAL(12, 2) NOT NULL,
    price_change_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- MLS Photos table for listing photos
CREATE TABLE IF NOT EXISTS public.mls_photos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    mls_listing_id UUID REFERENCES public.mls_listings(id) ON DELETE CASCADE,
    photo_url TEXT NOT NULL,
    photo_type TEXT CHECK (photo_type IN ('exterior', 'interior', 'aerial', 'street_view', 'floor_plan', 'virtual_tour')),
    caption TEXT,
    is_primary BOOLEAN DEFAULT false,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- MLS Open Houses table
CREATE TABLE IF NOT EXISTS public.mls_open_houses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    mls_listing_id UUID REFERENCES public.mls_listings(id) ON DELETE CASCADE,
    open_house_date DATE NOT NULL,
    start_time TIME,
    end_time TIME,
    description TEXT,
    refreshments BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- MLS Data Sources table for tracking different MLS providers
CREATE TABLE IF NOT EXISTS public.mls_data_sources (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source_name TEXT NOT NULL UNIQUE,
    source_type TEXT CHECK (source_type IN ('residential', 'commercial', 'land', 'rental')),
    coverage_areas TEXT[], -- states/counties covered
    api_endpoint TEXT,
    api_key_required BOOLEAN DEFAULT true,
    rate_limit_requests_per_minute INTEGER,
    rate_limit_requests_per_hour INTEGER,
    last_sync_date TIMESTAMP WITH TIME ZONE,
    sync_status TEXT CHECK (sync_status IN ('active', 'inactive', 'error', 'maintenance')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- MLS Sync Log table for tracking data synchronization
CREATE TABLE IF NOT EXISTS public.mls_sync_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    mls_source_id UUID REFERENCES public.mls_data_sources(id) ON DELETE CASCADE,
    sync_start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    sync_end_time TIMESTAMP WITH TIME ZONE,
    sync_status TEXT CHECK (sync_status IN ('running', 'completed', 'failed', 'partial')),
    properties_found INTEGER DEFAULT 0,
    properties_processed INTEGER DEFAULT 0,
    properties_added INTEGER DEFAULT 0,
    properties_updated INTEGER DEFAULT 0,
    properties_skipped INTEGER DEFAULT 0,
    errors TEXT[],
    warnings TEXT[],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for MLS-related fields
CREATE INDEX IF NOT EXISTS idx_properties_mls_id ON public.properties(mls_id);
CREATE INDEX IF NOT EXISTS idx_properties_mls_source ON public.properties(mls_source);
CREATE INDEX IF NOT EXISTS idx_properties_listing_status ON public.properties(listing_status);
CREATE INDEX IF NOT EXISTS idx_properties_listing_date ON public.properties(listing_date);
CREATE INDEX IF NOT EXISTS idx_properties_current_listing_price ON public.properties(current_listing_price);
CREATE INDEX IF NOT EXISTS idx_properties_days_on_market ON public.properties(days_on_market);

CREATE INDEX IF NOT EXISTS idx_mls_listings_property_id ON public.mls_listings(property_id);
CREATE INDEX IF NOT EXISTS idx_mls_listings_mls_id ON public.mls_listings(mls_id);
CREATE INDEX IF NOT EXISTS idx_mls_listings_mls_source ON public.mls_listings(mls_source);
CREATE INDEX IF NOT EXISTS idx_mls_listings_listing_status ON public.mls_listings(listing_status);
CREATE INDEX IF NOT EXISTS idx_mls_listings_listing_date ON public.mls_listings(listing_date);
CREATE INDEX IF NOT EXISTS idx_mls_listings_listing_price ON public.mls_listings(listing_price);

CREATE INDEX IF NOT EXISTS idx_mls_price_history_mls_listing_id ON public.mls_price_history(mls_listing_id);
CREATE INDEX IF NOT EXISTS idx_mls_price_history_price_change_date ON public.mls_price_history(price_change_date);

CREATE INDEX IF NOT EXISTS idx_mls_photos_mls_listing_id ON public.mls_photos(mls_listing_id);
CREATE INDEX IF NOT EXISTS idx_mls_photos_sort_order ON public.mls_photos(sort_order);

CREATE INDEX IF NOT EXISTS idx_mls_open_houses_mls_listing_id ON public.mls_open_houses(mls_listing_id);
CREATE INDEX IF NOT EXISTS idx_mls_open_houses_open_house_date ON public.mls_open_houses(open_house_date);

CREATE INDEX IF NOT EXISTS idx_mls_sync_log_mls_source_id ON public.mls_sync_log(mls_source_id);
CREATE INDEX IF NOT EXISTS idx_mls_sync_log_sync_start_time ON public.mls_sync_log(sync_start_time);
CREATE INDEX IF NOT EXISTS idx_mls_sync_log_sync_status ON public.mls_sync_log(sync_status);

-- Insert default MLS data sources
INSERT INTO public.mls_data_sources (source_name, source_type, coverage_areas, api_endpoint, api_key_required, rate_limit_requests_per_minute, rate_limit_requests_per_hour, sync_status) VALUES
('Retsly', 'residential', ARRAY['AZ', 'TX', 'FL', 'GA', 'NV'], 'https://rets.ly/api/v1', true, 60, 1000, 'active'),
('RealtyMole', 'residential', ARRAY['AZ', 'TX', 'FL', 'GA', 'NV'], 'https://realty-mole-property-api.p.rapidapi.com', true, 50, 800, 'active'),
('RentSpree', 'residential', ARRAY['AZ', 'TX', 'FL'], 'https://api.rentspree.com/v1', true, 40, 600, 'active'),
('RentData', 'residential', ARRAY['AZ', 'TX', 'FL', 'GA'], 'https://api.rentdata.org', true, 30, 500, 'active'),
('MLS Grid', 'residential', ARRAY['AZ', 'TX', 'FL', 'GA', 'NV'], 'https://api.mlsgrid.com/v2', true, 100, 2000, 'active');

-- Create function to update property listing status based on MLS data
CREATE OR REPLACE FUNCTION update_property_listing_status()
RETURNS TRIGGER AS $$
BEGIN
    -- Update the main properties table with current listing information
    UPDATE public.properties 
    SET 
        listing_status = NEW.listing_status,
        current_listing_price = NEW.listing_price,
        listing_date = NEW.listing_date,
        listing_agent = NEW.listing_agent,
        listing_office = NEW.listing_office,
        showing_instructions = NEW.showing_instructions,
        virtual_tour_url = NEW.virtual_tour_url,
        property_description = NEW.property_description,
        features = NEW.features,
        appliances = NEW.appliances,
        parking_type = NEW.parking_type,
        garage_spaces = NEW.garage_spaces,
        pool = NEW.pool,
        fireplace = NEW.fireplace,
        central_air = NEW.central_air,
        heating_type = NEW.heating_type,
        cooling_type = NEW.cooling_type,
        roof_type = NEW.roof_type,
        exterior_material = NEW.exterior_material,
        foundation_type = NEW.foundation_type,
        lot_features = NEW.lot_features,
        hoa_fee = NEW.hoa_fee,
        hoa_frequency = NEW.hoa_frequency,
        tax_year = NEW.tax_year,
        annual_taxes = NEW.annual_taxes,
        insurance_cost = NEW.insurance_cost,
        utilities_cost = NEW.utilities_cost,
        monthly_payment_estimate = NEW.monthly_payment_estimate,
        down_payment_estimate = NEW.down_payment_estimate,
        closing_cost_estimate = NEW.closing_cost_estimate,
        updated_at = NOW()
    WHERE id = NEW.property_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for MLS listings
CREATE TRIGGER trigger_update_property_listing_status
    AFTER INSERT OR UPDATE ON public.mls_listings
    FOR EACH ROW
    EXECUTE FUNCTION update_property_listing_status();

-- Create function to calculate days on market
CREATE OR REPLACE FUNCTION calculate_days_on_market()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.listing_date IS NOT NULL THEN
        NEW.days_on_market = CASE 
            WHEN NEW.listing_status = 'sold' THEN 
                (SELECT COALESCE(sale_date, CURRENT_DATE) FROM public.property_history 
                 WHERE property_id = NEW.property_id AND event_type = 'sale' 
                 ORDER BY event_date DESC LIMIT 1) - NEW.listing_date
            ELSE 
                CURRENT_DATE - NEW.listing_date
        END;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for calculating days on market
CREATE TRIGGER trigger_calculate_days_on_market
    BEFORE INSERT OR UPDATE ON public.mls_listings
    FOR EACH ROW
    EXECUTE FUNCTION calculate_days_on_market(); 