CREATE TABLE `alerts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`kind` text NOT NULL,
	`app` text,
	`pid` integer,
	`detail` text,
	`t` integer NOT NULL,
	`received` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `alerts_t` ON `alerts` (`t`);--> statement-breakpoint
CREATE INDEX `alerts_app` ON `alerts` (`app`,`t`);--> statement-breakpoint
CREATE TABLE `api_keys` (
	`key` text PRIMARY KEY NOT NULL,
	`label` text NOT NULL,
	`created` integer NOT NULL,
	`last_used` integer,
	`uses` integer DEFAULT 0 NOT NULL,
	`revoked` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `apps` (
	`name` text PRIMARY KEY NOT NULL,
	`runtime` text,
	`release` text,
	`env` text,
	`first_seen` integer NOT NULL,
	`last_seen` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`issue_id` integer,
	`app` text NOT NULL,
	`type` integer NOT NULL,
	`level` integer NOT NULL,
	`msg` text NOT NULL,
	`ctx` text,
	`frames` text,
	`fingerprint` text,
	`release` text,
	`env` text,
	`runtime` text,
	`pid` integer,
	`sdk` text,
	`t` integer NOT NULL,
	`received` integer NOT NULL,
	FOREIGN KEY (`issue_id`) REFERENCES `issues`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `events_t` ON `events` (`t`);--> statement-breakpoint
CREATE INDEX `events_app` ON `events` (`app`,`level`,`t`);--> statement-breakpoint
CREATE INDEX `events_issue` ON `events` (`issue_id`,`t`);--> statement-breakpoint
CREATE TABLE `issues` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`app` text NOT NULL,
	`fingerprint` text NOT NULL,
	`title` text NOT NULL,
	`level` integer NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`count` integer DEFAULT 0 NOT NULL,
	`release` text,
	`first_seen` integer NOT NULL,
	`last_seen` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `issues_last` ON `issues` (`status`,`last_seen`);--> statement-breakpoint
CREATE UNIQUE INDEX `issues_app_fingerprint` ON `issues` (`app`,`fingerprint`);--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`username` text NOT NULL,
	`password` text NOT NULL,
	`created` integer NOT NULL,
	`last_login` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_username_unique` ON `users` (`username`);