const PAGE_PLACEHOLDER = "__SITE_PAGE_JSON__";
const QR_PLACEHOLDER = "__QR_BASE64__";

const ACTIVITY_ANSWERS = {
  "mission-1": "오각기둥",
  "mission-2": "삼각뿔",
  "mission-3": "사각기둥",
  "ai-1": "오류",
  "ai-2": "옳음",
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

function validSession(value) {
  return typeof value === "string" && /^\d{8}(?:-[a-z0-9]{6})?$/.test(value);
}

function todaySessionKey() {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" })
    .format(new Date()).replaceAll("-", "");
}

async function currentSession(env) {
  const row = await env.DB.prepare(`
    SELECT session_key AS sessionKey, label, created_at AS createdAt
    FROM class_sessions WHERE is_active = 1
    ORDER BY updated_at DESC LIMIT 1
  `).first();
  return row || { sessionKey: todaySessionKey(), label: "오늘 기본 회차", createdAt: null };
}

async function listSessions(env) {
  const result = await env.DB.prepare(`
    SELECT session_key AS sessionKey, label, is_active AS isActive, created_at AS createdAt
    FROM class_sessions ORDER BY created_at DESC LIMIT 30
  `).all();
  const sessions = result.results || [];
  const fallbackKey = todaySessionKey();
  if (!sessions.some((row) => row.sessionKey === fallbackKey)) {
    sessions.push({ sessionKey: fallbackKey, label: "오늘 기본 회차", isActive: sessions.length ? 0 : 1, createdAt: null });
  }
  return { current: await currentSession(env), sessions };
}

async function createSession(request, env) {
  let body;
  try { body = await request.json(); } catch { return json({ error: "요청 형식을 확인해 주세요." }, 400); }
  const label = String(body.label || "").trim().replace(/\s+/g, " ").slice(0, 40);
  if (label.length < 2) return json({ error: "수업 회차 이름을 두 글자 이상 입력해 주세요." }, 400);
  const sessionKey = `${todaySessionKey()}-${crypto.randomUUID().replaceAll("-", "").slice(0, 6)}`;
  const now = new Date().toISOString();
  await env.DB.batch([
    env.DB.prepare("UPDATE class_sessions SET is_active = 0, updated_at = ? WHERE is_active = 1").bind(now),
    env.DB.prepare("INSERT INTO class_sessions (session_key, label, is_active, created_at, updated_at) VALUES (?, ?, 1, ?, ?)").bind(sessionKey, label, now, now),
  ]);
  return json({ session: { sessionKey, label, createdAt: now } }, 201);
}

async function activateSession(request, env) {
  let body;
  try { body = await request.json(); } catch { return json({ error: "요청 형식을 확인해 주세요." }, 400); }
  const sessionKey = String(body.sessionKey || "");
  if (!validSession(sessionKey)) return json({ error: "수업 회차를 확인해 주세요." }, 400);
  const existing = await env.DB.prepare("SELECT label, created_at AS createdAt FROM class_sessions WHERE session_key = ?").bind(sessionKey).first();
  const now = new Date().toISOString();
  const label = existing?.label || (sessionKey === todaySessionKey() ? "오늘 기본 회차" : "");
  if (!label) return json({ error: "수업 회차를 찾지 못했습니다." }, 404);
  await env.DB.batch([
    env.DB.prepare("UPDATE class_sessions SET is_active = 0, updated_at = ? WHERE is_active = 1").bind(now),
    env.DB.prepare(`
      INSERT INTO class_sessions (session_key, label, is_active, created_at, updated_at)
      VALUES (?, ?, 1, ?, ?)
      ON CONFLICT(session_key) DO UPDATE SET is_active = 1, updated_at = excluded.updated_at
    `).bind(sessionKey, label, existing?.createdAt || now, now),
  ]);
  return json({ session: { sessionKey, label, createdAt: existing?.createdAt || now } });
}

function timerSnapshot(row, nowMs = Date.now()) {
  const durationSeconds = Math.max(60, Number(row?.durationSeconds) || 2700);
  const storedRemaining = Math.max(0, row?.remainingSeconds == null ? durationSeconds : Number(row.remainingSeconds));
  const wasRunning = Boolean(row?.isRunning);
  const startedMs = row?.startedAt ? Date.parse(row.startedAt) : NaN;
  const elapsed = wasRunning && Number.isFinite(startedMs) ? Math.max(0, Math.floor((nowMs - startedMs) / 1000)) : 0;
  const remainingSeconds = Math.max(0, storedRemaining - elapsed);
  return { durationSeconds, remainingSeconds, isRunning: wasRunning && remainingSeconds > 0, startedAt: row?.startedAt || null };
}

async function readTimer(sessionKey, env) {
  const row = await env.DB.prepare(`
    SELECT duration_seconds AS durationSeconds, remaining_seconds AS remainingSeconds,
      is_running AS isRunning, started_at AS startedAt, updated_at AS updatedAt
    FROM class_timers WHERE session_key = ?
  `).bind(sessionKey).first();
  return timerSnapshot(row);
}

async function getTimer(url, env) {
  const sessionKey = url.searchParams.get("session") || "";
  if (!validSession(sessionKey)) return json({ error: "수업 회차를 확인해 주세요." }, 400);
  return json({ ...(await readTimer(sessionKey, env)), serverTime: new Date().toISOString() });
}

async function setTimer(request, env) {
  let body;
  try { body = await request.json(); } catch { return json({ error: "요청 형식을 확인해 주세요." }, 400); }
  const sessionKey = String(body.sessionKey || "");
  const action = String(body.action || "");
  if (!validSession(sessionKey) || !["start", "pause", "add", "reset"].includes(action)) {
    return json({ error: "타이머 요청을 확인해 주세요." }, 400);
  }
  const current = await readTimer(sessionKey, env);
  const durationSeconds = current.durationSeconds || 2700;
  let remainingSeconds = current.remainingSeconds;
  let isRunning = current.isRunning;
  let startedAt = current.startedAt;
  const now = new Date().toISOString();
  if (action === "start") {
    remainingSeconds = remainingSeconds > 0 ? remainingSeconds : durationSeconds;
    isRunning = true;
    startedAt = now;
  } else if (action === "pause") {
    isRunning = false;
    startedAt = null;
  } else if (action === "add") {
    remainingSeconds += 300;
    startedAt = isRunning ? now : null;
  } else if (action === "reset") {
    remainingSeconds = durationSeconds;
    isRunning = false;
    startedAt = null;
  }
  await env.DB.prepare(`
    INSERT INTO class_timers (session_key, duration_seconds, remaining_seconds, is_running, started_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(session_key) DO UPDATE SET
      duration_seconds = excluded.duration_seconds,
      remaining_seconds = excluded.remaining_seconds,
      is_running = excluded.is_running,
      started_at = excluded.started_at,
      updated_at = excluded.updated_at
  `).bind(sessionKey, durationSeconds, remainingSeconds, isRunning ? 1 : 0, startedAt, now).run();
  return json({ durationSeconds, remainingSeconds, isRunning, startedAt, serverTime: now });
}

function teacherAuthorized(request, env) {
  const provided = request.headers.get("x-teacher-code") || "";
  return Boolean(env.TEACHER_CODE) && provided === env.TEACHER_CODE;
}

function requireTeacher(request, env) {
  return teacherAuthorized(request, env) ? null : json({ error: "교사용 번호를 확인해 주세요." }, 401);
}

async function saveResponse(request, env) {
  let body;
  try { body = await request.json(); } catch { return json({ error: "요청 형식을 확인해 주세요." }, 400); }
  const groupNo = Number(body.groupNo);
  const activity = String(body.activity || "");
  const answer = String(body.answer || "").trim().slice(0, 60);
  const reason = String(body.reason || "").trim().slice(0, 500);
  const sessionKey = String(body.sessionKey || "");
  if (!validSession(sessionKey) || !Number.isInteger(groupNo) || groupNo < 1 || groupNo > 8 || !(activity in ACTIVITY_ANSWERS) || !answer || reason.length < 8) {
    return json({ error: "모둠 번호와 답변, 판단 근거를 확인해 주세요." }, 400);
  }
  const now = new Date().toISOString();
  const isCorrect = ACTIVITY_ANSWERS[activity] === answer ? 1 : 0;
  await env.DB.prepare(`
    INSERT INTO responses (session_key, group_no, activity, answer, reason, is_correct, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(session_key, group_no, activity) DO UPDATE SET
      answer = excluded.answer,
      reason = excluded.reason,
      is_correct = excluded.is_correct,
      updated_at = excluded.updated_at
  `).bind(sessionKey, groupNo, activity, answer, reason, isCorrect, now).run();
  return json({ saved: true, isCorrect: Boolean(isCorrect), updatedAt: now });
}

async function getResponses(url, env) {
  const sessionKey = url.searchParams.get("session") || "";
  if (!validSession(sessionKey)) return json({ error: "수업 날짜를 확인해 주세요." }, 400);
  const result = await env.DB.prepare(`
    SELECT group_no AS groupNo, activity, answer, reason, is_correct AS isCorrect, updated_at AS updatedAt
    FROM responses
    WHERE session_key = ?
    ORDER BY activity ASC, group_no ASC
  `).bind(sessionKey).all();
  const responses = result.results || [];
  const groups = [...new Set(responses.map((row) => row.groupNo))];
  const correct = responses.filter((row) => row.isCorrect).length;
  return json({ responses, summary: { groups: groups.length, submissions: responses.length, correct } });
}

async function deleteResponses(url, env) {
  const sessionKey = url.searchParams.get("session") || "";
  if (!validSession(sessionKey)) return json({ error: "수업 날짜를 확인해 주세요." }, 400);
  const result = await env.DB.prepare("DELETE FROM responses WHERE session_key = ?").bind(sessionKey).run();
  return json({ deleted: true, changes: result.meta?.changes || 0 });
}

async function getClassState(url, env) {
  const sessionKey = url.searchParams.get("session") || "";
  if (!validSession(sessionKey)) return json({ error: "수업 날짜를 확인해 주세요." }, 400);
  const row = await env.DB.prepare("SELECT active_stage AS activeStage, updated_at AS updatedAt FROM class_state WHERE session_key = ?").bind(sessionKey).first();
  return json(row || { activeStage: 1, updatedAt: null });
}

async function setClassState(request, env) {
  let body;
  try { body = await request.json(); } catch { return json({ error: "요청 형식을 확인해 주세요." }, 400); }
  const sessionKey = String(body.sessionKey || "");
  const activeStage = Number(body.activeStage);
  if (!validSession(sessionKey) || !Number.isInteger(activeStage) || activeStage < 1 || activeStage > 4) {
    return json({ error: "공개할 단계를 확인해 주세요." }, 400);
  }
  const updatedAt = new Date().toISOString();
  await env.DB.prepare(`
    INSERT INTO class_state (session_key, active_stage, updated_at) VALUES (?, ?, ?)
    ON CONFLICT(session_key) DO UPDATE SET active_stage = excluded.active_stage, updated_at = excluded.updated_at
  `).bind(sessionKey, activeStage, updatedAt).run();
  return json({ activeStage, updatedAt });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    try {
      if (url.pathname === "/api/session" && request.method === "GET") return json(await currentSession(env));
      if (url.pathname === "/api/sessions" && request.method === "GET") {
        const denied = requireTeacher(request, env);
        return denied || json(await listSessions(env));
      }
      if (url.pathname === "/api/sessions" && request.method === "POST") {
        const denied = requireTeacher(request, env);
        return denied || await createSession(request, env);
      }
      if (url.pathname === "/api/sessions" && request.method === "PATCH") {
        const denied = requireTeacher(request, env);
        return denied || await activateSession(request, env);
      }
      if (url.pathname === "/api/timer" && request.method === "GET") return await getTimer(url, env);
      if (url.pathname === "/api/timer" && request.method === "POST") {
        const denied = requireTeacher(request, env);
        return denied || await setTimer(request, env);
      }
      if (url.pathname === "/api/responses" && request.method === "POST") return await saveResponse(request, env);
      if (url.pathname === "/api/teacher/verify" && request.method === "POST") {
        const denied = requireTeacher(request, env);
        return denied || json({ verified: true });
      }
      if (url.pathname === "/api/responses" && request.method === "GET") {
        const denied = requireTeacher(request, env);
        return denied || await getResponses(url, env);
      }
      if (url.pathname === "/api/responses" && request.method === "DELETE") {
        const denied = requireTeacher(request, env);
        return denied || await deleteResponses(url, env);
      }
      if (url.pathname === "/api/class-state" && request.method === "GET") return await getClassState(url, env);
      if (url.pathname === "/api/class-state" && request.method === "POST") {
        const denied = requireTeacher(request, env);
        return denied || await setClassState(request, env);
      }
      if (url.pathname === "/qr-code.png" && request.method === "GET") {
        const bytes = Uint8Array.from(atob(QR_PLACEHOLDER), (c) => c.charCodeAt(0));
        return new Response(bytes, { headers: { "content-type": "image/png", "cache-control": "public, max-age=86400" } });
      }
      if (url.pathname === "/" && request.method === "GET") {
        return new Response(PAGE_PLACEHOLDER, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-cache" } });
      }
      return new Response("Not found", { status: 404 });
    } catch (error) {
      console.error("3D shape lab request failed", error);
      return url.pathname.startsWith("/api/") ? json({ error: "응답을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요." }, 500) : new Response("Unavailable", { status: 500 });
    }
  },
};
