import React, { useState, useEffect, useRef } from "react";
import Fuse from "fuse.js";
import { useSearchContext } from "./context";
import { EnhancedTooltip } from "./EnhancedTooltip";
import { AnimatedButton, InteractiveCard, HoverLift, LoadingSpinner } from "./Microinteractions";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Search, 
  MapPin, 
  Building, 
  User, 
  Filter, 
  X, 
  ChevronDown,
  Check,
  AlertCircle,
  Info,
  Sparkles,
  TrendingUp,
  Target
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const MIN_QUERY_LENGTH = 2;
const MAX_SUGGESTIONS = 8;

// Mock property data for search suggestions
const mockProperties = [
  {
    id: "1",
    address: "123 Main St",
    city: "New York",
    state: "NY",
    zip: "10001"
  },
  {
    id: "2", 
    address: "456 Oak Ave",
    city: "Los Angeles", 
    state: "CA",
    zip: "90210"
  },
  {
    id: "3",
    address: "789 Elm St", 
    city: "Houston",
    state: "TX", 
    zip: "77001"
  },
  {
    id: "4",
    address: "321 Beach Blvd",
    city: "Miami",
    state: "FL",
    zip: "33139"
  },
  {
    id: "5",
    address: "654 Palm Dr",
    city: "Phoenix",
    state: "AZ", 
    zip: "85001"
  }
];

// Quick filter options
const quickFilters = [
  { label: "High Equity", icon: TrendingUp, color: "bg-accent/10 text-accent" },
  { label: "Absentee", icon: User, color: "bg-blue-100 text-blue-700" },
  { label: "Distressed", icon: AlertCircle, color: "bg-destructive/10 text-destructive" },
  { label: "Vacant", icon: Building, color: "bg-yellow-100 text-yellow-700" }
];

const SearchBar: React.FC = () => {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [localData, setLocalData] = useState<any[]>([]);
  const [activeQuickFilter, setActiveQuickFilter] = useState<string | null>(null);
  const fuseRef = useRef<Fuse<any> | null>(null);
  const { dispatch } = useSearchContext();

  // Initialize local data with mock properties for client-side fuzzy search
  useEffect(() => {
    setLocalData(mockProperties);
    fuseRef.current = new Fuse(mockProperties, {
      keys: ["address", "city", "state", "zip"],
      threshold: 0.3,
    });
    console.log('SearchBar: Initialized with mock data for search suggestions');
  }, []);

  // Update suggestions as user types
  useEffect(() => {
    let active = true;
    const getSuggestions = async () => {
      if (query.length < MIN_QUERY_LENGTH) {
        setSuggestions([]);
        return;
      }
      
      // Client-side fuzzy search using Fuse.js
      let localResults: string[] = [];
      if (fuseRef.current) {
        localResults = fuseRef.current
          .search(query)
          .slice(0, MAX_SUGGESTIONS)
          .map((r) => {
            const row = r.item;
            return `${row.address}, ${row.city}, ${row.state} ${row.zip}`;
          });
      }
      
      if (active) setSuggestions(localResults.slice(0, MAX_SUGGESTIONS));
    };
    getSuggestions();
    return () => {
      active = false;
    };
  }, [query]);

  // Handle search trigger (on select or enter)
  const handleSearch = (searchValue: string) => {
    setQuery(searchValue);
    setShowSuggestions(false);
    console.log('SearchBar: Handling search for:', searchValue);
    
    // Parse search value for address, city, zip
    const parts = searchValue.split(",");
    const filters: any = {};
    
    if (parts.length >= 3) {
      // Full address format: "123 Main St, New York, NY 10001"
      filters.address = parts[0].trim();
      const cityStateZip = parts[1].trim().split(" ");
      filters.city = parts[1].trim();
      if (parts[2]) {
        const stateZip = parts[2].trim().split(" ");
        filters.state = stateZip[0];
        if (stateZip[1]) filters.zip = stateZip[1];
      }
    } else if (searchValue.match(/\d{5}/)) {
      // ZIP code format
      filters.zip = searchValue.match(/\d{5}/)[0];
    } else if (searchValue) {
      // Simple search - could be address, city, or state
      const lowerQuery = searchValue.toLowerCase();
      
      // Check if it's a state abbreviation
      const states = ['ny', 'ca', 'tx', 'fl', 'az'];
      if (states.includes(lowerQuery)) {
        filters.state = searchValue.toUpperCase();
      } else {
        // Assume it's a city or address
        filters.city = searchValue;
      }
    }
    
    console.log('SearchBar: Dispatching filters:', filters);
    dispatch({ type: "SET_FILTERS", payload: filters });
    
    // Also trigger the enhanced search for 50-state data
    // This will be handled by the SearchPage component
    dispatch({ type: "SET_SEARCH_TERM", payload: searchValue });
  };

  // Clear search and reset filters
  const clearSearch = () => {
    setQuery("");
    setSuggestions([]);
    setActiveQuickFilter(null);
    console.log('SearchBar: Clearing search and resetting filters');
    dispatch({ type: "SET_FILTERS", payload: {} });
  };

  // Handle quick filter selection
  const handleQuickFilter = (filterLabel: string) => {
    if (activeQuickFilter === filterLabel) {
      setActiveQuickFilter(null);
      dispatch({ type: "SET_FILTERS", payload: {} });
    } else {
      setActiveQuickFilter(filterLabel);
      // Apply quick filter logic
      const filters: any = {};
      switch (filterLabel) {
        case "High Equity":
          filters.equity_percent = 70;
          break;
        case "Absentee":
          filters.owner_type = "absentee";
          break;
        case "Distressed":
          filters.tags = ["distressed"];
          break;
        case "Vacant":
          filters.tags = ["vacant"];
          break;
      }
      dispatch({ type: "SET_FILTERS", payload: filters });
    }
  };

  return (
    <div className="w-full">
      {/* Enhanced Search Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Search className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Find Properties</h2>
          </div>
          <Badge variant="secondary" className="flex items-center gap-1">
            <Sparkles className="h-3 w-3" />
            AI-Powered
          </Badge>
        </div>
        <EnhancedTooltip
          type="help"
          title="Property Search"
          content="Search for properties by address, city, or ZIP code. Use autocomplete for quick suggestions."
        />
      </div>

      {/* Quick Filters */}
      <div className="flex items-center gap-2 mb-4">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Quick Filters:</span>
        {quickFilters.map((filter) => (
          <Badge
            key={filter.label}
            variant={activeQuickFilter === filter.label ? "default" : "outline"}
            className={cn(
              "cursor-pointer hover:scale-105 transition-all duration-200",
              activeQuickFilter === filter.label && filter.color
            )}
            onClick={() => handleQuickFilter(filter.label)}
          >
            <filter.icon className="h-3 w-3 mr-1" />
            {filter.label}
          </Badge>
        ))}
      </div>

      {/* Enhanced Search Input */}
      <div className="relative">
        <div className="relative">
          <input
            type="text"
            className={cn(
              "w-full px-4 py-4 pl-12 pr-12 rounded-xl border-2 transition-all duration-200",
              "bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100",
              "border-gray-300 dark:border-gray-600",
              "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500",
              "placeholder-gray-500 dark:placeholder-gray-400",
              "shadow-sm hover:shadow-md focus:shadow-lg"
            )}
            placeholder="Search by address, city, or ZIP code..."
            value={query}
            onChange={e => {
              setQuery(e.target.value);
              setShowSuggestions(true);
            }}
            onFocus={() => setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
            onKeyDown={e => {
              if (e.key === "Enter" && query.length >= MIN_QUERY_LENGTH) {
                handleSearch(query);
              }
            }}
          />
          
          {/* Search Icon */}
          <div className="absolute left-4 top-1/2 transform -translate-y-1/2">
            <Search className="h-5 w-5 text-gray-400 dark:text-gray-500" />
          </div>

          {/* Clear Button */}
          {query.length > 0 && (
            <motion.button
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              onClick={clearSearch}
              className="absolute right-4 top-1/2 transform -translate-y-1/2 p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <X className="h-4 w-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" />
            </motion.button>
          )}
        </div>

        {/* Enhanced Suggestions Dropdown */}
        <AnimatePresence>
          {showSuggestions && suggestions.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="absolute left-0 right-0 bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-xl shadow-xl z-20 mt-2 max-h-64 overflow-y-auto"
            >
              <div className="p-2">
                <div className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-700">
                  <Info className="h-3 w-3" />
                  <span>Suggestions ({suggestions.length})</span>
                </div>
                {suggestions.map((suggestion, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="flex items-center gap-3 px-3 py-3 cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
                    onMouseDown={() => handleSearch(suggestion)}
                  >
                    <MapPin className="h-4 w-4 text-blue-500 dark:text-blue-400 flex-shrink-0" />
                    <span className="text-sm text-gray-700 dark:text-gray-300">{suggestion}</span>
                    <Check className="h-3 w-3 text-accent ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Enhanced Search Tips */}
      <div className="mt-4 flex items-center gap-6 text-xs text-gray-600 dark:text-gray-400">
        <div className="flex items-center gap-1">
          <Target className="h-3 w-3" />
          <span>Address: "123 Main St"</span>
        </div>
        <div className="flex items-center gap-1">
          <Building className="h-3 w-3" />
          <span>City: "New York"</span>
        </div>
        <div className="flex items-center gap-1">
          <Filter className="h-3 w-3" />
          <span>ZIP: "10001"</span>
        </div>
      </div>

      {/* Enhanced Search Status */}
      {query.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-3 flex items-center gap-2 text-xs"
        >
          {query.length < MIN_QUERY_LENGTH ? (
            <div className="flex items-center gap-1 text-yellow-600 dark:text-yellow-400">
              <AlertCircle className="h-3 w-3" />
              <span>Type at least {MIN_QUERY_LENGTH} characters</span>
            </div>
          ) : (
            <div className="flex items-center gap-1 text-accent dark:text-accent">
              <Check className="h-3 w-3" />
              <span>Ready to search</span>
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
};

export default SearchBar; 