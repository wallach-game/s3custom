import { BaseComponent } from "../shared/base-component.js";

class DiskList extends BaseComponent {
  async render() {
    this.setContent(`<div class="card"><p class="loading">Loading disks...</p></div>`);

    try {
      const disks = await window.api.get("/api/disks");

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
                    </tr>
                  `).join("")}
                </tbody>
              </table>`
          }
        </div>
      `);

      this.$("#refresh").addEventListener("click", () => this.render());
    } catch (err) {
      this.setContent(`<div class="error-msg">Failed to load disks: ${this.esc(err.message)}</div>`);
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
