import { createHash, randomBytes } from 'node:crypto';

import { Database, database } from './database';
import { Emailer, emailer } from './email';

export class SubscriberService {
	constructor(
		private readonly database: Database,
		private readonly emailer: Emailer,
	) {}

	async createPendingSubscriber(email: string, origin: URL) {
		const normalizedEmail = email.trim().toLowerCase();
		if (!normalizedEmail) {
      throw new InvalidEmailError();
		}

		const token = randomBytes(32).toString('base64url');
		const tokenHash = createHash('sha256').update(token).digest('hex');
    const now = new Date();
    await this.database.createPendingSubscriber({
      email: normalizedEmail,
      token,
      tokenHash,
      tokenCreatedAt: now,
    });

		const confirmationUrl = new URL('/subscribe', origin);
		confirmationUrl.searchParams.set('t', token);
		await this.emailer.sendConfirmation(normalizedEmail, confirmationUrl.toString());
	}
}

export class InvalidEmailError extends Error {}

export const subscriberService = new SubscriberService(database, emailer);
