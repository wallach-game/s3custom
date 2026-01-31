import { BaseComponent } from "../shared/base-component.js";

class DiskList extends BaseComponent {
  async render() {
    this.setContent(`<div class="card"><p class="loading">Loading disks...</p></div>`);

    try {
      const [disks, raids, rotationStatus] = await Promise.all([
        window.api.get("/api/disks"),
        window.api.get("/api/disks/raid"),
        window.api.get("/api/disks/rotation/status").catch(() => ({ enabled: false, currentRotationSet: [] })),
      ]);

      window.activityLogger?.success(`Loaded ${disks.length} disks`);

      const raidMemberDisks = new Set(raids.flatMap(r => r.devices.map(d => d.name.replace('/dev/', ''))));

      const totalDisks = disks.length;
      const healthy = disks.filter((d) => d.smart?.healthy).length;
      const unhealthy = disks.filter((d) => d.smart && !d.smart.healthy).length;

      this.setContent(`
        <style>
          .disk-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
            gap: 20px;
            margin-top: 24px;
          }

          .disk-card {
            background: var(--surface);
            border: 1px solid var(--border);
            border-radius: var(--radius);
            padding: 20px;
            box-shadow: var(--shadow);
            transition: all var(--transition);
            display: flex;
            flex-direction: column;
            gap: 16px;
            animation: cardIn 0.3s ease;
          }

          .disk-card:hover {
            border-color: var(--accent);
            box-shadow: 0 4px 16px rgba(91, 157, 255, 0.15);
            transform: translateY(-2px);
          }

          .disk-header {
            display: flex;
            align-items: flex-start;
            gap: 14px;
          }

          .disk-icon-container {
            width: 56px;
            height: 56px;
            border-radius: 10px;
            display: flex;
            align-items: center;
            justify-content: center;
            background: var(--accent-subtle);
            flex-shrink: 0;
          }

          .disk-icon-container svg {
            color: var(--accent);
          }

          .disk-main-info {
            flex: 1;
            min-width: 0;
          }

          .disk-name {
            font-size: 16px;
            font-weight: 600;
            color: var(--text);
            margin-bottom: 4px;
            display: flex;
            align-items: center;
            gap: 8px;
          }

          .disk-name code {
            font-size: 14px;
            color: var(--accent);
            background: var(--accent-subtle);
            padding: 2px 8px;
            border-radius: 4px;
          }

          .disk-model {
            font-size: 13px;
            color: var(--text-muted);
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }

          .disk-details {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 12px;
          }

          .disk-detail-item {
            display: flex;
            flex-direction: column;
            gap: 4px;
          }

          .disk-detail-label {
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            color: var(--text-muted);
            font-weight: 600;
          }

          .disk-detail-value {
            font-size: 14px;
            color: var(--text);
            font-weight: 500;
          }

          .disk-actions {
            display: flex;
            gap: 8px;
            flex-wrap: wrap;
            padding-top: 8px;
            border-top: 1px solid var(--border);
          }

          .disk-action-btn {
            flex: 1;
            min-width: 100px;
            padding: 8px 12px;
            font-size: 12px;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 6px;
          }

          .rotation-badge {
            display: inline-flex;
            align-items: center;
            gap: 4px;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 11px;
            font-weight: 600;
            text-transform: uppercase;
          }

          .rotation-active {
            background: var(--success-subtle);
            color: var(--success);
          }

          .rotation-standby {
            background: var(--text-muted);
            color: var(--bg);
          }

          .rotation-pulse {
            width: 6px;
            height: 6px;
            border-radius: 50%;
            background: currentColor;
            animation: pulse 2s ease-in-out infinite;
          }

          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
          }

          @media (max-width: 768px) {
            .disk-grid {
              grid-template-columns: 1fr;
            }
          }
        </style>

        <div class="section-header">
          <h1>Disks</h1>
          <button class="btn-secondary" id="refresh">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
            Refresh
          </button>
        </div>

        <div class="stats-row">
          <div class="stat-card">
            <div class="stat-label">Total Disks</div>
            <div class="stat-value accent">${totalDisks}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Healthy</div>
            <div class="stat-value success">${healthy}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Issues</div>
            <div class="stat-value ${unhealthy > 0 ? "danger" : ""}">${unhealthy}</div>
          </div>
        </div>

        ${disks.length === 0
          ? `<div class="card">
              <div class="empty-state">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="2" width="20" height="8" rx="2"/><rect x="2" y="14" width="20" height="8" rx="2"/></svg>
                <p>No disks detected</p>
              </div>
            </div>`
          : `<div class="disk-grid">
              ${disks.map((d) => `
                <div class="disk-card">
                  <div class="disk-header">
                    <div class="disk-icon-container">
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                        <ellipse cx="12" cy="5" rx="9" ry="3"/>
                        <path d="M3 5V19A9 3 0 0 0 21 19V5"/>
                        <path d="M3 12A9 3 0 0 0 21 12"/>
                        <circle cx="12" cy="12" r="1" fill="currentColor"/>
                      </svg>
                    </div>
                    <div class="disk-main-info">
                      <div class="disk-name">
                        <code>/dev/${this.esc(d.name)}</code>
                        ${this.renderRotationBadge(d.name, rotationStatus)}
                      </div>
                      <div class="disk-model">${this.esc(d.model || "Unknown Model")}</div>
                    </div>
                  </div>

                  <div class="disk-details">
                    <div class="disk-detail-item">
                      <div class="disk-detail-label">Capacity</div>
                      <div class="disk-detail-value">${this.esc(d.size)}</div>
                    </div>
                    <div class="disk-detail-item">
                      <div class="disk-detail-label">Health</div>
                      <div class="disk-detail-value">${this.smartBadge(d.smart)}</div>
                    </div>
                    <div class="disk-detail-item">
                      <div class="disk-detail-label">Temperature</div>
                      <div class="disk-detail-value">
                        ${d.smart?.temperature != null
                          ? `<span style="color:${d.smart.temperature > 50 ? "var(--danger)" : "var(--success)"}">${d.smart.temperature}°C</span>`
                          : `<span style="color:var(--text-muted)">—</span>`}
                      </div>
                    </div>
                    <div class="disk-detail-item">
                      <div class="disk-detail-label">Mount Point</div>
                      <div class="disk-detail-value">
                        ${d.mountpoint
                          ? `<code style="font-size:11px;color:var(--text-secondary)">${this.esc(d.mountpoint)}</code>`
                          : `<span style="color:var(--text-muted)">—</span>`}
                      </div>
                    </div>
                  </div>

                  <div class="disk-actions">
                    <button class="btn-secondary disk-action-btn examine-btn" data-disk="${this.esc(d.name)}">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                      Examine
                    </button>
                    <button class="btn-secondary disk-action-btn recover-btn" data-disk="${this.esc(d.name)}">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                      Recover
                    </button>
                    <button class="btn-secondary disk-action-btn clone-btn" data-disk="${this.esc(d.name)}">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="13" y="13" width="8" height="8" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                      Clone
                    </button>
                    <button class="btn-secondary disk-action-btn test-speed" data-disk="${this.esc(d.name)}">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 12H4"/><path d="M18 6l6 6-6 6"/></svg>
                      Test
                    </button>
                  </div>
                </div>
              `).join("")}
            </div>`
        }
      `);

      this.$("#refresh").addEventListener("click", () => {
        window.activityLogger?.info("Refreshing disk list...");
        this.render();
      });

      // Attach event listeners to action buttons
      this.$$(".examine-btn").forEach(btn => {
        btn.addEventListener("click", () => {
          const disk = btn.dataset.disk;
          window.activityLogger?.info(`Opening examine dialog for ${disk}`);
          this.emit("open-examine", { disk });
        });
      });

      this.$$(".recover-btn").forEach(btn => {
        btn.addEventListener("click", () => {
          const disk = btn.dataset.disk;
          window.activityLogger?.info(`Opening recover dialog for ${disk}`);
          this.emit("open-recover", { disk });
        });
      });

      this.$$(".clone-btn").forEach(btn => {
        btn.addEventListener("click", () => {
          const disk = btn.dataset.disk;
          window.activityLogger?.info(`Opening clone dialog for ${disk}`);
          this.emit("open-clone", { disk });
        });
      });

      this.$$(".test-speed").forEach(btn => {
        btn.addEventListener("click", () => this.testSpeed(btn.dataset.disk));
      });
    } catch (err) {
      window.activityLogger?.error(`Failed to load disks: ${err.message}`);
      this.setContent(`<div class="error-msg">Failed to load disks: ${this.esc(err.message)}</div>`);
    }
  }

  async testSpeed(disk) {
    const btn = this.shadowRoot.querySelector(`[data-disk="${disk}"].test-speed`);
    const originalContent = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="spin-animation"><path d="M12 2v4"/><path d="M12 18v4"/><path d="M4.93 4.93l2.83 2.83"/><path d="M16.24 16.24l2.83 2.83"/><path d="M2 12h4"/><path d="M18 12h4"/><path d="M4.93 19.07l2.83-2.83"/><path d="M16.24 7.76l2.83-2.83"/></svg>`;

    window.activityLogger?.info(`Testing speed for ${disk}...`);

    try {
      const result = await window.api.get(`/api/disks/${disk}/speed`);
      let message = `Disk speed for ${disk}: ${result.speed.toFixed(2)} MB/sec`;
      if (result.isAnomaly) {
        message += "\n\nWarning: Anomaly detected! Disk speed is significantly lower than average.";
        window.activityLogger?.warning(`Speed anomaly detected on ${disk}`);
      } else {
        window.activityLogger?.success(`Speed test completed for ${disk}: ${result.speed.toFixed(2)} MB/sec`);
      }
      alert(message);
    } catch (err) {
      window.activityLogger?.error(`Speed test failed for ${disk}: ${err.message}`);
      alert(`Failed to test disk speed: ${err.message}`);
    } finally {
      btn.disabled = false;
      btn.innerHTML = originalContent;
    }
  }

  smartBadge(smart) {
    if (!smart) return `<span class="badge badge-muted">Unknown</span>`;
    if (smart.healthy) return `<span class="badge badge-success">✓ Healthy</span>`;
    return `<span class="badge badge-danger">✗ Failing</span>`;
  }

  renderRotationBadge(diskName, rotationStatus) {
    if (!rotationStatus.enabled) return '';

    const isActive = rotationStatus.currentRotationSet.includes(diskName);
    if (isActive) {
      return `<span class="rotation-badge rotation-active">
        <span class="rotation-pulse"></span>
        Active
      </span>`;
    } else {
      return `<span class="rotation-badge rotation-standby">Standby</span>`;
    }
  }

  esc(str) {
    const el = document.createElement("span");
    el.textContent = String(str);
    return el.innerHTML;
  }
}

customElements.define("disk-list", DiskList);
