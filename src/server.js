const express = require("express");
const cors = require("cors");
const config = require("./config/config");

const workflowsRouter = require("./routes/workflows");
const systemRouter = require("./routes/system");
const assetsRouter = require("./routes/assets");
const generationsRouter = require("./routes/generations");
const mediaAssetsRouter = require("./routes/mediaAssets");
const uploadsRouter = require("./routes/uploads");
const comfyRoutes = require("./routes/comfy");

const app = express();

app.locals.startedAt = new Date();

app.use(cors());
app.use(express.json({ limit: "10mb" }));

app.get("/health", (req, res) => {
  res.json({ ok: true });
});

/* Public media routes */
app.use("/media/assets", mediaAssetsRouter);
app.use("/media/generations", generationsRouter);
app.use("/upload", uploadsRouter);

/* API-key protection only for /api routes */
app.use("/api", (req, res, next) => {
  const apiKey = req.headers["x-api-key"];

  if (!process.env.LOCAL_API_KEY) {
    return next();
  }

  if (!apiKey) {
    return res.status(401).json({ error: "API key required" });
  }

  if (apiKey !== process.env.LOCAL_API_KEY) {
    return res.status(403).json({ error: "Invalid API key" });
  }

  next();
});

app.use("/api/workflows", workflowsRouter);
app.use("/api/system", systemRouter);
app.use("/api/assets", assetsRouter);
app.use("/api/generations", generationsRouter);
app.use("/api/comfy", comfyRoutes);

app.listen(config.port, "127.0.0.1", () => {
  console.log(`Server running on http://127.0.0.1:${config.port}`);
});