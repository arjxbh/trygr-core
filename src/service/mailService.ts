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

        console.log(`set up email transporter for ${SMTP_HOST}`);
    }

    sendNotification = async (to: string[], plainText: string) => {
        console.log(`trying to send email to ${to}`);
        if (!to.length) return;

        try {
          const info = await this.transporter.sendMail({
            from: '"Arjun Bhatnagar <arjxbh@gmail.com>"',
            to: to.join(','),
            subject: "Trygr Event Notification",
            text: plainText,
          });

          console.log("Message sent: %s", info.messageId);

          console.log(info);
        } catch (e) {
          console.log(e);
        }
    }
  }

//   // using Twilio SendGrid's v3 Node.js Library
// // https://github.com/sendgrid/sendgrid-nodejs
// const sgMail = require('@sendgrid/mail')
// sgMail.setApiKey(process.env.SENDGRID_API_KEY)
// const msg = {
//   to: 'arjxbh@gmail.com', // Change to your recipient
//   from: 'arjun@dapcwiz.com', // Change to your verified sender
//   subject: 'Sending with SendGrid is Fun',
//   text: 'and easy to do anywhere, even with Node.js',
//   html: '<strong>and easy to do anywhere, even with Node.js</strong>',
// }
// sgMail
//   .send(msg)
//   .then(() => {
//     console.log('Email sent')
//   })
//   .catch((error: any) => {
//     console.error(error)
//   })
