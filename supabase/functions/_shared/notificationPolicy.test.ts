import { describe, expect, it } from 'vitest';
import {
  planEmail,
  planInApp,
  planPush,
  policyFor,
  type ChannelPolicy,
  type EmailPlanInput,
} from './notificationPolicy.ts';

const policy = (overrides: Partial<ChannelPolicy> = {}): ChannelPolicy => ({
  event_type: 'test_event',
  importance: 'time_sensitive',
  push_mode: 'preference',
  email_mode: 'fallback',
  email_variant: 'transactional',
  email_preference_key: 'updates_enabled',
  rate_limit_key: null,
  rate_window_minutes: null,
  max_pushes_per_window: null,
  ...overrides,
});

const emailInput = (overrides: Partial<EmailPlanInput> = {}): EmailPlanInput => ({
  policy: policy(),
  requestedChannels: ['in_app', 'email', 'push'],
  devicePreferences: null,
  hasPushSubscription: true,
  preferences: null,
  suppressed: false,
  hasAddress: true,
  pushDelivered: false,
  ...overrides,
});

describe('policyFor', () => {
  it('refuses to mail anyone for an event type that has no policy row', () => {
    const resolved = policyFor('brand_new_event', null);
    expect(resolved.email_mode).toBe('none');
    expect(resolved.push_mode).toBe('none');
  });
});

describe('planEmail', () => {
  it('sends when push did not land for a fallback event', () => {
    expect(planEmail(emailInput({ pushDelivered: false }))).toEqual({ send: true, variant: 'transactional' });
  });

  it('does not double-notify when push already landed', () => {
    expect(planEmail(emailInput({ pushDelivered: true }))).toEqual({ send: false, reason: 'push_delivered' });
  });

  it('treats push never attempted as push not landed', () => {
    expect(planEmail(emailInput({ pushDelivered: null }))).toEqual({ send: true, variant: 'transactional' });
  });

  it('sends required mail even when the caller did not ask for the email channel', () => {
    const decision = planEmail(emailInput({
      policy: policy({ email_mode: 'required', importance: 'critical' }),
      requestedChannels: ['in_app'],
    }));
    expect(decision).toEqual({ send: true, variant: 'transactional' });
  });

  it('sends required mail even when the user turned the category off', () => {
    const decision = planEmail(emailInput({
      policy: policy({ email_mode: 'required' }),
      preferences: { updates_enabled: false, unsubscribed: true },
    }));
    expect(decision).toEqual({ send: true, variant: 'transactional' });
  });

  it('never sends to a suppressed address, not even required mail', () => {
    const decision = planEmail(emailInput({
      policy: policy({ email_mode: 'required', importance: 'critical' }),
      suppressed: true,
    }));
    expect(decision).toEqual({ send: false, reason: 'suppressed' });
  });

  it('sends an on-request event even when push landed, because the user chose email', () => {
    const decision = planEmail(emailInput({
      policy: policy({ email_mode: 'on_request', email_preference_key: 'reminders_enabled' }),
      requestedChannels: ['in_app', 'email'],
      pushDelivered: true,
    }));
    expect(decision).toEqual({ send: true, variant: 'transactional' });
  });

  it('does not send an on-request event the user did not ask for', () => {
    const decision = planEmail(emailInput({
      policy: policy({ email_mode: 'on_request', email_preference_key: 'reminders_enabled' }),
      requestedChannels: ['in_app'],
    }));
    expect(decision).toEqual({ send: false, reason: 'not_requested' });
  });

  it('holds digest events back from immediate delivery', () => {
    expect(planEmail(emailInput({ policy: policy({ email_mode: 'digest' }) })))
      .toEqual({ send: false, reason: 'deferred_to_digest' });
  });

  it('never emails a push-only event', () => {
    expect(planEmail(emailInput({ policy: policy({ email_mode: 'none' }) })))
      .toEqual({ send: false, reason: 'policy_none' });
  });

  it('treats a global unsubscribe as a marketing opt-out, not a receipt opt-out', () => {
    const marketing = planEmail(emailInput({
      policy: policy({ email_variant: 'marketing', email_preference_key: 'marketing_enabled', email_mode: 'fallback' }),
      preferences: { unsubscribed: true, marketing_enabled: true },
    }));
    expect(marketing).toEqual({ send: false, reason: 'unsubscribed' });

    const transactional = planEmail(emailInput({ preferences: { unsubscribed: true } }));
    expect(transactional).toEqual({ send: true, variant: 'transactional' });
  });

  it('treats marketing as opt-in when the user has no preference row', () => {
    const decision = planEmail(emailInput({
      policy: policy({ email_variant: 'marketing', email_preference_key: 'marketing_enabled' }),
      preferences: null,
    }));
    expect(decision).toEqual({ send: false, reason: 'preference_off' });
  });

  it('treats ordinary categories as opt-out when the user has no preference row', () => {
    expect(planEmail(emailInput({ preferences: null }))).toEqual({ send: true, variant: 'transactional' });
  });

  it('still honours the legacy system_settings email toggle', () => {
    expect(planEmail(emailInput({ devicePreferences: { email: false } })))
      .toEqual({ send: false, reason: 'preference_off' });
  });

  it('skips a user with no address on file', () => {
    expect(planEmail(emailInput({ hasAddress: false }))).toEqual({ send: false, reason: 'no_address' });
  });
});

describe('planPush', () => {
  it('sends required push regardless of the toggle', () => {
    expect(planPush({
      policy: policy({ push_mode: 'required' }),
      requestedChannels: ['in_app'],
      devicePreferences: { push: false },
      hasPushSubscription: true,
    })).toBe(true);
  });

  it('respects the toggle for preference-mode push', () => {
    expect(planPush({
      policy: policy({ push_mode: 'preference' }),
      requestedChannels: ['push'],
      devicePreferences: { push: false },
      hasPushSubscription: true,
    })).toBe(false);
  });

  it('does not attempt push without a subscription', () => {
    expect(planPush({
      policy: policy({ push_mode: 'required' }),
      requestedChannels: ['push'],
      devicePreferences: null,
      hasPushSubscription: false,
    })).toBe(false);
  });
});

describe('planInApp', () => {
  it('cannot be suppressed for a critical event', () => {
    expect(planInApp({
      policy: policy({ importance: 'critical' }),
      requestedChannels: ['in_app'],
      devicePreferences: { in_app: false },
      hasPushSubscription: false,
    })).toBe(true);
  });

  it('respects the toggle otherwise', () => {
    expect(planInApp({
      policy: policy(),
      requestedChannels: ['in_app'],
      devicePreferences: { in_app: false },
      hasPushSubscription: false,
    })).toBe(false);
  });
});
