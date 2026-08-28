-- Comprehensive Test Data Migration
-- This migration populates the database with realistic property data from multiple sources
-- Migration: 20250115000006_comprehensive_test_data.sql

-- Clear existing test data
DELETE FROM public.properties WHERE id IN (
  SELECT id FROM public.properties LIMIT 100
);

-- Insert comprehensive test data from multiple sources
INSERT INTO public.properties (
    address, city, state, zip, latitude, longitude, owner_name, owner_type,
    property_type, bedrooms, bathrooms, square_feet, lot_size, year_built,
    assessed_value, estimated_value, equity_percent, mortgage_status, lien_status,
    tags, status, data_source, data_confidence, market_value, property_condition,
    investment_score, arv_estimate, rehab_cost_estimate, cash_on_cash_return,
    cap_rate, rental_estimate, price_per_sqft, days_on_market
) VALUES 
-- ATTOM Data Source - High Quality Properties
('1234 Oak Street', 'Phoenix', 'AZ', '85001', 33.4484, -112.0740, 'John Smith', 'individual', 'residential', 3, 2, 1800, 6000, 1985, 280000, 320000, 75, 'active', 'none', ARRAY['distressed', 'vacant'], 'active', 'attom', 0.85, 320000, 'good', 7.5, 380000, 45000, 12.5, 8.2, 2200, 178, 45),
('5678 Maple Avenue', 'Dallas', 'TX', '75201', 32.7767, -96.7970, 'Sarah Johnson', 'absentee', 'residential', 4, 2.5, 2200, 7500, 1990, 350000, 420000, 65, 'active', 'none', ARRAY['high_equity', 'absentee'], 'active', 'attom', 0.90, 420000, 'excellent', 8.2, 480000, 35000, 14.2, 9.1, 2800, 191, 30),
('9012 Pine Road', 'Miami', 'FL', '33101', 25.7617, -80.1918, 'ABC Properties LLC', 'llc', 'residential', 2, 1.5, 1200, 4000, 1975, 220000, 280000, 80, 'paid_off', 'none', ARRAY['llc_owned', 'distressed'], 'active', 'attom', 0.75, 280000, 'fair', 6.8, 320000, 55000, 10.8, 7.5, 1800, 233, 120),

-- CoreLogic Data Source - Investment Properties
('3456 Elm Court', 'Houston', 'TX', '77001', 29.7604, -95.3698, 'Maria Rodriguez', 'individual', 'residential', 3, 2, 1600, 5500, 1988, 260000, 310000, 70, 'active', 'none', ARRAY['investment', 'rental'], 'active', 'corelogic', 0.88, 310000, 'good', 7.8, 360000, 40000, 13.2, 8.8, 2400, 194, 25),
('7890 Cedar Lane', 'Atlanta', 'GA', '30301', 33.7490, -84.3880, 'Trust Properties Inc', 'corporation', 'residential', 5, 3.5, 2800, 10000, 2000, 450000, 550000, 60, 'active', 'none', ARRAY['high_value', 'corporation'], 'active', 'corelogic', 0.92, 550000, 'excellent', 8.5, 620000, 25000, 15.8, 9.8, 3500, 196, 15),
('2345 Birch Drive', 'Chicago', 'IL', '60601', 41.8781, -87.6298, 'David Wilson', 'absentee', 'residential', 2, 1, 1000, 3500, 1970, 180000, 220000, 85, 'paid_off', 'none', ARRAY['distressed', 'absentee'], 'active', 'corelogic', 0.70, 220000, 'poor', 6.2, 260000, 65000, 9.5, 7.2, 1600, 220, 180),

-- MLS Data Source - Active Listings
('6789 Spruce Way', 'Los Angeles', 'CA', '90210', 34.0522, -118.2437, 'Jennifer Brown', 'individual', 'residential', 4, 3, 2400, 8000, 1995, 480000, 580000, 55, 'active', 'none', ARRAY['mls_listing', 'active'], 'active', 'mlsgrid', 0.95, 580000, 'excellent', 8.8, 650000, 20000, 16.5, 10.2, 3800, 242, 5),
('0123 Willow Circle', 'New York', 'NY', '10001', 40.7128, -74.0060, 'Michael Davis', 'individual', 'residential', 3, 2, 1800, 6000, 1985, 520000, 650000, 50, 'active', 'none', ARRAY['mls_listing', 'high_value'], 'active', 'mlsgrid', 0.93, 650000, 'good', 8.0, 720000, 35000, 14.8, 9.5, 4200, 361, 12),
('4567 Ash Street', 'Philadelphia', 'PA', '19102', 39.9526, -75.1652, 'Lisa Anderson', 'absentee', 'residential', 2, 1.5, 1400, 4500, 1980, 200000, 250000, 75, 'active', 'none', ARRAY['distressed', 'absentee'], 'active', 'mlsgrid', 0.78, 250000, 'fair', 6.5, 290000, 50000, 11.2, 7.8, 2000, 179, 90),

-- County Assessor Data Source - Tax Delinquent Properties
('8901 Poplar Avenue', 'Detroit', 'MI', '48201', 42.3314, -83.0458, 'Robert Taylor', 'individual', 'residential', 3, 2, 1600, 5000, 1975, 120000, 180000, 90, 'paid_off', 'tax_delinquent', ARRAY['tax_delinquent', 'distressed'], 'active', 'county_assessor', 0.85, 180000, 'poor', 7.2, 220000, 70000, 12.8, 8.5, 2200, 113, 365),
('2345 Sycamore Road', 'Cleveland', 'OH', '44101', 41.4993, -81.6944, 'Amanda White', 'absentee', 'residential', 2, 1, 1100, 3800, 1965, 80000, 120000, 95, 'paid_off', 'tax_delinquent', ARRAY['tax_delinquent', 'absentee'], 'active', 'county_assessor', 0.80, 120000, 'poor', 6.8, 150000, 80000, 10.5, 7.2, 1800, 109, 420),
('6789 Magnolia Drive', 'Baltimore', 'MD', '21201', 39.2904, -76.6122, 'Christopher Lee', 'individual', 'residential', 4, 2.5, 2000, 6500, 1988, 180000, 240000, 80, 'active', 'tax_delinquent', ARRAY['tax_delinquent', 'distressed'], 'active', 'county_assessor', 0.82, 240000, 'fair', 6.9, 280000, 60000, 11.8, 8.1, 2800, 120, 200),

-- RentSpree Data Source - Rental Properties
('0123 Cypress Lane', 'Austin', 'TX', '73301', 30.2672, -97.7431, 'Jessica Garcia', 'individual', 'residential', 3, 2, 1700, 5500, 1990, 280000, 340000, 70, 'active', 'none', ARRAY['rental', 'investment'], 'active', 'rentspree', 0.88, 340000, 'good', 7.6, 390000, 40000, 13.5, 8.9, 2400, 200, 60),
('4567 Hickory Court', 'Denver', 'CO', '80201', 39.7392, -104.9903, 'Daniel Martinez', 'absentee', 'residential', 2, 1.5, 1300, 4200, 1985, 220000, 280000, 75, 'active', 'none', ARRAY['rental', 'absentee'], 'active', 'rentspree', 0.85, 280000, 'fair', 6.9, 320000, 50000, 11.2, 7.8, 2000, 215, 85),
('8901 Walnut Street', 'Seattle', 'WA', '98101', 47.6062, -122.3321, 'Ashley Thompson', 'individual', 'residential', 4, 3, 2200, 7000, 1995, 380000, 460000, 60, 'active', 'none', ARRAY['rental', 'high_value'], 'active', 'rentspree', 0.90, 460000, 'excellent', 8.1, 520000, 30000, 14.8, 9.2, 3200, 209, 35),

-- RealtyMole Data Source - Market Properties
('2345 Chestnut Avenue', 'San Francisco', 'CA', '94101', 37.7749, -122.4194, 'Kevin Johnson', 'individual', 'residential', 3, 2, 1800, 6000, 1988, 650000, 780000, 45, 'active', 'none', ARRAY['high_value', 'investment'], 'active', 'realtymole', 0.92, 780000, 'excellent', 8.3, 850000, 25000, 16.2, 10.1, 4800, 433, 8),
('6789 Beech Road', 'Boston', 'MA', '02101', 42.3601, -71.0589, 'Nicole Davis', 'absentee', 'residential', 2, 1, 1100, 3800, 1975, 280000, 350000, 70, 'active', 'none', ARRAY['distressed', 'absentee'], 'active', 'realtymole', 0.78, 350000, 'fair', 6.7, 400000, 60000, 11.5, 7.9, 2400, 318, 150),
('0123 Maple Circle', 'Portland', 'OR', '97201', 45.5152, -122.6784, 'Ryan Wilson', 'individual', 'residential', 4, 2.5, 2000, 6500, 1990, 320000, 390000, 65, 'active', 'none', ARRAY['investment', 'rental'], 'active', 'realtymole', 0.87, 390000, 'good', 7.4, 440000, 45000, 13.1, 8.6, 2800, 195, 45),

-- Additional Properties for Better Coverage
('4567 Oak Ridge', 'Nashville', 'TN', '37201', 36.1627, -86.7816, 'Sarah Miller', 'individual', 'residential', 3, 2, 1600, 5200, 1985, 200000, 250000, 75, 'active', 'none', ARRAY['investment', 'distressed'], 'active', 'attom', 0.83, 250000, 'good', 7.1, 290000, 50000, 12.1, 8.0, 2200, 156, 75),
('8901 Pine Valley', 'Charlotte', 'NC', '28201', 35.2271, -80.8431, 'Michael Brown', 'absentee', 'residential', 2, 1.5, 1400, 4800, 1980, 160000, 200000, 80, 'active', 'none', ARRAY['distressed', 'absentee'], 'active', 'corelogic', 0.79, 200000, 'fair', 6.5, 240000, 55000, 10.8, 7.5, 1800, 143, 120),
('2345 Cedar Heights', 'Orlando', 'FL', '32801', 28.5383, -81.3792, 'Emily Taylor', 'individual', 'residential', 4, 3, 2200, 7200, 1992, 280000, 340000, 65, 'active', 'none', ARRAY['investment', 'rental'], 'active', 'mlsgrid', 0.89, 340000, 'good', 7.7, 390000, 40000, 13.8, 8.9, 2600, 155, 40),
('6789 Elm Springs', 'Las Vegas', 'NV', '89101', 36.1699, -115.1398, 'David Anderson', 'individual', 'residential', 3, 2, 1800, 6000, 1988, 220000, 280000, 70, 'active', 'none', ARRAY['distressed', 'investment'], 'active', 'county_assessor', 0.81, 280000, 'fair', 6.8, 320000, 55000, 11.5, 7.8, 2200, 156, 95),
('0123 Willow Creek', 'San Antonio', 'TX', '78201', 29.4241, -98.4936, 'Lisa Garcia', 'absentee', 'residential', 2, 1, 1200, 4200, 1978, 140000, 180000, 85, 'active', 'none', ARRAY['distressed', 'absentee'], 'active', 'rentspree', 0.76, 180000, 'poor', 6.2, 220000, 65000, 10.2, 7.1, 1600, 150, 180),
('4567 Birch Ridge', 'Columbus', 'OH', '43201', 39.9612, -82.9988, 'James Wilson', 'individual', 'residential', 4, 2.5, 2000, 6800, 1990, 180000, 230000, 70, 'active', 'none', ARRAY['investment', 'distressed'], 'active', 'realtymole', 0.84, 230000, 'good', 6.9, 270000, 50000, 11.8, 7.9, 2000, 115, 85),
('8901 Spruce Valley', 'Fort Worth', 'TX', '76101', 32.7555, -97.3308, 'Amanda Davis', 'individual', 'residential', 3, 2, 1600, 5400, 1985, 200000, 250000, 75, 'active', 'none', ARRAY['distressed', 'investment'], 'active', 'attom', 0.82, 250000, 'fair', 6.7, 290000, 55000, 11.2, 7.6, 2200, 156, 110),
('2345 Maple Springs', 'Indianapolis', 'IN', '46201', 39.7684, -86.1581, 'Robert Johnson', 'absentee', 'residential', 2, 1.5, 1400, 4600, 1980, 120000, 160000, 80, 'active', 'none', ARRAY['distressed', 'absentee'], 'active', 'corelogic', 0.77, 160000, 'poor', 6.1, 200000, 70000, 9.8, 6.9, 1800, 114, 200),
('6789 Cedar Ridge', 'Jacksonville', 'FL', '32201', 30.3322, -81.6557, 'Christopher Lee', 'individual', 'residential', 4, 3, 2200, 7500, 1992, 240000, 300000, 65, 'active', 'none', ARRAY['investment', 'rental'], 'active', 'mlsgrid', 0.86, 300000, 'good', 7.3, 350000, 45000, 12.8, 8.4, 2400, 136, 65),
('0123 Oak Valley', 'San Diego', 'CA', '92101', 32.7157, -117.1611, 'Jennifer Brown', 'individual', 'residential', 3, 2, 1800, 6200, 1988, 380000, 460000, 55, 'active', 'none', ARRAY['high_value', 'investment'], 'active', 'county_assessor', 0.91, 460000, 'excellent', 8.0, 520000, 30000, 15.2, 9.6, 3200, 256, 25)
ON CONFLICT DO NOTHING;

-- Update the location geometry for all properties
UPDATE public.properties 
SET location = ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)
WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

-- Create indexes for better search performance
CREATE INDEX IF NOT EXISTS idx_properties_data_source ON public.properties(data_source);
CREATE INDEX IF NOT EXISTS idx_properties_investment_score ON public.properties(investment_score);
CREATE INDEX IF NOT EXISTS idx_properties_market_value ON public.properties(market_value);
CREATE INDEX IF NOT EXISTS idx_properties_arv_estimate ON public.properties(arv_estimate);
CREATE INDEX IF NOT EXISTS idx_properties_days_on_market ON public.properties(days_on_market);

-- Insert sample MLS listings (commented out due to trigger issues)
-- INSERT INTO public.mls_listings (
--     mls_id, property_id, listing_status, listing_price, listing_agent,
--     property_description, features, listing_date, mls_source
-- ) VALUES 
-- ('MLS001', (SELECT id FROM public.properties WHERE address = '6789 Spruce Way' LIMIT 1), 'active', 580000, 'John Smith', 'Beautiful 4 bed 3 bath home in prime location', ARRAY['pool', 'garage', 'updated kitchen'], '2024-01-05', 'mlsgrid'),
-- ('MLS002', (SELECT id FROM public.properties WHERE address = '0123 Willow Circle' LIMIT 1), 'active', 650000, 'Sarah Johnson', 'Charming 3 bed 2 bath with great potential', ARRAY['fireplace', 'hardwood floors', 'fenced yard'], '2024-01-01', 'mlsgrid'),
-- ('MLS003', (SELECT id FROM public.properties WHERE address = '4567 Ash Street' LIMIT 1), 'active', 250000, 'Mike Davis', 'Investment opportunity - needs some work', ARRAY['basement', 'large lot', 'good bones'], '2023-10-15', 'mlsgrid');

-- Insert sample comparable sales
INSERT INTO public.comparable_sales (
    property_id, comp_address, sale_price, sale_date, distance_miles,
    bedrooms, bathrooms, square_feet
) VALUES 
((SELECT id FROM public.properties WHERE address = '1234 Oak Street' LIMIT 1), '1200 Oak Street', 310000, '2023-12-15', 0.2, 3, 2, 1750),
((SELECT id FROM public.properties WHERE address = '5678 Maple Avenue' LIMIT 1), '5600 Maple Avenue', 410000, '2023-11-20', 0.3, 4, 2.5, 2100),
((SELECT id FROM public.properties WHERE address = '9012 Pine Road' LIMIT 1), '9000 Pine Road', 270000, '2023-12-01', 0.1, 2, 1.5, 1150);

-- Insert sample owner contacts
INSERT INTO public.owner_contacts (
    property_id, owner_name, phone, email, mailing_address, contact_status
) VALUES 
((SELECT id FROM public.properties WHERE address = '1234 Oak Street' LIMIT 1), 'John Smith', '555-123-4567', 'john.smith@email.com', '1234 Oak Street, Phoenix, AZ 85001', 'new'),
((SELECT id FROM public.properties WHERE address = '5678 Maple Avenue' LIMIT 1), 'Sarah Johnson', '555-234-5678', 'sarah.johnson@email.com', '5678 Maple Avenue, Dallas, TX 75201', 'new'),
((SELECT id FROM public.properties WHERE address = '9012 Pine Road' LIMIT 1), 'ABC Properties LLC', '555-345-6789', 'contact@abcproperties.com', '9012 Pine Road, Miami, FL 33101', 'new');

-- Update cache statistics
INSERT INTO public.cache_statistics (
    cache_type, total_requests, cache_hits, cache_misses, hit_rate, 
    average_response_time_ms, total_cache_size_bytes, total_items
) VALUES 
('property_search', 150, 120, 30, 80.00, 45.5, 52428800, 500),
('property_details', 300, 270, 30, 90.00, 25.2, 104857600, 1000),
('mls_data', 75, 60, 15, 80.00, 65.8, 26214400, 250)
ON CONFLICT (cache_type) DO UPDATE SET
    total_requests = EXCLUDED.total_requests,
    cache_hits = EXCLUDED.cache_hits,
    cache_misses = EXCLUDED.cache_misses,
    hit_rate = EXCLUDED.hit_rate,
    average_response_time_ms = EXCLUDED.average_response_time_ms,
    total_cache_size_bytes = EXCLUDED.total_cache_size_bytes,
    total_items = EXCLUDED.total_items;

COMMIT; 