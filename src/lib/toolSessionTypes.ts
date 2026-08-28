/**
 * Types for tool sessions — structured captures of what users model in planning tools.
 * Sessions are stored in Supabase and injected into the Financial Coach system prompt
 * so the Coach can give advice grounded in what the user has actually been working on.
 */

export type ToolId =
  | 'retirement-planning'
  | 'real-estate'
  | 'business-valuation'
  | 'dcf-analysis'
  | 'stock-analysis';

export interface ToolSession {
  tool:        ToolId;
  /** Plain-English 2-3 sentence summary — this is exactly what the Coach reads. */
  summary:     string;
  /** Key numeric/string outputs for potential structured display. */
  key_outputs: Record<string, number | string>;
}

/** A session that has been persisted (has id + timestamps). */
export interface StoredSession extends ToolSession {
  id:         string;
  user_id:    string;
  created_at: string;
}
