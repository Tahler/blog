import { randomBytes } from "node:crypto";

import { database, type Database, type Subscriber } from "./database";
import { emailer, type Emailer } from "./email";
import { renderPost } from "./render-post";
import type { Post } from "./posts";

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

    const now = new Date();
    const existing = await this.database.readSubscriberByEmail(normalizedEmail);
    if (existing) {
      if (existing.active) {
        // Don't resend confirmations to active subscribers.
        console.log(
          "Refusing to send confirmation to existing active subscriber",
          existing.email,
        );
        return;
      }
      if (!existing.canSendEmail(now)) {
        // Don't spam pending subscribers.
        console.log(
          "Refusing to spam",
          existing.email,
          "who last received email at",
          existing.lastEmailSentAt,
        );
        return;
      }
    }
    const token = generateToken();
    const input = {
      email: normalizedEmail,
      token: token,
      tokenCreatedAt: now,
    };
    if (existing) {
      await this.database.updatePendingSubscriber(input);
    } else {
      await this.database.createPendingSubscriber(input);
    }
    const confirmationUrl = new URL("/subscribe", origin);
    confirmationUrl.searchParams.set("t", token);
    await this.emailer.sendConfirmation(
      normalizedEmail,
      confirmationUrl.toString(),
    );
    await this.database.updateLastEmailSentAt(normalizedEmail, now);
  }

  async confirm(token: string): Promise<void> {
    await this.readSubscriberByToken(token);
    await this.database.updateActive(token);
  }

  async readSubscriberByToken(token: string): Promise<Subscriber> {
    if (!token) {
      throw new InvalidTokenError();
    }
    const subscriber = await this.database.readSubscriberByToken(token);
    if (!subscriber) {
      throw new InvalidTokenError();
    }
    return subscriber;
  }

  async updatePreferences(
    token: string,
    input: { name: string; wantsProjects: boolean; wantsThoughts: boolean },
  ): Promise<void> {
    await this.readSubscriberByToken(token);
    const name = input.name.trim();
    await this.database.updatePreferences({
      token,
      name: name || null,
      wantsProjects: input.wantsProjects,
      wantsThoughts: input.wantsThoughts,
    });
  }

  async unsubscribe(token: string): Promise<void> {
    await this.readSubscriberByToken(token);
    await this.database.deleteSubscriberByToken(token);
  }

  async sendPost(post: Post, site: URL) {
    const postUrl = new URL(post.url, site).toString();
    const contentHtml = renderPost(post);
    const subscribers = await this.database.readActiveSubscribersByTag(
      post.tag,
    );
    let sentCount = 0;
    const errorsByEmail: Record<string, string> = {};

    for (const subscriber of subscribers) {
      if (!subscriber.token) {
        errorsByEmail[subscriber.email] = "Missing token";
        continue;
      }

      const preferencesUrl = new URL("/preferences", site);
      preferencesUrl.searchParams.set("t", subscriber.token);

      const unsubscribeUrl = new URL("/unsubscribe", site);
      unsubscribeUrl.searchParams.set("t", subscriber.token);

      try {
        await this.emailer.sendPost({
          toEmail: subscriber.email,
          subject: post.title,
          contentHtml,
          postUrl,
          preferencesUrl: preferencesUrl.toString(),
          unsubscribeUrl: unsubscribeUrl.toString(),
        });
        sentCount += 1;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        errorsByEmail[subscriber.email] = message;
      }
    }

    return {
      post,
      subscriberCount: subscribers.length,
      sentCount,
      errorsByEmail,
    };
  }
}

function generateToken() {
  return randomBytes(32).toString("base64url");
}

export class InvalidEmailError extends Error {}

export class InvalidTokenError extends Error {}

export const subscriberService = new SubscriberService(database, emailer);
