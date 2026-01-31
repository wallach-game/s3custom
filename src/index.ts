import express from "express";
import path from "path";
import disksRouter from "./routes/disks";
import filesRouter from "./routes/files";
import { sendCommand } from "./socket-client";
import { initializeRotationService } from "./services/disk-rotation.service";

const app = express();
const PORT = parseInt(process.env.PORT || "8080", 10);

// Initialize disk rotation service
initializeRotationService();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Configure request timeout for long-running operations (30 minutes)
app.use((_req, res, next) => {
  res.setTimeout(30 * 60 * 1000, () => {
    res.status(408).json({ error: "Request timeout" });
  });
  next();
});

// Health check endpoint
app.get("/health", async (_req, res) => {
  try {
    // Test if host agent is responsive by running a simple command
    await sendCommand("lsblk", ["--version"]);
    res.json({
      status: "healthy",
      timestamp: new Date().toISOString(),
      hostAgent: "connected"
    });
  } catch (err) {
    res.status(503).json({
      status: "unhealthy",
      timestamp: new Date().toISOString(),
      hostAgent: "disconnected",
      error: (err as Error).message
    });
  }
});

// Static files
app.use(express.static(path.join(__dirname, "../src/public")));

// API routes
app.use("/api/disks", disksRouter);
app.use("/api/files", filesRouter);

// SPA fallback
app.get("*", (_req, res) => {
  res.sendFile(path.join(__dirname, "../src/public/index.html"));
});

// Error handler
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ error: "Internal server error" });
});

app.listen(PORT, () => {
  console.log(`S3 Custom admin panel listening on port ${PORT}`);
});
