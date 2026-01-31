# Quick Start Guide: Analytics & Rotation Features

## Getting Started

### 1. Build and Deploy
```bash
cd /home/jirka/Documents/s3custom_report/s3custom
npm run build
docker compose up -d --build
```

### 2. Access the Interface
Open browser: `http://localhost:8080`

---

## Feature 1: Disk Analytics Dashboard

### Access
Click **"Analytics"** in the left sidebar or navigate to `#/analytics`

### What You'll See

**Overview Charts (All Disks):**
- Disk age distribution
- Temperature overview (color-coded: green/yellow/red)
- Power-on hours comparison
- Health status pie chart

**Detailed Analysis:**
1. Select a disk from the dropdown
2. View life expectancy prediction:
   - Estimated remaining time
   - Confidence level
   - Warning alerts
   - Factor scores
3. Historical trend charts (if data available)

### First Time Setup

**Option A: Manual SMART History Entry**
```bash
# Save SMART data for a disk
curl -X POST http://localhost:8080/api/disks/smart-history \
  -H "Content-Type: application/json" \
  -d '{
    "disk": "sda",
    "entry": {
      "timestamp": "'$(date -Iseconds)'",
      "healthy": true,
      "temperature": 38,
      "powerOnHours": 12500,
      "reallocatedSectors": 0,
      "currentPendingSectors": 0
    }
  }'
```

**Option B: Automated Collection Script**
Create `/opt/s3custom/collect-smart.sh`:
```bash
#!/bin/bash
# Collect SMART data for all disks every hour

for disk in $(lsblk -d -n -o NAME | grep -v loop); do
  # Get SMART data (requires smartctl)
  SMART=$(smartctl -A -i /dev/$disk 2>/dev/null)

  if [ $? -eq 0 ]; then
    TEMP=$(echo "$SMART" | grep "Temperature_Celsius" | awk '{print $10}')
    HOURS=$(echo "$SMART" | grep "Power_On_Hours" | awk '{print $10}')
    REALLOC=$(echo "$SMART" | grep "Reallocated_Sector" | awk '{print $10}')
    PENDING=$(echo "$SMART" | grep "Current_Pending_Sector" | awk '{print $10}')
    HEALTH=$(smartctl -H /dev/$disk | grep -c "PASSED")

    curl -X POST http://localhost:8080/api/disks/smart-history \
      -H "Content-Type: application/json" \
      -d "{
        \"disk\": \"$disk\",
        \"entry\": {
          \"timestamp\": \"$(date -Iseconds)\",
          \"healthy\": $([ $HEALTH -eq 1 ] && echo true || echo false),
          \"temperature\": ${TEMP:-0},
          \"powerOnHours\": ${HOURS:-0},
          \"reallocatedSectors\": ${REALLOC:-0},
          \"currentPendingSectors\": ${PENDING:-0}
        }
      }"
  fi
done
```

Add to crontab:
```bash
# Collect SMART data every hour
0 * * * * /opt/s3custom/collect-smart.sh
```

### Understanding Life Expectancy

**Confidence Levels:**
- **High:** 50+ history entries, healthy overall score
- **Medium:** 10-50 history entries
- **Low:** <10 entries or critically low score

**Warning Examples:**
- "Disk has exceeded typical lifespan (50,000 hours)"
- "Critical: 75 reallocated sectors detected"
- "Critical temperature: 65°C (max safe: 50°C)"
- "Health trend is degrading"

**Factor Scores (0-100):**
- **Power-On Hours:** Age vs typical 5-year lifespan
- **Reallocated Sectors:** Physical disk degradation (most important)
- **Temperature:** Thermal health and trend
- **Error Rate:** Read/write errors
- **Trend:** Historical health changes

---

## Feature 2: Disk Rotation Power Management

### Access
Click **"Rotation"** in the left sidebar or navigate to `#/rotation`

### Quick Setup

1. **Enable Rotation:**
   - Toggle the switch to ON
   - System will start managing disks automatically

2. **Configure Settings:**
   - **Rotation Interval:** 1-24 hours (recommended: 4-8 hours)
   - **Disks Per Rotation:** How many to keep active (recommended: total/3)
   - **Excluded Disks:** Comma-separated list (e.g., "sda, sdb")
   - Click "Save Configuration"

3. **Monitor:**
   - View current statistics
   - Check disk power states (Active/Standby)
   - See next rotation time
   - View rotation timeline

### How It Works

**Rotation Algorithm:**
1. Detects all eligible disks (excludes system disks)
2. Keeps 1/3 of disks active (configurable)
3. Rotates to next set every X hours
4. Spins down standby disks to save power
5. Tracks power savings in hours

**Example with 6 Disks:**
- Interval: 4 hours
- Disks per rotation: 2
- Cycle:
  - 0-4h: sda, sdb active | sdc, sdd, sde, sdf standby
  - 4-8h: sdc, sdd active | sda, sdb, sde, sdf standby
  - 8-12h: sde, sdf active | sda, sdb, sdc, sdd standby
  - Repeats...

### Recommendations

**For Home NAS (3-6 disks):**
- Interval: 4 hours
- Disks per rotation: 1
- Exclude: System disk only

**For Large Storage (6+ disks):**
- Interval: 6-8 hours
- Disks per rotation: 2-3
- Exclude: System disk + hot spares

**For RAID Arrays:**
- Exclude all RAID member disks
- Only rotate unused disks
- Monitor RAID status regularly

### Viewing Rotation Status on Disk List

When rotation is enabled, disk cards show badges:
- **Green "Active" badge with pulse:** Disk is currently active
- **Gray "Standby" badge:** Disk is spun down to save power

Navigate to Disks view (`#/disks`) to see status on each card.

---

## API Reference

### Analytics Endpoints

**Save SMART History:**
```bash
POST /api/disks/smart-history
Body: { "disk": "sda", "entry": { ... } }
```

**Get SMART History:**
```bash
GET /api/disks/smart-history/sda?limit=100
```

**Get Life Expectancy:**
```bash
GET /api/disks/life-expectancy/sda
```

### Rotation Endpoints

**Get Status:**
```bash
GET /api/disks/rotation/status
```

**Enable Rotation:**
```bash
POST /api/disks/rotation/enable
Body: { "rotationIntervalMinutes": 240 }
```

**Disable Rotation:**
```bash
POST /api/disks/rotation/disable
```

**Update Config:**
```bash
PUT /api/disks/rotation/config
Body: { "rotationIntervalMinutes": 480, "disksPerRotation": 2 }
```

**Get Statistics:**
```bash
GET /api/disks/rotation/stats
```

---

## Troubleshooting

### Analytics Issues

**Problem:** "No temperature data available"
- **Solution:** smartctl not installed or not returning data
- **Fix:** Install smarttools: `sudo apt install smartmontools`

**Problem:** "Limited historical data available"
- **Solution:** Not enough SMART history entries
- **Fix:** Run collection script multiple times or wait for cron job

**Problem:** Life expectancy shows "low confidence"
- **Solution:** Need more historical data for trend analysis
- **Fix:** Continue collecting data, confidence will improve

### Rotation Issues

**Problem:** Rotation not starting
- **Solution:** Less than 3 eligible disks
- **Fix:** Need at least 3 non-system disks for rotation

**Problem:** Disk won't spin down
- **Solution:** hdparm not installed or disk is busy
- **Fix:**
  - Install hdparm: `sudo apt install hdparm`
  - Check disk activity: `sudo iotop`

**Problem:** System disk being rotated
- **Solution:** Auto-exclusion may have failed
- **Fix:** Manually add system disk to excluded list

**Problem:** RAID disk being rotated
- **Solution:** RAID members should be auto-excluded
- **Fix:** Add RAID member disks to exclusion list

### Data Storage Issues

**Problem:** History data not persisting
- **Solution:** data/ directory not writable
- **Fix:** Check permissions: `ls -la data/`

**Problem:** Rotation config not saving
- **Solution:** data/ directory doesn't exist
- **Fix:** Will auto-create, but check container mounts

---

## Performance Tips

1. **SMART Collection Frequency:**
   - Every hour is ideal for trend analysis
   - Daily is acceptable for long-term monitoring
   - Real-time for critical systems

2. **Rotation Interval:**
   - Shorter intervals (2-4h) for even wear distribution
   - Longer intervals (8-12h) for maximum power savings
   - Balance based on your access patterns

3. **Storage Optimization:**
   - History auto-limits to 1000 entries per disk
   - Approximately 100KB per disk with full history
   - Manual cleanup not required

4. **System Load:**
   - Analytics dashboard: Minimal impact
   - Rotation scheduler: Runs in background, very low CPU
   - Spinup/spindown: Brief I/O spike

---

## Advanced Usage

### Custom Rotation Strategy

Edit rotation config directly:
```bash
vim /opt/s3custom/data/rotation-config.json
```

```json
{
  "enabled": true,
  "rotationIntervalMinutes": 360,
  "disksPerRotation": 2,
  "excludedDisks": ["sda", "sdb"],
  "minIdleMinutesBeforeSpin": 5
}
```

Restart container to apply:
```bash
docker compose restart
```

### Export Analytics Data

Get all history for backup:
```bash
# Get history for all disks
for disk in sda sdb sdc; do
  curl "http://localhost:8080/api/disks/smart-history/$disk" > "${disk}_history.json"
done
```

### Integration with Monitoring

Example Prometheus metrics endpoint (future enhancement):
```bash
# Current approach: Parse API responses
curl http://localhost:8080/api/disks/rotation/stats | jq '.status.totalPowerSavingsHours'
```

---

## Summary

**Analytics Dashboard:**
- Visualize disk health trends
- Predict remaining lifetime
- Monitor temperature and usage
- Make data-driven replacement decisions

**Rotation Management:**
- Reduce power consumption by ~66%
- Extend disk lifespan through even wear
- Automatic rotation with minimal manual intervention
- Real-time monitoring and control

**Best Practice:**
1. Enable SMART collection (hourly cron job)
2. Monitor analytics dashboard weekly
3. Enable rotation for unused disks
4. Exclude system and RAID disks
5. Review warnings and replace disks proactively

For detailed implementation information, see `ANALYTICS_ROTATION_IMPLEMENTATION.md`
