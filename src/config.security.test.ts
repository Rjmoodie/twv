import { describe, it, expect } from 'vitest'

import { safePublicConfig } from './config'

describe('public config hygiene', () => {
  it('does not expose api secrets in the browser-safe config', () => {
    expect(safePublicConfig.apis).toEqual({
      alphaVantage: '',
      mapbox: '',
      googleMaps: '',
    })
  })
})
