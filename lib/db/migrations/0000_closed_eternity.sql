CREATE TABLE "agents" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"category" text NOT NULL,
	"reliability_score" real DEFAULT 0 NOT NULL,
	"cost_score" real DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"supported_models" text[] DEFAULT '{}' NOT NULL,
	"strengths" text[] DEFAULT '{}' NOT NULL,
	"use_cases" text[] DEFAULT '{}' NOT NULL,
	"permissions" text[] DEFAULT '{}' NOT NULL,
	"tasks_completed" integer DEFAULT 0 NOT NULL,
	"avg_response_time" real DEFAULT 0 NOT NULL,
	"last_updated" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inbox_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"source" text NOT NULL,
	"source_icon" text DEFAULT '' NOT NULL,
	"sender" text DEFAULT '' NOT NULL,
	"subject" text NOT NULL,
	"summary" text NOT NULL,
	"priority" text DEFAULT 'medium' NOT NULL,
	"classification" text DEFAULT 'task' NOT NULL,
	"ai_recommendation" text DEFAULT '' NOT NULL,
	"related_project" text DEFAULT '' NOT NULL,
	"priority_score" integer DEFAULT 50 NOT NULL,
	"is_read" boolean DEFAULT false NOT NULL,
	"is_archived" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"owner" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"priority" text DEFAULT 'medium' NOT NULL,
	"progress" integer DEFAULT 0 NOT NULL,
	"risks" text[] DEFAULT '{}' NOT NULL,
	"tags" text[] DEFAULT '{}' NOT NULL,
	"due_date" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'todo' NOT NULL,
	"priority" text DEFAULT 'medium' NOT NULL,
	"category" text DEFAULT 'deep_work' NOT NULL,
	"recurrence" text DEFAULT 'one_off' NOT NULL,
	"source" text DEFAULT 'manual' NOT NULL,
	"calendar_event_id" text,
	"thread_id" text,
	"parent_task_id" integer,
	"parked_reason" text,
	"waiting_on" text,
	"waiting_since" text,
	"blocked_by_task_id" integer,
	"executing_agent_id" text,
	"zdr_endpoint" boolean,
	"queue_position" integer,
	"project_id" integer,
	"assignee" text DEFAULT '' NOT NULL,
	"due_date" text,
	"ai_recommendation" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "calendar_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"start_time" text NOT NULL,
	"end_time" text NOT NULL,
	"type" text DEFAULT 'meeting' NOT NULL,
	"attendees" text[] DEFAULT '{}' NOT NULL,
	"location" text DEFAULT '' NOT NULL,
	"ai_prep" text DEFAULT '' NOT NULL,
	"related_project" text DEFAULT '' NOT NULL,
	"action_items" text[] DEFAULT '{}' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "communications" (
	"id" serial PRIMARY KEY NOT NULL,
	"sender" text NOT NULL,
	"sender_email" text DEFAULT '' NOT NULL,
	"subject" text NOT NULL,
	"source" text DEFAULT 'email' NOT NULL,
	"summary" text NOT NULL,
	"sentiment" text DEFAULT 'neutral' NOT NULL,
	"priority" text DEFAULT 'medium' NOT NULL,
	"suggested_response" text DEFAULT '' NOT NULL,
	"related_project" text DEFAULT '' NOT NULL,
	"required_actions" text[] DEFAULT '{}' NOT NULL,
	"is_read" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "automations" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"trigger" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"applications_used" text[] DEFAULT '{}' NOT NULL,
	"required_permissions" text[] DEFAULT '{}' NOT NULL,
	"requires_approval" boolean DEFAULT false NOT NULL,
	"last_execution" text DEFAULT '' NOT NULL,
	"time_saved" real DEFAULT 0 NOT NULL,
	"runs_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "security_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"severity" text DEFAULT 'low' NOT NULL,
	"description" text NOT NULL,
	"timestamp" text NOT NULL,
	"resolved" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "security_layers" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"status" text DEFAULT 'secure' NOT NULL,
	"score" integer DEFAULT 100 NOT NULL,
	"last_scan" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vault_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"permission_level" text DEFAULT 'read' NOT NULL,
	"last_accessed" text DEFAULT '' NOT NULL,
	"owner" text DEFAULT '' NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"encrypted_value" text NOT NULL,
	"username" text DEFAULT '' NOT NULL,
	"always_ask" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vault_access_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"vault_item_id" integer NOT NULL,
	"item_name" text NOT NULL,
	"action" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "research_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"type" text DEFAULT 'article' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"tags" text[] DEFAULT '{}' NOT NULL,
	"sources" integer DEFAULT 0 NOT NULL,
	"credibility_score" real DEFAULT 0 NOT NULL,
	"ai_summary" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "memory_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"category" text NOT NULL,
	"key" text NOT NULL,
	"value" text NOT NULL,
	"is_protected" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "approvals" (
	"id" serial PRIMARY KEY NOT NULL,
	"action" text NOT NULL,
	"requesting_agent" text NOT NULL,
	"reason" text NOT NULL,
	"risk_level" text DEFAULT 'low' NOT NULL,
	"data_involved" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" text
);
--> statement-breakpoint
CREATE TABLE "insights" (
	"id" serial PRIMARY KEY NOT NULL,
	"message" text NOT NULL,
	"category" text NOT NULL,
	"confidence_score" real DEFAULT 0.8 NOT NULL,
	"priority" text DEFAULT 'medium' NOT NULL,
	"action_required" boolean DEFAULT false NOT NULL,
	"related_project" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "operating_modes" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"icon" text NOT NULL,
	"is_active" boolean DEFAULT false NOT NULL,
	"color" text DEFAULT 'cyan' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "marketplace_agents" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"provider" text NOT NULL,
	"category" text NOT NULL,
	"accuracy_score" real DEFAULT 0 NOT NULL,
	"cost_score" real DEFAULT 0 NOT NULL,
	"speed_score" real DEFAULT 0 NOT NULL,
	"reliability_score" real DEFAULT 0 NOT NULL,
	"privacy_score" real DEFAULT 0 NOT NULL,
	"is_installed" boolean DEFAULT false NOT NULL,
	"version" text DEFAULT '1.0.0' NOT NULL,
	"pricing" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "oauth_tokens" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"provider" text NOT NULL,
	"access_token" text NOT NULL,
	"refresh_token" text,
	"expires_at" timestamp with time zone,
	"scope" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_conversations" (
	"id" serial PRIMARY KEY NOT NULL,
	"agent_id" text NOT NULL,
	"session_id" text NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"tool_name" text,
	"latency_ms" integer,
	"tokens" integer,
	"cost_usd" double precision,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "task_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"command_text" text NOT NULL,
	"trigger_type" text DEFAULT 'manual' NOT NULL,
	"trigger_source" text,
	"agent_id" text DEFAULT 'claude' NOT NULL,
	"agent_type" text DEFAULT 'orchestrator' NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"steps" jsonb DEFAULT '[]' NOT NULL,
	"preview_content" text,
	"result_summary" text,
	"error_message" text,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"retry_from_step" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "entity_work_domains" (
	"id" serial PRIMARY KEY NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"work_domain_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "work_domains" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"is_built_in" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "skill_sets" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"content" text DEFAULT '' NOT NULL,
	"source_type" text DEFAULT 'authored' NOT NULL,
	"source_url" text,
	"source_author" text,
	"source_updated_at" text,
	"requested_tools" jsonb DEFAULT '[]' NOT NULL,
	"requested_integration_ids" jsonb DEFAULT '[]' NOT NULL,
	"version" text DEFAULT '1.0.0' NOT NULL,
	"status" text DEFAULT 'available' NOT NULL,
	"installed_at" timestamp with time zone,
	"source_document_id" integer,
	"source_section_id" text,
	"login_vault_item_id" integer,
	"recording" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "task_skill_set_suggestions" (
	"id" serial PRIMARY KEY NOT NULL,
	"task_id" integer NOT NULL,
	"skill_set_id" integer NOT NULL,
	"reason" text NOT NULL,
	"dismissed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "integration_directory" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"data_scope" text NOT NULL,
	"action_scope" text NOT NULL,
	"reversible" boolean DEFAULT true NOT NULL,
	"source_type" text DEFAULT 'directory' NOT NULL,
	"source_url" text,
	"source_author" text,
	"provider_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "custom_integrations" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"name" text NOT NULL,
	"source_type" text NOT NULL,
	"source_url" text,
	"base_url" text,
	"operations" text,
	"encrypted_auth_token" text,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "action_receipts" (
	"id" serial PRIMARY KEY NOT NULL,
	"description" text NOT NULL,
	"category" text NOT NULL,
	"scope" text NOT NULL,
	"outcome" text DEFAULT 'success' NOT NULL,
	"target" text,
	"detail" text,
	"can_undo" boolean DEFAULT false NOT NULL,
	"undone" boolean DEFAULT false NOT NULL,
	"related_approval_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"display_name" text DEFAULT '' NOT NULL,
	"role" text DEFAULT '' NOT NULL,
	"is_admin" boolean DEFAULT false NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "procedure_checks" (
	"id" serial PRIMARY KEY NOT NULL,
	"skill_set_id" integer NOT NULL,
	"document_id" integer,
	"section_id" text,
	"status" text NOT NULL,
	"first_difference" integer,
	"result" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"less_certain" boolean DEFAULT false NOT NULL,
	"needs_review" boolean DEFAULT false NOT NULL,
	"checked_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "procedure_checks_skill_set_id_unique" UNIQUE("skill_set_id")
);
--> statement-breakpoint
CREATE TABLE "procedure_documents" (
	"id" serial PRIMARY KEY NOT NULL,
	"work_domain_id" integer NOT NULL,
	"name" text NOT NULL,
	"file_name" text DEFAULT '' NOT NULL,
	"text" text DEFAULT '' NOT NULL,
	"sections" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"confidential" boolean DEFAULT false NOT NULL,
	"content_hash" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "meeting_briefs" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_id" text NOT NULL,
	"title" text NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"attendees" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"brief" text NOT NULL,
	"email_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"suggested_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"refreshed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "meeting_briefs_event_id_unique" UNIQUE("event_id")
);
--> statement-breakpoint
CREATE TABLE "suggestions" (
	"id" serial PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"title" text NOT NULL,
	"body" text DEFAULT '' NOT NULL,
	"why" text DEFAULT '' NOT NULL,
	"ref" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone,
	"dismissed_at" timestamp with time zone,
	"opened_at" timestamp with time zone
);
--> statement-breakpoint
CREATE INDEX "ac_agent_session_idx" ON "agent_conversations" USING btree ("agent_id","session_id","created_at");--> statement-breakpoint
CREATE INDEX "ac_created_at_idx" ON "agent_conversations" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "tr_status_idx" ON "task_runs" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "tr_trigger_idx" ON "task_runs" USING btree ("trigger_type","created_at");--> statement-breakpoint
CREATE INDEX "tr_created_at_idx" ON "task_runs" USING btree ("created_at");