import { BaseComponent } from "../shared/base-component.js";

class RaidManager extends BaseComponent {
  constructor() {
    super();
    this.disks = [];
  }

  async render() {
    this.setContent(`<div class="card"><p class="loading">Loading RAID status...</p></div>`);

    try {
      const [raids, disks] = await Promise.all([
        window.api.get("/api/disks/raid"),
        window.api.get("/api/disks"),
      ]);
      this.disks = disks;

      this.setContent(`
        <div class="section-header">
          <h1>RAID Management</h1>
        </div>

        <div class="stats-row">
          <div class="stat-card">
            <div class="stat-label">Arrays</div>
            <div class="stat-value accent">${raids.length}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Available Disks</div>
            <div class="stat-value">${this.disks.length}</div>
          </div>
        </div>

        <div class="card">
          <h2>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="6" height="18" rx="1"/><rect x="9" y="3" width="6" height="18" rx="1"/><rect x="16" y="3" width="6" height="18" rx="1"/></svg>
            Active Arrays
          </h2>
          ${raids.length === 0
            ? `<div class="empty-state">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="3" width="6" height="18" rx="1"/><rect x="9" y="3" width="6" height="18" rx="1"/><rect x="16" y="3" width="6" height="18" rx="1"/></svg>
                <p>No RAID arrays configured</p>
              </div>`
            : `<table>
                <thead>
                  <tr>
                    <th>Device</th>
                    <th>Level</th>
                    <th>State</th>
                    <th>Members</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  ${raids.map((r) => `
                    <tr>
                      <td><code style="color:var(--text)">${this.esc(r.device)}</code></td>
                      <td><span class="badge badge-muted">RAID ${this.esc(r.level)}</span></td>
                      <td>${this.stateBadge(r.state)}</td>
                      <td>${r.devices.map((d) => `<code style="font-size:12px">${this.esc(d)}</code>`).join(" ") || "\u2014"}</td>
                      <td>
                        <button class="btn-danger remove-raid" data-device="${this.esc(r.device)}">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                          Remove
                        </button>
                      </td>
                    </tr>
                  `).join("")}
                </tbody>
              </table>`
          }
        </div>

        <div class="card">
          <h2>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
            Create Array
          </h2>
          <div class="form-row">
            <label>RAID Level</label>
            <select id="raid-level">
              <option value="0">RAID 0 \u2014 Stripe</option>
              <option value="1">RAID 1 \u2014 Mirror</option>
              <option value="5">RAID 5 \u2014 Distributed Parity</option>
              <option value="6">RAID 6 \u2014 Double Parity</option>
              <option value="10">RAID 10 \u2014 Stripe + Mirror</option>
            </select>
          </div>
          <div class="form-row">
            <label>Devices</label>
            <div class="checkbox-group" id="device-checks">
              ${this.disks.map((d) => `
                <label class="checkbox-label">
                  <input type="checkbox" class="dev-check" value="${this.esc(d.name)}" />
                  <span>${this.esc(d.name)} (${this.esc(d.size)})</span>
                </label>
              `).join("")}
            </div>
          </div>
          <div style="margin-top:8px">
            <button class="btn-primary" id="create-raid">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
              Create Array
            </button>
          </div>
          <div id="create-result"></div>
        </div>
      `);

      this.$$(".remove-raid").forEach((btn) => {
        btn.addEventListener("click", () => this.removeRaid(btn.dataset.device));
      });

      this.$("#create-raid").addEventListener("click", () => this.createRaid());
    } catch (err) {
      this.setContent(`<div class="error-msg">Failed to load RAID info: ${this.esc(err.message)}</div>`);
    }
  }

  async createRaid() {
    const level = this.$("#raid-level").value;
    const devices = [...this.$$(".dev-check:checked")].map((c) => c.value);
    const resultEl = this.$("#create-result");

    if (devices.length < 2) {
      resultEl.innerHTML = `<div class="error-msg">Select at least 2 devices</div>`;
      return;
    }

    try {
      resultEl.innerHTML = `<p class="loading">Creating RAID array...</p>`;
      await window.api.post("/api/disks/raid", { level, devices });
      resultEl.innerHTML = `<div class="success-msg">RAID array created successfully</div>`;
      setTimeout(() => this.render(), 1500);
    } catch (err) {
      resultEl.innerHTML = `<div class="error-msg">${this.esc(err.message)}</div>`;
    }
  }

  async removeRaid(device) {
    if (!confirm(`Remove RAID array ${device}? This will stop the array.`)) return;

    try {
      await window.api.delete(`/api/disks/raid/${encodeURIComponent(device.replace("/dev/", ""))}`);
      this.render();
    } catch (err) {
      alert(`Failed to remove: ${err.message}`);
    }
  }

  stateBadge(state) {
    if (/clean|active/i.test(state)) return `<span class="badge badge-success">${this.esc(state)}</span>`;
    if (/degrad/i.test(state)) return `<span class="badge badge-warning">${this.esc(state)}</span>`;
    return `<span class="badge badge-danger">${this.esc(state)}</span>`;
  }

  esc(str) {
    const el = document.createElement("span");
    el.textContent = String(str);
    return el.innerHTML;
  }
}

customElements.define("raid-manager", RaidManager);
