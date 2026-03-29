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

const envPath = process.env.NODE_ENV === "production" && fs.existsSync(path.join(__dirname, ".env.production"))
  ? path.join(__dirname, ".env.production")
  : path.join(__dirname, ".env");

dotenv.config({ path: envPath });

const app = express();
const PORT = process.env.PORT || 5000;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || "http://localhost:3000";
const API_BASE = process.env.API_BASE || "/ccd-industry/api";

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use(
  cors({
    origin: CLIENT_ORIGIN,
    credentials: true,
  })
);

app.get("/", (_req, res) => {
  res.redirect("/ccd-industry");
});

app.get(`${API_BASE}/health`, (_req, res) => {
  res.json({ ok: true, service: "industry-payment", base: API_BASE, timestamp: new Date().toISOString() });
});

app.get(`${API_BASE}/test`, (_req, res) => {
  res.json({
    ok: true,
    message: "Backend is running",
    environment: process.env.NODE_ENV || "development",
    base: API_BASE,
    timestamp: new Date().toISOString(),
  });
});

app.use(API_BASE, authRoutes);
app.use(API_BASE, registrationRoutes);
app.use(API_BASE, paymentRoutes);

if (process.env.NODE_ENV === "production") {
  const clientPath = path.join(__dirname, "client/build");
  app.use(express.static(clientPath));
  app.use((req, res, next) => {
    if (req.method !== "GET") {
      return next();
    }

    if (req.path.startsWith(`${API_BASE}/`) || req.path === API_BASE) {
      return res.status(404).end();
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
