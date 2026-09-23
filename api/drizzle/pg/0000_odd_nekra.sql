CREATE TABLE "alerts" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"app" text,
	"pid" integer,
	"detail" text,
	"t" bigint NOT NULL,
	"received" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "api_keys" (
	"key" text PRIMARY KEY NOT NULL,
	"label" text NOT NULL,
	"created" bigint NOT NULL,
	"last_used" bigint,
	"uses" integer DEFAULT 0 NOT NULL,
	"revoked" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "apps" (
	"name" text PRIMARY KEY NOT NULL,
	"runtime" text,
	"release" text,
	"env" text,
	"first_seen" bigint NOT NULL,
	"last_seen" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"issue_id" bigint,
	"app" text NOT NULL,
	"type" integer NOT NULL,
	"level" integer NOT NULL,
	"msg" text NOT NULL,
	"ctx" text,
	"frames" text,
	"fingerprint" text,
	"release" text,
	"env" text,
	"runtime" text,
	"pid" integer,
	"sdk" text,
	"t" bigint NOT NULL,
	"received" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "issues" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"app" text NOT NULL,
	"fingerprint" text NOT NULL,
	"title" text NOT NULL,
	"level" integer NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	"release" text,
	"first_seen" bigint NOT NULL,
	"last_seen" bigint NOT NULL,
	CONSTRAINT "issues_app_fingerprint" UNIQUE("app","fingerprint")
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"password" text NOT NULL,
	"created" bigint NOT NULL,
	"last_login" bigint,
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_issue_id_issues_id_fk" FOREIGN KEY ("issue_id") REFERENCES "public"."issues"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "alerts_t" ON "alerts" USING btree ("t");--> statement-breakpoint
CREATE INDEX "alerts_app" ON "alerts" USING btree ("app","t");--> statement-breakpoint
CREATE INDEX "events_t" ON "events" USING btree ("t");--> statement-breakpoint
CREATE INDEX "events_app" ON "events" USING btree ("app","level","t");--> statement-breakpoint
CREATE INDEX "events_issue" ON "events" USING btree ("issue_id","t");--> statement-breakpoint
CREATE INDEX "issues_last" ON "issues" USING btree ("status","last_seen");