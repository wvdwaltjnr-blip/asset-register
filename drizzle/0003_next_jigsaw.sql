CREATE TABLE `insurance_types` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`created_at` text DEFAULT (current_timestamp) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `insurance_types_name_unique` ON `insurance_types` (`name`);--> statement-breakpoint
ALTER TABLE `assets` ADD `insurance_type_id` integer REFERENCES insurance_types(id);