CREATE TABLE `session_access` (
	`session_key` text PRIMARY KEY NOT NULL,
	`join_code` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `student_progress` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`session_key` text NOT NULL,
	`participant_id` text NOT NULL,
	`group_no` integer NOT NULL CHECK (`group_no` BETWEEN 1 AND 8),
	`display_name` text NOT NULL,
	`current_stage` integer NOT NULL DEFAULT 1 CHECK (`current_stage` BETWEEN 1 AND 4),
	`progress_percent` integer NOT NULL DEFAULT 0 CHECK (`progress_percent` BETWEEN 0 AND 100),
	`is_complete` integer NOT NULL DEFAULT 0,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_student_progress_session_participant` ON `student_progress` (`session_key`,`participant_id`);
--> statement-breakpoint
CREATE INDEX `idx_student_progress_session_group` ON `student_progress` (`session_key`,`group_no`);
