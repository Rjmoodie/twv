import { describe, expect, it } from 'vitest';
import { altFromCaption, captionFromFileName } from './portfolioImages';

describe('portfolio photo captions', () => {
  it('drops the address the entry title already carries', () => {
    expect(captionFromFileName('1531 S Ringgold St Kitchen.jpg', '1531 S Ringgold St')).toBe('Kitchen');
    expect(captionFromFileName('5006 Market St Duplex Conversion Facade Before.jpg', '5006 Market St')).toBe('Duplex Conversion Facade Before');
  });

  it('keeps the whole name when the title shares nothing with it', () => {
    expect(captionFromFileName('Rear Exterior After.jpg', '2603 Manton St')).toBe('Rear Exterior After');
  });

  it('never returns an empty caption when the title consumes every word', () => {
    expect(captionFromFileName('619 N Jackson St.jpg', '619 N Jackson St')).toBe('619 N Jackson St');
  });

  it('normalises separators and extensions', () => {
    expect(captionFromFileName('kitchen_after-final.JPEG')).toBe('Kitchen after final');
  });

  it('builds alt text that reads as a description, not a filename', () => {
    expect(altFromCaption('Facade Before', '5006 Market St')).toBe('Facade at 5006 Market St');
    expect(altFromCaption('Before', '2603 Manton St')).toBe('2603 Manton St');
  });
});
