import { describe, expect, it } from 'vitest'
import { buildJourneyShareText } from './JourneySharePrompt'

describe('Journey Moment share text', () => {
  it('includes a return path only for shareable moments', () => {
    const text = buildJourneyShareText(
      'Debt down 20%',
      'A steady start',
      '18 months to go',
      true,
      'https://somatech.pro/?module=community&moment=abc',
    )

    expect(text).toContain('https://somatech.pro/?module=community&moment=abc')
    expect(text).toContain('18 months to go')
  })

  it('does not expose hidden timeline details when disabled', () => {
    const text = buildJourneyShareText(
      'Debt down 20%',
      'A steady start',
      '18 months to go',
      false,
    )

    expect(text).not.toContain('18 months to go')
    expect(text).not.toContain('moment=')
  })
})
