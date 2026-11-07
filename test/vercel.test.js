const assert = require("node:assert/strict");
const { after, test } = require("node:test");
const app = require("../index");

let server;

after(async () => {
  if (server) {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }

  const database = await app.locals.databasePromise;
  await database.close();
});

test("Vercel Express entrypoint serves seeded API routes", async () => {
  server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  const homeResponse = await fetch(baseUrl);
  const homeBody = await homeResponse.json();
  assert.equal(homeResponse.status, 200);
  assert.equal(homeBody.message, "Lab 3 Books API");

  const booksResponse = await fetch(`${baseUrl}/books`);
  const booksBody = await booksResponse.json();
  assert.equal(booksResponse.status, 200);
  assert.equal(booksBody.data.length, 10);

  const createResponse = await fetch(`${baseUrl}/books`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      title: "Vercel Test Book",
      author: "Lab 3 Student",
      price: 99,
    }),
  });
  const createBody = await createResponse.json();
  assert.equal(createResponse.status, 201);

  const createdResponse = await fetch(`${baseUrl}/books/${createBody.data.id}`);
  const createdBody = await createdResponse.json();
  assert.equal(createdResponse.status, 200);
  assert.equal(createdBody.data.title, "Vercel Test Book");
});
