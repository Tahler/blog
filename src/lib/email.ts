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
    const { error } = await this.client.emails.send({
      ...message,
      from: this.from,
    });
    if (error) {
      throw new Error(`Resend failed to send email: ${error.message}`);
    }
  }
}

export class FakeEmailer implements Emailer {
  sent: Message[] = [];

  async send(message: Message) {
    this.sent.push(message);
    console.log("FakeEmailer.send", message);
  }
}

function createEmailer(): Emailer {
  const resendApiKey = import.meta.env.RESEND_API_KEY;
  const fromEmail = import.meta.env.RESEND_FROM_EMAIL;
  if (resendApiKey && fromEmail) {
    return new ResendEmailer(new Resend(resendApiKey), fromEmail);
  }

  console.log("Missing email env vars for Resend email delivery", {
    RESEND_API_KEY: !!resendApiKey,
    RESEND_FROM_EMAIL: !!fromEmail,
  });
  return new FakeEmailer();
}

export const emailer = createEmailer();
