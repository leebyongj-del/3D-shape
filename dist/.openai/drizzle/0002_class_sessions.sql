CREATE TABLE `class_sessions` (
	`session_key` text PRIMARY KEY NOT NULL,
	`label` text NOT NULL,
	`is_active` integer DEFAULT 0 NOT NULL CHECK (`is_active` IN (0, 1)),
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_class_sessions_active_updated`
ON `class_sessions` (`is_active`, `updated_at`);
--> statement-breakpoint
PRAGMA optimize;
