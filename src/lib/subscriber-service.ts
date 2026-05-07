import { createHash, randomBytes } from 'node:crypto';

import { Subscriber, database } from './database';
import { emailer } from './email';

export class SubscriberService {
	constructor(
		private readonly database: typeof database,
		private readonly emailer: typeof emailer,
	) {}

	async createPendingSubscriber(email: string, origin: URL) {
		const normalizedEmail = email.trim().toLowerCase();
		if (!normalizedEmail) {
			throw new InvalidEmailError();
		}

		const now = new Date();
		const existing = await this.database.readSubscriberByEmail(normalizedEmail);
    if (existing) {
      if (existing.active) {
        // Don't resend confirmations to active subscribers.
        console.log('Refusing to send confirmation to existing active subscriber', existing.email);
        return;
      }
      if (!existing.canSendEmail(now)) {
        // Don't spam pending subscribers.
        console.log('Refusing to spam', existing.email, 'who last received email at', existing.lastEmailSentAt)
        return;
      }
    }
    const token = generateToken();
    const input = {
      email: normalizedEmail,
      token: token,
      tokenHash: hash(token),
      tokenCreatedAt: now,
    };
    if (existing) {
      await this.database.updatePendingSubscriber(input);
    } else {
      await this.database.createPendingSubscriber(input);
    }
    const confirmationUrl = new URL('/subscribe', origin);
    confirmationUrl.searchParams.set('t', token);
		await this.emailer.sendConfirmation(normalizedEmail, confirmationUrl.toString());
		await this.database.updateLastEmailSentAt(normalizedEmail, now);
	}

	async confirmSubscriber(token: string): Promise<boolean> {
		if (!token) {
			return false;
		}
		const tokenHash = hash(token);
		const subscriber = await this.database.readSubscriberByTokenHash(tokenHash);
		if (!subscriber || !subscriber.token || !subscriber.tokenHash) {
			return false;
		}
		await this.database.updateActive(tokenHash);
		return true;
	}

	async readSubscriberByToken(token: string): Promise<Subscriber> {
		if (!token) {
			return null;
		}
		return this.database.readSubscriberByTokenHash(hash(token));
	}

	async updatePreferences(token: string, input: { name: string; wantsProjects: boolean; wantsThoughts: boolean }): Promise<void> {
		const name = input.name.trim();
		await this.database.updatePreferences({
			tokenHash: hash(token),
			name: name || null,
			wantsProjects: input.wantsProjects,
			wantsThoughts: input.wantsThoughts,
		});
	}
}

function generateToken() {
	return randomBytes(32).toString('base64url');
}

function hash(token: string) {
	return createHash('sha256').update(token).digest('hex');
}

export class InvalidEmailError extends Error {}

export const subscriberService = new SubscriberService(database, emailer);
