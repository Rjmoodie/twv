import { describe, it, expect, beforeEach, vi } from 'vitest';
import { track, setAnalyticsSink, recentEvents } from './analytics';

describe('analytics', () => {
  beforeEach(() => setAnalyticsSink(null));

  it('is a safe no-op before a sink is installed', () => {
    expect(() => track('journey_started')).not.toThrow();
  });

  it('forwards events and props to the installed sink', () => {
    const sink = vi.fn();
    setAnalyticsSink(sink);
    track('gate_encountered', { module: 'portfolio', tier: 'free' });

    expect(sink).toHaveBeenCalledOnce();
    const [event, props] = sink.mock.calls[0];
    expect(event).toBe('gate_encountered');
    expect(props.module).toBe('portfolio');
    expect(props.session_id).toBeTruthy();
  });

  it('never lets a throwing sink break the calling flow', () => {
    setAnalyticsSink(() => { throw new Error('vendor down'); });
    expect(() => track('moment_shared')).not.toThrow();
  });

  it('keeps a bounded debug buffer', () => {
    for (let i = 0; i < 60; i++) track('calculator_run', { i });
    expect(recentEvents().length).toBeLessThanOrEqual(50);
  });

  it('uses a stable session id across events', () => {
    const sink = vi.fn();
    setAnalyticsSink(sink);
    track('journey_started');
    track('journey_completed');
    const a = sink.mock.calls[0][1].session_id;
    const b = sink.mock.calls[1][1].session_id;
    expect(a).toBe(b);
  });
});
