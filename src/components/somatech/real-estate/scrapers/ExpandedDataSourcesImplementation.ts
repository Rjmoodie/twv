// Expanded Data Sources Implementation Strategy
// Advanced implementation for hundreds of new real estate data sources

import { expandedDataSources, ExpandedDataSource, getDataSourceStats } from './ExpandedDataSources';

// ===== IMPLEMENTATION PHASES =====

export const implementationPhases = {
  IMMEDIATE: [
    // County Assessors (High Priority)
    'assessor-san-diego',
    'assessor-orange',
    'assessor-riverside',
    'assessor-dallas',
    'assessor-bexar',
    'assessor-palm-beach',
    
    // Tax Delinquent (High Priority)
    'tax-delinquent-san-bernardino',
    'tax-delinquent-sacramento',
    'tax-delinquent-bexar',
    
    // Foreclosures (High Priority)
    'foreclosure-orange-clerk',
    'foreclosure-miami-dade-clerk',
    
    // Code Violations (High Priority)
    'code-violations-houston',
    'code-violations-phoenix',
    'code-violations-san-antonio',
    
    // Government Auctions (High Priority)
    'auction-gsa',
    'auction-treasury'
  ],
  
  PHASE_2: [
    // Regional MLS Systems
    'mls-mris',
    'mls-paragon',
    'mls-matrix',
    
    // Probate Properties
    'probate-orange',
    'probate-hillsborough',
    
    // Environmental Data
    'environmental-superfund',
    'environmental-brownfields',
    
    // Demographic Data
    'demographics-census-acs',
    
    // Economic Data
    'economic-fred',
    
    // Crime Data
    'crime-fbi-ucr',
    
    // Zoning Data
    'zoning-chicago',
    'zoning-nyc',
    
    // Permit Data
    'permits-chicago',
    'permits-nyc',
    
    // Flood Data
    'flood-fema-maps',
    
    // Earthquake Data
    'earthquake-usgs-recent'
  ],
  
  PHASE_3: [
    // Government REO
    'reo-va',
    'reo-usda',
    
    // School Data
    'schools-doe',
    
    // Transportation Data
    'transportation-dot',
    
    // Utility Data
    'utilities-eia',
    
    // Airport Data
    'airports-faa',
    
    // Hospital Data
    'hospitals-cms',
    
    // Commercial Property Directories
    'shopping-icsc-directory',
    'office-boma-directory',
    'industrial-naiop-directory',
    'datacenters-uptime-directory',
    
    // Infrastructure Data
    'celltowers-fcc-asr',
    'solar-eia-generation',
    'wind-eia-generation'
  ]
};

// ===== ADVANCED SCRAPING ENGINE =====

export interface ScrapingConfig {
  maxConcurrent: number;
  requestDelay: number;
  timeout: number;
  maxRetries: number;
  userAgents: string[];
  proxyList?: string[];
  respectRobotsTxt: boolean;
  followRedirects: boolean;
  cacheResults: boolean;
  cacheExpiry: number; // hours
}

export const defaultScrapingConfig: ScrapingConfig = {
  maxConcurrent: 5,
  requestDelay: 2000, // 2 seconds
  timeout: 30000, // 30 seconds
  maxRetries: 3,
  userAgents: [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
  ],
  respectRobotsTxt: true,
  followRedirects: true,
  cacheResults: true,
  cacheExpiry: 24
};

// ===== RATE LIMITING SYSTEM =====

export class AdvancedRateLimiter {
  private requestTimestamps: Map<string, number[]> = new Map();
  private config: ScrapingConfig;

  constructor(config: ScrapingConfig = defaultScrapingConfig) {
    this.config = config;
  }

  async waitForNextRequest(sourceId: string): Promise<void> {
    const now = Date.now();
    const timestamps = this.requestTimestamps.get(sourceId) || [];
    
    // Remove timestamps older than 1 hour
    const recentTimestamps = timestamps.filter(timestamp => now - timestamp < 3600000);
    
    // Check if we need to wait
    if (recentTimestamps.length > 0) {
      const lastRequest = recentTimestamps[recentTimestamps.length - 1];
      const timeSinceLastRequest = now - lastRequest;
      
      if (timeSinceLastRequest < this.config.requestDelay) {
        const waitTime = this.config.requestDelay - timeSinceLastRequest;
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
    
    // Update timestamps
    recentTimestamps.push(now);
    this.requestTimestamps.set(sourceId, recentTimestamps);
  }

  getCurrentLoad(sourceId: string): number {
    const timestamps = this.requestTimestamps.get(sourceId) || [];
    const now = Date.now();
    const recentRequests = timestamps.filter(timestamp => now - timestamp < 60000); // Last minute
    return recentRequests.length;
  }
}

// ===== ERROR HANDLING & RECOVERY =====

export class AdvancedErrorHandler {
  private errorCounts: Map<string, number> = new Map();
  private lastErrors: Map<string, string[]> = new Map();

  async handleError(error: any, sourceId: string): Promise<void> {
    const errorCount = this.errorCounts.get(sourceId) || 0;
    this.errorCounts.set(sourceId, errorCount + 1);

    const errors = this.lastErrors.get(sourceId) || [];
    errors.push(error.message);
    if (errors.length > 10) errors.shift(); // Keep only last 10 errors
    this.lastErrors.set(sourceId, errors);

    console.error(`Error scraping ${sourceId}:`, error.message);
    
    // Implement exponential backoff
    if (errorCount < 3) {
      const backoffTime = Math.pow(2, errorCount) * 1000; // 1s, 2s, 4s
      await new Promise(resolve => setTimeout(resolve, backoffTime));
    }
  }

  shouldSkipSource(sourceId: string): boolean {
    const errorCount = this.errorCounts.get(sourceId) || 0;
    return errorCount >= 5; // Skip after 5 consecutive errors
  }

  getErrorStats(sourceId: string): { count: number; recentErrors: string[] } {
    return {
      count: this.errorCounts.get(sourceId) || 0,
      recentErrors: this.lastErrors.get(sourceId) || []
    };
  }
}

// ===== DATA VALIDATION & CLEANING =====

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  confidence: number; // 0-1
  cleanedData?: any;
}

export class AdvancedDataValidator {
  private validationRules: Map<string, any> = new Map();

  constructor() {
    this.setupValidationRules();
  }

  private setupValidationRules(): void {
    // Property assessment validation
    this.validationRules.set('property-assessments', {
      required: ['address', 'owner', 'value'],
      address: { type: 'string', minLength: 10 },
      owner: { type: 'string', minLength: 2 },
      value: { type: 'number', min: 0 }
    });

    // Tax delinquent validation
    this.validationRules.set('tax-delinquent', {
      required: ['address', 'owner', 'amount'],
      address: { type: 'string', minLength: 10 },
      owner: { type: 'string', minLength: 2 },
      amount: { type: 'number', min: 0 }
    });

    // Foreclosure validation
    this.validationRules.set('foreclosure-filings', {
      required: ['address', 'defendant', 'plaintiff'],
      address: { type: 'string', minLength: 10 },
      defendant: { type: 'string', minLength: 2 },
      plaintiff: { type: 'string', minLength: 2 }
    });
  }

  validatePropertyData(data: any, dataType: string): ValidationResult {
    const rules = this.validationRules.get(dataType);
    if (!rules) {
      return {
        isValid: true,
        errors: [],
        warnings: ['No validation rules found for this data type'],
        confidence: 0.5
      };
    }

    const errors: string[] = [];
    const warnings: string[] = [];
    let confidence = 1.0;

    // Check required fields
    for (const field of rules.required) {
      if (!data[field]) {
        errors.push(`Missing required field: ${field}`);
        confidence -= 0.2;
      }
    }

    // Validate field types and constraints
    for (const [field, rule] of Object.entries(rules)) {
      if (field === 'required') continue;
      
      const value = data[field];
      if (value !== undefined) {
        if (rule.type === 'string' && typeof value !== 'string') {
          errors.push(`Field ${field} should be a string`);
          confidence -= 0.1;
        } else if (rule.type === 'number' && typeof value !== 'number') {
          errors.push(`Field ${field} should be a number`);
          confidence -= 0.1;
        }

        if (rule.minLength && typeof value === 'string' && value.length < rule.minLength) {
          warnings.push(`Field ${field} is shorter than expected`);
          confidence -= 0.05;
        }

        if (rule.min !== undefined && typeof value === 'number' && value < rule.min) {
          warnings.push(`Field ${field} value is below minimum`);
          confidence -= 0.05;
        }
      }
    }

    // Clean and standardize data
    const cleanedData = this.cleanData(data, dataType);

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      confidence: Math.max(0, confidence),
      cleanedData
    };
  }

  private cleanData(data: any, dataType: string): any {
    const cleaned = { ...data };

    // Standardize addresses
    if (cleaned.address) {
      cleaned.address = this.standardizeAddress(cleaned.address);
    }

    // Standardize names
    if (cleaned.owner) {
      cleaned.owner = this.standardizeName(cleaned.owner);
    }

    // Convert amounts to numbers
    if (cleaned.amount && typeof cleaned.amount === 'string') {
      cleaned.amount = this.parseAmount(cleaned.amount);
    }

    // Standardize dates
    if (cleaned.date) {
      cleaned.date = this.standardizeDate(cleaned.date);
    }

    return cleaned;
  }

  private standardizeAddress(address: string): string {
    // Remove extra whitespace and standardize common abbreviations
    return address
      .trim()
      .replace(/\s+/g, ' ')
      .replace(/\bst\b/gi, 'Street')
      .replace(/\bave\b/gi, 'Avenue')
      .replace(/\bblvd\b/gi, 'Boulevard')
      .replace(/\bdr\b/gi, 'Drive')
      .replace(/\bln\b/gi, 'Lane');
  }

  private standardizeName(name: string): string {
    // Capitalize properly and remove extra whitespace
    return name
      .trim()
      .replace(/\s+/g, ' ')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }

  private parseAmount(amount: string): number {
    // Remove currency symbols and commas, convert to number
    const cleaned = amount.replace(/[$,]/g, '');
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? 0 : parsed;
  }

  private standardizeDate(date: string): string {
    // Convert various date formats to ISO format
    try {
      return new Date(date).toISOString().split('T')[0];
    } catch {
      return date; // Return original if parsing fails
    }
  }
}

// ===== MAIN SCRAPING ENGINE =====

export interface ScrapingResult {
  success: boolean;
  data: any[];
  errors: string[];
  warnings: string[];
  source: string;
  timestamp: string;
  recordCount: number;
  processingTime: number;
  dataQuality: number;
}

export class ExpandedDataScraper {
  private rateLimiter: AdvancedRateLimiter;
  private errorHandler: AdvancedErrorHandler;
  private validator: AdvancedDataValidator;
  private config: ScrapingConfig;

  constructor(config: ScrapingConfig = defaultScrapingConfig) {
    this.config = config;
    this.rateLimiter = new AdvancedRateLimiter(config);
    this.errorHandler = new AdvancedErrorHandler();
    this.validator = new AdvancedDataValidator();
  }

  async scrapeSource(sourceId: string): Promise<ScrapingResult> {
    const startTime = Date.now();
    const source = expandedDataSources.find(s => s.id === sourceId);
    
    if (!source) {
      return {
        success: false,
        data: [],
        errors: [`Source not found: ${sourceId}`],
        warnings: [],
        source: sourceId,
        timestamp: new Date().toISOString(),
        recordCount: 0,
        processingTime: Date.now() - startTime,
        dataQuality: 0
      };
    }

    // Check if source should be skipped due to errors
    if (this.errorHandler.shouldSkipSource(sourceId)) {
      return {
        success: false,
        data: [],
        errors: [`Source skipped due to previous errors: ${sourceId}`],
        warnings: [],
        source: sourceId,
        timestamp: new Date().toISOString(),
        recordCount: 0,
        processingTime: Date.now() - startTime,
        dataQuality: 0
      };
    }

    // Wait for rate limiting
    await this.rateLimiter.waitForNextRequest(sourceId);

    try {
      let rawData: any[] = [];

      // Scrape data based on method
      if (source.method === 'api') {
        rawData = await this.scrapeAPI(source);
      } else if (source.method === 'scraper') {
        rawData = await this.scrapeWeb(source);
      } else if (source.method === 'csv') {
        rawData = await this.scrapeCSV(source);
      } else if (source.method === 'json') {
        rawData = await this.scrapeJSON(source);
      }

      // Validate and clean data
      const validationResults = rawData.map(item => 
        this.validator.validatePropertyData(item, source.dataType)
      );

      const validData = validationResults
        .map((result, index) => ({ ...result, originalData: rawData[index] }))
        .filter(result => result.isValid)
        .map(result => result.cleanedData || result.originalData);

      const errors = validationResults
        .flatMap(result => result.errors)
        .concat(rawData.filter((_, index) => !validationResults[index].isValid)
          .map(() => `Invalid data format for ${sourceId}`));

      const warnings = validationResults.flatMap(result => result.warnings);

      // Calculate overall data quality
      const avgConfidence = validationResults.length > 0 
        ? validationResults.reduce((sum, result) => sum + result.confidence, 0) / validationResults.length
        : 0;

      const processingTime = Date.now() - startTime;

      return {
        success: validData.length > 0,
        data: validData,
        errors,
        warnings,
        source: sourceId,
        timestamp: new Date().toISOString(),
        recordCount: validData.length,
        processingTime,
        dataQuality: avgConfidence
      };

    } catch (error) {
      await this.errorHandler.handleError(error, sourceId);
      
      return {
        success: false,
        data: [],
        errors: [error.message || 'Unknown error'],
        warnings: [],
        source: sourceId,
        timestamp: new Date().toISOString(),
        recordCount: 0,
        processingTime: Date.now() - startTime,
        dataQuality: 0
      };
    }
  }

  private async scrapeAPI(source: ExpandedDataSource): Promise<any[]> {
    if (!source.apiConfig) {
      throw new Error(`No API configuration for source: ${source.id}`);
    }

    const url = new URL(source.apiConfig.endpoint);
    
    // Add parameters
    if (source.apiConfig.parameters) {
      Object.entries(source.apiConfig.parameters).forEach(([key, value]) => {
        url.searchParams.append(key, value);
      });
    }

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'User-Agent': this.getRandomUserAgent(),
        'Accept': 'application/json',
        ...source.apiConfig.headers
      },
      signal: AbortSignal.timeout(this.config.timeout)
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return Array.isArray(data) ? data : [data];
  }

  private async scrapeWeb(source: ExpandedDataSource): Promise<any[]> {
    // This would use Puppeteer or similar for web scraping
    // For now, return empty array as placeholder
    console.log(`Web scraping not implemented for ${source.id}`);
    return [];
  }

  private async scrapeCSV(source: ExpandedDataSource): Promise<any[]> {
    // This would parse CSV data
    // For now, return empty array as placeholder
    console.log(`CSV scraping not implemented for ${source.id}`);
    return [];
  }

  private async scrapeJSON(source: ExpandedDataSource): Promise<any[]> {
    // This would parse JSON data
    // For now, return empty array as placeholder
    console.log(`JSON scraping not implemented for ${source.id}`);
    return [];
  }

  private getRandomUserAgent(): string {
    const index = Math.floor(Math.random() * this.config.userAgents.length);
    return this.config.userAgents[index];
  }

  // ===== BATCH PROCESSING =====

  async scrapeMultipleSources(sourceIds: string[]): Promise<Map<string, ScrapingResult>> {
    const results = new Map<string, ScrapingResult>();
    const semaphore = new Semaphore(this.config.maxConcurrent);

    const promises = sourceIds.map(async (sourceId) => {
      await semaphore.acquire();
      try {
        const result = await this.scrapeSource(sourceId);
        results.set(sourceId, result);
      } finally {
        semaphore.release();
      }
    });

    await Promise.all(promises);
    return results;
  }

  async scrapeByPhase(phase: 'IMMEDIATE' | 'PHASE_2' | 'PHASE_3'): Promise<Map<string, ScrapingResult>> {
    const sourceIds = implementationPhases[phase];
    return this.scrapeMultipleSources(sourceIds);
  }

  async scrapeByCategory(category: string): Promise<Map<string, ScrapingResult>> {
    const sources = expandedDataSources.filter(s => s.category === category);
    const sourceIds = sources.map(s => s.id);
    return this.scrapeMultipleSources(sourceIds);
  }

  // ===== MONITORING & STATISTICS =====

  getScrapingStats(): {
    totalSources: number;
    byPhase: Record<string, number>;
    byCategory: Record<string, number>;
    byPriority: Record<string, number>;
    errorStats: Record<string, { count: number; recentErrors: string[] }>;
  } {
    const stats = getDataSourceStats();
    const errorStats: Record<string, { count: number; recentErrors: string[] }> = {};

    expandedDataSources.forEach(source => {
      errorStats[source.id] = this.errorHandler.getErrorStats(source.id);
    });

    return {
      totalSources: stats.total,
      byPhase: stats.byImplementation,
      byCategory: stats.byCategory,
      byPriority: stats.byPriority,
      errorStats
    };
  }
}

// ===== UTILITY CLASSES =====

class Semaphore {
  private permits: number;
  private waitQueue: Array<() => void> = [];

  constructor(permits: number) {
    this.permits = permits;
  }

  async acquire(): Promise<void> {
    if (this.permits > 0) {
      this.permits--;
      return Promise.resolve();
    }

    return new Promise<void>(resolve => {
      this.waitQueue.push(resolve);
    });
  }

  release(): void {
    this.permits++;
    if (this.waitQueue.length > 0) {
      const resolve = this.waitQueue.shift()!;
      this.permits--;
      resolve();
    }
  }
}

// ===== EXPORT SUMMARY =====

export const getExpansionSummary = () => {
  const stats = getDataSourceStats();
  
  return {
    totalNewSources: stats.total,
    immediateImplementation: implementationPhases.IMMEDIATE.length,
    phase2Implementation: implementationPhases.PHASE_2.length,
    phase3Implementation: implementationPhases.PHASE_3.length,
    categories: Object.keys(stats.byCategory),
    highPrioritySources: stats.byPriority.high || 0,
    mediumPrioritySources: stats.byPriority.medium || 0,
    lowPrioritySources: stats.byPriority.low || 0,
    highQualitySources: stats.byQuality.HIGH || 0
  };
};
