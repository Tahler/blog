import { Resend } from "resend";

export interface Emailer {
  sendConfirmation(toEmail: string, confirmationUrl: string): Promise<void>;
  sendPost(input: PostInput): Promise<void>;
}

export interface PostInput {
  toEmail: string;
  subject: string;
  postUrl: string;
  preferencesUrl: string;
  unsubscribeUrl: string;
}

class ResendEmailer implements Emailer {
  constructor(
    private readonly fromEmail: string,
    private readonly client: Resend,
  ) {}

  async sendConfirmation(toEmail: string, confirmationUrl: string) {
    await this.client.emails.send({
      from: this.fromEmail,
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

  async sendPost(input: PostInput) {
    await this.client.emails.send({
      from: this.fromEmail,
      to: input.toEmail,
      subject: input.subject,
      html: `
        <div style="font-family: sans-serif; line-height: 1.5; color: #111;">
          <p><a href="${input.postUrl}">Read on the web</a></p>
          <p><a href="${input.preferencesUrl}">Manage preferences</a></p>
          <p><a href="${input.unsubscribeUrl}">Unsubscribe</a></p>
        </div>
      `,
    });
  }
}

class FakeEmailer implements Emailer {
  async sendConfirmation(toEmail: string, confirmationUrl: string) {
    console.log("FakeEmailer.sendConfirmation", { toEmail, confirmationUrl });
  }

  async sendPost(input: PostInput) {
    console.log("FakeEmailer.sendPost", input);
  }
}

function createEmailer(): Emailer {
  const resendApiKey = import.meta.env.RESEND_API_KEY;
  const fromEmail = import.meta.env.RESEND_FROM_EMAIL;
  if (resendApiKey && fromEmail) {
    return new ResendEmailer(fromEmail, new Resend(resendApiKey));
  }

  console.log("Missing email env vars for Resend email delivery", {
    RESEND_API_KEY: !!resendApiKey,
    RESEND_FROM_EMAIL: !!fromEmail,
  });
  return new FakeEmailer();
}

export const emailer = createEmailer();
