CREATE TABLE `asset_cost_adjustments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`asset_id` integer NOT NULL,
	`type` text NOT NULL,
	`amount` real NOT NULL,
	`occurred_at` text NOT NULL,
	`note` text,
	`recorded_by_id` integer NOT NULL,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`asset_id`) REFERENCES `assets`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`recorded_by_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `assets` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`description` text NOT NULL,
	`invoice_number` text,
	`vin_number` text,
	`registration` text,
	`status` text DEFAULT 'active' NOT NULL,
	`purchase_date` text NOT NULL,
	`disposal_date` text,
	`cost` real NOT NULL,
	`useful_life_years` real NOT NULL,
	`comments` text,
	`created_by_id` integer NOT NULL,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	`updated_at` text,
	FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`currency` text DEFAULT 'R' NOT NULL,
	`fiscal_year_start_month` integer DEFAULT 3 NOT NULL,
	`fiscal_year_start_day` integer DEFAULT 1 NOT NULL
);
