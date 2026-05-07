import { neon } from "@neondatabase/serverless";

import { getEnv } from "./env";

export interface Database {
  readSubscriberByEmail(email: string): Promise<Subscriber | null>;
  readSubscriberByToken(token: string): Promise<Subscriber | null>;
  createPendingSubscriber(input: PendingSubscriberInput): Promise<void>;
  updatePendingSubscriber(input: PendingSubscriberInput): Promise<void>;
  updateActive(token: string): Promise<void>;
  updatePreferences(input: PreferencesInput): Promise<void>;
  deleteSubscriberByToken(token: string): Promise<void>;
  updateLastEmailSentAt(email: string, sentAt: Date): Promise<void>;
}

export interface PendingSubscriberInput {
  email: string;
  token: string;
  tokenCreatedAt: Date;
}

export interface PreferencesInput {
  token: string;
  name: string | null;
  wantsProjects: boolean;
  wantsThoughts: boolean;
}

export class Subscriber {
  constructor(
    readonly id: number,
    readonly createdAt: Date,
    readonly email: string,
    readonly name: string | null,
    readonly active: boolean,
    readonly token: string | null,
    readonly tokenCreatedAt: Date | null,
    readonly lastEmailSentAt: Date | null,
    readonly wantsProjects: boolean,
    readonly wantsThoughts: boolean,
  ) {}

  canSendEmail(now = new Date()) {
    if (!this.lastEmailSentAt) {
      return true;
    }

    const fiveMinutes = 5 * 60 * 1000;
    return now.getTime() - this.lastEmailSentAt.getTime() >= fiveMinutes;
  }

  static from(row: Record<string, unknown>): Subscriber {
    return new Subscriber(
      Number(row.id),
      row.created_at as Date,
      String(row.email),
      row.name as string | null,
      Boolean(row.active),
      row.token as string | null,
      row.token_created_at as Date | null,
      row.last_email_sent_at as Date | null,
      Boolean(row.wants_projects),
      Boolean(row.wants_thoughts),
    );
  }
}
class NeonDatabase implements Database {
  constructor(private readonly sql = neon(getEnv("NEON_DATABASE_URL")!)) {}

  async readSubscriberByEmail(email: string) {
    const rows = await this.sql`
			SELECT *
			FROM subscribers
			WHERE email = ${email}
			LIMIT 1
		`;
    return rows[0] ? Subscriber.from(rows[0]) : null;
  }

  async readSubscriberByToken(token: string) {
    const rows = await this.sql`
			SELECT *
			FROM subscribers
			WHERE token = ${token}
			LIMIT 1
		`;
    return rows[0] ? Subscriber.from(rows[0]) : null;
  }

  async createPendingSubscriber({
    email,
    token,
    tokenCreatedAt,
  }: PendingSubscriberInput) {
    await this.sql`
			INSERT INTO subscribers (email, active, token, token_created_at)
			VALUES (${email}, false, ${token}, ${tokenCreatedAt})
		`;
  }

  async updatePendingSubscriber({
    email,
    token,
    tokenCreatedAt,
  }: PendingSubscriberInput) {
    await this.sql`
			UPDATE subscribers
			SET token = ${token},
				token_created_at = ${tokenCreatedAt}
			WHERE email = ${email}
		`;
  }

  async updateActive(token: string) {
    await this.sql`
			UPDATE subscribers
			SET active = true
			WHERE token = ${token}
		`;
  }

  async updatePreferences({
    token,
    name,
    wantsProjects,
    wantsThoughts,
  }: PreferencesInput) {
    await this.sql`
			UPDATE subscribers
			SET name = ${name},
				wants_projects = ${wantsProjects},
				wants_thoughts = ${wantsThoughts}
			WHERE token = ${token}
		`;
  }

  async deleteSubscriberByToken(token: string) {
    await this.sql`
			DELETE FROM subscribers
			WHERE token = ${token}
		`;
  }

  async updateLastEmailSentAt(email: string, sentAt: Date) {
    await this.sql`
			UPDATE subscribers
			SET last_email_sent_at = ${sentAt}
			WHERE email = ${email}
		`;
  }
}

class FakeDatabase implements Database {
  async readSubscriberByEmail(email: string) {
    console.log("FakeDatabase.readSubscriberByEmail", { email });
    return null;
  }

  async readSubscriberByToken(token: string) {
    console.log("FakeDatabase.readSubscriberByToken", { token });
    return null;
  }

  async createPendingSubscriber(input: PendingSubscriberInput) {
    console.log("FakeDatabase.createPendingSubscriber", input);
  }

  async updatePendingSubscriber(input: PendingSubscriberInput) {
    console.log("FakeDatabase.updatePendingSubscriber", input);
  }

  async updateActive(token: string) {
    console.log("FakeDatabase.updateActive", { token });
  }

  async updatePreferences(input: PreferencesInput) {
    console.log("FakeDatabase.updatePreferences", input);
  }

  async deleteSubscriberByToken(token: string) {
    console.log("FakeDatabase.deleteSubscriberByToken", { token });
  }

  async updateLastEmailSentAt(email: string, sentAt: Date) {
    console.log("FakeDatabase.updateLastEmailSentAt", { email, sentAt });
  }
}

const connectionString = getEnv("NEON_DATABASE_URL");

export const database: Database = connectionString
  ? new NeonDatabase()
  : new FakeDatabase();
