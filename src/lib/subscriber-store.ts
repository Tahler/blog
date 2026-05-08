import { neon } from "@neondatabase/serverless";

export interface SubscriberStore {
  readByEmail(email: string): Promise<Subscriber | null>;
  readByToken(token: string): Promise<Subscriber | null>;
  readByTag(tag: BlogPostTag): Promise<Subscriber[]>;
  create(input: PendingSubscriberInput): Promise<void>;
  updateActive(token: string): Promise<void>;
  updatePreferences(input: PreferencesInput): Promise<void>;
  deleteByToken(token: string): Promise<void>;
  updateLastEmailSentAt(email: string, sentAt: Date): Promise<void>;
}

export type BlogPostTag = "projects" | "thoughts";

export interface PendingSubscriberInput {
  email: string;
  token: string;
}

export interface PreferencesInput {
  token: string;
  name?: string;
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
    readonly lastEmailSentAt: Date | null,
    readonly wantsProjects: boolean,
    readonly wantsThoughts: boolean,
  ) { }

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
      row.last_email_sent_at as Date | null,
      Boolean(row.wants_projects),
      Boolean(row.wants_thoughts),
    );
  }

  static build(overrides: Partial<Subscriber> & Pick<Subscriber, "email">): Subscriber {
    return new Subscriber(
      overrides.id ?? 1,
      overrides.createdAt ?? new Date("2026-05-01T00:00:00Z"),
      overrides.email,
      overrides.name ?? null,
      overrides.active ?? true,
      "token" in overrides ? overrides.token! : "subscriber-token",
      "lastEmailSentAt" in overrides ? overrides.lastEmailSentAt! : null,
      overrides.wantsProjects ?? true,
      overrides.wantsThoughts ?? true,
    );
  }

}
class NeonDatabase implements SubscriberStore {
  private readonly sql;

  constructor(connectionString: string) {
    this.sql = neon(connectionString);
  }

  async readByEmail(email: string) {
    const rows = await this.sql`
			SELECT *
			FROM subscribers
			WHERE email = ${email}
			LIMIT 1
		`;
    return rows[0] ? Subscriber.from(rows[0]) : null;
  }

  async readByToken(token: string) {
    const rows = await this.sql`
			SELECT *
			FROM subscribers
			WHERE token = ${token}
			LIMIT 1
		`;
    return rows[0] ? Subscriber.from(rows[0]) : null;
  }

  async readByTag(tag: BlogPostTag) {
    const rows = await this.readActiveRowsByTag(tag);
    return rows.map(Subscriber.from);
  }

  private readActiveRowsByTag(tag: BlogPostTag) {
    switch (tag) {
      case "projects":
        return this.sql`
          SELECT *
          FROM subscribers
          WHERE active = true
            AND wants_projects = true
        `;

      case "thoughts":
        return this.sql`
          SELECT *
          FROM subscribers
          WHERE active = true
            AND wants_thoughts = true
        `;
    }
  }

  async create({
    email,
    token,
  }: PendingSubscriberInput) {
    await this.sql`
			INSERT INTO subscribers (email, active, token)
			VALUES (${email}, false, ${token})
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
    const nullName = name || null;
    await this.sql`
			UPDATE subscribers
			SET name = ${nullName},
				wants_projects = ${wantsProjects},
				wants_thoughts = ${wantsThoughts}
			WHERE token = ${token}
		`;
  }

  async deleteByToken(token: string) {
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

class FakeDatabase implements SubscriberStore {
  async readByEmail(email: string) {
    console.log("FakeDatabase.readSubscriberByEmail", { email });
    return null;
  }

  async readByToken(token: string) {
    console.log("FakeDatabase.readSubscriberByToken", { token });
    return null;
  }

  async readByTag(tag: BlogPostTag) {
    console.log("FakeDatabase.readActiveSubscribersByTag", { tag });
    return [];
  }

  async create(input: PendingSubscriberInput) {
    console.log("FakeDatabase.createPendingSubscriber", input);
  }

  async updateActive(token: string) {
    console.log("FakeDatabase.updateActive", { token });
  }

  async updatePreferences(input: PreferencesInput) {
    console.log("FakeDatabase.updatePreferences", input);
  }

  async deleteByToken(token: string) {
    console.log("FakeDatabase.deleteSubscriberByToken", { token });
  }

  async updateLastEmailSentAt(email: string, sentAt: Date) {
    console.log("FakeDatabase.updateLastEmailSentAt", { email, sentAt });
  }
}

const connectionString = import.meta.env.NEON_DATABASE_URL;

export const subscriberStore: SubscriberStore = connectionString
  ? new NeonDatabase(connectionString)
  : new FakeDatabase();
