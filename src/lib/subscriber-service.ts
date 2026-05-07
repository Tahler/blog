import { createHash, randomBytes } from 'node:crypto';

import { Database, database } from './database';

export class SubscriberService {
	constructor(private readonly database: Database) {}

	async createPendingSubscriber(email: string) {
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
	}
}

export class InvalidEmailError extends Error {}

export const subscriberService = new SubscriberService(database);
