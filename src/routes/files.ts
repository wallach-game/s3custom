import { Router, Request, Response } from "express";
import multer from "multer";
import * as path from "path";
import * as fileService from "../services/file.service";
import { log, LogLevel } from "../services/logging.service";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 100 * 1024 * 1024 } });

// GET /api/files?path= - list directory
router.get("/", async (req: Request, res: Response) => {
  try {
    const dirPath = (req.query.path as string) || "/";
    const files = await fileService.listFiles(dirPath);
    res.json(files);
  } catch (err: any) {
    if (err.message === "Path traversal denied") {
      log(LogLevel.WARN, "Path traversal attempt detected", { path: req.query.path });
      res.status(403).json({ error: err.message });
      return;
    }
    log(LogLevel.ERROR, "Failed to list files", { error: err.message, stack: err.stack, path: req.query.path });
    res.status(500).json({ error: "Failed to list directory contents" });
  }
});

// POST /api/files - upload file (multipart)
router.post("/", upload.single("file"), async (req: Request, res: Response) => {
  try {
    const uploadPath = (req.body.path as string) || "/";
    if (!req.file) {
      res.status(400).json({ error: "No file uploaded" });
      return;
    }
    const filePath = path.join(uploadPath, req.file.originalname);
    await fileService.createFile(filePath, req.file.buffer);
    res.json({ ok: true, path: filePath });
  } catch (err: any) {
    if (err.message === "Path traversal denied") {
      log(LogLevel.WARN, "Path traversal attempt detected in file upload", { path: req.body.path });
      res.status(403).json({ error: err.message });
      return;
    }
    log(LogLevel.ERROR, "Failed to upload file", { error: err.message, stack: err.stack, path: req.body.path });
    res.status(500).json({ error: "Failed to upload file" });
  }
});

// POST /api/files/mkdir - create directory
router.post("/mkdir", async (req: Request, res: Response) => {
  try {
    const { path: dirPath } = req.body;
    if (!dirPath) {
      res.status(400).json({ error: "path required" });
      return;
    }
    await fileService.createDirectory(dirPath);
    res.json({ ok: true, path: dirPath });
  } catch (err: any) {
    if (err.message === "Path traversal denied") {
      log(LogLevel.WARN, "Path traversal attempt detected in directory creation", { path: req.body.path });
      res.status(403).json({ error: err.message });
      return;
    }
    log(LogLevel.ERROR, "Failed to create directory", { error: err.message, stack: err.stack, path: req.body.path });
    res.status(500).json({ error: "Failed to create directory" });
  }
});

// PUT /api/files - update file content
router.put("/", async (req: Request, res: Response) => {
  try {
    const { path: filePath, content } = req.body;
    if (!filePath || content === undefined) {
      res.status(400).json({ error: "path and content required" });
      return;
    }
    await fileService.updateFile(filePath, content);
    res.json({ ok: true, path: filePath });
  } catch (err: any) {
    if (err.message === "Path traversal denied") {
      log(LogLevel.WARN, "Path traversal attempt detected in file update", { path: req.body.path });
      res.status(403).json({ error: err.message });
      return;
    }
    log(LogLevel.ERROR, "Failed to update file", { error: err.message, stack: err.stack, path: req.body.path });
    res.status(500).json({ error: "Failed to update file" });
  }
});

// DELETE /api/files?path= - delete file or directory
router.delete("/", async (req: Request, res: Response) => {
  try {
    const filePath = req.query.path as string;
    if (!filePath) {
      res.status(400).json({ error: "path query parameter required" });
      return;
    }
    await fileService.deleteFile(filePath);
    res.json({ ok: true });
  } catch (err: any) {
    if (err.message === "Path traversal denied") {
      log(LogLevel.WARN, "Path traversal attempt detected in file deletion", { path: req.query.path });
      res.status(403).json({ error: err.message });
      return;
    }
    log(LogLevel.ERROR, "Failed to delete file", { error: err.message, stack: err.stack, path: req.query.path });
    res.status(500).json({ error: "Failed to delete file or directory" });
  }
});

export default router;
