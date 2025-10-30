import { Injectable } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';

@Injectable()
export class NotifyMailService {
  constructor(private readonly mailer: MailerService) {}

  /** Common reusable Yeti email template */
  private renderTemplate(title: string, bodyHtml: string) {
    const year = new Date().getFullYear();
    // const logoUrl = 'https://www.garud.cloud/assets/yeti-logo.png';
    const headerColor = '#0a0f1a'; // dark header background

    return `
      <div style="background:#f6f7f9;padding:24px 12px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#111827;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" 
          style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;
                 border-radius:12px;overflow:hidden;box-shadow:0 4px 12px rgba(0,0,0,0.06);">
          <tr>
            <td style="background:${headerColor};padding:20px 0;text-align:center;">
            </td>
          </tr>
          <tr>
            <td style="padding:24px 24px 16px 24px;">
              <h2 style="margin:0 0 12px 0;font-size:22px;font-weight:600;
                         color:#111827;text-align:center;">${title}</h2>
              <div style="font-size:15px;line-height:1.6;color:#374151;">
                ${bodyHtml}
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 24px;border-top:1px solid #e5e7eb;
                       text-align:center;font-size:12px;color:#6b7280;">
              © ${year} Yeti. All rights reserved.
            </td>
          </tr>
        </table>
      </div>`;
  }

  /** ✅ Get admin list from ENV */
  private adminList(): string[] {
    const admins = (process.env.ADMIN_EMAILS ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    return admins;
  }

  /** 📩 1. Notify admins on new registration */
  async notifyAdminsNewRegistration(payload: {
    userId: string;
    email: string;
    firstName?: string;
    lastName?: string;
    phone?: string;
    createdAt: Date;
  }) {
    const to = this.adminList();
    if (!to.length) return;

    const name = [payload.firstName, payload.lastName]
      .filter(Boolean)
      .join(' ')
      .trim();

    const body = `
      <p>A new user has registered on <b>Yeti</b> and is awaiting approval.</p>
      <table width="100%" cellpadding="6" cellspacing="0" 
             style="margin-top:10px;border-collapse:collapse;">
        <tr><td style="font-weight:600;width:120px;">Name:</td>
            <td>${name || '—'}</td></tr>
        <tr><td style="font-weight:600;">Email:</td>
            <td><a href="mailto:${payload.email}" style="color:#2563eb;">
              ${payload.email}</a></td></tr>
        ${
          payload.phone
            ? `<tr><td style="font-weight:600;">Phone:</td><td>${payload.phone}</td></tr>`
            : ''
        }
        <tr><td style="font-weight:600;">User ID:</td><td>${payload.userId}</td></tr>
        <tr><td style="font-weight:600;">Requested:</td>
            <td>${new Date(payload.createdAt).toLocaleString()}</td></tr>
      </table>
      <p style="margin-top:20px;font-size:13px;color:#555;">
        Review this registration in the Admin Dashboard to approve or reject.
      </p>
    `;

    const html = this.renderTemplate('New User Registration', body);

    try {
      await this.mailer.sendMail({
        to,
        subject: 'Yeti — New User Registration Pending Approval',
        html,
      });
    } catch (err) {
      console.error('❌ Failed to send new registration email:', err);
    }
  }

  /** 📬 2. Notify user when approved */
  async notifyUserApproved(params: {
    email: string;
    firstName?: string;
    lastName?: string;
    loginUrl?: string;
    supportEmail?: string;
  }) {
    const {
      email,
      firstName,
      lastName,
      loginUrl = 'https://www.garud.cloud/',
      supportEmail = 'support@garud.cloud',
    } = params;

    const fullName =
      [firstName, lastName].filter(Boolean).join(' ').trim() || 'User';

    const body = `
      <p>Dear ${fullName},</p>
      <p>Your <b>Yeti</b> account has been approved and is now active.</p>
      <p style="text-align:center;margin:20px 0;">
        <a href="${loginUrl}" 
           style="display:inline-block;padding:12px 24px;background:#2563eb;
                  color:#ffffff;text-decoration:none;border-radius:6px;font-weight:500;">
          Sign In to Yeti
        </a>
      </p>
      <p>If you did not request this account, please contact us at 
        <a href="mailto:${supportEmail}" style="color:#2563eb;">${supportEmail}</a>.
      </p>
      <p>Regards,<br/>The Yeti Team</p>
    `;

    const html = this.renderTemplate('Account Approved', body);

    await this.mailer.sendMail({
      to: email,
      subject: 'Yeti — Account Approved',
      html,
    });
  }

  /** ❌ 3. Notify user when rejected */
  async notifyUserRejected(params: {
    email: string;
    firstName?: string;
    lastName?: string;
    reason?: string;
    supportEmail?: string;
  }) {
    const {
      email,
      firstName,
      lastName,
      reason,
      supportEmail = 'support@garud.cloud',
    } = params;

    const fullName =
      [firstName, lastName].filter(Boolean).join(' ').trim() || 'User';

    const body = `
      <p>Dear ${fullName},</p>
      <p>We appreciate your interest in joining <b>Yeti</b>, but unfortunately
         your registration could not be approved at this time.</p>
      ${reason ? `<p><b>Reason:</b> ${reason}</p>` : ''}
      <p>You can review your details and reapply if necessary.</p>
      <p>For any clarification, please contact us at 
        <a href="mailto:${supportEmail}" style="color:#2563eb;">${supportEmail}</a>.
      </p>
      <p>Regards,<br/>Yeti Team</p>
    `;

    const html = this.renderTemplate('Account Rejected', body);

    await this.mailer.sendMail({
      to: email,
      subject: 'Yeti — Account Rejected',
      html,
    });
  }

  /** 🌡️ 4. Temperature alert email */
  async notifyTemperatureAlert(params: {
    email: string;
    deviceName: string;
    measured: number;
    threshold: number;
    when?: string;
  }) {
    const { email, deviceName, measured, threshold, when } = params;

    const body = `
      <p><b>Device:</b> ${deviceName}</p>
      <p><b>Measured:</b> ${measured.toFixed(1)}°C</p>
      <p><b>Threshold:</b> ${threshold}°C</p>
      <p><b>Time:</b> ${when ?? new Date().toLocaleString()}</p>
      <p>Please check your system immediately.</p>
    `;

    const html = this.renderTemplate(
      `Temperature Alert – ${deviceName} exceeded ${threshold}°C`,
      body,
    );

    await this.mailer.sendMail({
      to: email,
      subject: `Yeti — Temperature Alert (${deviceName})`,
      html,
    });
  }
}
