import express from "express";
import path from "path";
import disksRouter from "./routes/disks";
import filesRouter from "./routes/files";

const app = express();
const PORT = parseInt(process.env.PORT || "8080", 10);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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
