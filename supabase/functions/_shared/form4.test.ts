import { describe, expect, it } from 'vitest';
import { classifyForm4Code, closestPriorMarketClose, isSuspectForm4Price, parseForm4DocumentMetadata, parseForm4Xml } from './form4.ts';

const XML = `<?xml version="1.0"?><ownershipDocument><reportingOwner><reportingOwnerId>
<rptOwnerCik>1234</rptOwnerCik><rptOwnerName>DOE JANE</rptOwnerName></reportingOwnerId>
<reportingOwnerRelationship><isDirector>1</isDirector><isOfficer>true</isOfficer><isTenPercentOwner>0</isTenPercentOwner><officerTitle>CFO</officerTitle></reportingOwnerRelationship></reportingOwner>
<nonDerivativeTable><nonDerivativeTransaction><transactionDate><value>2026-08-25</value></transactionDate>
<transactionCoding><transactionCode>P</transactionCode></transactionCoding><transactionAmounts>
<transactionShares><value>1,000</value></transactionShares><transactionPricePerShare><value>42.50</value></transactionPricePerShare>
<transactionAcquiredDisposedCode><value>A</value></transactionAcquiredDisposedCode></transactionAmounts>
<postTransactionAmounts><sharesOwnedFollowingTransaction><value>11000</value></sharesOwnedFollowingTransaction></postTransactionAmounts></nonDerivativeTransaction></nonDerivativeTable></ownershipDocument>`;

describe('Form 4 parser', () => {
  it('distinguishes conviction trades from compensation mechanics', () => {
    expect(['P', 'S', 'A', 'M', 'F', 'G'].map(classifyForm4Code)).toEqual([
      'open_market_purchase', 'open_market_sale', 'grant', 'option_exercise', 'tax_withholding', 'gift',
    ]);
  });

  it('parses identity, relationship and transaction values', () => {
    expect(parseForm4Xml(XML, { close: 40, marketCap: 1_000_000_000 })).toEqual([expect.objectContaining({
      lineIndex: 0, ownerCik: '0000001234', ownerName: 'DOE JANE', officerTitle: 'CFO', isOfficer: true,
      isDirector: true, transactionCode: 'P', classification: 'open_market_purchase', shares: 1000,
      pricePerShare: 42.5, sharesOwnedAfter: 11000, priceSuspect: false,
    })]);
  });

  it('keeps invalid prices detectable instead of dropping ownership rows', () => {
    expect(isSuspectForm4Price(34_800, 51_724, { close: 9, marketCap: 20_000_000 })).toBe(true);
    expect(parseForm4Xml(XML.replace('42.50', '0'))[0].priceSuspect).toBe(true);
  });

  it('uses the nearest prior trading close without reaching into the future', () => {
    const closes = new Map([['2026-08-21', 40], ['2026-08-24', 42]]);
    expect(closestPriorMarketClose(closes, '2026-08-23')).toBe(40);
    expect(closestPriorMarketClose(closes, '2026-08-20')).toBeNull();
  });

  it('emits the transaction for every valid reporting owner', () => {
    const secondOwner = `<reportingOwner><reportingOwnerId><rptOwnerCik>5678</rptOwnerCik><rptOwnerName>DOE JOHN</rptOwnerName></reportingOwnerId><reportingOwnerRelationship><isDirector>1</isDirector></reportingOwnerRelationship></reportingOwner>`;
    const rows = parseForm4Xml(XML.replace('<nonDerivativeTable>', `${secondOwner}<nonDerivativeTable>`));
    expect(rows).toHaveLength(2);
    expect(rows.map(row => row.ownerCik)).toEqual(['0000001234', '0000005678']);
    expect(rows.map(row => row.lineIndex)).toEqual([0, 0]);
    expect(new Set(rows.map(row => row.actorKey))).toEqual(new Set(['0000001234+0000005678']));
    expect(rows.every(row => row.jointFiling)).toBe(true);
  });

  it('resolves referenced filing footnotes when detecting a 10b5-1 plan', () => {
    const withPlan = XML
      .replace('<transactionCoding>', '<transactionCoding><footnoteId id="F1"/>')
      .replace('</ownershipDocument>', '<footnotes><footnote id="F1">Transaction under a Rule 10b5-1 trading plan.</footnote></footnotes></ownershipDocument>');
    expect(parseForm4Xml(withPlan)[0].plan10b51).toBe(true);
  });

  it('rejects a filing without a usable owner CIK instead of inventing one', () => {
    expect(parseForm4Xml(XML.replace('<rptOwnerCik>1234</rptOwnerCik>', '<rptOwnerCik>0</rptOwnerCik>'))).toEqual([]);
    expect(parseForm4Xml(XML.replace('1234', '12x34'))).toEqual([]);
  });

  it('rejects impossible transaction calendar dates', () => {
    expect(parseForm4Xml(XML.replace('2026-08-25', '2026-02-30'))).toEqual([]);
  });

  it('reads structured 10b5-1 and amendment metadata conservatively', () => {
    const amended = XML
      .replace('<ownershipDocument>', '<ownershipDocument><periodOfReport>2026-08-25</periodOfReport><dateOfOriginalSubmission>2026-08-26</dateOfOriginalSubmission><aff10b5One>true</aff10b5One>');
    expect(parseForm4Xml(amended)[0].plan10b51).toBe(true);
    expect(parseForm4DocumentMetadata(amended)).toEqual({
      actorKey: '0000001234',
      jointFiling: false,
      periodOfReport: '2026-08-25',
      originalSubmissionDate: '2026-08-26',
    });
  });
});
