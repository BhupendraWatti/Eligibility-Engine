CREATE TABLE `admin_users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`name` text NOT NULL,
	`role` text DEFAULT 'EDITOR' NOT NULL,
	`is_active` integer DEFAULT 1 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `admin_users_email_unique` ON `admin_users` (`email`);--> statement-breakpoint
CREATE TABLE `departments` (
	`id` text PRIMARY KEY NOT NULL,
	`organisation_id` text NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`description` text,
	`is_active` integer DEFAULT 1 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`organisation_id`) REFERENCES `organisations`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `unq_org_dept_slug` ON `departments` (`organisation_id`,`slug`);--> statement-breakpoint
CREATE TABLE `important_dates` (
	`id` text PRIMARY KEY NOT NULL,
	`recruitment_id` text NOT NULL,
	`event_type` text NOT NULL,
	`event_date` text NOT NULL,
	`is_tentative` integer DEFAULT 0 NOT NULL,
	`notes` text,
	FOREIGN KEY (`recruitment_id`) REFERENCES `recruitments`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_dates_rec` ON `important_dates` (`recruitment_id`);--> statement-breakpoint
CREATE TABLE `official_links` (
	`id` text PRIMARY KEY NOT NULL,
	`recruitment_id` text NOT NULL,
	`link_type` text NOT NULL,
	`title` text NOT NULL,
	`url` text NOT NULL,
	`is_active` integer DEFAULT 1 NOT NULL,
	FOREIGN KEY (`recruitment_id`) REFERENCES `recruitments`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `organisations` (
	`id` text PRIMARY KEY NOT NULL,
	`state_id` text NOT NULL,
	`name` text NOT NULL,
	`short_name` text NOT NULL,
	`slug` text NOT NULL,
	`website_url` text NOT NULL,
	`is_active` integer DEFAULT 1 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`state_id`) REFERENCES `states`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `organisations_slug_unique` ON `organisations` (`slug`);--> statement-breakpoint
CREATE INDEX `idx_org_state` ON `organisations` (`state_id`);--> statement-breakpoint
CREATE TABLE `posts` (
	`id` text PRIMARY KEY NOT NULL,
	`department_id` text NOT NULL,
	`sector_id` text NOT NULL,
	`title` text NOT NULL,
	`slug` text NOT NULL,
	`summary` text NOT NULL,
	`pay_scale` text,
	`default_min_age` integer DEFAULT 18 NOT NULL,
	`default_max_age` integer DEFAULT 33 NOT NULL,
	`default_qualification` text DEFAULT '10TH' NOT NULL,
	`is_active` integer DEFAULT 1 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`department_id`) REFERENCES `departments`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`sector_id`) REFERENCES `sectors`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `posts_slug_unique` ON `posts` (`slug`);--> statement-breakpoint
CREATE INDEX `idx_posts_sector` ON `posts` (`sector_id`);--> statement-breakpoint
CREATE INDEX `idx_posts_dept` ON `posts` (`department_id`);--> statement-breakpoint
CREATE TABLE `recruitment_eligibility` (
	`id` text PRIMARY KEY NOT NULL,
	`recruitment_id` text NOT NULL,
	`min_age` integer DEFAULT 18 NOT NULL,
	`max_age_general` integer DEFAULT 33 NOT NULL,
	`age_cutoff_date` text NOT NULL,
	`age_relaxation_sc_st` integer DEFAULT 5 NOT NULL,
	`age_relaxation_obc` integer DEFAULT 3 NOT NULL,
	`age_relaxation_female` integer DEFAULT 5 NOT NULL,
	`min_qualification_level` text NOT NULL,
	`allowed_streams_json` text,
	`requires_mp_domicile` integer DEFAULT 0 NOT NULL,
	`requires_mp_employment_reg` integer DEFAULT 1 NOT NULL,
	`requires_cpct` integer DEFAULT 0 NOT NULL,
	`gender_allowed` text DEFAULT 'ALL' NOT NULL,
	`min_height_male_cm` real,
	`min_height_female_cm` real,
	`min_chest_male_cm` real,
	`experience_months` integer DEFAULT 0 NOT NULL,
	`special_conditions_notes` text,
	FOREIGN KEY (`recruitment_id`) REFERENCES `recruitments`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `recruitment_eligibility_recruitment_id_unique` ON `recruitment_eligibility` (`recruitment_id`);--> statement-breakpoint
CREATE TABLE `recruitments` (
	`id` text PRIMARY KEY NOT NULL,
	`post_id` text NOT NULL,
	`organisation_id` text NOT NULL,
	`state_id` text NOT NULL,
	`advt_number` text NOT NULL,
	`title` text NOT NULL,
	`slug` text NOT NULL,
	`short_summary` text NOT NULL,
	`cycle_year` integer NOT NULL,
	`total_vacancies` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'DRAFT' NOT NULL,
	`lifecycle_status` text DEFAULT 'UPCOMING' NOT NULL,
	`is_featured` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`post_id`) REFERENCES `posts`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`organisation_id`) REFERENCES `organisations`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`state_id`) REFERENCES `states`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `recruitments_slug_unique` ON `recruitments` (`slug`);--> statement-breakpoint
CREATE INDEX `idx_rec_status_lifecycle` ON `recruitments` (`status`,`lifecycle_status`);--> statement-breakpoint
CREATE INDEX `idx_rec_post` ON `recruitments` (`post_id`);--> statement-breakpoint
CREATE INDEX `idx_rec_state` ON `recruitments` (`state_id`);--> statement-breakpoint
CREATE TABLE `sectors` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`icon` text,
	`display_order` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sectors_slug_unique` ON `sectors` (`slug`);--> statement-breakpoint
CREATE TABLE `sources` (
	`id` text PRIMARY KEY NOT NULL,
	`recruitment_id` text NOT NULL,
	`source_type` text NOT NULL,
	`source_url` text NOT NULL,
	`source_title` text NOT NULL,
	`publication_date` text,
	`last_verified_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`recruitment_id`) REFERENCES `recruitments`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `states` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`is_active` integer DEFAULT 1 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `states_code_unique` ON `states` (`code`);--> statement-breakpoint
CREATE UNIQUE INDEX `states_slug_unique` ON `states` (`slug`);--> statement-breakpoint
CREATE TABLE `vacancies` (
	`id` text PRIMARY KEY NOT NULL,
	`recruitment_id` text NOT NULL,
	`category` text NOT NULL,
	`gender` text DEFAULT 'ALL' NOT NULL,
	`count` integer NOT NULL,
	FOREIGN KEY (`recruitment_id`) REFERENCES `recruitments`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_vacancies_rec` ON `vacancies` (`recruitment_id`);