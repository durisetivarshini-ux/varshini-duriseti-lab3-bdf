const fs = require("node:fs/promises");
const path = require("node:path");
const express = require("express");
const sqlite = require("sqlite");
const sqlite3 = require("sqlite3");

const databasePath = process.env.DB_FILE || path.join(__dirname, "books.db");
const sortColumns = {
  id: "id",
  title: "title",
  author: "author",
  price: "price",
  pages: "pages",
};

async function openDatabase(filename = databasePath, addSampleBooks = false) {
  const database = await sqlite.open({
    filename,
    driver: sqlite3.Database,
  });

  const schema = await fs.readFile(path.join(__dirname, "schema.sql"), "utf8");
  await database.exec(schema);

  if (addSampleBooks) {
    const sampleBooks = await fs.readFile(path.join(__dirname, "seed.sql"), "utf8");
    await database.exec(sampleBooks);
  }

  return database;
}

function isValidBook(book) {
  return (
    book &&
    typeof book.title === "string" &&
    book.title.trim() !== "" &&
    typeof book.author === "string" &&
    book.author.trim() !== "" &&
    typeof book.price === "number" &&
    Number.isFinite(book.price) &&
    book.price >= 0 &&
    (book.pages === undefined ||
      book.pages === null ||
      (Number.isInteger(book.pages) && book.pages > 0))
  );
}

function createApp(database) {
  const app = express();
  app.use(express.json());

  app.get("/", (request, response) => {
    response.status(200).json({
      message: "Lab 3 Books API",
      endpoints: ["/books", "/books/:bookId"],
    });
  });

  // GET /books?search_q=guide&order_by=price&order=DESC&limit=5&offset=0
  app.get("/books", async (request, response) => {
    const search = request.query.search_q || "";
    const orderBy = request.query.order_by || "id";
    const requestedOrder = request.query.order || "ASC";
    const rawMinPrice = request.query.min_price;
    const rawMaxPrice = request.query.max_price;
    const limit = request.query.limit === undefined ? 10 : Number(request.query.limit);
    const offset = request.query.offset === undefined ? 0 : Number(request.query.offset);

    if (
      typeof search !== "string" ||
      typeof orderBy !== "string" ||
      !Object.keys(sortColumns).includes(orderBy)
    ) {
      response.status(400).json({ message: "Invalid search_q or order_by value" });
      return;
    }

    if (typeof requestedOrder !== "string") {
      response.status(400).json({ message: "order must be ASC or DESC" });
      return;
    }

    const order = requestedOrder.toUpperCase();
    if (order !== "ASC" && order !== "DESC") {
      response.status(400).json({ message: "order must be ASC or DESC" });
      return;
    }

    if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
      response.status(400).json({ message: "limit must be a whole number from 1 to 100" });
      return;
    }

    if (!Number.isInteger(offset) || offset < 0) {
      response.status(400).json({ message: "offset must be a non-negative whole number" });
      return;
    }

    let minPrice;
    let maxPrice;

    if (rawMinPrice !== undefined) {
      if (typeof rawMinPrice !== "string" || rawMinPrice.trim() === "") {
        response.status(400).json({ message: "min_price must be a non-negative number" });
        return;
      }

      minPrice = Number(rawMinPrice);
      if (!Number.isFinite(minPrice) || minPrice < 0) {
        response.status(400).json({ message: "min_price must be a non-negative number" });
        return;
      }
    }

    if (rawMaxPrice !== undefined) {
      if (typeof rawMaxPrice !== "string" || rawMaxPrice.trim() === "") {
        response.status(400).json({ message: "max_price must be a non-negative number" });
        return;
      }

      maxPrice = Number(rawMaxPrice);
      if (!Number.isFinite(maxPrice) || maxPrice < 0) {
        response.status(400).json({ message: "max_price must be a non-negative number" });
        return;
      }
    }

    if (minPrice !== undefined && maxPrice !== undefined && minPrice > maxPrice) {
      response.status(400).json({ message: "min_price cannot be greater than max_price" });
      return;
    }

    // Keep SQL values in the parameters array instead of adding them to the SQL text.
    const conditions = [];
    const parameters = [];

    if (search !== "") {
      conditions.push("title LIKE ?");
      parameters.push(`%${search}%`);
    }
    if (minPrice !== undefined) {
      conditions.push("price >= ?");
      parameters.push(minPrice);
    }
    if (maxPrice !== undefined) {
      conditions.push("price <= ?");
      parameters.push(maxPrice);
    }

    let sql = "SELECT * FROM book";
    if (conditions.length > 0) {
      sql += " WHERE " + conditions.join(" AND ");
    }

    const sortColumn = sortColumns[orderBy];
    const sortDirection = order === "DESC" ? "DESC" : "ASC";
    sql += ` ORDER BY ${sortColumn} ${sortDirection} LIMIT ? OFFSET ?`;
    parameters.push(limit, offset);

    try {
      const books = await database.all(sql, parameters);
      response.status(200).json({
        message: "Books retrieved successfully",
        data: books,
      });
    } catch (error) {
      console.error("Could not retrieve books:", error.message);
      response.status(500).json({ message: "Could not retrieve books" });
    }
  });

  app.get("/books/:bookId", async (request, response) => {
    const bookId = Number(request.params.bookId);

    if (!Number.isInteger(bookId) || bookId < 1) {
      response.status(404).json({ message: "Book not found" });
      return;
    }

    try {
      const book = await database.get("SELECT * FROM book WHERE id = ?", [bookId]);

      if (!book) {
        response.status(404).json({ message: "Book not found" });
        return;
      }

      response.status(200).json({
        message: "Book retrieved successfully",
        data: book,
      });
    } catch (error) {
      console.error("Could not retrieve the book:", error.message);
      response.status(500).json({ message: "Could not retrieve the book" });
    }
  });

  app.post("/books", async (request, response) => {
    if (!isValidBook(request.body)) {
      response.status(400).json({
        message: "Provide a title, an author, a numeric price, and valid pages",
      });
      return;
    }

    const title = request.body.title.trim();
    const author = request.body.author.trim();
    const price = request.body.price;
    const pages = request.body.pages || null;

    try {
      const result = await database.run(
        "INSERT INTO book (title, author, price, pages) VALUES (?, ?, ?, ?)",
        [title, author, price, pages],
      );

      response.status(201).json({
        message: "Book created successfully",
        data: { id: result.lastID, title, author, price, pages },
      });
    } catch (error) {
      console.error("Could not create the book:", error.message);
      response.status(500).json({ message: "Could not create the book" });
    }
  });

  app.put("/books/:bookId", async (request, response) => {
    const bookId = Number(request.params.bookId);

    if (!Number.isInteger(bookId) || bookId < 1) {
      response.status(404).json({ message: "Book not found" });
      return;
    }

    if (!isValidBook(request.body)) {
      response.status(400).json({
        message: "Provide a title, an author, a numeric price, and valid pages",
      });
      return;
    }

    const title = request.body.title.trim();
    const author = request.body.author.trim();
    const price = request.body.price;
    const pages = request.body.pages || null;

    try {
      const result = await database.run(
        "UPDATE book SET title = ?, author = ?, price = ?, pages = ? WHERE id = ?",
        [title, author, price, pages, bookId],
      );

      if (result.changes === 0) {
        response.status(404).json({ message: "Book not found" });
        return;
      }

      response.status(200).json({ message: "Book updated successfully" });
    } catch (error) {
      console.error("Could not update the book:", error.message);
      response.status(500).json({ message: "Could not update the book" });
    }
  });

  app.delete("/books/:bookId", async (request, response) => {
    const bookId = Number(request.params.bookId);

    if (!Number.isInteger(bookId) || bookId < 1) {
      response.status(404).json({ message: "Book not found" });
      return;
    }

    try {
      const result = await database.run("DELETE FROM book WHERE id = ?", [bookId]);

      if (result.changes === 0) {
        response.status(404).json({ message: "Book not found" });
        return;
      }

      response.status(200).json({ message: "Book deleted successfully" });
    } catch (error) {
      console.error("Could not delete the book:", error.message);
      response.status(500).json({ message: "Could not delete the book" });
    }
  });

  app.use((error, request, response, next) => {
    if (response.headersSent) {
      next(error);
      return;
    }

    if (error.status === 400 && error.type === "entity.parse.failed") {
      response.status(400).json({ message: "Request body contains invalid JSON" });
      return;
    }

    console.error("Request failed:", error.message);
    response.status(500).json({ message: "Something went wrong" });
  });

  return app;
}

async function startServer() {
  const database = await openDatabase();
  const app = createApp(database);
  const port = Number(process.env.PORT) || 3000;

  const server = app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
  });

  server.on("error", async (error) => {
    console.error("Could not start the server:", error.message);
    try {
      await database.close();
    } catch (closeError) {
      console.error("Could not close the database:", closeError.message);
    }
    process.exitCode = 1;
  });
}

if (require.main === module) {
  startServer().catch((error) => {
    console.error("Could not start the server:", error.message);
    process.exitCode = 1;
  });
}

module.exports = { createApp, openDatabase };
