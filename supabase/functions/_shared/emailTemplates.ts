/**
 * A registry keyed by event type. The dispatch worker looks a message up and
 * renders it; it never learns a type name, so adding a notification is a new
 * entry here plus a row in notification_channel_policies -- never a new branch
 * in the drain.
 */

import {
  emailButton,
  emailShell,
  escapeHtml,
  listUnsubscribeHeaders,
  safeUrl,
  type EmailVariant,
} from './email-brand.ts';

export type Payload = Record<string, unknown>;

/** The channel-independent content of one notification. */
export interface NotificationContent {
  title: string;
  message: string;
  /** Site-relative path, or null when there is nowhere useful to land. */
  actionPath: string | null;
  actionLabel: string;
  category: string;
  /**
   * Collapses redundant push notifications on the device. Keyed by the thing
   * the message is about, so a retry replaces rather than stacks.
   */
  pushTag: string;
}

export interface EmailRenderContext {
  variant: EmailVariant;
  siteUrl: string;
  unsubscribeUrl?: string;
  postalAddress?: string;
  preferencesUrl?: string;
}

export interface RenderedEmail {
  subject: string;
  html: string;
  headers: Record<string, string>;
}

const str = (value: unknown, fallback = ''): string => {
  const text = typeof value === 'string' ? value : value == null ? '' : String(value);
  return text.trim() || fallback;
};

/** A subject line containing CR or LF is a header-injection attempt. */
const subjectSafe = (value: string) => value.replace(/[\r\n]+/g, ' ').slice(0, 200);

export const absoluteUrl = (siteUrl: string, path: string | null): string | null => {
  if (!path) return null;
  try {
    return new URL(path, siteUrl).toString();
  } catch {
    return null;
  }
};

interface Template {
  content: (payload: Payload) => NotificationContent;
  body: (content: NotificationContent, actionUrl: string | null, payload: Payload) => string;
}

const TEMPLATES: Record<string, Template> = {
  calendar_reminder: {
    content: payload => {
      const eventTitle = str(payload.title, 'Upcoming event');
      return {
        title: `Reminder: ${eventTitle}`,
        message: str(payload.message, 'You have an upcoming calendar event.'),
        // `financial-calendar` was removed with the non-real-estate cut, and
        // this pointed at it -- Workspace's isRoutableModule guard silently
        // dropped the reader on the dashboard instead of the reminder they
        // clicked. Portfolio is where project dates actually live today.
        actionPath: str(payload.action_url, '/?module=portfolio'),
        actionLabel: 'Open calendar',
        category: 'calendar',
        pushTag: `calendar_reminder-${str(payload.reminder_id, str(payload.event_key, 'unknown'))}`,
      };
    },
    body: (content, actionUrl, payload) => {
      const eventDate = str(payload.event_date);
      const eventType = str(payload.event_type);
      return `<p style="margin:0 0 12px">${escapeHtml(content.message)}</p>`
        + (eventDate
          ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:16px 0;border:1px solid #e4e7ec;border-radius:10px;padding:14px 16px">`
            + `<tr><td style="font-size:13px;color:#667085">Date</td><td style="padding-left:18px;font-size:13px;font-weight:600">${escapeHtml(eventDate)}</td></tr>`
            + (eventType ? `<tr><td style="font-size:13px;color:#667085;padding-top:6px">Type</td><td style="padding-left:18px;padding-top:6px;font-size:13px;font-weight:600">${escapeHtml(eventType)}</td></tr>` : '')
            + `</table>`
          : '')
        + (actionUrl ? emailButton(content.actionLabel, actionUrl) : '')
        + `<p style="margin:16px 0 0;color:#667085;font-size:13px">You set this reminder in TW Ventures. Provider dates can change after a reminder is scheduled.</p>`;
    },
  },
  investor_inquiry_received: {
    content: payload => {
      const name = str(payload.full_name, 'Someone');
      const selfReport = str(payload.accreditation_self_report, 'unsure');
      const selfReportLabel = selfReport === 'accredited'
        ? 'self-reports as accredited'
        : selfReport === 'not_accredited'
          ? 'self-reports as not accredited'
          : 'is unsure of their accreditation status';
      return {
        title: `New investor enquiry: ${name}`,
        message: `${name} enquired through the investor page and ${selfReportLabel}.`,
        actionPath: '/?module=crm',
        actionLabel: 'Open CRM',
        category: 'investor',
        pushTag: `investor_inquiry-${str(payload.inquiry_id, 'unknown')}`,
      };
    },
    body: (content, actionUrl, payload) => {
      const email = str(payload.email);
      const range = str(payload.investment_range).replace(/_/g, ' ');
      return `<p style="margin:0 0 12px">${escapeHtml(content.message)}</p>`
        + ((email || range)
          ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:16px 0;border:1px solid #e4e7ec;border-radius:10px;padding:14px 16px">`
            + (email ? `<tr><td style="font-size:13px;color:#667085">Email</td><td style="padding-left:18px;font-size:13px;font-weight:600">${escapeHtml(email)}</td></tr>` : '')
            + (range ? `<tr><td style="font-size:13px;color:#667085;padding-top:6px">Range</td><td style="padding-left:18px;padding-top:6px;font-size:13px;font-weight:600">${escapeHtml(range)}</td></tr>` : '')
            + `</table>`
          : '')
        + (actionUrl ? emailButton(content.actionLabel, actionUrl) : '')
        // Stated in every one of these so it is never inferred from the form.
        + `<p style="margin:16px 0 0;color:#667085;font-size:13px">What the enquirer reported about their own accreditation is a lead qualifier, not a verification. It does not satisfy Rule 506(c).</p>`;
    },
  },

  project_milestone_due: {
    content: payload => {
      const milestoneTitle = str(payload.title, 'Project milestone');
      const projectName = str(payload.project_name, 'Your project');
      const dueDate = str(payload.due_date);
      return {
        title: `Milestone due: ${milestoneTitle}`,
        message: dueDate
          ? `${milestoneTitle} for ${projectName} is due ${dueDate}.`
          : `${milestoneTitle} for ${projectName} is coming due.`,
        actionPath: str(payload.action_url, '/?module=dashboard'),
        actionLabel: 'Open project dashboard',
        category: 'project',
        pushTag: `project_milestone-${str(payload.milestone_id, 'unknown')}`,
      };
    },
    body: (content, actionUrl, payload) => {
      const projectName = str(payload.project_name);
      const dueDate = str(payload.due_date);
      return `<p style="margin:0 0 12px">${escapeHtml(content.message)}</p>`
        + ((projectName || dueDate)
          ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:16px 0;border:1px solid #e4e7ec;border-radius:10px;padding:14px 16px">`
            + (projectName ? `<tr><td style="font-size:13px;color:#667085">Project</td><td style="padding-left:18px;font-size:13px;font-weight:600">${escapeHtml(projectName)}</td></tr>` : '')
            + (dueDate ? `<tr><td style="font-size:13px;color:#667085;padding-top:6px">Due</td><td style="padding-left:18px;padding-top:6px;font-size:13px;font-weight:600">${escapeHtml(dueDate)}</td></tr>` : '')
            + `</table>`
          : '')
        + (actionUrl ? emailButton(content.actionLabel, actionUrl) : '')
        + `<p style="margin:16px 0 0;color:#667085;font-size:13px">This operational reminder was generated from your TW Ventures project schedule.</p>`;
    },
  },
  project_invitation: {
    content: payload => {
      const projectName = str(payload.project_name, 'a TW Ventures project');
      const role = str(payload.invite_role, 'project member').replace(/_/g, ' ');
      return {
        title: `You’re invited to ${projectName}`,
        message: `You have been invited as ${role} for ${projectName}.`,
        actionPath: str(payload.action_url, '/'),
        actionLabel: 'Accept project invitation',
        category: 'project',
        pushTag: `project_invitation-${str(payload.invitation_id, 'unknown')}`,
      };
    },
    body: (content, actionUrl, payload) => {
      const projectName = str(payload.project_name);
      const role = str(payload.invite_role, 'project member').replace(/_/g, ' ');
      const expiresAt = str(payload.expires_at);
      return `<p style="margin:0 0 12px">${escapeHtml(content.message)}</p>`
        + `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:16px 0;border:1px solid #e4e7ec;border-radius:10px;padding:14px 16px">`
        + (projectName ? `<tr><td style="font-size:13px;color:#667085">Project</td><td style="padding-left:18px;font-size:13px;font-weight:600">${escapeHtml(projectName)}</td></tr>` : '')
        + `<tr><td style="font-size:13px;color:#667085;padding-top:6px">Access</td><td style="padding-left:18px;padding-top:6px;font-size:13px;font-weight:600">${escapeHtml(role)}</td></tr>`
        + (expiresAt ? `<tr><td style="font-size:13px;color:#667085;padding-top:6px">Expires</td><td style="padding-left:18px;padding-top:6px;font-size:13px;font-weight:600">${escapeHtml(expiresAt)}</td></tr>` : '')
        + `</table>`
        + (actionUrl ? emailButton(content.actionLabel, actionUrl) : '')
        + `<p style="margin:16px 0 0;color:#667085;font-size:13px">Sign in with the exact email address that received this invitation. If you were not expecting it, you can ignore this message.</p>`;
    },
  },
};

export function hasTemplate(eventType: string): boolean {
  return Object.hasOwn(TEMPLATES, eventType);
}

/**
 * Returns null for an unregistered event type rather than inventing copy. A
 * message nobody wrote is a message nobody reviewed.
 */
export function renderContent(eventType: string, payload: Payload): NotificationContent | null {
  const template = TEMPLATES[eventType];
  return template ? template.content(payload ?? {}) : null;
}

export function renderEmail(
  eventType: string,
  payload: Payload,
  context: EmailRenderContext,
): RenderedEmail | null {
  const template = TEMPLATES[eventType];
  if (!template) return null;

  const content = template.content(payload ?? {});
  const actionUrl = safeUrl(absoluteUrl(context.siteUrl, content.actionPath) ?? undefined);

  // emailShell throws if the variant and the material disagree, so a
  // non-compliant message cannot reach the provider.
  const html = emailShell({
    variant: context.variant,
    unsubscribeUrl: context.unsubscribeUrl,
    postalAddress: context.postalAddress,
    preferencesUrl: context.preferencesUrl,
    heading: content.title,
    preheader: content.message,
    bodyHtml: template.body(content, actionUrl, payload ?? {}),
  });

  return {
    subject: subjectSafe(content.title),
    html,
    headers: listUnsubscribeHeaders({
      variant: context.variant,
      unsubscribeUrl: context.unsubscribeUrl,
      postalAddress: context.postalAddress,
    }),
  };
}

export const REGISTERED_EVENT_TYPES = Object.keys(TEMPLATES);
