import { describe, expect, it } from 'vitest';
import { canEnterPortal, getPreferredPortalPath } from './portalRouting';

describe('portal routing', () => {
  it('never lets a client enter the project manager portal', () => {
    expect(canEnterPortal('project_manager', ['client'])).toBe(false);
    expect(getPreferredPortalPath(['client'])).toBe('/client');
  });

  it('allows project managers and administrators into the PM portal', () => {
    expect(canEnterPortal('project_manager', ['project_manager'])).toBe(true);
    expect(canEnterPortal('project_manager', ['admin'])).toBe(true);
  });

  it('keeps client and investor portals role-specific', () => {
    expect(canEnterPortal('client', ['project_manager'])).toBe(false);
    expect(canEnterPortal('investor', ['client'])).toBe(false);
  });

  it('uses the most operational portal for multi-role users', () => {
    expect(getPreferredPortalPath(['client', 'project_manager'])).toBe('/pm');
    expect(getPreferredPortalPath(['client', 'investor'])).toBe('/investor');
  });
});
