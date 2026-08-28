import { describe, expect, it } from 'vitest';
import { modules } from './constants';

describe('Calendar navigation', () => {
  it('places Calendar directly below Dashboard as a top-level item', () => {
    const dashboardIndex = modules.findIndex(({ id }) => id === 'dashboard');
    const calendarIndex = modules.findIndex(({ id }) => id === 'financial-calendar');

    expect(calendarIndex).toBe(dashboardIndex + 1);
    expect(modules[calendarIndex]).toMatchObject({
      name: 'Calendar',
      navGroup: 'overview',
      category: 'overview',
    });
  });

  it('places Insights at the top of the Planner group', () => {
    const plannerModules = modules.filter(({ navGroup }) => navGroup === 'planner');

    expect(plannerModules[0]).toMatchObject({
      id: 'personal-finance',
      name: 'Insights',
    });
  });
});
