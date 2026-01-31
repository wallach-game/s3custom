import { BaseComponent } from "../shared/base-component.js";

export class ExamineDisk extends BaseComponent {
  constructor() {
    super();
    this.name = "Examine Disk";
    this.state = {
      disk: "",
      result: null,
      loading: false,
      error: null,
    };
  }

  connectedCallback() {
    super.connectedCallback();
    this.render();
    this.shadowRoot.getElementById("examine-form").addEventListener("submit", this.handleSubmit.bind(this));
  }

  disconnectedCallback() {
    this.shadowRoot.getElementById("examine-form").removeEventListener("submit", this.handleSubmit.bind(this));
  }

  async handleSubmit(event) {
    event.preventDefault();
    this.state.disk = this.shadowRoot.getElementById("disk-input").value;
    if (!this.state.disk) {
      this.state.error = "Please enter a disk identifier (e.g., sda).";
      this.state.result = null;
      this.render();
      return;
    }

    this.state.loading = true;
    this.state.error = null;
    this.state.result = null;
    this.render(); // Re-render to show loading state

    try {
      const result = await window.api.get(`/api/disks/examine/${this.state.disk}`);
      this.state.result = result;
      this.state.error = null;
    } catch (err) {
      console.error("Examine Disk Error:", err);
      this.state.error = err.message;
      this.state.result = null;
    } finally {
      this.state.loading = false;
      this.render(); // Re-render to show results or error
    }
  }

  render() {
    const { disk, result, loading, error } = this.state;
    this.setContent(`
      <style>
        .card { margin-bottom: 24px; }
        .result-section h3 { margin-top: 20px; margin-bottom: 10px; color: var(--accent); }
        .result-item { margin-bottom: 10px; }
        .result-label { font-weight: 600; color: var(--text-secondary); }
        .result-value { color: var(--text); }
        pre {
          background: var(--bg-elevated);
          padding: 15px;
          border-radius: var(--radius-sm);
          overflow-x: auto;
          font-size: 0.9em;
          color: var(--text-muted);
        }
        .section-header { margin-bottom: 0; }
      </style>
      <div class="card">
        <div class="section-header">
          <h1>${this.name}</h1>
        </div>
        <form id="examine-form">
          <div class="form-row">
            <label for="disk-input">Disk Identifier:</label>
            <input type="text" id="disk-input" value="${disk}" placeholder="e.g., sda, nvme0n1" required>
          </div>
          <button type="submit" class="btn-primary" ${loading ? 'disabled' : ''}>
            ${loading ? '<div class="spin-animation status-dot"></div>' : ''} Examine
          </button>
        </form>

        ${error ? `<div class="error-msg">${error}</div>` : ''}
        ${loading && !result && !error ? `<div class="loading">Examining disk...</div>` : ''}

        ${result ? `
          <div class="result-section">
            <h3>Examination Result for /dev/${result.disk}</h3>
            ${result.exists ? `
              <div class="result-item"><span class="result-label">Disk Exists:</span> <span class="result-value">Yes</span></div>
            ` : `
              <div class="result-item"><span class="result-label">Disk Exists:</span> <span class="result-value">No</span></div>
            `}

            ${result.filesystemInfo && result.filesystemInfo.type ? `
              <h3>Main Filesystem Info</h3>
              <div class="result-item"><span class="result-label">Type:</span> <span class="result-value">${result.filesystemInfo.type}</span></div>
              ${result.filesystemInfo.label ? `<div class="result-item"><span class="result-label">Label:</span> <span class="result-value">${result.filesystemInfo.label}</span></div>` : ''}
              ${result.filesystemInfo.uuid ? `<div class="result-item"><span class="result-label">UUID:</span> <span class="result-value">${result.filesystemInfo.uuid}</span></div>` : ''}
            ` : ''}

            ${result.raidInfo && result.raidInfo.isRaid ? `
              <h3>RAID Info</h3>
              <div class="result-item"><span class="result-label">Is RAID:</span> <span class="result-value">Yes</span></div>
              <div class="result-item"><span class="result-label">RAID Metadata:</span> <pre>${result.raidInfo.metadata}</pre></div>
            ` : `
              <h3>RAID Info</h3>
              <div class="result-item"><span class="result-label">Is RAID:</span> <span class="result-value">No</span></div>
              ${result.raidInfo.metadata ? `<div class="result-item"><span class="result-label">Details:</span> <pre>${result.raidInfo.metadata}</pre></div>` : ''}
            `}

            ${result.partitions && result.partitions.length > 0 ? `
              <h3>Partitions</h3>
              ${result.partitions.map(p => `
                <div class="card" style="margin-bottom: 10px; padding: 15px; background: var(--bg-elevated);">
                  <div class="result-item"><span class="result-label">Name:</span> <span class="result-value">${p.name}</span></div>
                  <div class="result-item"><span class="result-label">Size:</span> <span class="result-value">${p.size}</span></div>
                  <div class="result-item"><span class="result-label">Filesystem:</span> <span class="result-value">${p.fstype || 'N/A'}</span></div>
                  <div class="result-item"><span class="result-label">Mountpoint:</span> <span class="result-value">${p.mountpoint || 'N/A'}</span></div>
                </div>
              `).join('')}
            ` : '<h3>No Partitions Found</h3>'}

            <h3>Raw Outputs</h3>
            <div class="result-item"><span class="result-label">lsblk:</span> <pre>${result.rawLsblk}</pre></div>
            <div class="result-item"><span class="result-label">mdadm --examine:</span> <pre>${result.rawMdadmExamine}</pre></div>
            <div class="result-item"><span class="result-label">blkid:</span> <pre>${result.rawBlkid}</pre></div>
          </div>
        ` : ''}
      </div>
    `);
  }
}

customElements.define("examine-disk", ExamineDisk);
