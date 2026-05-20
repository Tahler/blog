import { randomBytes } from "node:crypto";

import {
  subscriberStore,
  type SubscriberStore,
  type Subscriber,
  type BlogPostTag,
} from "./subscriber-store";
import { emailer, type Emailer } from "./email";
import { renderPost } from "./render-post";
import type { Post } from "./posts";

export class SubscriberService {
  private readonly store: SubscriberStore;
  private readonly emailer: SubscriberEmailer;
  private readonly now: () => Date;

  constructor(
    store: SubscriberStore,
    emailer: Emailer,
    now = () => new Date(),
  ) {
    this.store = store;
    this.emailer = new SubscriberEmailer(emailer);
    this.now = now;
  }

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

    const now = this.now();
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
    input: {
      name: string;
      wantsProjects: boolean;
      wantsThoughts: boolean;
      wantsOther: boolean;
    },
  ): Promise<void> {
    await this.readByToken(token);
    const name = input.name.trim();
    await this.store.updatePreferences({
      token,
      ...(name ? { name } : {}),
      wantsProjects: input.wantsProjects,
      wantsThoughts: input.wantsThoughts,
      wantsOther: input.wantsOther,
    });
  }

  async unsubscribe(token: string): Promise<void> {
    await this.readByToken(token);
    await this.store.deleteByToken(token);
  }

  async unsubscribeFromTag(token: string, tag: BlogPostTag): Promise<void> {
    const subscriber = await this.readByToken(token);
    await this.store.updatePreferences({
      token,
      ...(subscriber.name ? { name: subscriber.name } : {}),
      wantsProjects: tag === "projects" ? false : subscriber.wantsProjects,
      wantsThoughts: tag === "thoughts" ? false : subscriber.wantsThoughts,
      wantsOther: tag === "other" ? false : subscriber.wantsOther,
    });
  }

  async sendPost(post: Post, site: URL) {
    const postUrl = new URL(post.url, site).toString();
    const contentHtml = renderPost(post);
    const subscribers = await this.store.readByTag(post.tag);
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
      unsubscribeUrl.searchParams.set("tag", post.tag);

      try {
        await this.emailer.sendPost({
          to: subscriber,
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

interface SubscriberPostInput {
  to: Recipient;
  subject: string;
  contentHtml: string;
  postUrl: string;
  preferencesUrl: string;
  unsubscribeUrl: string;
}

class SubscriberEmailer {
  constructor(private readonly emailer: Emailer) {}

  async sendConfirmation(email: string, confirmationUrl: string) {
    await this.send(
      { email },
      "You're almost subscribed",
      `
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
    );
  }

  async sendPost(input: SubscriberPostInput) {
    await this.send(
      input.to,
      input.subject,
      `
        <div style="font-family: sans-serif; line-height: 1.5; color: #111;">
          ${input.contentHtml}
          <p><a href="${input.postUrl}">Read on the web</a></p>
          <p><a href="${input.preferencesUrl}">Manage preferences</a></p>
          <p><a href="${input.unsubscribeUrl}">Unsubscribe</a></p>
        </div>
      `,
    );
  }

  private async send(to: Recipient, subject: string, html: string) {
    const toEmail = to.name ? `${to.name} <${to.email}>` : to.email;
    await this.emailer.send({ to: toEmail, subject, html });
  }
}

interface Recipient {
  email: string;
  name?: string | null;
}

export const subscriberService = new SubscriberService(
  subscriberStore,
  emailer,
);
