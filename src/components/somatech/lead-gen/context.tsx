import React, { createContext, useContext, useReducer, ReactNode, Dispatch, useEffect } from "react";
import { SearchState, SearchAction, FilterState, Property, OwnerType, AdvancedFilterState } from "./types";
import { usePropertyLeads, PropertyLead } from "./usePropertyLeads";

const initialState: SearchState = {
  area: undefined,
  filters: {},
  advancedFilters: undefined, // New: advanced filter state
  results: [],
  loading: false,
  error: undefined,
  selectedPropertyId: undefined,
  page: 1,
  pageSize: 20,
  totalResults: 0,
};

function searchReducer(state: SearchState, action: SearchAction): SearchState {
  switch (action.type) {
    case "SET_FILTERS":
      return { ...state, filters: action.payload };
    case "SET_ADVANCED_FILTERS":
      return { ...state, advancedFilters: action.payload };
    case "SET_AREA":
      return { ...state, area: action.payload };
    case "SET_RESULTS":
      return { ...state, results: action.payload.results, totalResults: action.payload.total };
    case "SET_LOADING":
      return { ...state, loading: action.payload };
    case "SET_ERROR":
      return { ...state, error: action.payload };
    case "SELECT_PROPERTY":
      return { ...state, selectedPropertyId: action.payload };
    case "SET_PAGE":
      return { ...state, page: action.payload };
    case "SET_PAGE_SIZE":
      return { ...state, pageSize: action.payload };
    case "SET_SEARCH_TERM":
      return { ...state, searchTerm: action.payload };
    case "SET_PROPERTIES":
      return { ...state, results: action.payload, totalResults: action.payload.length };
    default:
      return state;
  }
}

interface SearchContextType {
  state: SearchState;
  dispatch: Dispatch<SearchAction>;
}

// Use null as the default value for type safety
export const SearchContext = createContext<SearchContextType | null>(null);

// Utility to flatten FilterState to PropertyLead-compatible filters
function flattenFilters(filters: FilterState): Partial<PropertyLead> {
  const result: Partial<PropertyLead> = {};
  Object.entries(filters).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      if (value.length > 0) result[key] = value[0]; // Only use first value for now
    } else if (value !== undefined && value !== null && value !== "") {
      result[key] = value;
    }
  });
  return result;
}

// Utility: Convert AdvancedFilterGroup to Supabase filter string (for .or()/.and())
function buildSupabaseFilter(group) {
  // Helper to convert a single condition to Supabase string
  function condToStr(cond) {
    if (!cond.field || !cond.operator) return '';
    // Map UI operator to Supabase
    const opMap = {
      '=': 'eq',
      '!=': 'neq',
      '>': 'gt',
      '>=': 'gte',
      '<': 'lt',
      '<=': 'lte',
      'contains': 'ilike',
      'in': 'in',
      'not in': 'not.in',
    };
    const op = opMap[cond.operator] || 'eq';
    let val = cond.value;
    if (op === 'ilike') val = `%${val}%`;
    if (op === 'in' || op === 'not.in') val = `(${Array.isArray(val) ? val.join(',') : val})`;
    return `${cond.field}.${op}.${val}`;
  }
  // Recursive
  const result = '';
  let logic = 'and';
  const buffer = [];
  for (let i = 0; i < group.length; i++) {
    const item = group[i];
    if (item === 'AND' || item === 'OR') {
      logic = item.toLowerCase();
    } else if (Array.isArray(item)) {
      const sub = buildSupabaseFilter(item);
      if (sub) buffer.push(sub);
    } else if (item && typeof item === 'object') {
      const str = condToStr(item);
      if (str) buffer.push(str);
    }
  }
  if (buffer.length === 0) return '';
  if (buffer.length === 1) return buffer[0];
  // Compose as logic(buffer)
  return `${logic}(${buffer.join(',')})`;
}

// Utility to flatten AdvancedFilterState to PropertyLead-compatible filters
function flattenAdvancedFilters(advancedFilters: AdvancedFilterState | undefined): Partial<PropertyLead> | undefined {
  if (!advancedFilters || !advancedFilters.conditions.length) return undefined;
  const filterString = buildSupabaseFilter(advancedFilters.conditions);
  if (!filterString) return undefined;
  // Return as a special key for usePropertyLeads to interpret
  return { _supabaseFilter: filterString };
}

// Utility to map PropertyLead to Property
function mapLeadsToProperties(leads: PropertyLead[]): Property[] {
  return leads.map(lead => ({
    ...lead,
    owner_type: lead.owner_type as OwnerType,
    // Add more field conversions if needed
  }));
}

// Inline tests for buildSupabaseFilter and flattenAdvancedFilters
function testBuildSupabaseFilter() {
  const single = [{ field: 'status', operator: '=', value: 'active' }];
  const andFlat = [
    { field: 'status', operator: '=', value: 'active' },
    'AND',
    { field: 'bedrooms', operator: '>', value: 2 }
  ];
  const orFlat = [
    { field: 'status', operator: '=', value: 'active' },
    'OR',
    { field: 'bedrooms', operator: '>', value: 2 }
  ];
  const nested = [
    { field: 'status', operator: '=', value: 'active' },
    'AND',
    [
      { field: 'bedrooms', operator: '>', value: 2 },
      'OR',
      { field: 'bathrooms', operator: '>', value: 2 }
    ]
  ];
  const empty = [];
  console.log('Test single:', buildSupabaseFilter(single));
  console.log('Test AND flat:', buildSupabaseFilter(andFlat));
  console.log('Test OR flat:', buildSupabaseFilter(orFlat));
  console.log('Test nested:', buildSupabaseFilter(nested));
  console.log('Test empty:', buildSupabaseFilter(empty));
}
    if (typeof window !== 'undefined' && import.meta.env.MODE !== 'production') {
  testBuildSupabaseFilter();
}

export const SearchContextProvider = ({ children }: { children: ReactNode }) => {
  const [state, dispatch] = useReducer(searchReducer, initialState);

  // Use advancedFilters if present, otherwise fall back to legacy filters
  const activeFilters = state.advancedFilters && state.advancedFilters.conditions.length > 0
    ? flattenAdvancedFilters(state.advancedFilters)
    : flattenFilters(state.filters);

  // Include search term in filters if present
  const finalFilters = state.searchTerm 
    ? { ...activeFilters, searchText: state.searchTerm }
    : activeFilters;

  console.log('SearchContextProvider: state.searchTerm:', state.searchTerm);
  console.log('SearchContextProvider: activeFilters:', activeFilters);
  console.log('SearchContextProvider: finalFilters:', finalFilters);

  const { data: properties, isLoading, error } = usePropertyLeads(finalFilters);

  // Sync query results to global state
  useEffect(() => {
    console.log('SearchContextProvider: properties updated', properties);
    if (properties) {
      const mappedProperties = mapLeadsToProperties(properties);
      console.log('SearchContextProvider: mapped properties', mappedProperties);
      dispatch({ 
        type: "SET_RESULTS", 
        payload: { 
          results: mappedProperties,
          total: properties.length 
        } 
      });
    }
    console.log('SearchContextProvider: loading state', isLoading);
    dispatch({ type: "SET_LOADING", payload: isLoading });
    if (error) {
      console.error('SearchContextProvider: error', error);
      dispatch({ type: "SET_ERROR", payload: error.message });
    }
  }, [properties, isLoading, error]);

  return (
    <SearchContext.Provider value={{ state, dispatch }}>
      {children}
    </SearchContext.Provider>
  );
};

export function useSearchContext() {
  const context = useContext(SearchContext);
  if (!context) {
    throw new Error("useSearchContext must be used within a SearchContextProvider");
  }
  return context;
} 