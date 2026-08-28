import { describe, expect, it } from 'vitest';
import {
  businessClassLabel,
  classifyFiler,
  classifySic,
  normalizeSic,
} from '../../../supabase/functions/_shared/sicClassification';

describe('normalizeSic', () => {
  it('accepts a code as a string or a number', () => {
    expect(normalizeSic('6021')).toBe(6021);
    expect(normalizeSic(6021)).toBe(6021);
  });

  it('trims surrounding whitespace rather than rejecting the code', () => {
    expect(normalizeSic('  6798 ')).toBe(6798);
  });

  it('treats absent and empty values as unusable', () => {
    expect(normalizeSic(null)).toBeNull();
    expect(normalizeSic(undefined)).toBeNull();
    expect(normalizeSic('')).toBeNull();
    expect(normalizeSic('   ')).toBeNull();
  });

  it('refuses anything that is not purely digits, rather than parsing a prefix', () => {
    // parseInt would happily return 6021 for all of these and misclassify the filer.
    expect(normalizeSic('6021-A')).toBeNull();
    expect(normalizeSic('6021x')).toBeNull();
    expect(normalizeSic('N/A')).toBeNull();
    expect(normalizeSic('-6021')).toBeNull();
    expect(normalizeSic('60.21')).toBeNull();
  });

  it('rejects codes outside any plausible SIC range', () => {
    expect(normalizeSic('0')).toBeNull();
    expect(normalizeSic('99')).toBeNull();
    expect(normalizeSic('10000')).toBeNull();
  });

  it('keeps short legacy codes that are still in range', () => {
    expect(normalizeSic('100')).toBe(100);
  });
});

describe('classifySic', () => {
  it('classifies real filers from their actual EDGAR codes', () => {
    expect(classifySic('6021')).toBe('bank');          // JPMorgan, national commercial banks
    expect(classifySic('6798')).toBe('reit');          // Prologis, American Tower
    expect(classifySic('6211')).toBe('financial-other'); // Goldman Sachs, security brokers
    expect(classifySic('6311')).toBe('insurer');       // life insurance
    expect(classifySic('3674')).toBe('general');       // Intel, NVIDIA, semiconductors
    expect(classifySic('7372')).toBe('general');       // Microsoft, prepackaged software
    expect(classifySic('2911')).toBe('general');       // Exxon, petroleum refining
  });

  it('puts REITs in their own class rather than with holding companies', () => {
    // 6798 sits inside the 6700s but depreciation dominates a REIT's income
    // statement, so it must not inherit the generic financial treatment.
    expect(classifySic('6798')).toBe('reit');
    expect(classifySic('6770')).toBe('financial-other');
    expect(classifySic('6799')).toBe('financial-other');
  });

  it('holds at every range boundary', () => {
    expect(classifySic('5999')).toBe('general');
    expect(classifySic('6000')).toBe('bank');
    expect(classifySic('6199')).toBe('bank');
    expect(classifySic('6200')).toBe('financial-other');
    expect(classifySic('6299')).toBe('financial-other');
    expect(classifySic('6300')).toBe('insurer');
    expect(classifySic('6399')).toBe('insurer');
    expect(classifySic('6400')).toBe('general');
    expect(classifySic('6411')).toBe('general');
    expect(classifySic('6499')).toBe('general');
    expect(classifySic('6399')).toBe('insurer');
    expect(classifySic('6400')).toBe('general');
    expect(classifySic('6411')).toBe('general');
    expect(classifySic('6500')).toBe('general');
    expect(classifySic('6599')).toBe('general');
    expect(classifySic('6600')).toBe('general');
    expect(classifySic('6700')).toBe('financial-other');
    expect(classifySic('6799')).toBe('financial-other');
    expect(classifySic('6800')).toBe('general');
  });

  it('falls back to an operating company when the code is unusable', () => {
    // The fallback must be the permissive class: an unknown filer should get the
    // full ladder, not be locked to book value by a missing code.
    expect(classifySic(null)).toBe('general');
    expect(classifySic('')).toBe('general');
    expect(classifySic('nonsense')).toBe('general');
  });
});

describe('classifyFiler', () => {
  it('returns the normalised code, description and class together', () => {
    expect(classifyFiler(' 6021 ', ' National Commercial Banks ')).toEqual({
      sic: '6021', description: 'National Commercial Banks', businessClass: 'bank',
    });
  });

  it('nulls an unusable code without discarding a usable description', () => {
    expect(classifyFiler('N/A', 'Semiconductors')).toEqual({
      sic: null, description: 'Semiconductors', businessClass: 'general',
    });
  });

  it('nulls an empty description rather than carrying whitespace', () => {
    expect(classifyFiler('3674', '   ').description).toBeNull();
    expect(classifyFiler('3674', undefined).description).toBeNull();
  });
});

describe('businessClassLabel', () => {
  it('reads as a phrase that can be dropped into a sentence', () => {
    expect(businessClassLabel('bank')).toBe('a bank or credit institution');
    expect(businessClassLabel('reit')).toBe('a real estate investment trust');
    expect(businessClassLabel('general')).toBe('an operating company');
  });
});
