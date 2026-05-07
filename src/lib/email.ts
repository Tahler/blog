import { Resend } from 'resend';

import { getEnv } from './env';

export interface Emailer {
	sendConfirmation(toEmail: string, confirmationUrl: string): Promise<void>;
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
}

class FakeEmailer implements Emailer {
	async sendConfirmation(toEmail: string, confirmationUrl: string) {
		console.log('FakeEmailer.sendConfirmation', { toEmail, confirmationUrl });
	}
}

function createEmailer(): Emailer {
	const resendApiKey = getEnv('RESEND_API_KEY');
	const fromEmail = getEnv('RESEND_FROM_EMAIL');
	if (resendApiKey && fromEmail) {
		return new ResendEmailer(fromEmail, new Resend(resendApiKey));
	}

  console.log('Missing email env vars for subscription confirmation email', {
    RESEND_API_KEY: !!resendApiKey,
    RESEND_FROM_EMAIL: !!fromEmail,
  });
	return new FakeEmailer();
}

export const emailer = createEmailer();
