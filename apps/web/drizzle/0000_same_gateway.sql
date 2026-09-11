CREATE TYPE "public"."case_status" AS ENUM('received', 'needs_review', 'needs_documents', 'needs_signature', 'ready_to_file', 'filed', 'under_review', 'decided_granted', 'decided_denied', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."event_actor" AS ENUM('system', 'user', 'operator');--> statement-breakpoint
CREATE TYPE "public"."file_kind" AS ENUM('notification', 'cnh', 'crlv', 'packet', 'signed_packet', 'receipt', 'decision');--> statement-breakpoint
CREATE TYPE "public"."orgao" AS ENUM('STTU', 'DETRAN_RN', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."stage" AS ENUM('NA', 'NIP');--> statement-breakpoint
CREATE TABLE "case_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"case_id" uuid NOT NULL,
	"type" text NOT NULL,
	"message_pt" text NOT NULL,
	"actor" "event_actor" NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "case_files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"case_id" uuid NOT NULL,
	"kind" "file_kind" NOT NULL,
	"storage_key" text NOT NULL,
	"mime" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"original_name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"token" text NOT NULL,
	"status" "case_status" DEFAULT 'received' NOT NULL,
	"orgao" "orgao",
	"stage" "stage",
	"orgao_code" text,
	"orgao_name" text,
	"ait_number" text,
	"placa" text,
	"renavam" text,
	"infraction_code" text,
	"infraction_description" text,
	"occurred_at" timestamp with time zone,
	"location" text,
	"amount_cents" integer,
	"issued_at" date,
	"deadline_defense" date,
	"deadline_driver_indication" date,
	"deadline_appeal" date,
	"owner_name" text,
	"owner_cpf" text,
	"owner_email" text,
	"owner_phone" text,
	"owner_address" text,
	"owner_cep" text,
	"narrative" jsonb,
	"protocol_number" text,
	"filed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cases_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "extractions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"case_id" uuid NOT NULL,
	"model" text NOT NULL,
	"prompt_version" text NOT NULL,
	"raw" jsonb NOT NULL,
	"normalized" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "case_events" ADD CONSTRAINT "case_events_case_id_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case_files" ADD CONSTRAINT "case_files_case_id_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "extractions" ADD CONSTRAINT "extractions_case_id_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE cascade ON UPDATE no action;