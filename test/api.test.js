const assert = require("node:assert/strict");
const { after, before, test } = require("node:test");
const sqlite = require("sqlite");
const sqlite3 = require("sqlite3");
const { createApp } = require("../app");

let database;
let server;
let baseUrl;
let createdBookId;

before(async () => {
  database = await sqlite.open({
    filename: ":memory:",
    driver: sqlite3.Database,
  });
  await database.exec(`
    CREATE TABLE book (
      id INTEGER PRIMARY KEY,
      title TEXT NOT NULL,
      author TEXT NOT NULL,
      price REAL NOT NULL CHECK (price >= 0),
      pages INTEGER CHECK (pages IS NULL OR pages > 0)
    );
    INSERT INTO book (id, title, author, price, pages) VALUES
      (1, 'The Guide', 'R. K. Narayan', 250, 220),
      (2, 'Malgudi Days', 'R. K. Narayan', 300, 240),
      (3, 'Wings of Fire', 'A. P. J. Abdul Kalam', 350, 180),
      (4, 'The White Tiger', 'Aravind Adiga', 400, 320);
  `);

  server = createApp(database).listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server) {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
  if (database) {
    await database.close();
  }
});

async function request(path, options) {
  const response = await fetch(`${baseUrl}${path}`, options);
  const body = await response.json();
  return { status: response.status, body };
}

test("GET /books returns books with default query values", async () => {
  const result = await request("/books");
  assert.equal(result.status, 200);
  assert.equal(result.body.message, "Books retrieved successfully");
  assert.equal(result.body.data.length, 4);
});

test("GET /books/:bookId returns a book or a 404 response", async () => {
  const found = await request("/books/1");
  const missing = await request("/books/9999");
  assert.equal(found.status, 200);
  assert.equal(found.body.data.title, "The Guide");
  assert.equal(missing.status, 404);
  assert.deepEqual(missing.body, { message: "Book not found" });
});

test("GET /books applies title search, sorting, and pagination together", async () => {
  const result = await request(
    "/books?search_q=The&order_by=price&order=DESC&limit=1&offset=0",
  );
  assert.equal(result.status, 200);
  assert.equal(result.body.data.length, 1);
  assert.equal(result.body.data[0].title, "The White Tiger");
});

test("GET /books applies inclusive price range filters", async () => {
  const result = await request("/books?min_price=250&max_price=350&order_by=price");
  assert.equal(result.status, 200);
  assert.deepEqual(result.body.data.map((book) => book.price), [250, 300, 350]);
});

test("GET /books rejects unsafe sorting and invalid query values", async () => {
  const unsafeSort = await request("/books?order_by=title%20DESC");
  const repeatedOrder = await request("/books?order=ASC&order=DESC");
  const invalidRange = await request("/books?min_price=400&max_price=200");
  const emptyRange = await request("/books?min_price=");
  assert.equal(unsafeSort.status, 400);
  assert.equal(typeof unsafeSort.body.message, "string");
  assert.equal(repeatedOrder.status, 400);
  assert.equal(invalidRange.status, 400);
  assert.equal(emptyRange.status, 400);
});

test("POST /books returns 201 and validates required fields and price", async () => {
  const created = await request("/books", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ title: "Test Book", author: "Test Author", price: 99 }),
  });
  assert.equal(created.status, 201);
  createdBookId = created.body.data.id;

  const invalidCases = [
    { author: "Test Author", price: 99 },
    { title: "Test Book", price: 99 },
    { title: "Test Book", author: "Test Author", price: "99" },
  ];
  for (const body of invalidCases) {
    const invalid = await request("/books", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    assert.equal(invalid.status, 400);
    assert.equal(typeof invalid.body.message, "string");
  }
});

test("PUT /books/:bookId returns 200 or 404 as appropriate", async () => {
  const updated = await request(`/books/${createdBookId}`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      title: "Updated Test Book",
      author: "Test Author",
      price: 120,
      pages: 180,
    }),
  });
  const missing = await request("/books/9999", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      title: "Missing Book",
      author: "Test Author",
      price: 120,
    }),
  });
  assert.equal(updated.status, 200);
  assert.deepEqual(updated.body, { message: "Book updated successfully" });
  assert.equal(missing.status, 404);
  assert.deepEqual(missing.body, { message: "Book not found" });
});

test("DELETE /books/:bookId returns 200 or 404 as appropriate", async () => {
  const deleted = await request(`/books/${createdBookId}`, { method: "DELETE" });
  const missing = await request("/books/9999", { method: "DELETE" });
  assert.equal(deleted.status, 200);
  assert.deepEqual(deleted.body, { message: "Book deleted successfully" });
  assert.equal(missing.status, 404);
  assert.deepEqual(missing.body, { message: "Book not found" });
});

test("invalid JSON receives a consistent JSON error response", async () => {
  const result = await request("/books", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{invalid",
  });
  assert.equal(result.status, 400);
  assert.deepEqual(result.body, { message: "Request body contains invalid JSON" });
});
