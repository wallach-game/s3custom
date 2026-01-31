import { BaseComponent } from "../shared/base-component.js";

export class RecoverDisk extends BaseComponent {
  constructor() {
    super();
    this.name = "Recover Disk";
    this.state = {
      disk: "",
      mountPath: "",
      loading: false,
      error: null,
      success: null,
    };
  }

  connectedCallback() {
    super.connectedCallback();
    this.render();
    this.shadowRoot.getElementById("recover-form").addEventListener("submit", this.handleSubmit.bind(this));
  }

  disconnectedCallback() {
    this.shadowRoot.getElementById("recover-form").removeEventListener("submit", this.handleSubmit.bind(this));
  }

  async handleSubmit(event) {
    event.preventDefault();
    this.state.disk = this.shadowRoot.getElementById("disk-input").value;
    this.state.mountPath = this.shadowRoot.getElementById("mount-path-input").value;

    if (!this.state.disk || !this.state.mountPath) {
      this.state.error = "Please enter both disk identifier and mount path.";
      this.state.success = null;
      this.render();
      return;
    }

    this.state.loading = true;
    this.state.error = null;
    this.state.success = null;
    this.render(); // Re-render to show loading state

    try {
      const result = await window.api.post('/api/disks/recover', {
        disk: this.state.disk,
        mountPath: this.state.mountPath,
      });
      this.state.success = result.message || "Disk mounted successfully in read-only mode.";
      this.state.error = null;
    } catch (err) {
      console.error("Recover Disk Error:", err);
      this.state.error = err.message;
      this.state.success = null;
    } finally {
      this.state.loading = false;
      this.render(); // Re-render to show results or error
    }
  }

  render() {
    const { disk, mountPath, loading, error, success } = this.state;
    this.setContent(`
      <style>
        .card { margin-bottom: 24px; }
        .section-header { margin-bottom: 0; }
        input { min-width: 250px; } /* Ensure input fields are wide enough */
      </style>
      <div class="card">
        <div class="section-header">
          <h1>${this.name}</h1>
        </div>
        <p class="text-muted">Mount a disk in read-only recovery mode. The agent will attempt to detect the filesystem and apply appropriate recovery flags.</p>
        <form id="recover-form">
          <div class="form-row">
            <label for="disk-input">Disk Identifier:</label>
            <input type="text" id="disk-input" value="${disk}" placeholder="e.g., sda1, /dev/sdb" required>
          </div>
          <div class="form-row">
            <label for="mount-path-input">Mount Path:</label>
            <input type="text" id="mount-path-input" value="${mountPath}" placeholder="e.g., /mnt/recovery/mydisk" required>
          </div>
          <button type="submit" class="btn-primary" ${loading ? 'disabled' : ''}>
            ${loading ? '<div class="spin-animation status-dot"></div>' : ''} Mount Read-Only
          </button>
        </form>

        ${error ? `<div class="error-msg">${error}</div>` : ''}
        ${success ? `<div class="success-msg">${success}</div>` : ''}
        ${loading && !success && !error ? `<div class="loading">Mounting disk...</div>` : ''}
      </div>
    `);
  }
}

customElements.define("recover-disk", RecoverDisk);
