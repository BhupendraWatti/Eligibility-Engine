ALTER TABLE `recruitment_eligibility` ADD `age_relaxation_ews` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `recruitment_eligibility` ADD `min_percentage_required` integer;--> statement-breakpoint
ALTER TABLE `recruitment_eligibility` ADD `additional_skills_json` text;