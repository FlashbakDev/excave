CREATE TABLE IF NOT EXISTS "players" (
  "id" text PRIMARY KEY NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "last_seen_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "excavation_nodes" (
  "id" text PRIMARY KEY NOT NULL,
  "world_id" text NOT NULL,
  "chunk_x" integer NOT NULL,
  "chunk_y" integer NOT NULL,
  "tile_x" integer NOT NULL,
  "tile_y" integer NOT NULL,
  "world_tile_x" integer NOT NULL,
  "world_tile_y" integer NOT NULL,
  "wall_side" text NOT NULL,
  "seed" integer NOT NULL,
  "status" text NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "player_items" (
  "player_id" text NOT NULL REFERENCES "players"("id"),
  "item_type" text NOT NULL,
  "quantity" integer NOT NULL,
  PRIMARY KEY ("player_id", "item_type")
);

CREATE TABLE IF NOT EXISTS "excavation_history" (
  "id" text PRIMARY KEY NOT NULL,
  "session_id" text NOT NULL,
  "node_id" text NOT NULL,
  "player_id" text NOT NULL REFERENCES "players"("id"),
  "world_id" text NOT NULL,
  "status" text NOT NULL,
  "recovered_json" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "excavation_history_session_uidx"
  ON "excavation_history" ("session_id");
