import { BaseComponent } from "../shared/base-component.js";

class FileManager extends BaseComponent {
  constructor() {
    super();
    this.currentPath = "/";
  }

  async render() {
    this.setContent(`<div class="card"><p class="loading">Loading files...</p></div>`);

    try {
      const files = await window.api.get(`/api/files?path=${encodeURIComponent(this.currentPath)}`);

      const dirs = files.filter((f) => f.isDirectory).length;
      const fileCount = files.length - dirs;

      this.setContent(`
        <div class="section-header">
          <h1>File Manager</h1>
        </div>

        <div class="card">
          <div class="breadcrumb" id="breadcrumb">${this.buildBreadcrumbs()}</div>
          <div class="toolbar">
            <button class="btn-primary" id="upload-btn">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
              Upload
            </button>
            <button class="btn-secondary" id="mkdir-btn">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/><line x1="12" y1="11" x2="12" y2="17"/><line x1="9" y1="14" x2="15" y2="14"/></svg>
              New Folder
            </button>
            <button class="btn-secondary" id="refresh-btn">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
              Refresh
            </button>
            <span style="margin-left:auto;font-size:12px;color:var(--text-muted)">${dirs} folder${dirs !== 1 ? "s" : ""}, ${fileCount} file${fileCount !== 1 ? "s" : ""}</span>
            <input type="file" id="file-input" style="display:none" />
          </div>
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Size</th>
                <th>Modified</th>
                <th style="width:80px">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${this.currentPath !== "/" ? `
                <tr>
                  <td colspan="4">
                    <a href="#" class="nav-up" style="color:var(--accent);text-decoration:none;display:inline-flex;align-items:center;gap:6px">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
                      ..
                    </a>
                  </td>
                </tr>
              ` : ""}
              ${files.map((f) => `
                <tr>
                  <td>
                    <div class="file-entry">
                      ${f.isDirectory
                        ? `<svg class="file-icon folder" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M10 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-8l-2-2z"/></svg>`
                        : `<svg class="file-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>`
                      }
                      ${f.isDirectory
                        ? `<a href="#" class="dir-link" data-path="${this.esc(f.path)}" style="color:var(--accent);text-decoration:none;font-weight:500">${this.esc(f.name)}</a>`
                        : `<span style="color:var(--text)">${this.esc(f.name)}</span>`
                      }
                    </div>
                  </td>
                  <td>${f.isDirectory ? "\u2014" : this.formatSize(f.size)}</td>
                  <td style="font-size:12px">${new Date(f.modified).toLocaleString()}</td>
                  <td>
                    <button class="btn-danger delete-btn" data-path="${this.esc(f.path)}" data-name="${this.esc(f.name)}" style="padding:4px 10px;font-size:12px">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                    </button>
                  </td>
                </tr>
              `).join("")}
              ${files.length === 0 ? `
                <tr><td colspan="4">
                  <div class="empty-state">
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
                    <p>Empty directory</p>
                  </div>
                </td></tr>
              ` : ""}
            </tbody>
          </table>
        </div>
      `);

      this.bindEvents();
    } catch (err) {
      this.setContent(`<div class="error-msg">Failed to load files: ${this.esc(err.message)}</div>`);
    }
  }

  bindEvents() {
    this.$$(".dir-link").forEach((link) => {
      link.addEventListener("click", (e) => {
        e.preventDefault();
        this.currentPath = link.dataset.path;
        this.render();
      });
    });

    this.$(".nav-up")?.addEventListener("click", (e) => {
      e.preventDefault();
      const parts = this.currentPath.split("/").filter(Boolean);
      parts.pop();
      this.currentPath = "/" + parts.join("/");
      this.render();
    });

    this.$$("#breadcrumb a").forEach((link) => {
      link.addEventListener("click", (e) => {
        e.preventDefault();
        this.currentPath = link.dataset.path;
        this.render();
      });
    });

    this.$("#upload-btn").addEventListener("click", () => {
      this.$("#file-input").click();
    });

    this.$("#file-input").addEventListener("change", async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const formData = new FormData();
      formData.append("file", file);
      formData.append("path", this.currentPath);

      try {
        await window.api.postForm("/api/files", formData);
        this.render();
      } catch (err) {
        alert(`Upload failed: ${err.message}`);
      }
    });

    this.$("#mkdir-btn").addEventListener("click", async () => {
      const name = prompt("Folder name:");
      if (!name) return;

      const dirPath = this.currentPath === "/" ? `/${name}` : `${this.currentPath}/${name}`;
      try {
        await window.api.post("/api/files/mkdir", { path: dirPath });
        this.render();
      } catch (err) {
        alert(`Create folder failed: ${err.message}`);
      }
    });

    this.$$(".delete-btn").forEach((btn) => {
      btn.addEventListener("click", async () => {
        if (!confirm(`Delete ${btn.dataset.name}?`)) return;
        try {
          await window.api.delete(`/api/files?path=${encodeURIComponent(btn.dataset.path)}`);
          this.render();
        } catch (err) {
          alert(`Delete failed: ${err.message}`);
        }
      });
    });

    this.$("#refresh-btn").addEventListener("click", () => this.render());
  }

  buildBreadcrumbs() {
    const parts = this.currentPath.split("/").filter(Boolean);
    let html = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="opacity:0.5;flex-shrink:0"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>`;
    html += `<a href="#" data-path="/">root</a>`;
    let acc = "";
    for (const part of parts) {
      acc += "/" + part;
      html += `<span class="sep">/</span><a href="#" data-path="${this.esc(acc)}">${this.esc(part)}</a>`;
    }
    return html;
  }

  formatSize(bytes) {
    if (bytes === 0) return "0 B";
    const units = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return (bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0) + " " + units[i];
  }

  esc(str) {
    const el = document.createElement("span");
    el.textContent = String(str);
    return el.innerHTML;
  }
}

customElements.define("file-manager", FileManager);
