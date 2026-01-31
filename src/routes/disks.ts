import { Router, Request, Response } from "express";
import * as diskService from "../services/disk.service";
import * as raidService from "../services/raid.service";
import * as powerService from "../services/power.service";
import * as recoveryService from "../services/recovery.service";
import * as smartHistoryService from "../services/smart-history.service";
import * as lifeExpectancyService from "../services/life-expectancy.service";
import * as rotationService from "../services/disk-rotation.service";
import { log, LogLevel } from "../services/logging.service";

const router = Router();

// GET /api/disks - list disks with SMART status
router.get("/", async (_req: Request, res: Response) => {
  try {
    const disks = await diskService.listDisksWithSmart();
    res.json(disks);
  } catch (err: any) {
    log(LogLevel.ERROR, "Failed to list disks with SMART status", { error: err.message, stack: err.stack });
    res.status(500).json({ error: "Failed to retrieve disk information" });
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
    log(LogLevel.ERROR, "Failed to create RAID array", { error: err.message, stack: err.stack, body: req.body });
    res.status(500).json({ error: "Failed to create RAID array" });
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
    log(LogLevel.ERROR, "Failed to clone disk to RAID array", { error: err.message, stack: err.stack, disk: req.body.disk });
    res.status(500).json({ error: "Failed to clone disk to RAID array" });
  }
});

// GET /api/disks/raid - get RAID status
router.get("/raid", async (_req: Request, res: Response) => {
  try {
    const status = await raidService.getRaidStatus();
    res.json(status);
  } catch (err: any) {
    log(LogLevel.ERROR, "Failed to get RAID status", { error: err.message, stack: err.stack });
    res.status(500).json({ error: "Failed to retrieve RAID status" });
  }
});

// DELETE /api/disks/raid/:device - remove RAID array
router.delete("/raid/:device", async (req: Request, res: Response) => {
  try {
    const device = req.params.device as string;
    const result = await raidService.removeRaid(device);
    res.json({ ok: true, output: result });
  } catch (err: any) {
    log(LogLevel.ERROR, `Failed to remove RAID array ${req.params.device}`, { error: err.message, stack: err.stack });
    res.status(500).json({ error: "Failed to remove RAID array" });
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
    log(LogLevel.ERROR, `Failed to fail disk ${req.body.disk} in RAID array ${req.params.device}`, { error: err.message, stack: err.stack });
    res.status(500).json({ error: "Failed to mark disk as failed in RAID array" });
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
    log(LogLevel.ERROR, `Failed to remove disk ${req.body.disk} from RAID array ${req.params.device}`, { error: err.message, stack: err.stack });
    res.status(500).json({ error: "Failed to remove disk from RAID array" });
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
    log(LogLevel.ERROR, `Failed to add disk ${req.body.disk} to RAID array ${req.params.device}`, { error: err.message, stack: err.stack });
    res.status(500).json({ error: "Failed to add disk to RAID array" });
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
    log(LogLevel.ERROR, `Failed to control power for disk ${req.body.disk} with action ${req.body.action}`, { error: err.message, stack: err.stack, body: req.body });
    res.status(500).json({ error: "Failed to control disk power" });
  }
});

// GET /api/disks/power/:disk - get power status
router.get("/power/:disk", async (req: Request, res: Response) => {
  try {
    const disk = req.params.disk as string;
    const status = await powerService.getPowerStatus(disk);
    res.json({ disk, status });
  } catch (err: any) {
    log(LogLevel.ERROR, `Failed to get power status for disk ${req.params.disk}`, { error: err.message, stack: err.stack });
    res.status(500).json({ error: "Failed to retrieve disk power status" });
  }
});

// GET /api/disks/:disk/speed - get disk speed
router.get("/:disk/speed", async (req: Request, res: Response) => {
  try {
    const disk = req.params.disk as string;
    const { speed, isAnomaly } = await diskService.getDiskSpeed(disk);
    res.json({ disk, speed, isAnomaly });
  } catch (err: any) {
    log(LogLevel.ERROR, `Failed to get disk speed for disk ${req.params.disk}`, { error: err.message, stack: err.stack });
    res.status(500).json({ error: "Failed to retrieve disk speed" });
  }
});

// New endpoint for disk examination
router.get("/examine/:disk", async (req: Request, res: Response) => {
  try {
    const disk = req.params.disk as string;
    const result = await diskService.examineDisk(disk);
    res.json(result);
  } catch (err: any) {
    log(LogLevel.ERROR, `Failed to examine disk ${req.params.disk}`, { error: err.message, stack: err.stack });
    res.status(500).json({ error: "Failed to examine disk" });
  }
});

// POST /api/disks/recover - Mount a disk in read-only recovery mode
router.post("/recover", async (req: Request, res: Response) => {
  try {
    const { disk, mountPath } = req.body;
    if (!disk || !mountPath) {
      res.status(400).json({ error: "disk and mountPath are required" });
      return;
    }
    const result = await recoveryService.mountDiskReadOnly(disk, mountPath);
    res.json({ ok: true, message: result });
  } catch (err: any) {
    log(LogLevel.ERROR, `Failed to recover disk ${req.body.disk} to ${req.body.mountPath}`, { error: err.message, stack: err.stack });
    res.status(500).json({ error: "Failed to mount disk in recovery mode" });
  }
});

// POST /api/disks/clone - Clone a disk
router.post("/clone", async (req: Request, res: Response) => {
  try {
    const { sourceDisk, destinationPath, logfilePath } = req.body;
    if (!sourceDisk || !destinationPath) {
      res.status(400).json({ error: "sourceDisk and destinationPath are required" });
      return;
    }
    const result = await recoveryService.cloneDisk(sourceDisk, destinationPath, logfilePath);
    res.json({ ok: true, message: result });
  } catch (err: any) {
    log(LogLevel.ERROR, `Failed to clone disk ${req.body.sourceDisk} to ${req.body.destinationPath}`, { error: err.message, stack: err.stack });
    res.status(500).json({ error: "Failed to clone disk" });
  }
});

// POST /api/disks/smart-history - Save SMART history entry
router.post("/smart-history", async (req: Request, res: Response) => {
  try {
    const { disk, entry } = req.body;
    if (!disk || !entry) {
      res.status(400).json({ error: "disk and entry are required" });
      return;
    }
    await smartHistoryService.saveSmartHistory(disk, entry);
    res.json({ ok: true, message: "SMART history saved" });
  } catch (err: any) {
    log(LogLevel.ERROR, `Failed to save SMART history for ${req.body.disk}`, { error: err.message, stack: err.stack });
    res.status(500).json({ error: "Failed to save SMART history" });
  }
});

// GET /api/disks/smart-history/:disk - Get SMART history for a disk
router.get("/smart-history/:disk", async (req: Request, res: Response) => {
  try {
    const disk = req.params.disk as string;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;
    const history = await smartHistoryService.getSmartHistory(disk, limit);
    res.json({ disk, history });
  } catch (err: any) {
    log(LogLevel.ERROR, `Failed to get SMART history for ${req.params.disk}`, { error: err.message, stack: err.stack });
    res.status(500).json({ error: "Failed to retrieve SMART history" });
  }
});

// GET /api/disks/life-expectancy/:disk - Get life expectancy prediction
router.get("/life-expectancy/:disk", async (req: Request, res: Response) => {
  try {
    const disk = req.params.disk as string;
    const lifeExpectancy = await lifeExpectancyService.calculateLifeExpectancy(disk);
    res.json(lifeExpectancy);
  } catch (err: any) {
    log(LogLevel.ERROR, `Failed to calculate life expectancy for ${req.params.disk}`, { error: err.message, stack: err.stack });
    res.status(500).json({ error: "Failed to calculate life expectancy" });
  }
});

// GET /api/disks/rotation/status - Get rotation status
router.get("/rotation/status", async (_req: Request, res: Response) => {
  try {
    const status = rotationService.getRotationStatus();
    res.json(status);
  } catch (err: any) {
    log(LogLevel.ERROR, "Failed to get rotation status", { error: err.message, stack: err.stack });
    res.status(500).json({ error: "Failed to get rotation status" });
  }
});

// POST /api/disks/rotation/enable - Enable rotation
router.post("/rotation/enable", async (req: Request, res: Response) => {
  try {
    const config = req.body;
    rotationService.enableRotation(config);
    res.json({ ok: true, message: "Disk rotation enabled" });
  } catch (err: any) {
    log(LogLevel.ERROR, "Failed to enable rotation", { error: err.message, stack: err.stack });
    res.status(500).json({ error: "Failed to enable rotation" });
  }
});

// POST /api/disks/rotation/disable - Disable rotation
router.post("/rotation/disable", async (_req: Request, res: Response) => {
  try {
    rotationService.disableRotation();
    res.json({ ok: true, message: "Disk rotation disabled" });
  } catch (err: any) {
    log(LogLevel.ERROR, "Failed to disable rotation", { error: err.message, stack: err.stack });
    res.status(500).json({ error: "Failed to disable rotation" });
  }
});

// PUT /api/disks/rotation/config - Update rotation configuration
router.put("/rotation/config", async (req: Request, res: Response) => {
  try {
    const config = req.body;
    rotationService.updateRotationConfig(config);
    res.json({ ok: true, message: "Rotation configuration updated" });
  } catch (err: any) {
    log(LogLevel.ERROR, "Failed to update rotation config", { error: err.message, stack: err.stack });
    res.status(500).json({ error: "Failed to update rotation configuration" });
  }
});

// GET /api/disks/rotation/stats - Get rotation statistics
router.get("/rotation/stats", async (_req: Request, res: Response) => {
  try {
    const status = rotationService.getRotationStatus();
    const diskStates = rotationService.getDiskStates();
    res.json({ status, diskStates });
  } catch (err: any) {
    log(LogLevel.ERROR, "Failed to get rotation stats", { error: err.message, stack: err.stack });
    res.status(500).json({ error: "Failed to get rotation statistics" });
  }
});

export default router;
