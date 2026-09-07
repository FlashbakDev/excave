CREATE TABLE IF NOT EXISTS "worlds" (
  "id" text PRIMARY KEY NOT NULL,
  "seed" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
