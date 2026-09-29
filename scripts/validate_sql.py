import pathlib
import sqlite3

db = sqlite3.connect(":memory:")
for migration in sorted(pathlib.Path("drizzle").glob("*.sql")):
    sql = migration.read_text(encoding="utf-8").replace("--> statement-breakpoint", "")
    db.executescript(sql)
objects = db.execute(
    "SELECT name FROM sqlite_schema WHERE type IN ('table', 'index') ORDER BY name"
).fetchall()
print(objects)
