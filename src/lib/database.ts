import { neon } from '@neondatabase/serverless';

import { getEnv } from './env';

export interface Database {
	createPendingSubscriber(input: PendingSubscriberInput): Promise<void>;
}

export interface PendingSubscriberInput {
	email: string;
	token: string;
	tokenHash: string;
	tokenCreatedAt: Date;
}

export class Subscriber {
	constructor(
		readonly id: number,
		readonly createdAt: Date,
		readonly email: string,
		readonly name: string | null,
		readonly active: boolean,
		readonly token: string | null,
		readonly tokenHash: string | null,
		readonly tokenCreatedAt: Date | null,
		readonly lastEmailSentAt: Date | null,
		readonly wantsProjects: boolean,
		readonly wantsThoughts: boolean,
	) {}

  static from(row: Record<string, unknown>): Subscriber {
    return new Subscriber(
      Number(row.id),
      row.created_at as Date,
      String(row.email),
      row.name as string | null,
      Boolean(row.active),
      row.token as string | null,
      row.token_hash as string | null,
      row.token_created_at as Date | null,
      row.last_email_sent_at as Date | null,
      Boolean(row.wants_projects),
      Boolean(row.wants_thoughts),
    );
  }
}
class NeonDatabase implements Database {
	constructor(private readonly sql = neon(getEnv('NEON_DATABASE_URL')!)) {}

	async createPendingSubscriber({ email, token, tokenHash, tokenCreatedAt }: PendingSubscriberInput) {
		await this.sql`
			INSERT INTO subscribers (email, active, token, token_hash, token_created_at)
			VALUES (${email}, false, ${token}, ${tokenHash}, ${tokenCreatedAt})
		`;
	}
}

class FakeDatabase implements Database {
	async createPendingSubscriber(input: PendingSubscriberInput) {
		console.log('FakeDatabase.createPendingSubscriber', input);
	}
}

const connectionString = getEnv('NEON_DATABASE_URL');

export const database: Database = connectionString
	? new NeonDatabase()
	: new FakeDatabase();
