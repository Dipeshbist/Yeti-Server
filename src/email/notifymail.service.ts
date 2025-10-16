/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { Injectable } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';

@Injectable()
export class NotifyMailService {
  constructor(private readonly mailer: MailerService) {}

  private adminList(): string[] {
    const admins = (process.env.ADMIN_EMAILS ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    return admins;
  }

  async notifyAdminsNewRegistration(payload: {
    userId: string;
    email: string;
    firstName?: string;
    lastName?: string;
    createdAt: Date;
  }) {
    const to = this.adminList();
    if (!to.length) return;

    try {
      await this.mailer.sendMail({
        to,
        subject: 'New user registration pending approval',
        html: `
        <h3>New Registration</h3>
        <p><b>Email:</b> ${payload.email}</p>
        <p><b>Name:</b> ${payload.firstName ?? ''} ${payload.lastName ?? ''}</p>
        <p><b>User ID:</b> ${payload.userId}</p>
        <p><b>Requested:</b> ${payload.createdAt.toISOString()}</p>
      `,
      });
    } catch (err) {
      console.error('Failed to send new registration email to admins:', err);
    }
  }

  async notifyUserApproved(email: string) {
    await this.mailer.sendMail({
      to: email,
      subject: 'Your account has been approved',
      html: `<p>Your account was approved. You can now log in with your email and password.</p>`,
    });
  }

  async notifyUserRejected(email: string, reason: string) {
    await this.mailer.sendMail({
      to: email,
      subject: 'Your registration was rejected',
      html: `<p>We’re sorry—your registration was rejected.</p><p><b>Reason:</b> ${reason}</p>`,
    });
  }
}
