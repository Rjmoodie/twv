/**
 * expenseCategoryMapper.ts
 *
 * Maps free-text expense names to the MonthlyCashFlow category keys used by
 * the Personal Finance dashboard, charts, and Financial Coach.
 *
 * Also exports parseExpenseFile — shared CSV/text parser used by both
 * MonthlyExpenseForm and ItemizedExpenseInput.
 */

export type ExpenseCategoryKey =
  | 'housing' | 'food' | 'transport' | 'healthcare' | 'entertainment'
  | 'subscriptions' | 'clothing' | 'education' | 'travel' | 'other_expenses';

/** Labels and chart-matched colors — must stay in sync with EXPENSE_CATEGORIES in usePersonalFinance.ts */
export const CATEGORY_META: Record<ExpenseCategoryKey, { label: string; color: string }> = {
  housing:       { label: 'Housing',       color: '#6366f1' },
  food:          { label: 'Food',           color: '#10b981' },
  transport:     { label: 'Transport',      color: '#f59e0b' },
  healthcare:    { label: 'Healthcare',     color: '#ef4444' },
  entertainment: { label: 'Entertainment',  color: '#8b5cf6' },
  subscriptions: { label: 'Subscriptions',  color: '#06b6d4' },
  clothing:      { label: 'Clothing',       color: '#ec4899' },
  education:     { label: 'Education',      color: '#3b82f6' },
  travel:        { label: 'Travel',         color: '#14b8a6' },
  other_expenses:{ label: 'Other',          color: '#9ca3af' },
};

/**
 * Maps an expense item name to its most likely budget category.
 * Rules ordered so the most specific match wins (checked top to bottom).
 * Returns 'other_expenses' when no rule fires.
 */
export function mapExpenseToCategory(name: string): ExpenseCategoryKey {
  const n = name.toLowerCase();

  // ── Housing / utilities ────────────────────────────────────────────────────
  if (/rent|mortgage|lease|electricity|electric bill|power bill|energy bill|gas bill|natural gas|water bill|sewage|utility|utilities|internet|broadband|wifi|wi-fi|phone bill|mobile plan|cell plan|sim plan|council tax|strata|hoa|body corporate|home insurance|renters insurance|renter.?s insurance|contents insurance|home maintenance|repair|plumber|handyman/.test(n)) return 'housing';

  // ── Food / dining ──────────────────────────────────────────────────────────
  if (/grocer|supermarket|walmart|target|kroger|safeway|aldi|lidl|whole foods|trader joe|costco|tesco|sainsbury|waitrose|coles|woolworth|restaurant|dining|takeout|takeaway|doordash|uber eats|grubhub|just eat|deliveroo|menulog|door dash|food delivery|meal kit|hello fresh|marley spoon|cafe|coffee|starbucks|barista|bakery|butcher|deli|sushi|pizza|burger|mcdonalds|kfc|subway|chipotle|lunch|dinner|breakfast|brunch/.test(n)) return 'food';

  // ── Transport ──────────────────────────────────────────────────────────────
  if (/petrol|gasoline|gas station|fuel|shell|bp |caltex|mobil|car insurance|car payment|auto loan|auto insurance|vehicle insurance|registration|rego|parking|toll|e-toll|uber(?! eats)|lyft|taxi|rideshare|bus pass|train|metro|subway|transit|commute|opal|myki|car service|mechanic|tyre|tire|roadside/.test(n)) return 'transport';

  // ── Healthcare ─────────────────────────────────────────────────────────────
  if (/doctor|gp |physician|medical|pharmacy|chemist|prescription|medication|dental|dentist|orthodont|optician|optometrist|eye care|vision|hospital|clinic|physio|physiotherap|chiropract|osteopath|health insurance|private health|medibank|bupa|ahm|nib |therapy|therapist|psychologist|counsell|gym|fitness|personal trainer|pilates|yoga|exercise|health club|crossfit|anytime fitness/.test(n)) return 'healthcare';

  // ── Streaming / entertainment ──────────────────────────────────────────────
  if (/netflix|disney\+|disney plus|hulu|hbo|binge|stan |apple tv|foxtel|kayo|prime video|amazon video|paramount\+|peacock|youtube premium|twitch|crunchyroll|movie|cinema|theatre|theater|concert|festival|event ticket|gaming|steam|xbox|playstation|nintendo|epic games|gog\.com/.test(n)) return 'entertainment';

  // ── Subscriptions / software ───────────────────────────────────────────────
  if (/spotify|apple music|tidal|deezer|amazon prime|microsoft 365|office 365|adobe|creative cloud|google one|google workspace|dropbox|notion|slack|zoom|1password|lastpass|nord vpn|expressvpn|antivirus|norton|mcafee|subscription|membership|annual fee|recurring/.test(n)) return 'subscriptions';

  // ── Clothing / fashion ─────────────────────────────────────────────────────
  if (/cloth|fashion|shoe|sneaker|apparel|outfit|dress|shirt|pants|jeans|jacket|coat|wardrobe|zara|h&m|uniqlo|asos|cotton on|country road|myer|david jones/.test(n)) return 'clothing';

  // ── Education ──────────────────────────────────────────────────────────────
  if (/tuition|school|university|college|tafe|course|class|textbook|textbooks|udemy|coursera|skillshare|linkedin learn|pluralsight|training|workshop|lesson|tutoring|student loan|hecs|help debt/.test(n)) return 'education';

  // ── Travel ─────────────────────────────────────────────────────────────────
  if (/flight|airline|qantas|jetstar|virgin|rex air|emirates|british airways|hotel|motel|airbnb|vrbo|stayz|booking\.com|expedia|agoda|vacation|holiday|trip|travel insurance|luggage|suitcase|passport|visa fee/.test(n)) return 'travel';

  return 'other_expenses';
}

// ── Shared CSV / text file parser ─────────────────────────────────────────────

export interface ParsedExpenseItem {
  id:     string;
  name:   string;
  amount: number;
}

let _parseUid = 0;
const parseUid = () => `parsed_${++_parseUid}`;

/** True for strings that look like a date token in any common format. */
function isDateToken(s: string): boolean {
  return (
    /^\d{4}[-/]\d{2}([-/]\d{2})?$/.test(s) ||          // ISO: 2024-05-15 / 2024-05
    /^\d{1,2}[-/]\d{1,2}([-/]\d{2,4})?$/.test(s) ||    // MM/DD or DD/MM/YYYY
    /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/i.test(s) // Month name
  );
}

/**
 * Parses a CSV or plain-text file into expense items.
 *
 * Handles:
 *   - Two-column CSV: "name, amount"
 *   - Bank statement CSV: "date, description, amount, balance" (rightmost positive number = amount)
 *   - Tab-separated or multi-space: "name   amount"
 *
 * Skips header rows and lines with no extractable positive amount.
 * Capped at 60 items.
 */
export function parseExpenseFile(text: string): ParsedExpenseItem[] {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const items: ParsedExpenseItem[] = [];
  const headerPattern = /^(date|description|amount|category|name|balance|debit|credit|type|memo|ref|transaction)/i;
  const amountPattern = /^\$?-?[\d,]+\.?\d{0,2}$/;

  for (const line of lines) {
    if (headerPattern.test(line)) continue;

    const cols = line.split(',').map(c => c.replace(/"/g, '').trim());

    let amount = 0;
    let nameparts: string[] = [];

    // Scan right-to-left for the rightmost positive money-like column
    for (let i = cols.length - 1; i >= 0; i--) {
      if (amountPattern.test(cols[i])) {
        const val = parseFloat(cols[i].replace(/[$,]/g, ''));
        if (!isNaN(val) && val > 0) {
          amount     = Math.round(val * 100) / 100;
          nameparts  = cols.slice(0, i).filter(c => !isDateToken(c));
          break;
        }
      }
    }

    // Fallback: tab or multi-space separated
    if (!amount) {
      const parts = line.split(/\t|\s{3,}/).map(p => p.trim()).filter(Boolean);
      for (let i = parts.length - 1; i >= 0; i--) {
        const val = parseFloat(parts[i].replace(/[$,]/g, ''));
        if (!isNaN(val) && val > 0 && /\d/.test(parts[i])) {
          amount    = Math.round(val * 100) / 100;
          nameparts = parts.slice(0, i).filter(p => !isDateToken(p));
          break;
        }
      }
    }

    const name = nameparts.join(' ').replace(/\s+/g, ' ').trim();
    if (amount > 0 && name.length >= 2 && name.length <= 100 && !isDateToken(name)) {
      items.push({ id: parseUid(), name, amount });
    }
  }

  return items.slice(0, 60);
}
