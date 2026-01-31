import { BaseComponent } from "../shared/base-component.js";

class ModalDialog extends BaseComponent {
  constructor() {
    super();
    this.isOpen = false;
  }

  connectedCallback() {
    super.connectedCallback();
    this.render();
    this.setupEventListeners();
  }

  setupEventListeners() {
    // ESC key to close
    this.handleKeyDown = (e) => {
      if (e.key === "Escape" && this.isOpen) {
        this.close();
      }
    };
    document.addEventListener("keydown", this.handleKeyDown);
  }

  disconnectedCallback() {
    document.removeEventListener("keydown", this.handleKeyDown);
    this.enableBodyScroll();
  }

  open(title, content) {
    this.isOpen = true;
    this.title = title || "Dialog";
    this.content = content || "";
    this.disableBodyScroll();
    this.render();
    this.emit("modal-opened");
  }

  close() {
    this.isOpen = false;
    this.enableBodyScroll();
    this.render();
    this.emit("modal-closed");
  }

  disableBodyScroll() {
    document.body.style.overflow = "hidden";
  }

  enableBodyScroll() {
    document.body.style.overflow = "";
  }

  render() {
    this.setContent(`
      <style>
        :host {
          display: ${this.isOpen ? "block" : "none"};
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          z-index: 9999;
        }

        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.7);
          backdrop-filter: blur(4px);
          animation: fadeIn 0.2s ease;
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        .modal-container {
          position: fixed;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 90%;
          max-width: 800px;
          max-height: 85vh;
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: var(--radius);
          box-shadow: var(--shadow-lg);
          display: flex;
          flex-direction: column;
          animation: slideIn 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          overflow: hidden;
        }

        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translate(-50%, -48%);
          }
          to {
            opacity: 1;
            transform: translate(-50%, -50%);
          }
        }

        .modal-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 20px 24px;
          border-bottom: 1px solid var(--border);
          background: var(--bg-elevated);
          flex-shrink: 0;
        }

        .modal-title {
          font-size: 18px;
          font-weight: 600;
          color: var(--text);
          margin: 0;
        }

        .modal-close {
          background: transparent;
          border: none;
          color: var(--text-muted);
          cursor: pointer;
          padding: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 6px;
          transition: all var(--transition);
        }

        .modal-close:hover {
          background: var(--accent-subtle);
          color: var(--accent);
        }

        .modal-body {
          flex: 1;
          overflow-y: auto;
          padding: 24px;
        }

        /* Scrollbar styling for modal content */
        .modal-body::-webkit-scrollbar {
          width: 8px;
        }

        .modal-body::-webkit-scrollbar-track {
          background: var(--bg);
          border-radius: 4px;
        }

        .modal-body::-webkit-scrollbar-thumb {
          background: var(--border);
          border-radius: 4px;
        }

        .modal-body::-webkit-scrollbar-thumb:hover {
          background: var(--border-light);
        }

        @media (max-width: 768px) {
          .modal-container {
            width: 95%;
            max-height: 90vh;
          }

          .modal-header {
            padding: 16px 20px;
          }

          .modal-body {
            padding: 20px;
          }
        }
      </style>

      ${this.isOpen ? `
        <div class="modal-overlay" id="overlay"></div>
        <div class="modal-container">
          <div class="modal-header">
            <h2 class="modal-title">${this.escapeHtml(this.title)}</h2>
            <button class="modal-close" id="close-btn" title="Close">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
          <div class="modal-body" id="modal-content">
            ${this.content}
          </div>
        </div>
      ` : ""}
    `);

    if (this.isOpen) {
      this.$("#close-btn")?.addEventListener("click", () => this.close());
      this.$("#overlay")?.addEventListener("click", () => this.close());
    }
  }

  escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  // Method to update modal content dynamically
  setModalContent(html) {
    const modalContent = this.$("#modal-content");
    if (modalContent) {
      modalContent.innerHTML = html;
    }
  }
}

customElements.define("modal-dialog", ModalDialog);
export { ModalDialog };
