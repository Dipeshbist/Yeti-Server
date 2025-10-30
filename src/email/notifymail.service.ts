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
    phone?: string;
    createdAt: Date;
  }) {
    const to = this.adminList();
    if (!to.length) return;

    try {
      await this.mailer.sendMail({
        to,
        subject: 'Yeti — New User Registration Pending Approval',
        html: `
  <div style="background:#f6f7f9;padding:24px 12px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#111827;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:8px;">
      <tr>
        <td style="padding:24px 24px 8px 24px;">
          <h2 style="margin:0 0 8px 0;font-size:20px;font-weight:600;color:#111827;">New User Registration</h2>
        </td>
      </tr>
      <tr>
        <td style="padding:0 24px 16px 24px;font-size:14px;line-height:1.6;color:#374151;">
          <p style="margin:0 0 8px 0;">A new user has registered on <b>Yeti</b> and is awaiting approval.</p>
          <table width="100%" cellpadding="6" cellspacing="0" style="margin-top:10px;border-collapse:collapse;">
            <tr>
              <td style="font-weight:600;width:120px;">Email:</td>
              <td><a href="mailto:${payload.email}" style="color:#1f3ad7;text-decoration:none;">${payload.email}</a></td>
            </tr>
            <tr>
              <td style="font-weight:600;">Name:</td>
              <td>${payload.firstName ?? ''} ${payload.lastName ?? ''}</td>
            </tr>
            ${
              payload['phone']
                ? `<tr>
                    <td style="font-weight:600;">Phone:</td>
                    <td>${payload['phone']}</td>
                  </tr>`
                : ''
            }
            <tr>
              <td style="font-weight:600;">User ID:</td>
              <td>${payload.userId}</td>
            </tr>
            <tr>
              <td style="font-weight:600;">Requested:</td>
              <td>${new Date(payload.createdAt).toLocaleString()}</td>
            </tr>
          </table>
          <p style="margin-top:20px;font-size:13px;color:#555;">
            You can review this registration in the Admin Dashboard to approve or reject.
          </p>
        </td>
      </tr>
      <tr>
        <td style="padding:12px 24px 20px 24px;border-top:1px solid #e5e7eb;text-align:left;">
          <p style="margin:0;font-size:12px;color:#6b7280;">© ${new Date().getFullYear()} Yeti. Admin Notification</p>
        </td>
      </tr>
    </table>
  </div>
  `,
      });
    } catch (err) {
      console.error('Failed to send new registration email to admins:', err);
    }
  }

  async notifyUserApproved(params: {
    email: string;
    firstName?: string;
    lastName?: string;
    loginUrl?: string; // optional override
    supportEmail?: string; // optional override
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

    const subject = 'Yeti — Account Approved';
    const year = new Date().getFullYear();

    // Plain-text fallback (what many clients show in preview)
    const text = [
      `Dear ${fullName},`,
      ``,
      `Your Yeti account has been approved.`,
      `You can now sign in at: ${loginUrl}`,
      ``,
      `If you did not request this account, please contact us at ${supportEmail}.`,
      ``,
      `Regards,`,
      `Yeti Team`,
      `© ${year} Yeti`,
    ].join('\n');

    // Minimal, official HTML (no emoji, no button, no heavy header)
    const html = `
  <div style="background:#f6f7f9;padding:24px 12px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#111827;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:8px;">
      <tr>
        <td style="padding:24px 24px 8px 24px;">
          <h2 style="margin:0 0 8px 0;font-size:20px;font-weight:600;color:#111827;">Your account has been approved</h2>
        </td>
      </tr>
      <tr>
        <td style="padding:0 24px 16px 24px;font-size:14px;line-height:1.6;color:#374151;">
          <p style="margin:0 0 12px 0;">Dear ${fullName},</p>
          <p style="margin:0 0 12px 0;">
            Your Yeti account is now active. You can sign in using the link below:
          </p>
          <p style="margin:0 0 12px 0;">
            <a href="${loginUrl}" style="color:#1f3ad7;text-decoration:underline;">${loginUrl}</a>
          </p>
          <p style="margin:0 0 12px 0;">
            If you did not request this account, please contact us at
            <a href="mailto:${supportEmail}" style="color:#1f3ad7;text-decoration:underline;">${supportEmail}</a>.
          </p>
          <p style="margin:16px 0 0 0;">Regards,<br/>Yeti Team</p>
        </td>
      </tr>
      <tr>
        <td style="padding:12px 24px 20px 24px;border-top:1px solid #e5e7eb;text-align:left;">
          <p style="margin:0;font-size:12px;color:#6b7280;">© ${year} Yeti. All rights reserved.</p>
        </td>
      </tr>
    </table>
  </div>
  `;

    await this.mailer.sendMail({
      to: email,
      subject,
      text, // plaintext preview
      html, // minimal official HTML
    });
  }

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

    const subject = 'Yeti — Account Rejected';
    const year = new Date().getFullYear();

    // Plain text fallback
    const text = [
      `Dear ${fullName},`,
      ``,
      `We regret to inform you that your Yeti account registration was not approved.`,
      reason ? `Reason: ${reason}` : '',
      ``,
      `You can review your details and apply again if appropriate.`,
      `If you have questions, please contact us at ${supportEmail}.`,
      ``,
      `Regards,`,
      `Yeti Team`,
      `© ${year} Yeti`,
    ].join('\n');

    // Minimal official HTML
    const html = `
  <div style="background:#f6f7f9;padding:24px 12px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#111827;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:8px;">
      <tr>
        <td style="padding:24px 24px 8px 24px;">
          <h2 style="margin:0 0 8px 0;font-size:20px;font-weight:600;color:#b91c1c;">Your account registration was not approved</h2>
        </td>
      </tr>
      <tr>
        <td style="padding:0 24px 16px 24px;font-size:14px;line-height:1.6;color:#374151;">
          <p style="margin:0 0 12px 0;">Dear ${fullName},</p>
          <p style="margin:0 0 12px 0;">
            We appreciate your interest in joining Yeti. Unfortunately, your registration could not be approved at this time.
          </p>
          ${
            reason
              ? `<p style="margin:0 0 12px 0;"><b>Reason:</b> ${reason}</p>`
              : ''
          }
          <p style="margin:0 0 12px 0;">
            You can review your details and reapply if necessary.
          </p>
          <p style="margin:0 0 12px 0;">
            For any clarification or assistance, please contact us at
            <a href="mailto:${supportEmail}" style="color:#1f3ad7;text-decoration:underline;">${supportEmail}</a>.
          </p>
          <p style="margin:16px 0 0 0;">Regards,<br/>Yeti Team</p>
        </td>
      </tr>
      <tr>
        <td style="padding:12px 24px 20px 24px;border-top:1px solid #e5e7eb;text-align:left;">
          <p style="margin:0;font-size:12px;color:#6b7280;">© ${year} Yeti. All rights reserved.</p>
        </td>
      </tr>
    </table>
  </div>
  `;

    await this.mailer.sendMail({
      to: email,
      subject,
      text,
      html,
    });
  }

  async notifyTemperatureAlert(params: {
    email: string;
    deviceName: string;
    measured: number;
    threshold: number;
    when?: string;
  }) {
    const { email, deviceName, measured, threshold, when } = params;
    const subject = `Temperature Alert – ${deviceName} exceeded ${threshold}°C`;

    const text = [
      `Device: ${deviceName}`,
      `Measured: ${measured.toFixed(1)}°C`,
      `Threshold: ${threshold}°C`,
      `Time: ${when ?? new Date().toLocaleString()}`,
    ].join('\n');

    const html = `
  <div style="font-family:system-ui,Arial,sans-serif;">
    <h2 style="color:#b91c1c;">Temperature Alert</h2>
    <p><b>Device:</b> ${deviceName}</p>
    <p><b>Measured:</b> ${measured.toFixed(1)}°C</p>
    <p><b>Threshold:</b> ${threshold}°C</p>
    <p><b>Time:</b> ${when ?? new Date().toLocaleString()}</p>
  </div>`;

    await this.mailer.sendMail({ to: email, subject, text, html });
  }
}
