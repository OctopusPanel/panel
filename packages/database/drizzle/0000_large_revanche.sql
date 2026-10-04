CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"uuid" uuid DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"username" varchar(64) NOT NULL,
	"password_hash" varchar(255) NOT NULL,
	"role" varchar(32) DEFAULT 'user' NOT NULL,
	"language_preference" varchar(16) DEFAULT 'en' NOT NULL,
	"two_factor_secret" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_uuid_unique" UNIQUE("uuid"),
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE "nodes" (
	"id" serial PRIMARY KEY NOT NULL,
	"uuid" uuid DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(128) NOT NULL,
	"fqdn" varchar(255) NOT NULL,
	"api_port" integer DEFAULT 8080 NOT NULL,
	"sftp_port" integer DEFAULT 2022 NOT NULL,
	"token_hash" varchar(255) NOT NULL,
	"memory_limit" integer NOT NULL,
	"disk_limit" integer NOT NULL,
	"is_maintenance" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "nodes_uuid_unique" UNIQUE("uuid")
);
--> statement-breakpoint
CREATE TABLE "allocations" (
	"id" serial PRIMARY KEY NOT NULL,
	"node_id" integer NOT NULL,
	"ip_address" varchar(64) NOT NULL,
	"port" integer NOT NULL,
	"alias" varchar(255),
	"server_id" integer,
	"is_primary" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "blueprints" (
	"id" serial PRIMARY KEY NOT NULL,
	"uuid" uuid DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(128) NOT NULL,
	"author" varchar(128) DEFAULT 'OctopusPanel' NOT NULL,
	"description" text,
	"docker_image" varchar(255) NOT NULL,
	"docker_images" jsonb DEFAULT '{}'::jsonb,
	"startup_command" text NOT NULL,
	"stop_command" varchar(255) DEFAULT '^C' NOT NULL,
	"config_files" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"variables" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"install_script" text,
	"install_container" varchar(255),
	"install_entrypoint" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "blueprints_uuid_unique" UNIQUE("uuid")
);
--> statement-breakpoint
CREATE TABLE "servers" (
	"id" serial PRIMARY KEY NOT NULL,
	"uuid" uuid DEFAULT gen_random_uuid() NOT NULL,
	"identifier" varchar(8) NOT NULL,
	"name" varchar(128) NOT NULL,
	"description" text,
	"user_id" integer NOT NULL,
	"node_id" integer NOT NULL,
	"blueprint_id" integer NOT NULL,
	"allocation_id" integer,
	"memory" integer NOT NULL,
	"cpu" integer DEFAULT 100 NOT NULL,
	"disk" integer NOT NULL,
	"swap" integer DEFAULT 0 NOT NULL,
	"io" integer DEFAULT 500 NOT NULL,
	"is_suspended" boolean DEFAULT false NOT NULL,
	"status" varchar(32) DEFAULT 'offline' NOT NULL,
	"provider_type" varchar(64) DEFAULT 'tentacle-docker' NOT NULL,
	"docker_image" varchar(255) NOT NULL,
	"startup_command" text NOT NULL,
	"environment" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "servers_uuid_unique" UNIQUE("uuid"),
	CONSTRAINT "servers_identifier_unique" UNIQUE("identifier")
);
--> statement-breakpoint
CREATE TABLE "subusers" (
	"id" serial PRIMARY KEY NOT NULL,
	"server_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"permissions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"action" varchar(128) NOT NULL,
	"resource_type" varchar(64) NOT NULL,
	"resource_id" varchar(128),
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"ip_address" varchar(64),
	"timestamp" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "modules" (
	"id" varchar(128) PRIMARY KEY NOT NULL,
	"name" varchar(128) NOT NULL,
	"version" varchar(32) NOT NULL,
	"description" text,
	"is_enabled" boolean DEFAULT false NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"installed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "allocations" ADD CONSTRAINT "allocations_node_id_nodes_id_fk" FOREIGN KEY ("node_id") REFERENCES "public"."nodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "allocations" ADD CONSTRAINT "allocations_server_id_servers_id_fk" FOREIGN KEY ("server_id") REFERENCES "public"."servers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "servers" ADD CONSTRAINT "servers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "servers" ADD CONSTRAINT "servers_node_id_nodes_id_fk" FOREIGN KEY ("node_id") REFERENCES "public"."nodes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "servers" ADD CONSTRAINT "servers_blueprint_id_blueprints_id_fk" FOREIGN KEY ("blueprint_id") REFERENCES "public"."blueprints"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "servers" ADD CONSTRAINT "servers_allocation_id_allocations_id_fk" FOREIGN KEY ("allocation_id") REFERENCES "public"."allocations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subusers" ADD CONSTRAINT "subusers_server_id_servers_id_fk" FOREIGN KEY ("server_id") REFERENCES "public"."servers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subusers" ADD CONSTRAINT "subusers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;