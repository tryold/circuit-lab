import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

const now = sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`;

// One row per member who has opened the app, keyed by the Gateway's user.id.
export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  createdAt: text("created_at").notNull().default(now),
});

export const projects = sqliteTable(
  "projects",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id").notNull(),
    // The Gateway's organization id: shared projects are seen within it.
    orgId: text("org_id").notNull(),
    name: text("name").notNull(),
    board: text("board", { enum: ["uno", "pico"] }).notNull(),
    visibility: text("visibility", { enum: ["private", "shared"] })
      .notNull()
      .default("private"),
    diagram: text("diagram").notNull(),
    firmwareSize: integer("firmware_size"),
    firmwareUploadedAt: text("firmware_uploaded_at"),
    copiedFromId: text("copied_from_id"),
    copiedFromName: text("copied_from_name"),
    createdAt: text("created_at").notNull().default(now),
    updatedAt: text("updated_at").notNull().default(now),
  },
  (table) => [
    index("projects_owner_idx").on(table.ownerId),
    index("projects_shared_idx").on(table.orgId, table.visibility),
  ],
);

export const projectFiles = sqliteTable(
  "project_files",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id").notNull(),
    path: text("path").notNull(),
    content: text("content").notNull(),
    updatedAt: text("updated_at").notNull().default(now),
  },
  (table) => [uniqueIndex("project_files_path_idx").on(table.projectId, table.path)],
);
