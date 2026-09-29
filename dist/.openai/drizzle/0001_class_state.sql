CREATE TABLE `class_state` (
	`session_key` text PRIMARY KEY NOT NULL,
	`active_stage` integer DEFAULT 1 NOT NULL CHECK (`active_stage` BETWEEN 1 AND 4),
	`updated_at` text NOT NULL
);
--> statement-breakpoint
PRAGMA optimize;
