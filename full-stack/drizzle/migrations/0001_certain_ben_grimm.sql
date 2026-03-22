CREATE TABLE "backup_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"target" varchar(20) NOT NULL,
	"file_name" varchar(255) NOT NULL,
	"file_size" integer,
	"status" varchar(20) NOT NULL,
	"error" text,
	"duration_ms" integer,
	"table_counts" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
