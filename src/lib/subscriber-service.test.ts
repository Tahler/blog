import { describe, expect, it } from "vitest";

import { FakeEmailer } from "./email";
import type { Post } from "./posts";
import { SubscriberService } from "./subscriber-service";
import { FakeSubscriberStore, Subscriber } from "./subscriber-store";

describe(SubscriberService, () => {
  it("create inserts a subscriber and sends confirmation email", async () => {
    const store = new FakeSubscriberStore();
    const emailer = new FakeEmailer();
    const service = new SubscriberService(store, emailer);

    const email = "alice@example.com";
    await service.create(email, new URL("https://bertyl.com"));

    const got = await store.readByEmail(email);
    expect(got).not.toBeNull();
    expect(got?.email).toEqual(email);
    expect(got?.active).toBe(false);
    const token = got?.token;
    expect(token).not.toBeNull();
    expect(emailer.sent).toEqual([
      {
        to: email,
        subject: "You're almost subscribed",
        html: expect.stringContaining(
          `href="https://bertyl.com/subscribe?t=${token}"`,
        ),
      },
    ]);
  });

  it("create does not resend within five minutes", async () => {
    const now = new Date("2026-05-01T00:00:00.000Z");
    const fiveMinutes = 5 * 60 * 1000;
    const withinThreshold = new Date(now.getTime() - fiveMinutes + 1);
    const subscriber = Subscriber.build({
      email: "alice@example.com",
      active: false,
      token: "existing-token",
      lastEmailSentAt: withinThreshold,
    });
    const store = new FakeSubscriberStore([subscriber]);
    const emailer = new FakeEmailer();
    const service = new SubscriberService(store, emailer, () => now);

    await service.create(subscriber.email, new URL("https://bertyl.com"));

    expect(emailer.sent).toEqual([]);
  });

  it("create resends if more than five minutes ago", async () => {
    const now = new Date("2026-05-01T00:00:00.000Z");
    const fiveMinutes = 5 * 60 * 1000;
    const outsideThreshold = new Date(now.getTime() - fiveMinutes - 1);
    const subscriber = Subscriber.build({
      email: "alice@example.com",
      active: false,
      token: "existing-token",
      lastEmailSentAt: outsideThreshold,
    });
    const store = new FakeSubscriberStore([subscriber]);
    const emailer = new FakeEmailer();
    const service = new SubscriberService(store, emailer, () => now);

    await service.create(subscriber.email, new URL("https://bertyl.com"));

    expect(emailer.sent).toEqual([
      expect.objectContaining({
        to: "alice@example.com",
        subject: "You're almost subscribed",
      }),
    ]);
  });

  it("confirm activates the matching subscriber", async () => {
    const store = new FakeSubscriberStore([
      Subscriber.build({
        email: "alice@example.com",
        active: false,
        token: "alice-token",
      }),
    ]);
    const service = new SubscriberService(store, new FakeEmailer());

    await service.confirm("alice-token");

    expect(store.subscribers[0]?.active).toBe(true);
  });

  it("updatePreferences updates the matching subscriber", async () => {
    const token = "some-token";
    const store = new FakeSubscriberStore([
      Subscriber.build({
        email: "alice@example.com",
        name: null,
        token,
        wantsProjects: true,
        wantsThoughts: true,
      }),
    ]);
    const service = new SubscriberService(store, new FakeEmailer());

    await service.updatePreferences(token, {
      name: "Alice",
      wantsProjects: false,
      wantsThoughts: true,
    });

    const got = await store.readByToken(token);
    expect(got?.name).toBe("Alice");
    expect(got?.wantsProjects).toBe(false);
    expect(got?.wantsThoughts).toBe(true);
  });

  it("unsubscribe removes the matching subscriber", async () => {
    const store = new FakeSubscriberStore([
      Subscriber.build({
        email: "alice@example.com",
        token: "alice-token",
      }),
      Subscriber.build({
        email: "bob@example.com",
        token: "bob-token",
      }),
    ]);
    const service = new SubscriberService(store, new FakeEmailer());

    await service.unsubscribe("alice-token");

    const gotEmails = store.subscribers.map((subscriber) => subscriber.email);
    expect(gotEmails).toEqual(["bob@example.com"]);
  });

  it("sendPost sends existing notification payload to matching subscribers", async () => {
    const store = new FakeSubscriberStore([
      Subscriber.build({
        email: "alice@example.com",
        name: "Alice",
        token: "some-token",
        wantsProjects: true,
        wantsThoughts: false,
      }),
    ]);
    const emailer = new FakeEmailer();
    const service = new SubscriberService(store, emailer);
    const post: Post = {
      url: "/blog/a-new-post",
      title: "A New Post",
      description: "A new post description",
      date: new Date("2026-04-30"),
      tag: "projects",
      body: [
        "# Hello",
        "",
        "This is a blog post with a [link](https://example.com).",
      ].join("\n"),
    };

    const result = await service.sendPost(post, new URL("https://bertyl.com"));

    expect(emailer.sent.length).toBe(1);
    if (emailer.sent.length > 0) {
      const got = emailer.sent[0];
      expect(got.to).toEqual("Alice <alice@example.com>");
      expect(got.subject).toEqual("A New Post");
      expect(got.html).toContain("<h1>Hello</h1>");
      expect(got.html).toContain(
        `<p>This is a blog post with a <a href="https://example.com">link</a>.</p>`,
      );
      expect(got.html).toContain(
        `<p>This is a blog post with a <a href="https://example.com">link</a>.</p>`,
      );
      expect(got.html).toContain(
        `<a href="https://bertyl.com/blog/a-new-post">Read on the web</a>`,
      );
      expect(got.html).toContain(
        `<a href="https://bertyl.com/preferences?t=some-token">Manage preferences</a>`,
      );
      expect(got.html).toContain(
        `<a href="https://bertyl.com/unsubscribe?t=some-token">Unsubscribe</a>`,
      );
    }
    expect(result.subscriberCount).toBe(1);
    expect(result.sentCount).toBe(1);
    expect(result.errorsByEmail).toEqual({});
  });
});
