const express = require("express");
const { createApp, openDatabase } = require("./api");

const app = express();
const databasePromise = openDatabase(":memory:", true);
const apiPromise = databasePromise.then((database) => createApp(database));

app.use((request, response, next) => {
  apiPromise.then(
    (api) => api(request, response, next),
    next,
  );
});

app.use((error, request, response, next) => {
  if (response.headersSent) {
    next(error);
    return;
  }

  console.error("Could not start the API:", error.message);
  response.status(500).json({ message: "Could not start the API" });
});

app.locals.databasePromise = databasePromise;

module.exports = app;
