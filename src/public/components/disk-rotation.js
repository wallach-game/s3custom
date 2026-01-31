import { BaseComponent } from "../shared/base-component.js";

class DiskRotation extends BaseComponent {
  async render() {
    this.setContent(`<div class="card"><p class="loading">Loading rotation settings...</p></div>`);

    try {
      const [status, stats] = await Promise.all([
        window.api.get("/api/disks/rotation/status"),
        window.api.get("/api/disks/rotation/stats")
      ]);

      window.activityLogger?.success("Loaded disk rotation status");

      this.setContent(`
        <style>
          .rotation-container {
            display: flex;
            flex-direction: column;
            gap: 24px;
          }

          .control-card {
            background: var(--surface);
            border: 1px solid var(--border);
            border-radius: var(--radius);
            padding: 24px;
            box-shadow: var(--shadow);
          }

          .toggle-section {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding-bottom: 20px;
            border-bottom: 1px solid var(--border);
            margin-bottom: 20px;
          }

          .toggle-label {
            display: flex;
            flex-direction: column;
            gap: 4px;
          }

          .toggle-title {
            font-size: 18px;
            font-weight: 600;
            color: var(--text);
          }

          .toggle-description {
            font-size: 13px;
            color: var(--text-muted);
          }

          .toggle-switch {
            position: relative;
            width: 56px;
            height: 28px;
          }

          .toggle-switch input {
            opacity: 0;
            width: 0;
            height: 0;
          }

          .toggle-slider {
            position: absolute;
            cursor: pointer;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background-color: var(--border);
            transition: 0.3s;
            border-radius: 28px;
          }

          .toggle-slider:before {
            position: absolute;
            content: "";
            height: 20px;
            width: 20px;
            left: 4px;
            bottom: 4px;
            background-color: white;
            transition: 0.3s;
            border-radius: 50%;
          }

          input:checked + .toggle-slider {
            background-color: var(--accent);
          }

          input:checked + .toggle-slider:before {
            transform: translateX(28px);
          }

          .settings-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
            margin-bottom: 20px;
          }

          .setting-item {
            display: flex;
            flex-direction: column;
            gap: 8px;
          }

          .setting-label {
            font-size: 13px;
            font-weight: 600;
            color: var(--text);
          }

          .setting-input {
            padding: 10px;
            font-size: 14px;
            border: 1px solid var(--border);
            border-radius: var(--radius);
            background: var(--bg);
            color: var(--text);
          }

          .slider-container {
            display: flex;
            flex-direction: column;
            gap: 8px;
          }

          .slider-value {
            text-align: center;
            font-size: 16px;
            font-weight: 600;
            color: var(--accent);
          }

          input[type="range"] {
            width: 100%;
            height: 6px;
            background: var(--border);
            outline: none;
            border-radius: 3px;
            cursor: pointer;
          }

          input[type="range"]::-webkit-slider-thumb {
            -webkit-appearance: none;
            appearance: none;
            width: 18px;
            height: 18px;
            background: var(--accent);
            cursor: pointer;
            border-radius: 50%;
          }

          .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
            gap: 16px;
            margin-top: 20px;
          }

          .stat-box {
            background: var(--bg);
            padding: 16px;
            border-radius: var(--radius);
            border: 1px solid var(--border);
          }

          .stat-value {
            font-size: 28px;
            font-weight: 700;
            color: var(--accent);
            margin-bottom: 4px;
          }

          .stat-label {
            font-size: 12px;
            color: var(--text-muted);
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }

          .disk-states-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
            gap: 12px;
            margin-top: 16px;
          }

          .disk-state-card {
            background: var(--bg);
            padding: 12px;
            border-radius: var(--radius);
            border: 1px solid var(--border);
            display: flex;
            align-items: center;
            gap: 12px;
          }

          .state-indicator {
            width: 12px;
            height: 12px;
            border-radius: 50%;
          }

          .state-active {
            background: var(--success);
            box-shadow: 0 0 8px var(--success);
          }

          .state-standby {
            background: var(--text-muted);
          }

          .state-unknown {
            background: var(--warning);
          }

          .disk-state-info {
            flex: 1;
          }

          .disk-state-name {
            font-size: 14px;
            font-weight: 600;
            color: var(--text);
          }

          .disk-state-status {
            font-size: 11px;
            color: var(--text-muted);
            text-transform: uppercase;
          }

          .next-rotation {
            background: var(--accent-subtle);
            padding: 16px;
            border-radius: var(--radius);
            border-left: 3px solid var(--accent);
            margin-top: 16px;
          }

          .next-rotation-label {
            font-size: 12px;
            color: var(--text-muted);
            margin-bottom: 4px;
          }

          .next-rotation-time {
            font-size: 16px;
            font-weight: 600;
            color: var(--accent);
          }

          .timeline-container {
            margin-top: 24px;
            padding: 20px;
            background: var(--bg);
            border-radius: var(--radius);
            border: 1px solid var(--border);
          }

          .timeline-title {
            font-size: 14px;
            font-weight: 600;
            margin-bottom: 16px;
            color: var(--text);
          }

          .timeline {
            display: flex;
            gap: 4px;
            height: 40px;
          }

          .timeline-slot {
            flex: 1;
            border-radius: 4px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 10px;
            font-weight: 600;
            color: white;
          }

          .timeline-active {
            background: var(--success);
          }

          .timeline-standby {
            background: var(--text-muted);
          }
        </style>

        <div class="section-header">
          <h1>Disk Rotation Power Management</h1>
        </div>

        <div class="rotation-container">
          <div class="control-card">
            <div class="toggle-section">
              <div class="toggle-label">
                <div class="toggle-title">Automatic Disk Rotation</div>
                <div class="toggle-description">
                  Rotate disk power states to reduce energy consumption and extend disk lifespan
                </div>
              </div>
              <label class="toggle-switch">
                <input type="checkbox" id="rotation-toggle" ${status.enabled ? 'checked' : ''}>
                <span class="toggle-slider"></span>
              </label>
            </div>

            <div class="settings-grid" id="settings-section" style="display: ${status.enabled ? 'grid' : 'none'}">
              <div class="setting-item">
                <label class="setting-label">Rotation Interval</label>
                <div class="slider-container">
                  <div class="slider-value" id="interval-value">4 hours</div>
                  <input type="range" id="interval-slider" min="1" max="24" value="4" step="1">
                </div>
              </div>

              <div class="setting-item">
                <label class="setting-label">Disks Active per Rotation</label>
                <input type="number" id="disks-per-rotation" class="setting-input" value="1" min="1" max="10">
              </div>

              <div class="setting-item">
                <label class="setting-label">Excluded Disks (comma-separated)</label>
                <input type="text" id="excluded-disks" class="setting-input" placeholder="sda, sdb">
              </div>
            </div>

            <button class="btn-primary" id="save-config" style="display: ${status.enabled ? 'inline-block' : 'none'}; margin-top: 16px;">
              Save Configuration
            </button>
          </div>

          <div class="control-card" id="stats-section" style="display: ${status.enabled ? 'block' : 'none'}">
            <h2 style="margin: 0 0 16px; font-size: 16px;">Rotation Statistics</h2>

            <div class="stats-grid">
              <div class="stat-box">
                <div class="stat-value">${status.totalDisksManaged}</div>
                <div class="stat-label">Disks Managed</div>
              </div>
              <div class="stat-box">
                <div class="stat-value">${status.currentlyActive}</div>
                <div class="stat-label">Currently Active</div>
              </div>
              <div class="stat-box">
                <div class="stat-value">${status.currentlyStandby}</div>
                <div class="stat-label">Currently Standby</div>
              </div>
              <div class="stat-box">
                <div class="stat-value">${status.totalPowerSavingsHours.toFixed(0)}h</div>
                <div class="stat-label">Power Savings</div>
              </div>
            </div>

            ${status.nextRotationTime ? `
              <div class="next-rotation">
                <div class="next-rotation-label">Next Rotation</div>
                <div class="next-rotation-time">${new Date(status.nextRotationTime).toLocaleString()}</div>
              </div>
            ` : ''}

            ${Object.keys(stats.diskStates).length > 0 ? `
              <h3 style="margin: 24px 0 12px; font-size: 14px; font-weight: 600;">Disk Power States</h3>
              <div class="disk-states-grid">
                ${Object.values(stats.diskStates).map(disk => `
                  <div class="disk-state-card">
                    <div class="state-indicator state-${disk.powerState}"></div>
                    <div class="disk-state-info">
                      <div class="disk-state-name">/dev/${this.esc(disk.disk)}</div>
                      <div class="disk-state-status">${this.esc(disk.powerState)}</div>
                    </div>
                  </div>
                `).join('')}
              </div>
            ` : ''}

            ${status.currentRotationSet.length > 0 ? `
              <div class="timeline-container">
                <div class="timeline-title">Current Rotation Cycle</div>
                <div class="timeline">
                  ${this.renderTimeline(status, stats)}
                </div>
              </div>
            ` : ''}
          </div>
        </div>
      `);

      this.attachEventListeners(status);

    } catch (err) {
      window.activityLogger?.error(`Failed to load rotation settings: ${err.message}`);
      this.setContent(`<div class="error-msg">Failed to load rotation settings: ${this.esc(err.message)}</div>`);
    }
  }

  renderTimeline(status, stats) {
    const allDisks = Object.keys(stats.diskStates);
    if (allDisks.length === 0) return '';

    return allDisks.map(disk => {
      const isActive = status.currentRotationSet.includes(disk);
      const cssClass = isActive ? 'timeline-active' : 'timeline-standby';
      return `<div class="timeline-slot ${cssClass}">${this.esc(disk)}</div>`;
    }).join('');
  }

  attachEventListeners(status) {
    const toggle = this.$("#rotation-toggle");
    const intervalSlider = this.$("#interval-slider");
    const intervalValue = this.$("#interval-value");
    const saveButton = this.$("#save-config");
    const settingsSection = this.$("#settings-section");
    const statsSection = this.$("#stats-section");

    toggle.addEventListener("change", async (e) => {
      const enabled = e.target.checked;

      if (enabled) {
        try {
          window.activityLogger?.info("Enabling disk rotation...");
          await window.api.post("/api/disks/rotation/enable", {
            rotationIntervalMinutes: parseInt(intervalSlider.value) * 60
          });
          window.activityLogger?.success("Disk rotation enabled");
          settingsSection.style.display = "grid";
          statsSection.style.display = "block";
          saveButton.style.display = "inline-block";
          setTimeout(() => this.render(), 1000);
        } catch (err) {
          window.activityLogger?.error(`Failed to enable rotation: ${err.message}`);
          alert(`Failed to enable rotation: ${err.message}`);
          e.target.checked = false;
        }
      } else {
        try {
          window.activityLogger?.info("Disabling disk rotation...");
          await window.api.post("/api/disks/rotation/disable");
          window.activityLogger?.success("Disk rotation disabled");
          settingsSection.style.display = "none";
          statsSection.style.display = "none";
          saveButton.style.display = "none";
        } catch (err) {
          window.activityLogger?.error(`Failed to disable rotation: ${err.message}`);
          alert(`Failed to disable rotation: ${err.message}`);
          e.target.checked = true;
        }
      }
    });

    if (intervalSlider && intervalValue) {
      intervalSlider.addEventListener("input", (e) => {
        const hours = e.target.value;
        intervalValue.textContent = `${hours} hour${hours > 1 ? 's' : ''}`;
      });
    }

    if (saveButton) {
      saveButton.addEventListener("click", async () => {
        try {
          const config = {
            rotationIntervalMinutes: parseInt(intervalSlider.value) * 60,
            disksPerRotation: parseInt(this.$("#disks-per-rotation").value),
            excludedDisks: this.$("#excluded-disks").value
              .split(",")
              .map(d => d.trim())
              .filter(d => d.length > 0)
          };

          window.activityLogger?.info("Saving rotation configuration...");
          await window.api.put("/api/disks/rotation/config", config);
          window.activityLogger?.success("Configuration saved successfully");
          alert("Configuration saved successfully!");
        } catch (err) {
          window.activityLogger?.error(`Failed to save configuration: ${err.message}`);
          alert(`Failed to save configuration: ${err.message}`);
        }
      });
    }
  }

  esc(str) {
    const el = document.createElement("span");
    el.textContent = String(str);
    return el.innerHTML;
  }
}

customElements.define("disk-rotation", DiskRotation);
