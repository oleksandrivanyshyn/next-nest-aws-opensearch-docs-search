CREATE TYPE "public"."document_status" AS ENUM('PENDING', 'INDEXED', 'ERROR');--> statement-breakpoint
CREATE TABLE "documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_email" varchar(255) NOT NULL,
	"user_filename" text NOT NULL,
	"s3_key" text NOT NULL,
	"status" "document_status" DEFAULT 'PENDING' NOT NULL,
	"error_message" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "documents_s3_key_unique" UNIQUE("s3_key")
);
