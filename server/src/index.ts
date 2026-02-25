import session from "express-session";
import connectSqlite3 from "connect-sqlite3";
import { ENV } from "./config/env.js";

const SQLiteStore = connectSqlite3(session);

app.use(
  session({
    store: new SQLiteStore({
      db: "sessions.sqlite",
      dir: "./data"
    }),
    secret: ENV.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: false // local dev
    }
  })
);
