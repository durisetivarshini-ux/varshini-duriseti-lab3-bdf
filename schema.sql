CREATE TABLE IF NOT EXISTS book (
  id INTEGER PRIMARY KEY,
  title TEXT NOT NULL,
  author TEXT NOT NULL,
  price REAL NOT NULL CHECK (price >= 0),
  pages INTEGER CHECK (pages IS NULL OR pages > 0)
);
