/**
 * Thin bridge between any module and the Financial Coach.
 *
 * Usage:
 *   askCoach('My savings rate dropped to 12%. What should I cut?', navigate);
 *
 * The prompt is stored in sessionStorage. When the Coach component mounts
 * (or when the user navigates to it), it reads and fires the prompt automatically.
 */

export const COACH_PREFILL_KEY = 'somatech_coach_prefill';

export function askCoach(prompt: string, onNavigate: (module: string) => void): void {
  sessionStorage.setItem(COACH_PREFILL_KEY, prompt);
  onNavigate('financial-coach');
}

export function consumeCoachPrefill(): string | null {
  const prompt = sessionStorage.getItem(COACH_PREFILL_KEY);
  if (prompt) sessionStorage.removeItem(COACH_PREFILL_KEY);
  return prompt;
}
