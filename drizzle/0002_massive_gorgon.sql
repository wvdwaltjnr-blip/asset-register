CREATE TABLE `asset_categories` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`default_useful_life_years` real NOT NULL,
	`created_at` text DEFAULT (current_timestamp) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `asset_categories_name_unique` ON `asset_categories` (`name`);--> statement-breakpoint
ALTER TABLE `assets` ADD `category_id` integer REFERENCES asset_categories(id);