const nodemailer = require('nodemailer');
import {
    SMTP_HOST,
    SMTP_PASSWORD,
    SMTP_PORT,
    SMTP_SECURE,
    SMTP_USERNAME,
  } from '../config/env';

  export class MailService {
    transporter: typeof nodemailer.createTransport

    constructor() {
        this.transporter = nodemailer.createTransport({
            host: SMTP_HOST,
            port: SMTP_PORT,
            secure: SMTP_SECURE,
            auth: {
              user: SMTP_USERNAME,
              pass: SMTP_PASSWORD,
            },
          });
    }

    sendNotification = async (to: string[], plainText: string) => {
        if (!to.length) return;

        const info = await this.transporter.sendMail({
            from: '"Arjun Bhatnagar <arjxbh@gmail.com>"',
            to: to.join(','),
            subject: "Trygr Event Notification",
            text: plainText,
        });

        console.log("Message sent: %s", info.messageId);

        console.log(info);
    }
  }
