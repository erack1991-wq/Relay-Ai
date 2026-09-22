CREATE TABLE `voice_calls` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace` text NOT NULL,
	`phone` text NOT NULL,
	`state` text NOT NULL,
	`status` text DEFAULT 'in-progress' NOT NULL,
	`error` text DEFAULT '' NOT NULL,
	`created` text NOT NULL,
	`updated` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `voice_turns` (
	`id` text PRIMARY KEY NOT NULL,
	`response` text DEFAULT '' NOT NULL
);
