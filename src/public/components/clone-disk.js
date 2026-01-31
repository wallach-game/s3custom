import { BaseComponent } from "../shared/base-component.js";

export class CloneDisk extends BaseComponent {
  constructor() {
    super();
    this.name = "Clone Disk";
    this.state = {
      sourceDisk: "",
      destinationPath: "",
      logfilePath: "",
      loading: false,
      error: null,
      success: null,
    };
  }

  connectedCallback() {
    super.connectedCallback();
    this.render();
    this.shadowRoot.getElementById("clone-form").addEventListener("submit", this.handleSubmit.bind(this));
  }

  disconnectedCallback() {
    this.shadowRoot.getElementById("clone-form").removeEventListener("submit", this.handleSubmit.bind(this));
  }

  async handleSubmit(event) {
    event.preventDefault();
    this.state.sourceDisk = this.shadowRoot.getElementById("source-disk-input").value;
    this.state.destinationPath = this.shadowRoot.getElementById("destination-path-input").value;
    this.state.logfilePath = this.shadowRoot.getElementById("logfile-path-input").value;

    if (!this.state.sourceDisk || !this.state.destinationPath) {
      this.state.error = "Please enter both source disk and destination path.";
      this.state.success = null;
      this.render();
      return;
    }

    this.state.loading = true;
    this.state.error = null;
    this.state.success = null;
    this.render(); // Re-render to show loading state

    try {
      const result = await window.api.post('/api/disks/clone', {
        sourceDisk: this.state.sourceDisk,
        destinationPath: this.state.destinationPath,
        logfilePath: this.state.logfilePath || undefined, // Send as undefined if empty
      });
      this.state.success = result.message || "Disk cloning started successfully.";
      this.state.error = null;
      // Optionally clear input fields after successful submission
      this.state.sourceDisk = "";
      this.state.destinationPath = "";
      this.state.logfilePath = "";
    } catch (err) {
      console.error("Clone Disk Error:", err);
      this.state.error = err.message;
      this.state.success = null;
    } finally {
      this.state.loading = false;
      this.render(); // Re-render to show results or error
    }
  }

  render() {
    const { sourceDisk, destinationPath, logfilePath, loading, error, success } = this.state;
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
        <p class="text-muted">Clone a source disk sector-by-sector to a destination path (e.g., an image file or another device).</p>
        <form id="clone-form">
          <div class="form-row">
            <label for="source-disk-input">Source Disk:</label>
            <input type="text" id="source-disk-input" value="${sourceDisk}" placeholder="e.g., sda, /dev/sdb" required>
          </div>
          <div class="form-row">
            <label for="destination-path-input">Destination Path:</label>
            <input type="text" id="destination-path-input" value="${destinationPath}" placeholder="e.g., /mnt/backups/disk.img, /dev/sdc" required>
          </div>
          <div class="form-row">
            <label for="logfile-path-input">Log File (Optional):</label>
            <input type="text" id="logfile-path-input" value="${logfilePath}" placeholder="e.g., /var/log/clone.log">
          </div>
          <button type="submit" class="btn-primary" ${loading ? 'disabled' : ''}>
            ${loading ? '<div class="spin-animation status-dot"></div>' : ''} Clone Disk
          </button>
        </form>

        ${error ? `<div class="error-msg">${error}</div>` : ''}
        ${success ? `<div class="success-msg">${success}</div>` : ''}
        ${loading && !success && !error ? `<div class="loading">Cloning disk... (This may take a long time)</div>` : ''}
      </div>
    `);
  }
}

customElements.define("clone-disk", CloneDisk);
