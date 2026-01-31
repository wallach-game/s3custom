import { Router, Request, Response } from "express";
import * as diskService from "../services/disk.service";
import * as raidService from "../services/raid.service";
import * as powerService from "../services/power.service";
import { log, LogLevel } from "../services/logging.service";

const router = Router();

// GET /api/disks - list disks with SMART status
router.get("/", async (_req: Request, res: Response) => {
  try {
    const disks = await diskService.listDisksWithSmart();
    res.json(disks);
  } catch (err: any) {
    log(LogLevel.ERROR, "Failed to list disks with SMART status", { error: err.message });
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
    log(LogLevel.ERROR, "Failed to create RAID array", { error: err.message, body: req.body });
    res.status(500).json({ error: err.message });
  }
});

// POST /api/disks/raid/clone - clone a disk to a new RAID 1 array
router.post("/raid/clone", async (req: Request, res: Response) => {
  try {
    const { disk } = req.body;
    if (!disk) {
      res.status(400).json({ error: "disk required" });
      return;
    }
    const result = await raidService.cloneToRaid(disk);
    res.json({ ok: true, output: result });
  } catch (err: any) {
    log(LogLevel.ERROR, "Failed to clone disk to RAID array", { error: err.message, disk: req.body.disk });
    res.status(500).json({ error: err.message });
  }
});

// GET /api/disks/raid - get RAID status
router.get("/raid", async (_req: Request, res: Response) => {
  try {
    const status = await raidService.getRaidStatus();
    res.json(status);
  } catch (err: any) {
    log(LogLevel.ERROR, "Failed to get RAID status", { error: err.message });
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
    log(LogLevel.ERROR, `Failed to remove RAID array ${req.params.device}`, { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

// POST /api/disks/raid/:device/fail - fail a disk in a RAID array
router.post("/raid/:device/fail", async (req: Request, res: Response) => {
  try {
    const device = req.params.device as string;
    const { disk } = req.body;
    if (!disk) {
      res.status(400).json({ error: "disk required" });
      return;
    }
    const result = await raidService.failDisk(device, disk);
    res.json({ ok: true, output: result });
  } catch (err: any) {
    log(LogLevel.ERROR, `Failed to fail disk ${req.body.disk} in RAID array ${req.params.device}`, { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

// POST /api/disks/raid/:device/remove - remove a disk from a RAID array
router.post("/raid/:device/remove", async (req: Request, res: Response) => {
  try {
    const device = req.params.device as string;
    const { disk } = req.body;
    if (!disk) {
      res.status(400).json({ error: "disk required" });
      return;
    }
    const result = await raidService.removeDisk(device, disk);
    res.json({ ok: true, output: result });
  } catch (err: any) {
    log(LogLevel.ERROR, `Failed to remove disk ${req.body.disk} from RAID array ${req.params.device}`, { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

// POST /api/disks/raid/:device/add - add a disk to a RAID array
router.post("/raid/:device/add", async (req: Request, res: Response) => {
  try {
    const device = req.params.device as string;
    const { disk } = req.body;
    if (!disk) {
      res.status(400).json({ error: "disk required" });
      return;
    }
    const result = await raidService.addDisk(device, disk);
    res.json({ ok: true, output: result });
  } catch (err: any) {
    log(LogLevel.ERROR, `Failed to add disk ${req.body.disk} to RAID array ${req.params.device}`, { error: err.message });
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
    log(LogLevel.ERROR, `Failed to control power for disk ${req.body.disk} with action ${req.body.action}`, { error: err.message, body: req.body });
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
    log(LogLevel.ERROR, `Failed to get power status for disk ${req.params.disk}`, { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

// GET /api/disks/:disk/speed - get disk speed
router.get("/:disk/speed", async (req: Request, res: Response) => {
  try {
    const disk = req.params.disk as string;
    const { speed, isAnomaly } = await diskService.getDiskSpeed(disk);
    res.json({ disk, speed, isAnomaly });
  } catch (err: any) {
    log(LogLevel.ERROR, `Failed to get disk speed for disk ${req.params.disk}`, { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

export default router;
