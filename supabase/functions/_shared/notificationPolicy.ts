/**
 * Whether an event reaches someone by in-app, push, email, all three, or none
 * is a row in notification_channel_policies -- not a branch in the dispatch
 * worker. Adding a notification type means inserting a row. The dispatcher
 * never learns a new `if`.
 *
 * This module holds the pure resolution logic so it can be tested without a
 * database, a provider, or a network.
 */

import type { EmailVariant } from './email-brand.ts';

export type Importance = 'critical' | 'transactional' | 'time_sensitive' | 'activity';

/** How push behaves for this event. */
export type PushMode =
  | 'required'      // send whenever a subscription exists; preferences cannot suppress
  | 'preference'    // send unless the user turned push off
  | 'rate_limited'  // send subject to the shared per-key window
  | 'none';

/** How email behaves for this event. */
export type EmailMode =
  | 'required'    // always sends; preference toggles cannot suppress it
  | 'on_request'  // sends when the caller asked for it, honouring preferences.
                  // For events where the channel list is the user's own choice
                  // -- a reminder they configured -- their choice is the policy.
  | 'fallback'    // sends only if push did not land, so an active app user is not double-notified
  | 'digest'      // never immediate; rolls into a periodic summary
  | 'none';       // push/in-app only by design; email would be noise

/** Which column of user_email_preferences governs this event. */
export type PreferenceKey =
  | 'transactional_enabled'
  | 'reminders_enabled'
  | 'updates_enabled'
  | 'marketing_enabled'
  | 'digest_enabled';

export interface ChannelPolicy {
  event_type: string;
  importance: Importance;
  push_mode: PushMode;
  email_mode: EmailMode;
  email_variant: EmailVariant;
  email_preference_key: PreferenceKey;
  rate_limit_key: string | null;
  rate_window_minutes: number | null;
  max_pushes_per_window: number | null;
}

export interface EmailPreferences {
  transactional_enabled?: boolean | null;
  reminders_enabled?: boolean | null;
  updates_enabled?: boolean | null;
  marketing_enabled?: boolean | null;
  digest_enabled?: boolean | null;
  unsubscribed?: boolean | null;
}

/**
 * An event type with no policy row must not be able to mail anyone. Silence is
 * a recoverable bug; an unregistered type that reaches every inbox is not.
 */
export const UNREGISTERED_EVENT_POLICY: Omit<ChannelPolicy, 'event_type'> = {
  importance: 'activity',
  push_mode: 'none',
  email_mode: 'none',
  email_variant: 'transactional',
  email_preference_key: 'updates_enabled',
  rate_limit_key: null,
  rate_window_minutes: null,
  max_pushes_per_window: null,
};

export function policyFor(event_type: string, row: ChannelPolicy | null | undefined): ChannelPolicy {
  return row ?? { event_type, ...UNREGISTERED_EVENT_POLICY };
}

export interface ChannelPlanInput {
  policy: ChannelPolicy;
  /** The channels the enqueueing caller asked for. */
  requestedChannels: string[];
  /** Legacy per-user toggles held in system_settings.notification_preferences. */
  devicePreferences?: Record<string, boolean> | null;
  hasPushSubscription: boolean;
}

export function planInApp(input: ChannelPlanInput): boolean {
  if (!input.requestedChannels.includes('in_app')) return false;
  if (input.policy.importance === 'critical') return true;
  return input.devicePreferences?.in_app !== false;
}

export function planPush(input: ChannelPlanInput): boolean {
  const { policy } = input;
  if (policy.push_mode === 'none') return false;
  if (!input.hasPushSubscription) return false;
  if (!input.requestedChannels.includes('push') && policy.push_mode !== 'required') return false;
  if (policy.push_mode === 'required') return true;
  return input.devicePreferences?.push !== false;
}

export type EmailSkipReason =
  | 'not_requested'
  | 'suppressed'
  | 'no_address'
  | 'policy_none'
  | 'deferred_to_digest'
  | 'push_delivered'
  | 'unsubscribed'
  | 'preference_off';

export type EmailDecision =
  | { send: true; variant: EmailVariant }
  | { send: false; reason: EmailSkipReason };

export interface EmailPlanInput extends ChannelPlanInput {
  preferences: EmailPreferences | null | undefined;
  /** True when the address is on the bounce/complaint suppression list. */
  suppressed: boolean;
  hasAddress: boolean;
  /**
   * Whether push actually landed. `null` when push was never attempted, which
   * a fallback event must treat as "push did not land".
   */
  pushDelivered: boolean | null;
}

export function planEmail(input: EmailPlanInput): EmailDecision {
  const { policy, preferences } = input;
  const required = policy.email_mode === 'required';

  // Suppression outranks everything, including `required`. Mail to an address
  // that hard-bounced cannot arrive, and retrying it only burns sender
  // reputation for the messages that could.
  if (input.suppressed) return { send: false, reason: 'suppressed' };
  if (!input.hasAddress) return { send: false, reason: 'no_address' };

  if (policy.email_mode === 'none') return { send: false, reason: 'policy_none' };
  if (policy.email_mode === 'digest') return { send: false, reason: 'deferred_to_digest' };

  // `required` mail is sent even when the caller forgot to name the channel:
  // that is what makes it required.
  if (!required && !input.requestedChannels.includes('email')) {
    return { send: false, reason: 'not_requested' };
  }

  if (policy.email_mode === 'fallback' && input.pushDelivered === true) {
    return { send: false, reason: 'push_delivered' };
  }

  if (!required) {
    // A global opt-out is an opt-out of marketing. It must not silence the
    // receipts and reminders the account itself depends on.
    if (preferences?.unsubscribed === true && policy.email_variant === 'marketing') {
      return { send: false, reason: 'unsubscribed' };
    }
    if (isPreferenceOff(preferences, policy.email_preference_key)) {
      return { send: false, reason: 'preference_off' };
    }
    // The legacy toggle stays authoritative until every user has a row in
    // user_email_preferences.
    if (input.devicePreferences?.email === false) {
      return { send: false, reason: 'preference_off' };
    }
  }

  return { send: true, variant: policy.email_variant };
}

/**
 * Marketing and digest are opt-in: absent a row, they are off. Everything else
 * is opt-out: absent a row, it is on.
 */
function isPreferenceOff(preferences: EmailPreferences | null | undefined, key: PreferenceKey): boolean {
  const optIn = key === 'marketing_enabled' || key === 'digest_enabled';
  const value = preferences?.[key];
  if (value === null || value === undefined) return optIn;
  return value === false;
}
