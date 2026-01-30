import { Router, Request, Response } from "express";
import * as diskService from "../services/disk.service";
import * as raidService from "../services/raid.service";
import * as powerService from "../services/power.service";

const router = Router();

// GET /api/disks - list disks with SMART status
router.get("/", async (_req: Request, res: Response) => {
  try {
    const disks = await diskService.listDisksWithSmart();
    res.json(disks);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/disks/raid - create RAID array
router.post("/raid", async (req: Request, res: Response) => {
  try {
    const { level, devices } = req.body;
    if (!level || !Array.isArray(devices)) {
      res.status(400).json({ error: "level and devices[] required" });
      return;
    }
    const result = await raidService.createRaid(level, devices);
    res.json({ ok: true, output: result });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/disks/raid - get RAID status
router.get("/raid", async (_req: Request, res: Response) => {
  try {
    const status = await raidService.getRaidStatus();
    res.json(status);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/disks/raid/:device - remove RAID array
router.delete("/raid/:device", async (req: Request, res: Response) => {
  try {
    const device = req.params.device as string;
    const result = await raidService.removeRaid(device);
    res.json({ ok: true, output: result });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/disks/power - control disk power
router.post("/power", async (req: Request, res: Response) => {
  try {
    const { disk, action, value } = req.body;
    if (!disk || !action) {
      res.status(400).json({ error: "disk and action required" });
      return;
    }

    let result: string;
    switch (action) {
      case "spindown":
        result = await powerService.spinDown(disk);
        break;
      case "spinup":
        result = await powerService.spinUp(disk);
        break;
      case "timeout":
        if (value === undefined) {
          res.status(400).json({ error: "value (seconds) required for timeout" });
          return;
        }
        result = await powerService.setIdleTimeout(disk, Number(value));
        break;
      default:
        res.status(400).json({ error: `Unknown action: ${action}` });
        return;
    }

    res.json({ ok: true, output: result });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/disks/power/:disk - get power status
router.get("/power/:disk", async (req: Request, res: Response) => {
  try {
    const disk = req.params.disk as string;
    const status = await powerService.getPowerStatus(disk);
    res.json({ disk, status });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
