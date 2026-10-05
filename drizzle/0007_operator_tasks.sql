CREATE TABLE `operator_tasks` (
  `id` text PRIMARY KEY NOT NULL,
  `owner` text NOT NULL,
  `title` text NOT NULL,
  `objective` text NOT NULL,
  `status` text NOT NULL DEFAULT 'queued',
  `approval` text NOT NULL DEFAULT 'not_required',
  `next_action` text NOT NULL DEFAULT '',
  `result` text NOT NULL DEFAULT '',
  `created` text NOT NULL,
  `updated` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_operator_tasks_owner_status` ON `operator_tasks` (`owner`,`status`,`updated`);
