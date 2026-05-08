import { Resend } from "resend";

export interface Emailer {
  send(message: Message): Promise<void>;
}

export interface Message {
  to: string;
  subject: string;
  html: string;
}

class ResendEmailer implements Emailer {
  constructor(
    private readonly client: Resend,
    private readonly from: string,
  ) {}

  async send(message: Message) {
    await this.client.emails.send({ ...message, from: this.from });
  }
}

export interface SubscriberPostInput {
  toEmail: string;
  subject: string;
  contentHtml: string;
  postUrl: string;
  preferencesUrl: string;
  unsubscribeUrl: string;
}

export class SubscriberEmailer {
  constructor(private readonly emailer: Emailer) {}

  async sendConfirmation(toEmail: string, confirmationUrl: string) {
    await this.emailer.send({
      to: toEmail,
      subject: "You're almost subscribed",
      html: `
        <div style="font-family: sans-serif; line-height: 1.5; color: #111;">
          <p>You're almost subscribed!</p>
          <p>Just click the link below to receive future posts in your inbox.</p>
          <p>
            <a
              href="${confirmationUrl}"
              style="display: inline-block; padding: 12px 16px; border-radius: 6px; background: #0f766e; color: #fff; text-decoration: none; font-weight: 600;"
            >
              Confirm subscription
            </a>
          </p>
          <p>Don't want to subscribe? Feel free to ignore this email.</p>
        </div>
      `,
    });
  }

  async sendPost(input: SubscriberPostInput) {
    await this.emailer.send({
      to: input.toEmail,
      subject: input.subject,
      html: `
        <div style="font-family: sans-serif; line-height: 1.5; color: #111;">
          ${input.contentHtml}
          <p><a href="${input.postUrl}">Read on the web</a></p>
          <p><a href="${input.preferencesUrl}">Manage preferences</a></p>
          <p><a href="${input.unsubscribeUrl}">Unsubscribe</a></p>
        </div>
      `,
    });
  }
}

export class FakeEmailer implements Emailer {
  sent: Message[] = [];

  async send(message: Message) {
    this.sent.push(message);
    console.log("FakeEmailer.send", message);
  }
}

function createEmailer(): SubscriberEmailer {
  const resendApiKey = import.meta.env.RESEND_API_KEY;
  const fromEmail = import.meta.env.RESEND_FROM_EMAIL;
  if (resendApiKey && fromEmail) {
    return new SubscriberEmailer(
      new ResendEmailer(new Resend(resendApiKey), fromEmail),
    );
  }

  console.log("Missing email env vars for Resend email delivery", {
    RESEND_API_KEY: !!resendApiKey,
    RESEND_FROM_EMAIL: !!fromEmail,
  });
  return new SubscriberEmailer(new FakeEmailer());
}

export const emailer = createEmailer();
