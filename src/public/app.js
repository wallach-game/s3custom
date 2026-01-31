import { ExamineDisk } from "./components/examine-disk.js";
import { RecoverDisk } from "./components/recover-disk.js";
import { CloneDisk } from "./components/clone-disk.js";

// API client with logging
class Api {
  logRequest(method, url) {
    if (window.activityLogger) {
      window.activityLogger.info(`${method} ${url}`);
    }
  }

  async get(url) {
    this.logRequest("GET", url);
    const res = await fetch(url);
    if (!res.ok) throw new Error((await res.json()).error || res.statusText);
    return res.json();
  }

  async post(url, body) {
    this.logRequest("POST", url);
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error((await res.json()).error || res.statusText);
    return res.json();
  }

  async postForm(url, formData) {
    this.logRequest("POST", url);
    const res = await fetch(url, { method: "POST", body: formData });
    if (!res.ok) throw new Error((await res.json()).error || res.statusText);
    return res.json();
  }

  async put(url, body) {
    this.logRequest("PUT", url);
    const res = await fetch(url, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error((await res.json()).error || res.statusText);
    return res.json();
  }

  async delete(url) {
    this.logRequest("DELETE", url);
    const res = await fetch(url, { method: "DELETE" });
    if (!res.ok) throw new Error((await res.json()).error || res.statusText);
    return res.json();
  }
}

window.api = new Api();

// Router
const routes = {
  disks: "disk-list",
  examine: "examine-disk",
  recover: "recover-disk",
  clone: "clone-disk",
  raid: "raid-manager",
  power: "power-control",
  files: "file-manager",
  analytics: "disk-analytics",
  rotation: "disk-rotation",
};

function navigate() {
  const hash = location.hash.slice(2) || "disks";
  const tag = routes[hash];
  const app = document.getElementById("app");

  if (!tag) {
    app.innerHTML = `<div class="error-msg">Page not found</div>`;
    return;
  }

  app.innerHTML = `<${tag}></${tag}>`;

  document.querySelectorAll(".nav-link").forEach((link) => {
    link.classList.toggle("active", link.dataset.route === hash);
  });

  if (window.activityLogger) {
    window.activityLogger.info(`Navigated to ${hash}`);
  }

  // Setup modal handlers for disk-list
  if (tag === "disk-list") {
    setTimeout(() => setupDiskListModals(), 100);
  }
}

function setupDiskListModals() {
  const diskList = document.querySelector("disk-list");
  if (!diskList) return;

  // Listen for open-examine event
  diskList.addEventListener("open-examine", (e) => {
    const disk = e.detail.disk;
    openExamineModal(disk);
  });

  // Listen for open-recover event
  diskList.addEventListener("open-recover", (e) => {
    const disk = e.detail.disk;
    openRecoverModal(disk);
  });

  // Listen for open-clone event
  diskList.addEventListener("open-clone", (e) => {
    const disk = e.detail.disk;
    openCloneModal(disk);
  });
}

function openExamineModal(disk) {
  const modal = document.createElement("modal-dialog");
  document.body.appendChild(modal);

  modal.open("Examine Disk", `
    <examine-disk data-disk="${disk}"></examine-disk>
  `);

  modal.addEventListener("modal-closed", () => {
    modal.remove();
  });

  // Auto-trigger examine for the selected disk
  setTimeout(() => {
    const examineComponent = modal.shadowRoot.querySelector("examine-disk");
    if (examineComponent && examineComponent.shadowRoot) {
      const input = examineComponent.shadowRoot.getElementById("disk-input");
      if (input) {
        input.value = disk;
        const form = examineComponent.shadowRoot.getElementById("examine-form");
        if (form) form.dispatchEvent(new Event("submit"));
      }
    }
  }, 100);
}

function openRecoverModal(disk) {
  const modal = document.createElement("modal-dialog");
  document.body.appendChild(modal);

  modal.open("Recover Disk", `
    <recover-disk data-disk="${disk}"></recover-disk>
  `);

  modal.addEventListener("modal-closed", () => {
    modal.remove();
  });

  // Pre-fill disk field
  setTimeout(() => {
    const recoverComponent = modal.shadowRoot.querySelector("recover-disk");
    if (recoverComponent && recoverComponent.shadowRoot) {
      const input = recoverComponent.shadowRoot.getElementById("disk-input");
      if (input) {
        input.value = disk;
      }
    }
  }, 100);
}

function openCloneModal(disk) {
  const modal = document.createElement("modal-dialog");
  document.body.appendChild(modal);

  modal.open("Clone Disk", `
    <clone-disk data-disk="${disk}"></clone-disk>
  `);

  modal.addEventListener("modal-closed", () => {
    modal.remove();
  });

  // Pre-fill source disk field
  setTimeout(() => {
    const cloneComponent = modal.shadowRoot.querySelector("clone-disk");
    if (cloneComponent && cloneComponent.shadowRoot) {
      const input = cloneComponent.shadowRoot.getElementById("source-disk-input");
      if (input) {
        input.value = disk;
      }
    }
  }, 100);
}

// Agent status check
async function checkAgentStatus() {
  const el = document.getElementById("agent-status");
  if (!el) return;

  const dot = el.querySelector(".status-dot");
  const label = el.querySelector(".status-label");

  try {
    await window.api.get("/api/disks");
    dot.className = "status-dot online";
    label.textContent = "Agent connected";
  } catch {
    dot.className = "status-dot offline";
    label.textContent = "Agent offline";
  }
}

window.addEventListener("hashchange", navigate);
window.addEventListener("DOMContentLoaded", () => {
  if (!location.hash) location.hash = "#/disks";
  navigate();
  checkAgentStatus();
  setInterval(checkAgentStatus, 30000);

  // Log initialization
  setTimeout(() => {
    if (window.activityLogger) {
      window.activityLogger.success("S3 Custom interface initialized");
    }
  }, 500);
});
