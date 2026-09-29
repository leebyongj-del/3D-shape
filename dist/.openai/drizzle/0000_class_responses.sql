CREATE TABLE `responses` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `session_key` text NOT NULL,
  `group_no` integer NOT NULL CHECK (`group_no` BETWEEN 1 AND 8),
  `activity` text NOT NULL,
  `answer` text NOT NULL,
  `reason` text NOT NULL,
  `is_correct` integer DEFAULT 0 NOT NULL,
  `updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_responses_session_group_activity`
ON `responses` (`session_key`, `group_no`, `activity`);
--> statement-breakpoint
CREATE INDEX `idx_responses_session_updated`
ON `responses` (`session_key`, `updated_at`);
--> statement-breakpoint
PRAGMA optimize;
