import { BaseComponent } from "../shared/base-component.js";

class DiskList extends BaseComponent {
  async render() {
    this.setContent(`<div class="card"><p class="loading">Loading disks...</p></div>`);

    try {
      const [disks, raids] = await Promise.all([
        window.api.get("/api/disks"),
        window.api.get("/api/disks/raid"),
      ]);

      const raidMemberDisks = new Set(raids.flatMap(r => r.devices.map(d => d.name.replace('/dev/', ''))));

      const totalDisks = disks.length;
      const healthy = disks.filter((d) => d.smart?.healthy).length;
      const unhealthy = disks.filter((d) => d.smart && !d.smart.healthy).length;
      const totalSize = disks.map((d) => d.size).join(" + ");

      this.setContent(`
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

        <div class="card">
          <h2>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="8" rx="2"/><rect x="2" y="14" width="20" height="8" rx="2"/><circle cx="6" cy="6" r="1"/><circle cx="6" cy="18" r="1"/></svg>
            Block Devices
          </h2>
          ${disks.length === 0
            ? `<div class="empty-state">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="2" width="20" height="8" rx="2"/><rect x="2" y="14" width="20" height="8" rx="2"/></svg>
                <p>No disks detected</p>
              </div>`
            : `<table>
                <thead>
                  <tr>
                    <th>Device</th>
                    <th>Model</th>
                    <th>Size</th>
                    <th>Mount</th>
                    <th>Health</th>
                    <th>Temp</th>
                    <th>Power-On</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  ${disks.map((d) => `
                    <tr>
                      <td><code style="color:var(--text);font-size:13px">/dev/${this.esc(d.name)}</code></td>
                      <td>${this.esc(d.model || "\u2014")}</td>
                      <td style="font-weight:600;color:var(--text)">${this.esc(d.size)}</td>
                      <td>${d.mountpoint ? `<code style="font-size:12px">${this.esc(d.mountpoint)}</code>` : `<span style="color:var(--text-muted)">\u2014</span>`}</td>
                      <td>${this.smartBadge(d.smart)}</td>
                      <td>${d.smart?.temperature != null ? `<span style="color:${d.smart.temperature > 50 ? "var(--danger)" : "var(--text-secondary)"}">${d.smart.temperature}\u00b0C</span>` : `<span style="color:var(--text-muted)">\u2014</span>`}</td>
                      <td>${d.smart?.powerOnHours != null ? `${d.smart.powerOnHours.toLocaleString()}h` : `<span style="color:var(--text-muted)">\u2014</span>`}</td>
                      <td>
                        <div class="action-group">
                          ${!raidMemberDisks.has(d.name) ? `
                            <button class="btn-secondary btn-icon clone-to-raid" title="Clone to RAID 1" data-disk="${this.esc(d.name)}">
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="13" y="2" width="8" height="8" rx="2"/><rect x="3" y="14" width="8" height="8" rx="2"/><path d="M13 2v10h8"/><path d="M3 14v6a2 2 0 0 0 2 2h6"/><path d="M21 10v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-6"/></svg>
                            </button>
                          ` : ''}
                          <button class="btn-secondary btn-icon test-speed" title="Test Speed" data-disk="${this.esc(d.name)}">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12H4"/><path d="M18 6l6 6-6 6"/></svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  `).join("")}
                </tbody>
              </table>`
          }
        </div>
      `);

      this.$("#refresh").addEventListener("click", () => this.render());
      this.$$(".clone-to-raid").forEach(btn => {
        btn.addEventListener("click", () => this.cloneToRaid(btn.dataset.disk));
      });
      this.$$(".test-speed").forEach(btn => {
        btn.addEventListener("click", () => this.testSpeed(btn.dataset.disk));
      });
    } catch (err) {
      this.setContent(`<div class="error-msg">Failed to load disks: ${this.esc(err.message)}</div>`);
    }
  }

  async cloneToRaid(disk) {
    if (!confirm(`Create a RAID 1 array from ${disk}? The disk will be converted in place and data will be preserved, but this is a potentially destructive action. It is recommended to have backups.`)) return;

    try {
      await window.api.post("/api/disks/raid/clone", { disk });
      alert("RAID 1 array created successfully. You can now add a second disk to the array in the RAID Management page to start the mirroring process.");
      this.render();
    } catch (err) {
      alert(`Failed to create RAID array: ${err.message}`);
    }
  }

  async testSpeed(disk) {
    const btn = this.shadowRoot.querySelector(`[data-disk="${disk}"].test-speed`);
    const originalContent = btn.innerHTML; // Store original content
    btn.disabled = true;
    btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="spin-animation"><path d="M12 2v4"/><path d="M12 18v4"/><path d="M4.93 4.93l2.83 2.83"/><path d="M16.24 16.24l2.83 2.83"/><path d="M2 12h4"/><path d="M18 12h4"/><path d="M4.93 19.07l2.83-2.83"/><path d="M16.24 7.76l2.83-2.83"/></svg>`; // Spinner icon
    try {
      const result = await window.api.get(`/api/disks/${disk}/speed`);
      let message = `Disk speed for ${disk}: ${result.speed.toFixed(2)} MB/sec`;
      if (result.isAnomaly) {
        message += "\n\nWarning: Anomaly detected! Disk speed is significantly lower than average.";
      }
      alert(message);
    } catch (err) {
      alert(`Failed to test disk speed: ${err.message}`);
    } finally {
      btn.disabled = false;
      btn.innerHTML = originalContent; // Restore original content
    }
  }

  smartBadge(smart) {
    if (!smart) return `<span class="badge badge-muted">Unknown</span>`;
    if (smart.healthy) return `<span class="badge badge-success">\u2713 Healthy</span>`;
    return `<span class="badge badge-danger">\u2717 Failing</span>`;
  }

  esc(str) {
    const el = document.createElement("span");
    el.textContent = String(str);
    return el.innerHTML;
  }
}

customElements.define("disk-list", DiskList);
