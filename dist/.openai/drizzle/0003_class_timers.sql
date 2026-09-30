CREATE TABLE `class_timers` (
	`session_key` text PRIMARY KEY NOT NULL,
	`duration_seconds` integer DEFAULT 2700 NOT NULL CHECK (`duration_seconds` >= 60),
	`remaining_seconds` integer DEFAULT 2700 NOT NULL CHECK (`remaining_seconds` >= 0),
	`is_running` integer DEFAULT 0 NOT NULL CHECK (`is_running` IN (0, 1)),
	`started_at` text,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
PRAGMA optimize;
