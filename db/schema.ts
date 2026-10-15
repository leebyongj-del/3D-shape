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

export const classState = sqliteTable("class_state", {
  sessionKey: text("session_key").primaryKey(),
  activeStage: integer("active_stage").notNull().default(1),
  updatedAt: text("updated_at").notNull(),
});

export const classSessions = sqliteTable("class_sessions", {
  sessionKey: text("session_key").primaryKey(),
  label: text("label").notNull(),
  isActive: integer("is_active").notNull().default(0),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => ({
  activeUpdated: index("idx_class_sessions_active_updated").on(table.isActive, table.updatedAt),
}));

export const classTimers = sqliteTable("class_timers", {
  sessionKey: text("session_key").primaryKey(),
  durationSeconds: integer("duration_seconds").notNull().default(2700),
  remainingSeconds: integer("remaining_seconds").notNull().default(2700),
  isRunning: integer("is_running").notNull().default(0),
  startedAt: text("started_at"),
  updatedAt: text("updated_at").notNull(),
});

export const sessionAccess = sqliteTable("session_access", {
  sessionKey: text("session_key").primaryKey(),
  joinCode: text("join_code").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const studentProgress = sqliteTable("student_progress", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  sessionKey: text("session_key").notNull(),
  participantId: text("participant_id").notNull(),
  groupNo: integer("group_no").notNull(),
  displayName: text("display_name").notNull(),
  currentStage: integer("current_stage").notNull().default(1),
  progressPercent: integer("progress_percent").notNull().default(0),
  isComplete: integer("is_complete").notNull().default(0),
  updatedAt: text("updated_at").notNull(),
}, (table) => ({
  sessionParticipant: uniqueIndex("idx_student_progress_session_participant").on(table.sessionKey, table.participantId),
  sessionGroup: index("idx_student_progress_session_group").on(table.sessionKey, table.groupNo),
}));
