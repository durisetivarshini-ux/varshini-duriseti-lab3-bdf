# Lab 3 Viva Questions and Answers

1. **What is the difference between a query parameter and a path parameter?**  
   A path parameter identifies a resource, such as `/books/3`. A query parameter filters or changes a list, such as `/books?limit=5`.

2. **What does stateless mean in REST?**  
   Each request contains the information needed to process it. The server does not depend on stored session state from an earlier request.

3. **Which status code is used for bad input?**  
   `400 Bad Request`.

4. **Which status code is used when a record is missing?**  
   `404 Not Found`.

5. **What is SQL LIKE?**  
   `LIKE` compares text with a pattern. `%` matches any number of characters, so `%Guide%` can find titles containing “Guide”.

6. **Why do we use parameterized queries?**  
   They keep user-provided values separate from SQL instructions and help prevent SQL injection.

7. **What are limit and offset?**  
   `limit` sets the maximum number of rows returned. `offset` skips rows before returning results.

8. **What is input validation?**  
   It checks that request data has the required fields and correct types before the application uses it.

9. **What does EADDRINUSE mean?**  
   The requested network port is already in use by another process. Stop that process or start this application on another port.

10. **Why is await required for database operations?**  
    Database operations finish asynchronously. `await` waits for the result before the next dependent operation uses it.

## Debugging exercise notes

- **Port conflict:** `EADDRINUSE` means another application already listens on the selected port. Close the other server, or set a free port, for example `PORT=3001`.
- **Wrong import path:** Check the relative path and filename casing, and make sure the required module exists before restarting the app.
- **Wrong table name:** The database table is named `book` (singular). SQL using a different name such as `books` fails with “no such table”; use the schema's actual name consistently.
- **Missing await:** Await calls such as `database.get`, `database.all`, and `database.run` before reading their results or sending the HTTP response.
