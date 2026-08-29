import { describe, expect, it } from 'vitest';

import { isChunkLoadError } from './lazyWithRetry';

describe('isChunkLoadError', () => {
  it.each([
    'Failed to fetch dynamically imported module: https://app.example.com/js/Workspace-old.js',
    'Importing a module script failed.',
    'error loading dynamically imported module',
    'Unable to preload CSS for /css/PortfolioModule-old.css',
    'Loading chunk 42 failed',
    'Expected a JavaScript-or-Wasm module script but the server responded with a MIME type of "text/html".',
  ])('recognizes a recoverable deployment or network failure: %s', (message) => {
    expect(isChunkLoadError(new TypeError(message))).toBe(true);
  });

  it('recognizes named chunk errors', () => {
    const error = new Error('request failed');
    error.name = 'ChunkLoadError';
    expect(isChunkLoadError(error)).toBe(true);
  });

  it('recognizes Safari import failures without treating every TypeError as a chunk failure', () => {
    expect(isChunkLoadError(new TypeError('Load failed'))).toBe(true);
    expect(isChunkLoadError(new TypeError("Cannot read properties of undefined (reading 'map')"))).toBe(false);
  });

  it('does not misclassify application render errors', () => {
    expect(isChunkLoadError(new Error('usePortfolio must be used inside PortfolioProvider'))).toBe(false);
  });
});
