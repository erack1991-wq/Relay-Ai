ALTER TABLE `customers` ADD COLUMN `messenger_psid` text;
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_customers_workspace_messenger` ON `customers` (`workspace`,`messenger_psid`) WHERE `messenger_psid` IS NOT NULL;
