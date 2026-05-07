CREATE TABLE "subscribers" (
	"id" serial PRIMARY KEY NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"email" text NOT NULL,
	"name" text,
	"active" boolean DEFAULT false NOT NULL,
	"token" text,
	"token_created_at" timestamp,
	"last_email_sent_at" timestamp,
	"wants_projects" boolean DEFAULT true NOT NULL,
	"wants_thoughts" boolean DEFAULT true NOT NULL,
	CONSTRAINT "subscribers_email_unique" UNIQUE("email")
);
