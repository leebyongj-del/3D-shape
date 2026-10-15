import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import worker from "../worker/index.js";

const db = new DatabaseSync(":memory:");
for (const file of fs.readdirSync("drizzle").filter((name) => name.endsWith(".sql")).sort()) {
  const sql = fs.readFileSync(path.join("drizzle", file), "utf8");
  for (const statement of sql.split("--> statement-breakpoint").map((part) => part.trim()).filter(Boolean)) db.exec(statement);
}

const DB = {
  prepare(sql) {
    return {
      bind(...params) {
        const statement = db.prepare(sql);
        return {
          first: async () => statement.get(...params),
          all: async () => ({ results: statement.all(...params) }),
          run: async () => {
            const result = statement.run(...params);
            return { meta: { changes: Number(result.changes) } };
          },
        };
      },
      first: async () => db.prepare(sql).get(),
      all: async () => ({ results: db.prepare(sql).all() }),
      run: async () => {
        const result = db.prepare(sql).run();
        return { meta: { changes: Number(result.changes) } };
      },
    };
  },
  async batch(statements) {
    const results = [];
    for (const statement of statements) results.push(await statement.run());
    return results;
  },
};

const env = { DB, TEACHER_CODE: "130408" };
const call = async (pathname, { method = "GET", body, teacher = false } = {}) => {
  const headers = new Headers();
  if (body) headers.set("content-type", "application/json");
  if (teacher) headers.set("x-teacher-code", "130408");
  const response = await worker.fetch(new Request(`https://example.test${pathname}`, { method, headers, body: body ? JSON.stringify(body) : undefined }), env);
  const data = await response.json();
  assert.ok(response.ok, `${method} ${pathname}: ${response.status} ${JSON.stringify(data)}`);
  return data;
};

const created = await call("/api/sessions", { method: "POST", teacher: true, body: { label: "진행률 검증 수업", joinCode: "2468" } });
const sessionKey = created.session.sessionKey;
const verified = await call("/api/student/verify", { method: "POST", body: { code: "2468" } });
assert.equal(verified.session.sessionKey, sessionKey);

for (const student of [
  { participantId: "student_alpha_01", displayName: "김도형", progressPercent: 25, currentStage: 2 },
  { participantId: "student_beta_02", displayName: "이입체", progressPercent: 75, currentStage: 4 },
]) {
  await call("/api/student/progress", { method: "POST", body: { sessionKey, code: "2468", groupNo: 1, isComplete: false, ...student } });
}

const dashboard = await call(`/api/responses?session=${sessionKey}`, { teacher: true });
assert.equal(dashboard.participants.length, 2);
assert.deepEqual(dashboard.participants.map((student) => student.displayName), ["김도형", "이입체"]);
assert.deepEqual(dashboard.participants.map((student) => student.progressPercent), [25, 75]);
assert.equal(dashboard.summary.groups, 1);
assert.equal(dashboard.summary.students, 2);
assert.equal(dashboard.summary.averageProgress, 50);

console.log("Verified: role code -> student entry -> two members in one group -> individual progress dashboard");
