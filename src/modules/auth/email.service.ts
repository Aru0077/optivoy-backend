import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MailConfig } from '../../config/mail.config';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(private readonly configService: ConfigService) {}

  async sendEmailVerification(to: string, code: string): Promise<void> {
    const subject = 'Verify your email';
    const html = `Your Optivoy email verification code is <strong>${code}</strong>. This code will expire soon.`;

    await this.send({ to, subject, html });
  }

  async sendPasswordReset(to: string, token: string): Promise<void> {
    const config = this.configService.get<MailConfig>('mail')!;
    const resetUrl = `${config.appBaseUrl}/reset-password?token=${encodeURIComponent(token)}`;
    const subject = 'Reset your password';
    const html = `Reset password via: <a href="${resetUrl}">${resetUrl}</a>`;

    await this.send({ to, subject, html });
  }

  async sendAdminTwoFactorCode(to: string, code: string): Promise<void> {
    const subject = 'Your admin sign-in verification code';
    const html = `Your Optivoy admin verification code is <strong>${code}</strong>. This code will expire soon.`;

    await this.send({ to, subject, html });
  }

  async sendUnreadNotificationDigest(
    to: string,
    input: {
      unreadCount: number;
      items: Array<{
        title: string;
        content: string;
        createdAt: Date;
      }>;
    },
  ): Promise<void> {
    const config = this.configService.get<MailConfig>('mail')!;
    const notificationsUrl = `${config.appBaseUrl}/notifications`;
    const subject = `You have ${input.unreadCount} unread notification${input.unreadCount === 1 ? '' : 's'}`;
    const itemsHtml = input.items
      .map(
        (item) =>
          `<li><strong>${this.escapeHtml(item.title)}</strong><br/>${this.escapeHtml(item.content)}<br/><small>${item.createdAt.toISOString()}</small></li>`,
      )
      .join('');
    const moreMessage =
      input.unreadCount > input.items.length
        ? `<p>And ${input.unreadCount - input.items.length} more unread notifications.</p>`
        : '';
    const html =
      `<p>You have ${input.unreadCount} unread notification${input.unreadCount === 1 ? '' : 's'} in Optivoy.</p>` +
      `<ul>${itemsHtml}</ul>` +
      moreMessage +
      `<p>View them here: <a href="${notificationsUrl}">${notificationsUrl}</a></p>`;

    await this.send({ to, subject, html });
  }

  private async send(input: {
    to: string;
    subject: string;
    html: string;
  }): Promise<void> {
    const config = this.configService.get<MailConfig>('mail')!;

    if (config.provider === 'resend' && config.resendApiKey) {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: config.from,
          to: [input.to],
          subject: input.subject,
          html: input.html,
        }),
      });

      if (!response.ok) {
        const body = await response.text();
        this.logger.error(`Resend send failed: ${response.status} ${body}`);
        throw new Error(`Email delivery failed: ${response.status} ${body}`);
      }

      return;
    }

    this.logger.log(
      `[MAIL:LOG] to=${input.to} subject=${input.subject} body=${input.html}`,
    );
  }

  private escapeHtml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
}
