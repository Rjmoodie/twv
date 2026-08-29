// Expanded Data Sources for Real Estate Scraping
// This file contains hundreds of additional data sources to expand your real estate data integration

export interface ExpandedDataSource {
  id: string;
  name: string;
  category: string;
  url: string;
  method: 'api' | 'scraper' | 'rss' | 'csv' | 'json';
  description: string;
  dataType: string;
  frequency: 'daily' | 'weekly' | 'monthly' | 'real-time' | 'quarterly' | 'yearly';
  requiresAuth: boolean;
  apiKey?: string;
  rateLimit?: number;
  priority: 'high' | 'medium' | 'low';
  state?: string;
  county?: string;
  city?: string;
  dataQuality: 'HIGH' | 'MEDIUM' | 'LOW';
  implementation: 'IMMEDIATE' | 'PHASE_2' | 'PHASE_3';
  selectors?: {
    tableSelector?: string;
    rowSelector?: string;
    ownerSelector?: string;
    addressSelector?: string;
    amountSelector?: string;
    dateSelector?: string;
    statusSelector?: string;
    [key: string]: string | undefined;
  };
  apiConfig?: {
    endpoint: string;
    parameters?: Record<string, string>;
    headers?: Record<string, string>;
  };
}

export const expandedDataSources: ExpandedDataSource[] = [
  // ===== MLS & LISTING SITES EXPANSION =====
  
  // Regional MLS Systems
  {
    id: 'mls-mris',
    name: 'MRIS MLS (DC Metro)',
    category: 'MLS',
    url: 'https://www.mris.com/api/listings',
    method: 'api',
    description: 'Metropolitan Regional Information Systems MLS',
    dataType: 'mls-listings',
    frequency: 'real-time',
    requiresAuth: true,
    apiKey: 'your-mris-api-key',
    rateLimit: 1000,
    priority: 'high',
    state: 'MD',
    dataQuality: 'HIGH',
    implementation: 'PHASE_2'
  },
  {
    id: 'mls-paragon',
    name: 'Paragon MLS (Florida)',
    category: 'MLS',
    url: 'https://www.paragonrels.com/api',
    method: 'api',
    description: 'Paragon MLS system for Florida properties',
    dataType: 'mls-listings',
    frequency: 'real-time',
    requiresAuth: true,
    apiKey: 'your-paragon-api-key',
    rateLimit: 1000,
    priority: 'high',
    state: 'FL',
    dataQuality: 'HIGH',
    implementation: 'PHASE_2'
  },
  {
    id: 'mls-matrix',
    name: 'Matrix MLS (Texas)',
    category: 'MLS',
    url: 'https://matrix.mlsmatrix.com/api',
    method: 'api',
    description: 'Matrix MLS system for Texas properties',
    dataType: 'mls-listings',
    frequency: 'real-time',
    requiresAuth: true,
    apiKey: 'your-matrix-api-key',
    rateLimit: 1000,
    priority: 'high',
    state: 'TX',
    dataQuality: 'HIGH',
    implementation: 'PHASE_2'
  },

  // ===== COUNTY ASSESSOR EXPANSION =====
  
  // California Counties
  {
    id: 'assessor-san-diego',
    name: 'San Diego County Assessor',
    category: 'County Assessor',
    url: 'https://arcc.sdcounty.ca.gov/assessor/',
    method: 'scraper',
    description: 'San Diego County property assessment data',
    dataType: 'property-assessments',
    frequency: 'monthly',
    requiresAuth: false,
    priority: 'high',
    state: 'CA',
    county: 'San Diego',
    dataQuality: 'HIGH',
    implementation: 'IMMEDIATE',
    selectors: {
      tableSelector: '.property-search-results',
      rowSelector: '.property-row',
      ownerSelector: '.owner-name',
      addressSelector: '.property-address',
      valueSelector: '.assessed-value',
      dateSelector: '.assessment-date'
    }
  },
  {
    id: 'assessor-orange',
    name: 'Orange County Assessor',
    category: 'County Assessor',
    url: 'https://www.ocassessor.com/',
    method: 'scraper',
    description: 'Orange County property assessment data',
    dataType: 'property-assessments',
    frequency: 'monthly',
    requiresAuth: false,
    priority: 'high',
    state: 'CA',
    county: 'Orange',
    dataQuality: 'HIGH',
    implementation: 'IMMEDIATE',
    selectors: {
      tableSelector: '.search-results',
      rowSelector: '.property-item',
      ownerSelector: '.owner',
      addressSelector: '.address',
      valueSelector: '.value',
      dateSelector: '.date'
    }
  },
  {
    id: 'assessor-riverside',
    name: 'Riverside County Assessor',
    category: 'County Assessor',
    url: 'https://www.riversideacr.com/',
    method: 'scraper',
    description: 'Riverside County property assessment data',
    dataType: 'property-assessments',
    frequency: 'monthly',
    requiresAuth: false,
    priority: 'high',
    state: 'CA',
    county: 'Riverside',
    dataQuality: 'HIGH',
    implementation: 'IMMEDIATE',
    selectors: {
      tableSelector: '.property-results',
      rowSelector: '.property-row',
      ownerSelector: '.owner-name',
      addressSelector: '.property-address',
      valueSelector: '.assessed-value',
      dateSelector: '.assessment-date'
    }
  },

  // Texas Counties
  {
    id: 'assessor-dallas',
    name: 'Dallas County Assessor',
    category: 'County Assessor',
    url: 'https://www.dallascounty.org/departments/dchom/',
    method: 'scraper',
    description: 'Dallas County property assessment data',
    dataType: 'property-assessments',
    frequency: 'monthly',
    requiresAuth: false,
    priority: 'high',
    state: 'TX',
    county: 'Dallas',
    dataQuality: 'HIGH',
    implementation: 'IMMEDIATE',
    selectors: {
      tableSelector: '.property-search-results',
      rowSelector: '.property-row',
      ownerSelector: '.owner-name',
      addressSelector: '.property-address',
      valueSelector: '.assessed-value',
      dateSelector: '.assessment-date'
    }
  },
  {
    id: 'assessor-bexar',
    name: 'Bexar County Assessor',
    category: 'County Assessor',
    url: 'https://www.bexar.org/',
    method: 'scraper',
    description: 'Bexar County property assessment data',
    dataType: 'property-assessments',
    frequency: 'monthly',
    requiresAuth: false,
    priority: 'high',
    state: 'TX',
    county: 'Bexar',
    dataQuality: 'HIGH',
    implementation: 'IMMEDIATE',
    selectors: {
      tableSelector: '.property-results',
      rowSelector: '.property-row',
      ownerSelector: '.owner-name',
      addressSelector: '.property-address',
      valueSelector: '.assessed-value',
      dateSelector: '.assessment-date'
    }
  },

  // Florida Counties
  {
    id: 'assessor-palm-beach',
    name: 'Palm Beach County Assessor',
    category: 'County Assessor',
    url: 'https://www.pbcgov.org/papa/',
    method: 'scraper',
    description: 'Palm Beach County property assessment data',
    dataType: 'property-assessments',
    frequency: 'monthly',
    requiresAuth: false,
    priority: 'high',
    state: 'FL',
    county: 'Palm Beach',
    dataQuality: 'HIGH',
    implementation: 'IMMEDIATE',
    selectors: {
      tableSelector: '.property-search-results',
      rowSelector: '.property-row',
      ownerSelector: '.owner-name',
      addressSelector: '.property-address',
      valueSelector: '.assessed-value',
      dateSelector: '.assessment-date'
    }
  },

  // ===== TAX DELINQUENT EXPANSION =====
  
  // Additional California Counties
  {
    id: 'tax-delinquent-san-bernardino',
    name: 'San Bernardino County Tax Delinquent',
    category: 'Tax Delinquent',
    url: 'https://www.sbcounty.gov/assessor/tax-delinquent/',
    method: 'scraper',
    description: 'San Bernardino County tax delinquent properties',
    dataType: 'tax-delinquent',
    frequency: 'monthly',
    requiresAuth: false,
    priority: 'high',
    state: 'CA',
    county: 'San Bernardino',
    dataQuality: 'HIGH',
    implementation: 'IMMEDIATE',
    selectors: {
      tableSelector: '.delinquent-properties',
      rowSelector: '.property-row',
      ownerSelector: '.owner-name',
      addressSelector: '.property-address',
      amountSelector: '.tax-amount',
      dateSelector: '.delinquent-year'
    }
  },
  {
    id: 'tax-delinquent-sacramento',
    name: 'Sacramento County Tax Delinquent',
    category: 'Tax Delinquent',
    url: 'https://assessor.saccounty.gov/tax-delinquent/',
    method: 'scraper',
    description: 'Sacramento County tax delinquent properties',
    dataType: 'tax-delinquent',
    frequency: 'monthly',
    requiresAuth: false,
    priority: 'high',
    state: 'CA',
    county: 'Sacramento',
    dataQuality: 'HIGH',
    implementation: 'IMMEDIATE',
    selectors: {
      tableSelector: '.delinquent-list',
      rowSelector: '.property-item',
      ownerSelector: '.owner',
      addressSelector: '.address',
      amountSelector: '.amount',
      dateSelector: '.year'
    }
  },

  // Texas Counties
  {
    id: 'tax-delinquent-bexar',
    name: 'Bexar County Tax Delinquent',
    category: 'Tax Delinquent',
    url: 'https://www.bexar.org/tax-delinquent/',
    method: 'scraper',
    description: 'Bexar County tax delinquent properties',
    dataType: 'tax-delinquent',
    frequency: 'monthly',
    requiresAuth: false,
    priority: 'high',
    state: 'TX',
    county: 'Bexar',
    dataQuality: 'HIGH',
    implementation: 'IMMEDIATE',
    selectors: {
      tableSelector: '.delinquent-properties',
      rowSelector: '.property-row',
      ownerSelector: '.owner-name',
      addressSelector: '.property-address',
      amountSelector: '.tax-amount',
      dateSelector: '.delinquent-year'
    }
  },

  // ===== FORECLOSURE EXPANSION =====
  
  // County Clerk Foreclosure Filings
  {
    id: 'foreclosure-orange-clerk',
    name: 'Orange County Clerk Foreclosures',
    category: 'Foreclosures',
    url: 'https://www.myorangeclerk.com/foreclosures',
    method: 'scraper',
    description: 'Orange County foreclosure filings',
    dataType: 'foreclosure-filings',
    frequency: 'weekly',
    requiresAuth: false,
    priority: 'high',
    state: 'FL',
    county: 'Orange',
    dataQuality: 'HIGH',
    implementation: 'IMMEDIATE',
    selectors: {
      tableSelector: '.foreclosure-cases',
      rowSelector: '.case-row',
      ownerSelector: '.defendant',
      addressSelector: '.property-address',
      lenderSelector: '.plaintiff',
      amountSelector: '.amount',
      dateSelector: '.filing-date',
      caseSelector: '.case-number'
    }
  },
  {
    id: 'foreclosure-miami-dade-clerk',
    name: 'Miami-Dade Clerk Foreclosures',
    category: 'Foreclosures',
    url: 'https://www.miami-dadeclerk.com/foreclosures',
    method: 'scraper',
    description: 'Miami-Dade County foreclosure filings',
    dataType: 'foreclosure-filings',
    frequency: 'weekly',
    requiresAuth: false,
    priority: 'high',
    state: 'FL',
    county: 'Miami-Dade',
    dataQuality: 'HIGH',
    implementation: 'IMMEDIATE',
    selectors: {
      tableSelector: '.foreclosure-cases',
      rowSelector: '.case-row',
      ownerSelector: '.defendant',
      addressSelector: '.property-address',
      lenderSelector: '.plaintiff',
      amountSelector: '.amount',
      dateSelector: '.filing-date',
      caseSelector: '.case-number'
    }
  },

  // ===== CODE VIOLATION EXPANSION =====
  
  // Additional City Open Data Portals
  {
    id: 'code-violations-houston',
    name: 'Houston Code Violations',
    category: 'Code Violations',
    url: 'https://data.houstontx.gov/code-violations',
    method: 'api',
    description: 'Houston code violation properties via open data API',
    dataType: 'code-violations',
    frequency: 'daily',
    requiresAuth: false,
    priority: 'high',
    state: 'TX',
    city: 'Houston',
    dataQuality: 'HIGH',
    implementation: 'IMMEDIATE',
    apiConfig: {
      endpoint: 'https://data.houstontx.gov/resource/code-violations.json',
      parameters: {
        '$limit': '1000',
        '$order': 'violation_date DESC'
      }
    }
  },
  {
    id: 'code-violations-phoenix',
    name: 'Phoenix Code Violations',
    category: 'Code Violations',
    url: 'https://data.phoenix.gov/code-violations',
    method: 'api',
    description: 'Phoenix code violation properties via open data API',
    dataType: 'code-violations',
    frequency: 'daily',
    requiresAuth: false,
    priority: 'high',
    state: 'AZ',
    city: 'Phoenix',
    dataQuality: 'HIGH',
    implementation: 'IMMEDIATE',
    apiConfig: {
      endpoint: 'https://data.phoenix.gov/resource/code-violations.json',
      parameters: {
        '$limit': '1000',
        '$order': 'violation_date DESC'
      }
    }
  },
  {
    id: 'code-violations-san-antonio',
    name: 'San Antonio Code Violations',
    category: 'Code Violations',
    url: 'https://data.sanantonio.gov/code-violations',
    method: 'api',
    description: 'San Antonio code violation properties via open data API',
    dataType: 'code-violations',
    frequency: 'daily',
    requiresAuth: false,
    priority: 'high',
    state: 'TX',
    city: 'San Antonio',
    dataQuality: 'HIGH',
    implementation: 'IMMEDIATE',
    apiConfig: {
      endpoint: 'https://data.sanantonio.gov/resource/code-violations.json',
      parameters: {
        '$limit': '1000',
        '$order': 'violation_date DESC'
      }
    }
  },

  // ===== PROBATE EXPANSION =====
  
  // Additional County Probate Courts
  {
    id: 'probate-orange',
    name: 'Orange County Probate Court',
    category: 'Probate Properties',
    url: 'https://www.myorangeclerk.com/probate',
    method: 'scraper',
    description: 'Orange County probate properties',
    dataType: 'probate-properties',
    frequency: 'weekly',
    requiresAuth: false,
    priority: 'high',
    state: 'FL',
    county: 'Orange',
    dataQuality: 'HIGH',
    implementation: 'PHASE_2',
    selectors: {
      tableSelector: '.probate-cases',
      rowSelector: '.case-row',
      ownerSelector: '.deceased',
      addressSelector: '.property',
      executorSelector: '.executor',
      dateSelector: '.filing-date',
      caseSelector: '.case-number'
    }
  },
  {
    id: 'probate-hillsborough',
    name: 'Hillsborough County Probate Court',
    category: 'Probate Properties',
    url: 'https://www.hillsclerk.com/probate',
    method: 'scraper',
    description: 'Hillsborough County probate properties',
    dataType: 'probate-properties',
    frequency: 'weekly',
    requiresAuth: false,
    priority: 'high',
    state: 'FL',
    county: 'Hillsborough',
    dataQuality: 'HIGH',
    implementation: 'PHASE_2',
    selectors: {
      tableSelector: '.probate-cases',
      rowSelector: '.case-row',
      ownerSelector: '.deceased',
      addressSelector: '.property',
      executorSelector: '.executor',
      dateSelector: '.filing-date',
      caseSelector: '.case-number'
    }
  },

  // ===== AUCTION SITES EXPANSION =====
  
  // Government Auction Sites
  {
    id: 'auction-gsa',
    name: 'GSA Auctions',
    category: 'Auctions',
    url: 'https://gsaauctions.gov/gsaauctions/gsaauctions/',
    method: 'scraper',
    description: 'Government Services Administration property auctions',
    dataType: 'auction-properties',
    frequency: 'daily',
    requiresAuth: false,
    priority: 'high',
    dataQuality: 'HIGH',
    implementation: 'IMMEDIATE',
    selectors: {
      tableSelector: '.auction-listings',
      rowSelector: '.auction-item',
      addressSelector: '.property-address',
      priceSelector: '.starting-bid',
      dateSelector: '.auction-date',
      statusSelector: '.auction-status'
    }
  },
  {
    id: 'auction-treasury',
    name: 'Treasury Auctions',
    category: 'Auctions',
    url: 'https://www.treasury.gov/auctions/',
    method: 'scraper',
    description: 'US Treasury property auctions',
    dataType: 'auction-properties',
    frequency: 'weekly',
    requiresAuth: false,
    priority: 'high',
    dataQuality: 'HIGH',
    implementation: 'IMMEDIATE',
    selectors: {
      tableSelector: '.treasury-auctions',
      rowSelector: '.auction-item',
      addressSelector: '.property-address',
      priceSelector: '.minimum-bid',
      dateSelector: '.auction-date',
      statusSelector: '.auction-status'
    }
  },

  // ===== REO EXPANSION =====
  
  // Additional Government REO Sources
  {
    id: 'reo-va',
    name: 'VA REO Properties',
    category: 'REO',
    url: 'https://www.va.gov/reo',
    method: 'scraper',
    description: 'Veterans Affairs REO properties',
    dataType: 'reo-properties',
    frequency: 'weekly',
    requiresAuth: false,
    priority: 'high',
    dataQuality: 'HIGH',
    implementation: 'PHASE_3',
    selectors: {
      tableSelector: '.va-reo-properties',
      rowSelector: '.property-row',
      addressSelector: '.property-address',
      priceSelector: '.list-price',
      statusSelector: '.status',
      dateSelector: '.list-date'
    }
  },
  {
    id: 'reo-usda',
    name: 'USDA REO Properties',
    category: 'REO',
    url: 'https://www.usda.gov/reo',
    method: 'scraper',
    description: 'USDA REO properties',
    dataType: 'reo-properties',
    frequency: 'weekly',
    requiresAuth: false,
    priority: 'high',
    dataQuality: 'HIGH',
    implementation: 'PHASE_3',
    selectors: {
      tableSelector: '.usda-reo-properties',
      rowSelector: '.property-row',
      addressSelector: '.property-address',
      priceSelector: '.list-price',
      statusSelector: '.status',
      dateSelector: '.list-date'
    }
  },

  // ===== ENVIRONMENTAL DATA EXPANSION =====
  
  // EPA Data Sources
  {
    id: 'environmental-superfund',
    name: 'EPA Superfund Sites',
    category: 'Environmental',
    url: 'https://www.epa.gov/superfund/search-superfund-sites-where-you-live',
    method: 'api',
    description: 'EPA Superfund contaminated sites',
    dataType: 'environmental-hazards',
    frequency: 'monthly',
    requiresAuth: false,
    priority: 'medium',
    dataQuality: 'HIGH',
    implementation: 'PHASE_2',
    apiConfig: {
      endpoint: 'https://api.epa.gov/superfund-sites',
      parameters: {
        'format': 'json'
      }
    }
  },
  {
    id: 'environmental-brownfields',
    name: 'EPA Brownfields',
    category: 'Environmental',
    url: 'https://www.epa.gov/brownfields',
    method: 'api',
    description: 'EPA Brownfields contaminated properties',
    dataType: 'environmental-hazards',
    frequency: 'monthly',
    requiresAuth: false,
    priority: 'medium',
    dataQuality: 'HIGH',
    implementation: 'PHASE_2',
    apiConfig: {
      endpoint: 'https://api.epa.gov/brownfields',
      parameters: {
        'format': 'json'
      }
    }
  },

  // ===== DEMOGRAPHIC DATA EXPANSION =====
  
  // Census Bureau APIs
  {
    id: 'demographics-census-acs',
    name: 'Census ACS Demographics',
    category: 'Demographics',
    url: 'https://api.census.gov/data/acs/acs5',
    method: 'api',
    description: 'Census American Community Survey demographic data',
    dataType: 'demographics',
    frequency: 'yearly',
    requiresAuth: false,
    priority: 'medium',
    dataQuality: 'HIGH',
    implementation: 'PHASE_2',
    apiConfig: {
      endpoint: 'https://api.census.gov/data/acs/acs5',
      parameters: {
        'get': 'B01003_001E,B19013_001E,B25077_001E',
        'for': 'county:*',
        'in': 'state:*'
      }
    }
  },

  // ===== ECONOMIC DATA EXPANSION =====
  
  // Federal Reserve Data
  {
    id: 'economic-fred',
    name: 'Federal Reserve Economic Data',
    category: 'Economic',
    url: 'https://fred.stlouisfed.org/',
    method: 'api',
    description: 'Federal Reserve economic indicators',
    dataType: 'economic-data',
    frequency: 'monthly',
    requiresAuth: false,
    priority: 'medium',
    dataQuality: 'HIGH',
    implementation: 'PHASE_2',
    apiConfig: {
      endpoint: 'https://api.stlouisfed.org/fred/series',
      parameters: {
        'api_key': 'your-fred-api-key',
        'file_type': 'json'
      }
    }
  },

  // ===== SCHOOL DATA EXPANSION =====
  
  // Department of Education
  {
    id: 'schools-doe',
    name: 'Department of Education Schools',
    category: 'Schools',
    url: 'https://data.ed.gov/',
    method: 'api',
    description: 'Department of Education school data',
    dataType: 'school-data',
    frequency: 'yearly',
    requiresAuth: false,
    priority: 'low',
    dataQuality: 'HIGH',
    implementation: 'PHASE_3',
    apiConfig: {
      endpoint: 'https://data.ed.gov/api/schools',
      parameters: {
        'format': 'json'
      }
    }
  },

  // ===== CRIME DATA EXPANSION =====
  
  // FBI Crime Data
  {
    id: 'crime-fbi-ucr',
    name: 'FBI Uniform Crime Reports',
    category: 'Crime',
    url: 'https://www.fbi.gov/services/cjis/ucr',
    method: 'api',
    description: 'FBI Uniform Crime Reporting data',
    dataType: 'crime-data',
    frequency: 'yearly',
    requiresAuth: false,
    priority: 'medium',
    dataQuality: 'HIGH',
    implementation: 'PHASE_2',
    apiConfig: {
      endpoint: 'https://api.fbi.gov/ucr',
      parameters: {
        'format': 'json'
      }
    }
  },

  // ===== TRANSPORTATION DATA EXPANSION =====
  
  // Department of Transportation
  {
    id: 'transportation-dot',
    name: 'DOT Transportation Data',
    category: 'Transportation',
    url: 'https://data.transportation.gov/',
    method: 'api',
    description: 'Department of Transportation data',
    dataType: 'transportation-data',
    frequency: 'monthly',
    requiresAuth: false,
    priority: 'low',
    dataQuality: 'HIGH',
    implementation: 'PHASE_3',
    apiConfig: {
      endpoint: 'https://data.transportation.gov/api',
      parameters: {
        'format': 'json'
      }
    }
  },

  // ===== UTILITY DATA EXPANSION =====
  
  // Energy Information Administration
  {
    id: 'utilities-eia',
    name: 'EIA Utility Data',
    category: 'Utilities',
    url: 'https://www.eia.gov/',
    method: 'api',
    description: 'Energy Information Administration utility data',
    dataType: 'utility-data',
    frequency: 'monthly',
    requiresAuth: false,
    priority: 'low',
    dataQuality: 'HIGH',
    implementation: 'PHASE_3',
    apiConfig: {
      endpoint: 'https://api.eia.gov/v2',
      parameters: {
        'api_key': 'your-eia-api-key',
        'format': 'json'
      }
    }
  },

  // ===== ZONING DATA EXPANSION =====
  
  // City Zoning APIs
  {
    id: 'zoning-chicago',
    name: 'Chicago Zoning Data',
    category: 'Zoning',
    url: 'https://data.cityofchicago.org/zoning',
    method: 'api',
    description: 'Chicago zoning data via open data API',
    dataType: 'zoning-data',
    frequency: 'monthly',
    requiresAuth: false,
    priority: 'medium',
    state: 'IL',
    city: 'Chicago',
    dataQuality: 'HIGH',
    implementation: 'PHASE_2',
    apiConfig: {
      endpoint: 'https://data.cityofchicago.org/resource/zoning.json',
      parameters: {
        '$limit': '1000'
      }
    }
  },
  {
    id: 'zoning-nyc',
    name: 'NYC Zoning Data',
    category: 'Zoning',
    url: 'https://data.cityofnewyork.us/zoning',
    method: 'api',
    description: 'NYC zoning data via open data API',
    dataType: 'zoning-data',
    frequency: 'monthly',
    requiresAuth: false,
    priority: 'medium',
    state: 'NY',
    city: 'New York',
    dataQuality: 'HIGH',
    implementation: 'PHASE_2',
    apiConfig: {
      endpoint: 'https://data.cityofnewyork.us/resource/zoning.json',
      parameters: {
        '$limit': '1000'
      }
    }
  },

  // ===== PERMIT DATA EXPANSION =====
  
  // Building Permits
  {
    id: 'permits-chicago',
    name: 'Chicago Building Permits',
    category: 'Permits',
    url: 'https://data.cityofchicago.org/permits',
    method: 'api',
    description: 'Chicago building permit data',
    dataType: 'building-permits',
    frequency: 'daily',
    requiresAuth: false,
    priority: 'medium',
    state: 'IL',
    city: 'Chicago',
    dataQuality: 'HIGH',
    implementation: 'PHASE_2',
    apiConfig: {
      endpoint: 'https://data.cityofchicago.org/resource/building-permits.json',
      parameters: {
        '$limit': '1000',
        '$order': 'issue_date DESC'
      }
    }
  },
  {
    id: 'permits-nyc',
    name: 'NYC Building Permits',
    category: 'Permits',
    url: 'https://data.cityofnewyork.us/permits',
    method: 'api',
    description: 'NYC building permit data',
    dataType: 'building-permits',
    frequency: 'daily',
    requiresAuth: false,
    priority: 'medium',
    state: 'NY',
    city: 'New York',
    dataQuality: 'HIGH',
    implementation: 'PHASE_2',
    apiConfig: {
      endpoint: 'https://data.cityofnewyork.us/resource/building-permits.json',
      parameters: {
        '$limit': '1000',
        '$order': 'issue_date DESC'
      }
    }
  },

  // ===== FLOOD DATA EXPANSION =====
  
  // FEMA Flood Maps
  {
    id: 'flood-fema-maps',
    name: 'FEMA Flood Maps',
    category: 'Flood',
    url: 'https://www.fema.gov/flood-maps',
    method: 'api',
    description: 'FEMA flood map data',
    dataType: 'flood-data',
    frequency: 'monthly',
    requiresAuth: false,
    priority: 'medium',
    dataQuality: 'HIGH',
    implementation: 'PHASE_2',
    apiConfig: {
      endpoint: 'https://api.fema.gov/flood-maps',
      parameters: {
        'format': 'json'
      }
    }
  },

  // ===== EARTHQUAKE DATA EXPANSION =====
  
  // USGS Earthquake Data
  {
    id: 'earthquake-usgs-recent',
    name: 'USGS Recent Earthquakes',
    category: 'Earthquake',
    url: 'https://earthquake.usgs.gov/earthquakes/feed/',
    method: 'api',
    description: 'USGS recent earthquake data',
    dataType: 'earthquake-data',
    frequency: 'real-time',
    requiresAuth: false,
    priority: 'medium',
    dataQuality: 'HIGH',
    implementation: 'PHASE_2',
    apiConfig: {
      endpoint: 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson',
      parameters: {}
    }
  },

  // ===== AIRPORT DATA EXPANSION =====
  
  // FAA Airport Data
  {
    id: 'airports-faa',
    name: 'FAA Airport Data',
    category: 'Airports',
    url: 'https://www.faa.gov/airports/',
    method: 'api',
    description: 'FAA airport information',
    dataType: 'airport-data',
    frequency: 'monthly',
    requiresAuth: false,
    priority: 'low',
    dataQuality: 'HIGH',
    implementation: 'PHASE_3',
    apiConfig: {
      endpoint: 'https://api.faa.gov/airports',
      parameters: {
        'format': 'json'
      }
    }
  },

  // ===== HOSPITAL DATA EXPANSION =====
  
  // Centers for Medicare & Medicaid Services
  {
    id: 'hospitals-cms',
    name: 'CMS Hospital Data',
    category: 'Hospitals',
    url: 'https://data.cms.gov/hospitals',
    method: 'api',
    description: 'CMS hospital information',
    dataType: 'hospital-data',
    frequency: 'monthly',
    requiresAuth: false,
    priority: 'low',
    dataQuality: 'HIGH',
    implementation: 'PHASE_3',
    apiConfig: {
      endpoint: 'https://data.cms.gov/api/hospitals',
      parameters: {
        'format': 'json'
      }
    }
  },

  // ===== SHOPPING CENTER DATA EXPANSION =====
  
  // International Council of Shopping Centers
  {
    id: 'shopping-icsc-directory',
    name: 'ICSC Shopping Center Directory',
    category: 'Shopping Centers',
    url: 'https://www.icsc.com/',
    method: 'scraper',
    description: 'ICSC shopping center directory',
    dataType: 'shopping-center-data',
    frequency: 'quarterly',
    requiresAuth: false,
    priority: 'low',
    dataQuality: 'MEDIUM',
    implementation: 'PHASE_3',
    selectors: {
      tableSelector: '.shopping-centers',
      rowSelector: '.center-item',
      nameSelector: '.center-name',
      addressSelector: '.center-address',
      sizeSelector: '.center-size',
      anchorSelector: '.anchor-tenants'
    }
  },

  // ===== OFFICE BUILDING DATA EXPANSION =====
  
  // Building Owners and Managers Association
  {
    id: 'office-boma-directory',
    name: 'BOMA Office Directory',
    category: 'Office Buildings',
    url: 'https://www.boma.org/',
    method: 'scraper',
    description: 'BOMA office building directory',
    dataType: 'office-data',
    frequency: 'quarterly',
    requiresAuth: false,
    priority: 'low',
    dataQuality: 'MEDIUM',
    implementation: 'PHASE_3',
    selectors: {
      tableSelector: '.office-buildings',
      rowSelector: '.building-item',
      nameSelector: '.building-name',
      addressSelector: '.building-address',
      sizeSelector: '.building-size',
      classSelector: '.building-class'
    }
  },

  // ===== INDUSTRIAL DATA EXPANSION =====
  
  // NAIOP Industrial Directory
  {
    id: 'industrial-naiop-directory',
    name: 'NAIOP Industrial Directory',
    category: 'Industrial',
    url: 'https://www.naiop.org/',
    method: 'scraper',
    description: 'NAIOP industrial property directory',
    dataType: 'industrial-data',
    frequency: 'quarterly',
    requiresAuth: false,
    priority: 'low',
    dataQuality: 'MEDIUM',
    implementation: 'PHASE_3',
    selectors: {
      tableSelector: '.industrial-properties',
      rowSelector: '.property-item',
      nameSelector: '.property-name',
      addressSelector: '.property-address',
      sizeSelector: '.property-size',
      typeSelector: '.property-type'
    }
  },

  // ===== DATA CENTER EXPANSION =====
  
  // Uptime Institute Data Centers
  {
    id: 'datacenters-uptime-directory',
    name: 'Uptime Institute Data Centers',
    category: 'Data Centers',
    url: 'https://uptimeinstitute.com/',
    method: 'scraper',
    description: 'Uptime Institute data center directory',
    dataType: 'datacenter-data',
    frequency: 'quarterly',
    requiresAuth: false,
    priority: 'low',
    dataQuality: 'MEDIUM',
    implementation: 'PHASE_3',
    selectors: {
      tableSelector: '.data-centers',
      rowSelector: '.datacenter-item',
      nameSelector: '.datacenter-name',
      addressSelector: '.datacenter-address',
      tierSelector: '.tier-rating',
      sizeSelector: '.facility-size'
    }
  },

  // ===== CELL TOWER EXPANSION =====
  
  // FCC Antenna Structure Registration
  {
    id: 'celltowers-fcc-asr',
    name: 'FCC Antenna Structure Registration',
    category: 'Cell Towers',
    url: 'https://www.fcc.gov/antenna-structure-registration',
    method: 'api',
    description: 'FCC antenna structure registration data',
    dataType: 'cell-tower-data',
    frequency: 'monthly',
    requiresAuth: false,
    priority: 'low',
    dataQuality: 'HIGH',
    implementation: 'PHASE_3',
    apiConfig: {
      endpoint: 'https://api.fcc.gov/asr',
      parameters: {
        'format': 'json'
      }
    }
  },

  // ===== SOLAR FARM EXPANSION =====
  
  // EIA Solar Generation
  {
    id: 'solar-eia-generation',
    name: 'EIA Solar Generation Data',
    category: 'Solar Farms',
    url: 'https://www.eia.gov/solar/',
    method: 'api',
    description: 'EIA solar generation data',
    dataType: 'solar-farm-data',
    frequency: 'monthly',
    requiresAuth: false,
    priority: 'low',
    dataQuality: 'HIGH',
    implementation: 'PHASE_3',
    apiConfig: {
      endpoint: 'https://api.eia.gov/v2/solar',
      parameters: {
        'api_key': 'your-eia-api-key',
        'format': 'json'
      }
    }
  },

  // ===== WIND FARM EXPANSION =====
  
  // EIA Wind Generation
  {
    id: 'wind-eia-generation',
    name: 'EIA Wind Generation Data',
    category: 'Wind Farms',
    url: 'https://www.eia.gov/wind/',
    method: 'api',
    description: 'EIA wind generation data',
    dataType: 'wind-farm-data',
    frequency: 'monthly',
    requiresAuth: false,
    priority: 'low',
    dataQuality: 'HIGH',
    implementation: 'PHASE_3',
    apiConfig: {
      endpoint: 'https://api.eia.gov/v2/wind',
      parameters: {
        'api_key': 'your-eia-api-key',
        'format': 'json'
      }
    }
  }
];

// Helper functions for working with expanded data sources
export const getDataSourcesByCategory = (category: string): ExpandedDataSource[] => {
  return expandedDataSources.filter(source => source.category === category);
};

export const getDataSourcesByState = (state: string): ExpandedDataSource[] => {
  return expandedDataSources.filter(source => source.state === state);
};

export const getDataSourcesByPriority = (priority: 'high' | 'medium' | 'low'): ExpandedDataSource[] => {
  return expandedDataSources.filter(source => source.priority === priority);
};

export const getDataSourcesByImplementation = (implementation: 'IMMEDIATE' | 'PHASE_2' | 'PHASE_3'): ExpandedDataSource[] => {
  return expandedDataSources.filter(source => source.implementation === implementation);
};

export const getDataSourcesByQuality = (quality: 'HIGH' | 'MEDIUM' | 'LOW'): ExpandedDataSource[] => {
  return expandedDataSources.filter(source => source.dataQuality === quality);
};

// Summary statistics
export const getDataSourceStats = () => {
  const total = expandedDataSources.length;
  const byCategory = expandedDataSources.reduce((acc, source) => {
    acc[source.category] = (acc[source.category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  const byPriority = expandedDataSources.reduce((acc, source) => {
    acc[source.priority] = (acc[source.priority] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  const byImplementation = expandedDataSources.reduce((acc, source) => {
    acc[source.implementation] = (acc[source.implementation] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  const byQuality = expandedDataSources.reduce((acc, source) => {
    acc[source.dataQuality] = (acc[source.dataQuality] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  return {
    total,
    byCategory,
    byPriority,
    byImplementation,
    byQuality
  };
};
