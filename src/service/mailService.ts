import nodemailer from 'nodemailer';
import {
  SMTP_HOST,
  SMTP_PASSWORD,
  SMTP_PORT,
  SMTP_SECURE,
  SMTP_USERNAME,
} from '../config/env';

export class MailService {
  transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_SECURE,
      requireTLS: Boolean(SMTP_USERNAME || SMTP_PASSWORD),
      auth: {
        user: SMTP_USERNAME,
        pass: SMTP_PASSWORD,
      },
    });

    console.log(`set up email transporter for ${SMTP_HOST}`);
  }

  sendNotification = async (to: string[], plainText: string) => {
    console.log(`trying to send email to ${to}`);
    if (!to.length) return;

    try {
      const info = await this.transporter.sendMail({
        from: SMTP_USERNAME || 'trygr@localhost',
        to: to.join(','),
        subject: 'Trygr Event Notification',
        text: plainText,
      });

      console.log('Message sent: %s', info.messageId);
    } catch {
      console.error('SMTP notification failed');
    }
  };
}
