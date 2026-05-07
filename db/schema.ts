import { boolean, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const subscribers = pgTable("subscribers", {
  id: serial("id").primaryKey(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  email: text("email").notNull().unique(),
  name: text("name"),
  active: boolean("active").notNull().default(false),
  token: text("token"),
  tokenCreatedAt: timestamp("token_created_at"),
  lastEmailSentAt: timestamp("last_email_sent_at"),
  wantsProjects: boolean("wants_projects").notNull().default(true),
  wantsThoughts: boolean("wants_thoughts").notNull().default(true),
});
