import { neon } from "@neondatabase/serverless";

import type { BlogPostTag } from "./blog-post-tags";

export interface SubscriberStore {
  readByEmail(email: string): Promise<Subscriber | null>;
  readByToken(token: string): Promise<Subscriber | null>;
  readByTag(tag: BlogPostTag): Promise<Subscriber[]>;
  create(input: PendingSubscriberInput): Promise<void>;
  updateLastEmailSentAt(email: string, sentAt: Date): Promise<void>;
  updateActive(token: string): Promise<void>;
  updatePreferences(input: PreferencesInput): Promise<void>;
  deleteByToken(token: string): Promise<void>;
}

export interface PendingSubscriberInput {
  email: string;
  token: string;
}

export interface PreferencesInput {
  token: string;
  name?: string;
  wantsProjects: boolean;
  wantsThoughts: boolean;
  wantsTravel: boolean;
  wantsOther: boolean;
}

export class Subscriber {
  constructor(
    public id: number,
    public createdAt: Date,
    public email: string,
    public name: string | null,
    public active: boolean,
    public token: string | null,
    public lastEmailSentAt: Date | null,
    public wantsProjects: boolean,
    public wantsThoughts: boolean,
    public wantsTravel: boolean,
    public wantsOther: boolean,
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
      row.last_email_sent_at as Date | null,
      Boolean(row.wants_projects),
      Boolean(row.wants_thoughts),
      Boolean(row.wants_travel),
      Boolean(row.wants_other),
    );
  }

  static build(
    overrides: Partial<Subscriber> & Pick<Subscriber, "email">,
  ): Subscriber {
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
      overrides.wantsTravel ?? true,
      overrides.wantsOther ?? true,
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

      case "travel":
        return this.sql`
          SELECT *
          FROM subscribers
          WHERE active = true
            AND wants_travel = true
        `;

      case "other":
        return this.sql`
          SELECT *
          FROM subscribers
          WHERE active = true
            AND wants_other = true
        `;
    }
  }

  async create({ email, token }: PendingSubscriberInput) {
    await this.sql`
			INSERT INTO subscribers (email, active, token)
			VALUES (${email}, false, ${token})
		`;
  }

  async updateLastEmailSentAt(email: string, sentAt: Date) {
    await this.sql`
			UPDATE subscribers
			SET last_email_sent_at = ${sentAt}
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
    wantsTravel,
    wantsOther,
  }: PreferencesInput) {
    const nullName = name || null;
    await this.sql`
			UPDATE subscribers
			SET name = ${nullName},
				wants_projects = ${wantsProjects},
				wants_thoughts = ${wantsThoughts},
				wants_travel = ${wantsTravel},
				wants_other = ${wantsOther}
			WHERE token = ${token}
		`;
  }

  async deleteByToken(token: string) {
    await this.sql`
			DELETE FROM subscribers
			WHERE token = ${token}
		`;
  }
}

export class FakeSubscriberStore implements SubscriberStore {
  constructor(public subscribers: Subscriber[] = []) {}

  async readByEmail(email: string) {
    return this.subscribers.find((s) => s.email === email) ?? null;
  }

  async readByToken(token: string) {
    return this.subscribers.find((s) => s.token === token) ?? null;
  }

  async readByTag(tag: BlogPostTag) {
    const predicates: { [k in BlogPostTag]: (s: Subscriber) => boolean } = {
      projects: (s) => s.wantsProjects === true,
      thoughts: (s) => s.wantsThoughts === true,
      travel: (s) => s.wantsTravel === true,
      other: (s) => s.wantsOther === true,
    };
    const predicate = predicates[tag];
    return this.subscribers.filter(predicate) ?? null;
  }

  async create(input: PendingSubscriberInput) {
    this.subscribers.push(
      Subscriber.build({
        email: input.email,
        active: false,
        token: input.token,
      }),
    );
  }

  async updateLastEmailSentAt(email: string, sentAt: Date) {
    const subscriber = await this.readByEmail(email);
    if (!subscriber) {
      return;
    }
    subscriber.lastEmailSentAt = sentAt;
  }

  async updateActive(token: string) {
    const subscriber = await this.readByToken(token);
    if (!subscriber) {
      return;
    }
    subscriber.active = true;
  }

  async updatePreferences(input: PreferencesInput) {
    const subscriber = await this.readByToken(input.token);
    if (!subscriber) {
      return;
    }
    subscriber.name = input.name || null;
    subscriber.wantsProjects = input.wantsProjects;
    subscriber.wantsThoughts = input.wantsThoughts;
    subscriber.wantsTravel = input.wantsTravel;
    subscriber.wantsOther = input.wantsOther;
  }

  async deleteByToken(token: string) {
    const index = this.subscribers.findIndex(
      (subscriber) => subscriber.token === token,
    );
    if (index === -1) {
      return;
    }
    this.subscribers.splice(index, 1);
  }
}

const connectionString = import.meta.env.NEON_DATABASE_URL;

export const subscriberStore: SubscriberStore = connectionString
  ? new NeonDatabase(connectionString)
  : new FakeSubscriberStore();
