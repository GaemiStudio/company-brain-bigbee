import { NotificationChannel } from '../types/notification.types';
import {
  NotificationTemplate,
  RenderedTemplateContent,
} from '../interfaces/notification-template.interface';
import { emailTemplateComponents } from './components/email-base.template';
import { escapeHtml } from '../utils/escape-html.util';

/**
 * Company Brain alert (🔴 problem, 🟢 solution, 💎 match), sent to the bell and
 * by email. The Brain watcher writes the title and body; this template only
 * lays them out for each channel.
 */
export class BrainAlertTemplate implements NotificationTemplate {
  readonly variables = {
    title: { type: 'string', required: true } as const,
    body: { type: 'string', required: true } as const,
    organizationId: { type: 'string', required: true } as const,
    /** App path to open, e.g. "/organizations/:id/brain". */
    actionPath: { type: 'string', required: true } as const,
    /** The same link as a full URL, for email. */
    actionUrl: { type: 'url', required: true } as const,
  };

  render(channel: NotificationChannel, variables: Record<string, any>): RenderedTemplateContent {
    const { title, body, organizationId, actionPath, actionUrl } = variables;

    if (channel === NotificationChannel.IN_APP) {
      return {
        title,
        body,
        textContent: body,
        data: { organizationId, actionUrl: actionPath },
      };
    }

    if (channel === NotificationChannel.EMAIL) {
      return {
        subject: title,
        htmlContent: emailTemplateComponents.fullTemplate({
          subject: title,
          title,
          content: `<p>${escapeHtml(body)}</p>`,
          ctaUrl: actionUrl,
          ctaText: 'Open Company Brain',
        }),
        textContent: `${title}\n\n${body}\n\n${actionUrl}`,
      };
    }

    throw new Error(`Channel ${channel} not supported`);
  }
}
