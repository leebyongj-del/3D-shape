import { integer, sqliteTable, text, uniqueIndex, index } from "drizzle-orm/sqlite-core";

export const responses = sqliteTable("responses", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  sessionKey: text("session_key").notNull(),
  groupNo: integer("group_no").notNull(),
  activity: text("activity").notNull(),
  answer: text("answer").notNull(),
  reason: text("reason").notNull(),
  isCorrect: integer("is_correct").notNull().default(0),
  updatedAt: text("updated_at").notNull(),
}, (table) => ({
  sessionGroupActivity: uniqueIndex("idx_responses_session_group_activity").on(table.sessionKey, table.groupNo, table.activity),
  sessionUpdated: index("idx_responses_session_updated").on(table.sessionKey, table.updatedAt),
}));
