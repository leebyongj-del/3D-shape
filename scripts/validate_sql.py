import pathlib
import sqlite3

sql = pathlib.Path("drizzle/0000_class_responses.sql").read_text(encoding="utf-8")
sql = sql.replace("--> statement-breakpoint", "")
db = sqlite3.connect(":memory:")
db.executescript(sql)
objects = db.execute(
    "SELECT name FROM sqlite_schema WHERE type IN ('table', 'index') ORDER BY name"
).fetchall()
print(objects)
