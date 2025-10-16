// src/email/NotifyMail.Module.ts
import { Module } from '@nestjs/common';
import { MailerModule } from '@nestjs-modules/mailer';
import { NotifyMailService } from './NotifyMail.Service';

@Module({
  imports: [
    MailerModule.forRoot({
      transport: {
        service: 'gmail',
        auth: {
          user: process.env.GMAIL_USER,
          pass: process.env.GMAIL_APP_PASSWORD,
        },
      },
      defaults: {
        from: `"Yeti Support" <${process.env.GMAIL_USER}>`,
      },
    }),
  ],
  providers: [NotifyMailService],
  exports: [NotifyMailService],
})
export class NotifyMailModule {}
