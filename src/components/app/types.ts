/**
 * Shared shapes used across the app shell.
 *
 * Domain types live next to the feature that owns them -- portfolio types in
 * `portfolio/types.ts`, database rows in `integrations/supabase/types.ts`.
 * This file is only for the few shapes the shell itself passes around.
 */

/** Output of the traditional buy-and-hold calculator. */
export interface RealEstateResult {
  monthlyPayment: number;
  netCashFlow: number;
  cashOnCashReturn: number;
  capRate: number;
  profitable: boolean;
}

/** A navigable feature area, as declared in `constants.ts`. */
export interface Module {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  featured: boolean;
  seo?: {
    title: string;
    description: string;
    keywords: string;
  };
  navGroup?: string;
}

/** The signed-in user's `profiles` row. */
export interface Profile {
  id: string;
  username: string | null;
  email: string | null;
  avatar_url: string | null;
  bio: string | null;
  location: string | null;
  website: string | null;
  theme_preference: string;
  onboarding_completed: boolean;
  profile_completion_score: number;
  two_factor_enabled?: boolean;
  email_verified?: boolean;
}
