import { BaseComponent } from "../shared/base-component.js";

class PowerControl extends BaseComponent {
  async render() {
    this.setContent(`<div class="card"><p class="loading">Loading disks...</p></div>`);

    try {
      const disks = await window.api.get("/api/disks");

      this.setContent(`
        <div class="section-header">
          <h1>Power Management</h1>
          <button class="btn-secondary" id="refresh">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
            Refresh
          </button>
        </div>

        <div class="card">
          <h2>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18.36 6.64a9 9 0 1 1-12.73 0"/><line x1="12" y1="2" x2="12" y2="12"/></svg>
            Disk Power Controls
          </h2>
          ${disks.length === 0
            ? `<div class="empty-state">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M18.36 6.64a9 9 0 1 1-12.73 0"/><line x1="12" y1="2" x2="12" y2="12"/></svg>
                <p>No disks found</p>
              </div>`
            : `<table>
                <thead>
                  <tr>
                    <th>Device</th>
                    <th>Model</th>
                    <th>Size</th>
                    <th>Power State</th>
                    <th>Actions</th>
                    <th>Idle Timeout</th>
                  </tr>
                </thead>
                <tbody>
                  ${disks.map((d) => `
                    <tr data-disk="${this.esc(d.name)}">
                      <td><code style="color:var(--text)">/dev/${this.esc(d.name)}</code></td>
                      <td>${this.esc(d.model || "\u2014")}</td>
                      <td style="font-weight:600;color:var(--text)">${this.esc(d.size)}</td>
                      <td class="power-status"><span class="loading" style="padding:0">Checking</span></td>
                      <td>
                        <div class="action-group">
                          <button class="btn-secondary spin-down" data-disk="${this.esc(d.name)}">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
                            Sleep
                          </button>
                          <button class="btn-secondary spin-up" data-disk="${this.esc(d.name)}">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
                            Wake
                          </button>
                        </div>
                      </td>
                      <td>
                        <div class="action-group">
                          <select class="timeout-select" data-disk="${this.esc(d.name)}">
                            <option value="0">Disabled</option>
                            <option value="300">5 min</option>
                            <option value="600">10 min</option>
                            <option value="1200">20 min</option>
                            <option value="1800">30 min</option>
                            <option value="3600">1 hour</option>
                          </select>
                          <button class="btn-primary set-timeout" data-disk="${this.esc(d.name)}" style="padding:6px 12px">Set</button>
                        </div>
                      </td>
                    </tr>
                  `).join("")}
                </tbody>
              </table>`
          }
        </div>
      `);

      for (const d of disks) {
        this.fetchPowerStatus(d.name);
      }

      this.$$(".spin-down").forEach((btn) => {
        btn.addEventListener("click", () => this.powerAction(btn.dataset.disk, "spindown"));
      });

      this.$$(".spin-up").forEach((btn) => {
        btn.addEventListener("click", () => this.powerAction(btn.dataset.disk, "spinup"));
      });

      this.$$(".set-timeout").forEach((btn) => {
        btn.addEventListener("click", () => {
          const select = this.$(`.timeout-select[data-disk="${btn.dataset.disk}"]`);
          this.powerAction(btn.dataset.disk, "timeout", parseInt(select.value, 10));
        });
      });

      this.$("#refresh")?.addEventListener("click", () => this.render());
    } catch (err) {
      this.setContent(`<div class="error-msg">Failed to load disks: ${this.esc(err.message)}</div>`);
    }
  }

  async fetchPowerStatus(disk) {
    try {
      const data = await window.api.get(`/api/disks/power/${encodeURIComponent(disk)}`);
      const row = this.$(`tr[data-disk="${disk}"]`);
      if (row) {
        const cell = row.querySelector(".power-status");
        if (data.status === "active") {
          cell.innerHTML = `<span class="badge badge-success">Active</span>`;
        } else if (data.status === "standby") {
          cell.innerHTML = `<span class="badge badge-warning">Standby</span>`;
        } else {
          cell.innerHTML = `<span class="badge badge-muted">${this.esc(data.status)}</span>`;
        }
      }
    } catch {
      const row = this.$(`tr[data-disk="${disk}"]`);
      if (row) {
        row.querySelector(".power-status").innerHTML = `<span class="badge badge-muted">\u2014</span>`;
      }
    }
  }

  async powerAction(disk, action, value) {
    try {
      const body = { disk, action };
      if (value !== undefined) body.value = value;
      await window.api.post("/api/disks/power", body);
      setTimeout(() => this.fetchPowerStatus(disk), 500);
    } catch (err) {
      alert(`Power action failed: ${err.message}`);
    }
  }

  esc(str) {
    const el = document.createElement("span");
    el.textContent = String(str);
    return el.innerHTML;
  }
}

customElements.define("power-control", PowerControl);
