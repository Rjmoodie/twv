import { describe, expect, it } from 'vitest';
import { is13FInformationTable, normalizeSecAcceptanceTimestamp, parseForm13FInformationTable } from './form13f.ts';

const XML = `<?xml version="1.0"?><informationTable xmlns="http://www.sec.gov/edgar/document/thirteenf/informationtable">
<infoTable><nameOfIssuer>APPLE INC</nameOfIssuer><titleOfClass>COM</titleOfClass><cusip>037833100</cusip>
<figi>BBG000B9XRY4</figi><value>67200000000</value><shrsOrPrnAmt><sshPrnamt>300000000</sshPrnamt><sshPrnamtType>SH</sshPrnamtType></shrsOrPrnAmt>
<investmentDiscretion>DFND</investmentDiscretion><votingAuthority><Sole>300000000</Sole><Shared>0</Shared><None>0</None></votingAuthority></infoTable>
<infoTable><nameOfIssuer>SPDR S&amp;P 500 ETF TR</nameOfIssuer><titleOfClass>PUT</titleOfClass><cusip>78462F103</cusip>
<value>1250000</value><shrsOrPrnAmt><sshPrnamt>5000</sshPrnamt><sshPrnamtType>SH</sshPrnamtType></shrsOrPrnAmt><putCall>PUT</putCall>
<votingAuthority><Sole>0</Sole><Shared>0</Shared><None>5000</None></votingAuthority></infoTable></informationTable>`;

describe('Form 13F information table parser', () => {
  it('recognizes and parses namespaced current-format holdings', () => {
    expect(is13FInformationTable(XML)).toBe(true);
    expect(parseForm13FInformationTable(XML)).toEqual([
      expect.objectContaining({ lineIndex: 0, issuerName: 'APPLE INC', cusip: '037833100', figi: 'BBG000B9XRY4', valueUsd: 67_200_000_000, sharesOrPrincipal: 300_000_000, putCall: null, votingSole: 300_000_000 }),
      expect.objectContaining({ lineIndex: 1, issuerName: 'SPDR S&P 500 ETF TR', cusip: '78462F103', putCall: 'PUT', votingNone: 5000 }),
    ]);
  });

  it('drops malformed rows rather than inventing identifiers or values', () => {
    expect(parseForm13FInformationTable(XML.replace('037833100', 'bad').replace('78462F103', 'bad'))).toEqual([]);
  });

  it('normalizes compact SEC acceptance timestamps and fails closed to the filing date', () => {
    expect(normalizeSecAcceptanceTimestamp('20260827142359', '2026-08-27')).toBe('2026-08-27T14:23:59.000Z');
    expect(normalizeSecAcceptanceTimestamp('20260230142359', '2026-02-27')).toBe('2026-02-27T00:00:00Z');
    expect(normalizeSecAcceptanceTimestamp('not-a-date', '2026-08-27')).toBe('2026-08-27T00:00:00Z');
  });
});
