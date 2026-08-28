import { marketCalendarAPI } from '@/services/api/market-calendar-api';

export interface PDUFAAPIResponse {
  success: boolean;
  data?: PDUFAData[];
  message?: string;
  timestamp: string;
  total?: number;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface PDUFAData {
  ticker: string;
  company: string;
  drug: string;
  indication: string;
  pdufaDate: string;
  reviewType: string;
  status: string;
  sourceUrl?: string;
  lastUpdated: string;
  confidence: number;
}

export interface PDUFAStats {
  totalPDUFAs: number;
  upcomingPDUFAs: number;
  todayPDUFAs: number;
  tomorrowPDUFAs: number;
  thisWeekPDUFAs: number;
  thisMonthPDUFAs: number;
  lastUpdated: string;
}

export class EnhancedPDUFAAPI {
  private static instance: EnhancedPDUFAAPI;
  private cache: Map<string, { data: PDUFAData[]; timestamp: number }> = new Map();
  private readonly CACHE_TTL = 15 * 60 * 1000; // 15 minutes (more reasonable for PDUFA data)

  private constructor() {}

  static getInstance(): EnhancedPDUFAAPI {
    if (!EnhancedPDUFAAPI.instance) {
      EnhancedPDUFAAPI.instance = new EnhancedPDUFAAPI();
    }
    return EnhancedPDUFAAPI.instance;
  }

  private async fetchData(): Promise<PDUFAData[]> {
    const cacheKey = 'all';
    const cached = this.cache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.data;
    }

    try {
      const result = await marketCalendarAPI.regulatory();
      const data = result.items.map((item) => ({
        ticker: item.ticker ?? 'N/A',
        company: item.company,
        drug: item.drug,
        indication: item.indication,
        pdufaDate: item.eventDate,
        reviewType: item.eventType,
        status: item.status,
        sourceUrl: item.sourceUrl,
        lastUpdated: result.fetchedAt,
        confidence: item.confidence,
      }));
      this.cache.set(cacheKey, { data, timestamp: Date.now() });
      return data;
    } catch (error) {
      if (cached) return cached.data;
      throw error;
    }
  }

  async getAllPDUFAs(page: number = 1, limit: number = 50): Promise<PDUFAAPIResponse> {
    try {
      const allData = await this.fetchData();
      const total = allData.length;
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;
      const paginatedData = allData.slice(startIndex, endIndex);

      return {
        success: true,
        data: paginatedData,
        total,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        },
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to fetch PDUFA data',
        timestamp: new Date().toISOString()
      };
    }
  }

  async getUpcomingPDUFAs(days: number = 30): Promise<PDUFAAPIResponse> {
    try {
      const allData = await this.fetchData();
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() + days);
      
      const data = allData.filter(item => {
        const pdufaDate = new Date(item.pdufaDate);
        return pdufaDate >= new Date() && pdufaDate <= cutoffDate;
      });
      
      return {
        success: true,
        data,
        total: data.length,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to fetch upcoming PDUFAs',
        timestamp: new Date().toISOString()
      };
    }
  }

  async getPDUFAsForDate(date: string): Promise<PDUFAAPIResponse> {
    try {
      const allData = await this.fetchData();
      const data = allData.filter(item => item.pdufaDate === date);
      
      return {
        success: true,
        data,
        total: data.length,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to fetch PDUFAs for date',
        timestamp: new Date().toISOString()
      };
    }
  }

  async getPDUFAsByTicker(ticker: string): Promise<PDUFAAPIResponse> {
    try {
      const allData = await this.fetchData();
      const data = allData.filter(item => 
        item.ticker.toLowerCase() === ticker.toLowerCase()
      );
      
      return {
        success: true,
        data,
        total: data.length,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to fetch PDUFAs by ticker',
        timestamp: new Date().toISOString()
      };
    }
  }

  async getPDUFAsByCompany(company: string): Promise<PDUFAAPIResponse> {
    try {
      const allData = await this.fetchData();
      const data = allData.filter(item => 
        item.company.toLowerCase().includes(company.toLowerCase())
      );
      
      return {
        success: true,
        data,
        total: data.length,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to fetch PDUFAs by company',
        timestamp: new Date().toISOString()
      };
    }
  }

  async getStats(): Promise<PDUFAAPIResponse & { stats?: PDUFAStats }> {
    try {
      const allData = await this.fetchData();
      const today = new Date().toLocaleDateString('en-CA');
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = tomorrow.toLocaleDateString('en-CA');
      
      const todayPDUFAs = allData.filter(item => item.pdufaDate === today);
      const tomorrowPDUFAs = allData.filter(item => item.pdufaDate === tomorrowStr);
      
      const thisWeek = new Date();
      thisWeek.setDate(thisWeek.getDate() + 7);
      const thisWeekPDUFAs = allData.filter(item => {
        const pdufaDate = new Date(item.pdufaDate);
        return pdufaDate >= new Date() && pdufaDate <= thisWeek;
      });
      
      const thisMonth = new Date();
      thisMonth.setMonth(thisMonth.getMonth() + 1);
      const thisMonthPDUFAs = allData.filter(item => {
        const pdufaDate = new Date(item.pdufaDate);
        return pdufaDate >= new Date() && pdufaDate <= thisMonth;
      });

      const stats: PDUFAStats = {
        totalPDUFAs: allData.length,
        upcomingPDUFAs: allData.filter(item => new Date(item.pdufaDate) >= new Date()).length,
        todayPDUFAs: todayPDUFAs.length,
        tomorrowPDUFAs: tomorrowPDUFAs.length,
        thisWeekPDUFAs: thisWeekPDUFAs.length,
        thisMonthPDUFAs: thisMonthPDUFAs.length,
        lastUpdated: new Date().toISOString()
      };

      return {
        success: true,
        stats,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to fetch PDUFA stats',
        timestamp: new Date().toISOString()
      };
    }
  }

  async searchPDUFAs(query: string): Promise<PDUFAAPIResponse> {
    try {
      const allData = await this.fetchData();
      const searchTerm = query.toLowerCase();
      
      const data = allData.filter(item => 
        item.ticker.toLowerCase().includes(searchTerm) ||
        item.company.toLowerCase().includes(searchTerm) ||
        item.drug.toLowerCase().includes(searchTerm) ||
        item.indication.toLowerCase().includes(searchTerm)
      );
      
      return {
        success: true,
        data,
        total: data.length,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to search PDUFAs',
        timestamp: new Date().toISOString()
      };
    }
  }

  async runIngestWithWatchlist(_args: Record<string, unknown>): Promise<PDUFAAPIResponse> {
    // Delegate to proxy server — ingest runs server-side
    return this.getAllPDUFAs();
  }

  async clearCache(): Promise<PDUFAAPIResponse> {
    try {
      this.cache.clear();
      return {
        success: true,
        message: 'Cache cleared successfully',
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to clear cache',
        timestamp: new Date().toISOString()
      };
    }
  }

  async sendTestAlert(): Promise<PDUFAAPIResponse> {
    try {
      // Mock test alert - in real implementation, this would send to Discord/Slack
      console.log('Test PDUFA alert sent');
      
      return {
        success: true,
        message: 'Test alert sent successfully',
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to send test alert',
        timestamp: new Date().toISOString()
      };
    }
  }
}

export const enhancedPdufaAPI = EnhancedPDUFAAPI.getInstance();
