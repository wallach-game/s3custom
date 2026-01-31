import { BaseComponent } from "../shared/base-component.js";

class ActivityLogger extends BaseComponent {
  constructor() {
    super();
    this.logs = [];
    this.maxLogs = 100; // Keep last 100 logs
    this.expanded = false;
  }

  connectedCallback() {
    super.connectedCallback();
    this.setupGlobalLogger();
    this.render();
  }

  setupGlobalLogger() {
    // Create global logger instance
    if (!window.activityLogger) {
      window.activityLogger = {
        log: (message, level = "info") => this.addLog(message, level),
        info: (message) => this.addLog(message, "info"),
        success: (message) => this.addLog(message, "success"),
        warning: (message) => this.addLog(message, "warning"),
        error: (message) => this.addLog(message, "error"),
      };
    }
  }

  addLog(message, level = "info") {
    const timestamp = new Date();
    const log = {
      id: Date.now() + Math.random(),
      timestamp,
      level,
      message,
    };

    this.logs.unshift(log); // Add to beginning
    if (this.logs.length > this.maxLogs) {
      this.logs.pop(); // Remove oldest
    }

    this.render();
  }

  toggleExpanded() {
    this.expanded = !this.expanded;
    this.render();
  }

  clearLogs() {
    this.logs = [];
    this.render();
  }

  formatTime(date) {
    return date.toLocaleTimeString("en-US", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  }

  getLevelIcon(level) {
    const icons = {
      info: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>',
      success: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
      warning: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
      error: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
    };
    return icons[level] || icons.info;
  }

  render() {
    const visibleLogs = this.expanded ? this.logs : this.logs.slice(0, 5);

    this.setContent(`
      <style>
        :host {
          display: block;
          position: fixed;
          bottom: 0;
          right: 0;
          width: 100%;
          max-width: 500px;
          z-index: 1000;
          margin: 0 16px 16px 0;
        }

        .logger-container {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: var(--radius);
          box-shadow: var(--shadow-lg);
          overflow: hidden;
          animation: slideUp 0.3s ease;
        }

        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .logger-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 16px;
          background: var(--bg-elevated);
          border-bottom: 1px solid var(--border);
          cursor: pointer;
          user-select: none;
        }

        .logger-header:hover {
          background: var(--surface-hover);
        }

        .logger-title {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 13px;
          font-weight: 600;
          color: var(--text);
        }

        .logger-title svg {
          color: var(--accent);
        }

        .logger-badge {
          background: var(--accent-subtle);
          color: var(--accent);
          padding: 2px 8px;
          border-radius: 12px;
          font-size: 11px;
          font-weight: 600;
        }

        .logger-actions {
          display: flex;
          gap: 6px;
          align-items: center;
        }

        .logger-btn {
          background: transparent;
          border: none;
          color: var(--text-muted);
          cursor: pointer;
          padding: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 4px;
          transition: all var(--transition);
        }

        .logger-btn:hover {
          background: var(--accent-subtle);
          color: var(--accent);
        }

        .logger-content {
          max-height: ${this.expanded ? "400px" : "200px"};
          overflow-y: auto;
          transition: max-height 0.3s ease;
        }

        .log-entry {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          padding: 10px 16px;
          border-bottom: 1px solid var(--border);
          font-size: 12px;
          transition: background var(--transition);
        }

        .log-entry:hover {
          background: var(--accent-subtle);
        }

        .log-entry:last-child {
          border-bottom: none;
        }

        .log-time {
          color: var(--text-muted);
          font-family: monospace;
          font-size: 11px;
          flex-shrink: 0;
          width: 60px;
        }

        .log-icon {
          flex-shrink: 0;
          margin-top: 2px;
        }

        .log-icon.info { color: var(--accent); }
        .log-icon.success { color: var(--success); }
        .log-icon.warning { color: var(--warning); }
        .log-icon.error { color: var(--danger); }

        .log-message {
          flex: 1;
          color: var(--text-secondary);
          line-height: 1.4;
          word-break: break-word;
        }

        .empty-state {
          text-align: center;
          padding: 32px 16px;
          color: var(--text-muted);
          font-size: 13px;
        }

        .empty-state svg {
          opacity: 0.3;
          margin-bottom: 8px;
        }

        .expand-icon {
          transition: transform 0.3s ease;
          ${this.expanded ? "transform: rotate(180deg);" : ""}
        }
      </style>

      <div class="logger-container">
        <div class="logger-header" id="toggle-header">
          <div class="logger-title">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="16" y1="13" x2="8" y2="13"/>
              <line x1="16" y1="17" x2="8" y2="17"/>
              <polyline points="10 9 9 9 8 9"/>
            </svg>
            <span>Activity Log</span>
            <span class="logger-badge">${this.logs.length}</span>
          </div>
          <div class="logger-actions">
            ${this.logs.length > 0 ? `
              <button class="logger-btn" id="clear-btn" title="Clear logs">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="3 6 5 6 21 6"/>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                </svg>
              </button>
            ` : ''}
            <button class="logger-btn expand-icon" title="${this.expanded ? 'Collapse' : 'Expand'}">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="6 9 12 15 18 9"/>
              </svg>
            </button>
          </div>
        </div>

        <div class="logger-content">
          ${this.logs.length === 0 ? `
            <div class="empty-state">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
              </svg>
              <p>No activity yet</p>
            </div>
          ` : visibleLogs.map((log) => `
            <div class="log-entry">
              <div class="log-time">${this.formatTime(log.timestamp)}</div>
              <div class="log-icon ${log.level}">
                ${this.getLevelIcon(log.level)}
              </div>
              <div class="log-message">${this.escapeHtml(log.message)}</div>
            </div>
          `).join("")}
        </div>
      </div>
    `);

    // Event listeners
    this.$("#toggle-header").addEventListener("click", (e) => {
      if (e.target.closest("#clear-btn")) return;
      this.toggleExpanded();
    });

    const clearBtn = this.$("#clear-btn");
    if (clearBtn) {
      clearBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        this.clearLogs();
      });
    }
  }

  escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }
}

customElements.define("activity-logger", ActivityLogger);
