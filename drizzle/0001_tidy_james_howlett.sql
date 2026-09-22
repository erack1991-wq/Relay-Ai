DROP INDEX `idx_bookings_workspace_start`;--> statement-breakpoint
ALTER TABLE `bookings` ADD `source` text REFERENCES items(id);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_bookings_workspace_source` ON `bookings` (`workspace`,`source`) WHERE "bookings"."status" = 'confirmed' AND "bookings"."source" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `idx_bookings_workspace_start` ON `bookings` (`workspace`,`start`) WHERE "bookings"."status" = 'confirmed';