CREATE TABLE `operator_memory` (
  `id` text PRIMARY KEY NOT NULL,
  `owner` text NOT NULL,
  `kind` text NOT NULL,
  `title` text NOT NULL,
  `content` text NOT NULL,
  `source_task` text NOT NULL DEFAULT '',
  `created` text NOT NULL,
  `updated` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_operator_memory_owner_kind` ON `operator_memory` (`owner`,`kind`,`updated`);
