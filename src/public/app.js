// API client
class Api {
  async get(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error((await res.json()).error || res.statusText);
    return res.json();
  }

  async post(url, body) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error((await res.json()).error || res.statusText);
    return res.json();
  }

  async postForm(url, formData) {
    const res = await fetch(url, { method: "POST", body: formData });
    if (!res.ok) throw new Error((await res.json()).error || res.statusText);
    return res.json();
  }

  async put(url, body) {
    const res = await fetch(url, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error((await res.json()).error || res.statusText);
    return res.json();
  }

  async delete(url) {
    const res = await fetch(url, { method: "DELETE" });
    if (!res.ok) throw new Error((await res.json()).error || res.statusText);
    return res.json();
  }
}

window.api = new Api();

// Router
const routes = {
  disks: "disk-list",
  raid: "raid-manager",
  power: "power-control",
  files: "file-manager",
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
});
