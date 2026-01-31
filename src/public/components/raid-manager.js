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
                      <td>
                        <div class="raid-members">
                        ${r.devices.map((d) => `
                          <div class="raid-member">
                            <code style="font-size:12px">${this.esc(d.name)}</code>
                            <span class="badge badge-small ${/active|sync/.test(d.state) ? 'badge-success' : 'badge-danger'}">${this.esc(d.state)}</span>
                            <button class="btn-icon btn-warning fail-disk" title="Mark as faulty" data-device="${this.esc(r.device)}" data-disk="${this.esc(d.name)}">
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18.36 6.64a9 9 0 1 1-12.73 0M12 2v10"/></svg>
                            </button>
                            <button class="btn-icon btn-danger remove-disk" title="Remove from array" data-device="${this.esc(r.device)}" data-disk="${this.esc(d.name)}">
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                            </button>
                          </div>
                        `).join("") || "\u2014"}
                        </div>
                      </td>
                      <td>
                        <button class="btn-success add-spare" data-device="${this.esc(r.device)}">
                           <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
                          Add Spare
                        </button>
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
      this.$$(".add-spare").forEach((btn) => {
        btn.addEventListener("click", () => this.addSpare(btn.dataset.device));
      });
      this.$$(".fail-disk").forEach((btn) => {
        btn.addEventListener("click", () => this.failDisk(btn.dataset.device, btn.dataset.disk));
      });
      this.$$(".remove-disk").forEach((btn) => {
        btn.addEventListener("click", () => this.removeDisk(btn.dataset.device, btn.dataset.disk));
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

  async addSpare(device) {
    const availableDisks = this.disks.map(d => d.name);
    const disk = prompt(`Enter disk to add as spare for ${device}\nAvailable: ${availableDisks.join(", ")}`);
    if (!disk) return;

    try {
      await window.api.post(`/api/disks/raid/${encodeURIComponent(device.replace("/dev/", ""))}/add`, { disk });
      this.render();
    } catch (err) {
      alert(`Failed to add spare: ${err.message}`);
    }
  }

  async failDisk(device, disk) {
    if (!confirm(`Mark disk ${disk} as faulty in ${device}?`)) return;

    try {
      await window.api.post(`/api/disks/raid/${encodeURIComponent(device.replace("/dev/", ""))}/fail`, { disk });
      this.render();
    } catch (err) {
      alert(`Failed to fail disk: ${err.message}`);
    }
  }

  async removeDisk(device, disk) {
    if (!confirm(`Remove disk ${disk} from ${device}?`)) return;

    try {
      await window.api.post(`/api/disks/raid/${encodeURIComponent(device.replace("/dev/", ""))}/remove`, { disk });
      this.render();
    } catch (err) {
      alert(`Failed to remove disk: ${err.message}`);
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
