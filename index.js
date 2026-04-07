const path = require("path");
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const dotenv = require("dotenv");
const fs = require("fs");

const connectDb = require("./config/db");
const authRoutes = require("./routes/authRoutes");
const registrationRoutes = require("./routes/registrationRoutes");
const paymentRoutes = require("./routes/paymentRoutes");
const Registration = require("./models/Registration");

const envPath = process.env.NODE_ENV === "production" && fs.existsSync(path.join(__dirname, ".env.production"))
  ? path.join(__dirname, ".env.production")
  : path.join(__dirname, ".env");

dotenv.config({ path: envPath });

const app = express();
const PORT = process.env.PORT || 5000;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || "http://localhost:3000";
const API_BASE = process.env.API_BASE || "/ccd-industry/api";
const APP_BASE = process.env.APP_BASE || "/ccd-industry";
const API_BASE_ALIASES = Array.from(new Set([API_BASE, "/ccd-industry/api", "/api"]))
  .map((base) => String(base || "").trim())
  .filter((base) => base.startsWith("/"));

const configuredOrigins = CLIENT_ORIGIN.split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

function resolveCorsOrigin(origin, callback) {
  // Requests from scripts/curl may not send Origin.
  if (!origin) {
    return callback(null, true);
  }

  // In production behind reverse proxies, reflect any origin by default.
  if (process.env.NODE_ENV === "production") {
    return callback(null, true);
  }

  if (configuredOrigins.includes(origin)) {
    return callback(null, true);
  }

  return callback(new Error(`CORS blocked for origin: ${origin}`));
}

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use(
  cors({
    origin: resolveCorsOrigin,
    credentials: true,
  })
);

app.get("/", (_req, res) => {
  res.redirect(APP_BASE);
});

for (const apiBase of API_BASE_ALIASES) {
  app.get(`${apiBase}/health`, (_req, res) => {
    res.json({
      ok: true,
      service: "industry-payment",
      base: apiBase,
      aliases: API_BASE_ALIASES,
      timestamp: new Date().toISOString(),
    });
  });

  app.get(`${apiBase}/test`, (_req, res) => {
    res.json({
      ok: true,
      message: "Backend is running",
      environment: process.env.NODE_ENV || "development",
      base: apiBase,
      aliases: API_BASE_ALIASES,
      timestamp: new Date().toISOString(),
    });
  });
}



// //route to get all the registrations for admin no authentication required
// app.get(`${API_BASE}/registrations`, async (req, res, next) => {
//   try {
//     const registrations = await Registration.find().populate("user", "name email");
//     res.json({ registrations });
//   } catch (error) {
//     next(error);
//   }
// });


for (const apiBase of API_BASE_ALIASES) {
  app.use(apiBase, authRoutes);
  app.use(apiBase, registrationRoutes);
  app.use(apiBase, paymentRoutes);
}

if (process.env.NODE_ENV === "production") {
  const clientPath = path.join(__dirname, "client/build");
  app.use(express.static(clientPath));
  app.use(APP_BASE, express.static(clientPath));

  app.use((req, res, next) => {
    if (req.method !== "GET") {
      return next();
    }

    if (API_BASE_ALIASES.some((apiBase) => req.path === apiBase || req.path.startsWith(`${apiBase}/`))) {
      return res.status(404).end();
    }

    if (req.path !== "/" && req.path !== APP_BASE && !req.path.startsWith(`${APP_BASE}/`)) {
      return next();
    }

    return res.sendFile(path.join(clientPath, "index.html"));
  });
}

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ message: "Internal server error" });
});

async function start() {
  await connectDb();
  app.listen(PORT, () => {
    console.log(`Server started on port ${PORT}`);
  });
}

start().catch((error) => {
  console.error("Failed to start server", error);
  process.exit(1);
});
