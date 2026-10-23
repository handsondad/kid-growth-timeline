ALTER TABLE `photos` ADD `media_type` text DEFAULT 'photo' NOT NULL;--> statement-breakpoint
ALTER TABLE `photos` ADD `duration_ms` integer;--> statement-breakpoint
ALTER TABLE `photos` ADD `video_playback_key` text;--> statement-breakpoint
ALTER TABLE `photos` ADD `source_media_id` text;--> statement-breakpoint
ALTER TABLE `photos` ADD `trim_start_ms` integer;--> statement-breakpoint
ALTER TABLE `photos` ADD `trim_end_ms` integer;--> statement-breakpoint
ALTER TABLE `pipeline_queue` ADD `progress` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `pipeline_queue` ADD `dedupe_key` text;--> statement-breakpoint
CREATE UNIQUE INDEX `pipeline_queue_dedupe_key_unique` ON `pipeline_queue` (`dedupe_key`);