const fs = require("node:fs/promises");
const path = require("node:path");
const sqlite = require("sqlite");
const sqlite3 = require("sqlite3");

async function seedDatabase() {
  const databasePath = path.join(__dirname, "books.db");
  const database = await sqlite.open({
    filename: databasePath,
    driver: sqlite3.Database,
  });

  try {
    const schema = await fs.readFile(path.join(__dirname, "schema.sql"), "utf8");
    const seed = await fs.readFile(path.join(__dirname, "seed.sql"), "utf8");
    await database.exec(schema);
    await database.exec(seed);
    console.log(`Database is ready at ${databasePath}`);
  } finally {
    await database.close();
  }
}

seedDatabase().catch((error) => {
  console.error("Could not seed the database:", error.message);
  process.exitCode = 1;
});
