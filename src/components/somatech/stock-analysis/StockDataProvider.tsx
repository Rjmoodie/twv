import React, { useEffect, useRef, useState, type ReactNode } from "react";
import { StockData, DCFScenarios, InvestmentThesis } from "../types";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { useAuth } from "@/components/somatech/AuthProvider";
import { mapStockAnalysisResponse, type StockAnalysisResponse } from "./stockAnalysisMapper";
import { defaultDcfScenarios, defaultInvestmentThesis, stockAnalysisStorageKey } from './stockDataDefaults';

interface StockDataContextType {
  stockData: StockData | null;
  loading: boolean;
  dcfScenarios: DCFScenarios;
  setDcfScenarios: (scenarios: DCFScenarios) => void;
  investmentThesis: InvestmentThesis;
  setInvestmentThesis: (thesis: InvestmentThesis) => void;
  analyzeStock: () => Promise<void>;
  clearAnalysis: () => void;
}

const StockDataContext = React.createContext<StockDataContextType | null>(null);

interface StockDataProviderProps {
  children: ReactNode;
  globalTicker?: string;
}

const LEGACY_STORAGE_KEY = "somatech:stock-analysis:v3";
const ANONYMOUS_OWNER = "anonymous";

interface PersistedAnalysis {
  ownerUserId: string;
  stockData: StockData;
  dcfScenarios: DCFScenarios;
  investmentThesis: InvestmentThesis;
}

const loadPersistedAnalysis = (userId: string): PersistedAnalysis | null => {
  if (typeof window === "undefined") return null;
  try {
    // The unscoped v3 payload cannot be attributed safely to any account.
    window.localStorage.removeItem(LEGACY_STORAGE_KEY);
    const saved = window.localStorage.getItem(stockAnalysisStorageKey(userId));
    if (!saved) return null;
    const parsed = JSON.parse(saved) as Partial<PersistedAnalysis>;
    if (parsed.ownerUserId !== userId || !parsed.stockData?.symbol) {
      window.localStorage.removeItem(stockAnalysisStorageKey(userId));
      return null;
    }
    return {
      ownerUserId: userId,
      stockData: parsed.stockData,
      dcfScenarios: parsed.dcfScenarios ?? defaultDcfScenarios(),
      investmentThesis: parsed.investmentThesis ?? defaultInvestmentThesis(),
    };
  } catch (error) {
    console.warn("Could not restore the saved stock analysis:", error);
    return null;
  }
};

const persistAnalysis = (analysis: PersistedAnalysis) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(stockAnalysisStorageKey(analysis.ownerUserId), JSON.stringify(analysis));
};

export const StockDataProvider = ({ children, globalTicker }: StockDataProviderProps) => {
  const { user, loading: authLoading } = useAuth();
  const currentOwner = authLoading ? null : user?.id ?? ANONYMOUS_OWNER;
  const ownerRef = useRef<string | null>(currentOwner);
  ownerRef.current = currentOwner;
  const requestSequence = useRef(0);
  const [stateOwner, setStateOwner] = useState<string | null>(null);
  const [stockData, setStockData] = useState<StockData | null>(null);
  const [loading, setLoading] = useState(false);
  const [dcfScenarios, setDcfScenarios] = useState<DCFScenarios>(defaultDcfScenarios);
  const [investmentThesis, setInvestmentThesis] = useState<InvestmentThesis>(defaultInvestmentThesis);

  useEffect(() => {
    requestSequence.current++;
    setLoading(false);
    setStockData(null);
    setDcfScenarios(defaultDcfScenarios());
    setInvestmentThesis(defaultInvestmentThesis());
    setStateOwner(currentOwner);

    if (!user?.id || currentOwner !== user.id) return;
    const restored = loadPersistedAnalysis(user.id);
    if (!restored) return;
    setStockData(restored.stockData);
    setDcfScenarios(restored.dcfScenarios);
    setInvestmentThesis(restored.investmentThesis);
  }, [currentOwner, user?.id]);

  const ownsState = Boolean(currentOwner && stateOwner === currentOwner);
  const visibleStockData = ownsState ? stockData : null;
  const visibleDcfScenarios = ownsState ? dcfScenarios : defaultDcfScenarios();
  const visibleInvestmentThesis = ownsState ? investmentThesis : defaultInvestmentThesis();

  useEffect(() => {
    if (!user?.id || stateOwner !== user.id || !stockData) return;
    try {
      persistAnalysis({
        ownerUserId: user.id,
        stockData,
        dcfScenarios,
        investmentThesis,
      });
    } catch (error) {
      console.warn("Could not save the stock analysis:", error);
    }
  }, [user?.id, stateOwner, stockData, dcfScenarios, investmentThesis]);

  const analyzeStock = async () => {
    const ticker = globalTicker?.trim().toUpperCase();
    const requestedOwner = ownerRef.current;
    if (!ticker) {
      toast.error("Please enter a stock symbol");
      return;
    }
    if (!requestedOwner) return;

    const sequence = ++requestSequence.current;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke<StockAnalysisResponse>("stock-analysis", {
        body: { ticker },
      });
      if (error) {
        if (error instanceof FunctionsHttpError) {
          const body = await error.context.json().catch(() => null);
          throw new Error(body?.error || error.message);
        }
        throw error;
      }
      if (!data) throw new Error("Stock data service returned no data");
      if (sequence !== requestSequence.current || ownerRef.current !== requestedOwner) return;

      const normalized = mapStockAnalysisResponse(data);
      const sameTicker = visibleStockData?.symbol.toUpperCase() === normalized.symbol.toUpperCase();
      const nextDcf = sameTicker ? visibleDcfScenarios : defaultDcfScenarios();
      const nextThesis = sameTicker ? visibleInvestmentThesis : defaultInvestmentThesis();

      // Commit a ticker-consistent snapshot before rendering success. Drafts
      // from another security never travel with the newly loaded company.
      if (user?.id && requestedOwner === user.id) {
        try {
          persistAnalysis({
            ownerUserId: user.id,
            stockData: normalized,
            dcfScenarios: nextDcf,
            investmentThesis: nextThesis,
          });
        } catch (persistError) {
          console.warn("Could not save the stock analysis:", persistError);
        }
      }
      setStateOwner(requestedOwner);
      setDcfScenarios(nextDcf);
      setInvestmentThesis(nextThesis);
      setStockData(normalized);
      toast.success(`Loaded sourced analysis for ${ticker}`);
    } catch (error) {
      if (sequence !== requestSequence.current || ownerRef.current !== requestedOwner) return;
      console.error("Stock analysis failed:", error);
      toast.error(error instanceof Error ? error.message : `Failed to load ${ticker}`);
    } finally {
      if (sequence === requestSequence.current && ownerRef.current === requestedOwner) setLoading(false);
    }
  };

  const clearAnalysis = () => {
    requestSequence.current++;
    setStockData(null);
    setDcfScenarios(defaultDcfScenarios());
    setInvestmentThesis(defaultInvestmentThesis());
    setLoading(false);
    setStateOwner(currentOwner);
    if (typeof window !== "undefined" && user?.id) {
      window.localStorage.removeItem(stockAnalysisStorageKey(user.id));
    }
    toast.success("Stock analysis cleared");
  };

  return (
    <StockDataContext.Provider value={{
      stockData: visibleStockData,
      loading: ownsState && loading,
      dcfScenarios: visibleDcfScenarios,
      setDcfScenarios,
      investmentThesis: visibleInvestmentThesis,
      setInvestmentThesis,
      analyzeStock,
      clearAnalysis,
    }}>
      {children}
    </StockDataContext.Provider>
  );
};

export const useStockData = () => {
  const context = React.useContext(StockDataContext);
  if (!context) throw new Error("useStockData must be used within a StockDataProvider");
  return context;
};
