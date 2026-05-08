import { randomBytes } from "node:crypto";

import { subscriberStore, type SubscriberStore, type Subscriber } from "./subscriber-store";
import { emailer, type SubscriberEmailer } from "./email";
import { renderPost } from "./render-post";
import type { Post } from "./posts";

export class SubscriberService {
  constructor(
    private readonly store: SubscriberStore,
    private readonly emailer: SubscriberEmailer,
  ) { }

  /**
   * Creates a pending subscriber and sends a confirmation email.
   *
   * If a pending subscriber already exists, another email is sent unless the
   * last one was sent within the last five minutes.
   *
   * If an active subscriber already exists, nothing happens.
   */
  async create(email: string, origin: URL) {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      throw new InvalidEmailError();
    }

    const now = new Date();
    const existing = await this.store.readByEmail(normalizedEmail);
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

    const token = existing?.token ?? generateToken();
    if (!existing) {
      await this.store.create({
        email: normalizedEmail,
        token,
      });
    }

    const confirmationUrl = new URL("/subscribe", origin);
    confirmationUrl.searchParams.set("t", token);
    await this.emailer.sendConfirmation(
      normalizedEmail,
      confirmationUrl.toString(),
    );
    await this.store.updateLastEmailSentAt(normalizedEmail, now);
  }

  async confirm(token: string): Promise<void> {
    await this.readByToken(token);
    await this.store.updateActive(token);
  }

  async readByToken(token: string): Promise<Subscriber> {
    if (!token) {
      throw new InvalidTokenError();
    }
    const subscriber = await this.store.readByToken(token);
    if (!subscriber) {
      throw new InvalidTokenError();
    }
    return subscriber;
  }

  async updatePreferences(
    token: string,
    input: { name: string; wantsProjects: boolean; wantsThoughts: boolean },
  ): Promise<void> {
    await this.readByToken(token);
    const name = input.name.trim();
    await this.store.updatePreferences({
      token,
      ...(name ? { name } : {}),
      wantsProjects: input.wantsProjects,
      wantsThoughts: input.wantsThoughts,
    });
  }

  async unsubscribe(token: string): Promise<void> {
    await this.readByToken(token);
    await this.store.deleteByToken(token);
  }

  async sendPost(post: Post, site: URL) {
    const postUrl = new URL(post.url, site).toString();
    const contentHtml = renderPost(post);
    const subscribers = await this.store.readByTag(
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

export class InvalidEmailError extends Error { }

export class InvalidTokenError extends Error { }

export const subscriberService = new SubscriberService(subscriberStore, emailer);
