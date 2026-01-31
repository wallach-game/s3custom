import { BaseComponent } from "../shared/base-component.js";

class DiskAnalytics extends BaseComponent {
  async render() {
    this.setContent(`<div class="card"><p class="loading">Loading analytics...</p></div>`);

    try {
      const disks = await window.api.get("/api/disks");

      window.activityLogger?.success(`Loaded analytics for ${disks.length} disks`);

      this.setContent(`
        <style>
          .analytics-container {
            display: flex;
            flex-direction: column;
            gap: 24px;
          }

          .chart-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
            gap: 20px;
          }

          .chart-card {
            background: var(--surface);
            border: 1px solid var(--border);
            border-radius: var(--radius);
            padding: 20px;
            box-shadow: var(--shadow);
          }

          .chart-header {
            font-size: 16px;
            font-weight: 600;
            margin-bottom: 16px;
            color: var(--text);
            display: flex;
            align-items: center;
            gap: 8px;
          }

          .chart-canvas {
            width: 100%;
            height: 250px;
            border: 1px solid var(--border);
            border-radius: 8px;
            background: var(--bg);
          }

          .disk-selector {
            margin-bottom: 20px;
          }

          .disk-selector select {
            width: 100%;
            padding: 10px;
            font-size: 14px;
            border: 1px solid var(--border);
            border-radius: var(--radius);
            background: var(--surface);
            color: var(--text);
          }

          .life-expectancy-card {
            background: var(--surface);
            border: 1px solid var(--border);
            border-radius: var(--radius);
            padding: 24px;
            box-shadow: var(--shadow);
          }

          .life-stat {
            display: flex;
            flex-direction: column;
            gap: 8px;
            margin-bottom: 16px;
          }

          .life-stat-label {
            font-size: 12px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            color: var(--text-muted);
            font-weight: 600;
          }

          .life-stat-value {
            font-size: 32px;
            font-weight: 700;
            color: var(--accent);
          }

          .confidence-badge {
            display: inline-block;
            padding: 4px 12px;
            border-radius: 12px;
            font-size: 12px;
            font-weight: 600;
            text-transform: uppercase;
          }

          .confidence-high {
            background: var(--success-subtle);
            color: var(--success);
          }

          .confidence-medium {
            background: var(--warning-subtle);
            color: var(--warning);
          }

          .confidence-low {
            background: var(--danger-subtle);
            color: var(--danger);
          }

          .warnings-list {
            margin-top: 16px;
            padding: 12px;
            background: var(--danger-subtle);
            border-left: 3px solid var(--danger);
            border-radius: 4px;
          }

          .warning-item {
            font-size: 13px;
            color: var(--danger);
            margin: 4px 0;
          }

          .factors-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
            gap: 12px;
            margin-top: 16px;
          }

          .factor-item {
            display: flex;
            flex-direction: column;
            gap: 6px;
          }

          .factor-label {
            font-size: 11px;
            color: var(--text-muted);
            text-transform: uppercase;
          }

          .factor-bar {
            height: 8px;
            background: var(--border);
            border-radius: 4px;
            overflow: hidden;
          }

          .factor-fill {
            height: 100%;
            transition: width 0.3s ease;
          }

          .factor-value {
            font-size: 12px;
            font-weight: 600;
            color: var(--text);
          }

          @media (max-width: 768px) {
            .chart-grid {
              grid-template-columns: 1fr;
            }
          }
        </style>

        <div class="section-header">
          <h1>Disk Analytics</h1>
          <button class="btn-secondary" id="refresh">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
            Refresh
          </button>
        </div>

        <div class="analytics-container">
          <div class="disk-selector">
            <label for="disk-select" style="display: block; margin-bottom: 8px; font-weight: 600;">Select Disk for Detailed Analysis:</label>
            <select id="disk-select">
              <option value="">-- Select a disk --</option>
              ${disks.map(d => `<option value="${this.esc(d.name)}">${this.esc(d.name)} - ${this.esc(d.model || 'Unknown')}</option>`).join('')}
            </select>
          </div>

          <div id="life-expectancy-container"></div>

          <div class="chart-grid">
            <div class="chart-card">
              <div class="chart-header">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 3v18h18"/><polyline points="7 15 12 10 16 14 21 9"/></svg>
                Disk Age Distribution
              </div>
              <canvas id="age-chart" class="chart-canvas"></canvas>
            </div>

            <div class="chart-card">
              <div class="chart-header">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                Temperature Overview
              </div>
              <canvas id="temp-chart" class="chart-canvas"></canvas>
            </div>

            <div class="chart-card">
              <div class="chart-header">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                Power-On Hours
              </div>
              <canvas id="power-chart" class="chart-canvas"></canvas>
            </div>

            <div class="chart-card">
              <div class="chart-header">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
                Health Status
              </div>
              <canvas id="health-chart" class="chart-canvas"></canvas>
            </div>
          </div>

          <div id="history-charts" style="display: none;">
            <h2 style="margin: 24px 0 16px; font-size: 20px;">Historical Trends</h2>
            <div class="chart-grid">
              <div class="chart-card">
                <div class="chart-header">Temperature History</div>
                <canvas id="temp-history-chart" class="chart-canvas"></canvas>
              </div>
              <div class="chart-card">
                <div class="chart-header">Power-On Hours Trend</div>
                <canvas id="power-history-chart" class="chart-canvas"></canvas>
              </div>
            </div>
          </div>
        </div>
      `);

      // Draw overview charts
      this.drawAgeDistribution(disks);
      this.drawTemperatureOverview(disks);
      this.drawPowerOnHours(disks);
      this.drawHealthStatus(disks);

      // Setup event listeners
      this.$("#refresh").addEventListener("click", () => {
        window.activityLogger?.info("Refreshing analytics...");
        this.render();
      });

      this.$("#disk-select").addEventListener("change", async (e) => {
        const disk = e.target.value;
        if (disk) {
          await this.loadDiskDetails(disk);
        } else {
          this.$("#life-expectancy-container").innerHTML = "";
          this.$("#history-charts").style.display = "none";
        }
      });

    } catch (err) {
      window.activityLogger?.error(`Failed to load analytics: ${err.message}`);
      this.setContent(`<div class="error-msg">Failed to load analytics: ${this.esc(err.message)}</div>`);
    }
  }

  async loadDiskDetails(disk) {
    try {
      window.activityLogger?.info(`Loading details for ${disk}...`);

      const [lifeExpectancy, history] = await Promise.all([
        window.api.get(`/api/disks/life-expectancy/${disk}`).catch(() => null),
        window.api.get(`/api/disks/smart-history/${disk}`).catch(() => ({ history: [] }))
      ]);

      // Display life expectancy
      if (lifeExpectancy) {
        this.displayLifeExpectancy(lifeExpectancy);
      }

      // Display history charts
      if (history.history && history.history.length > 0) {
        this.$("#history-charts").style.display = "block";
        this.drawTemperatureHistory(history.history);
        this.drawPowerOnHistory(history.history);
      } else {
        this.$("#history-charts").style.display = "none";
      }

    } catch (err) {
      window.activityLogger?.error(`Failed to load details for ${disk}: ${err.message}`);
    }
  }

  displayLifeExpectancy(data) {
    const container = this.$("#life-expectancy-container");

    const confidenceClass = `confidence-${data.confidence}`;
    const timeDisplay = data.estimatedRemainingYears > 0
      ? `${data.estimatedRemainingYears} years, ${data.estimatedRemainingMonths} months`
      : `${data.estimatedRemainingMonths} months`;

    container.innerHTML = `
      <div class="life-expectancy-card">
        <h2 style="margin: 0 0 20px; font-size: 18px;">Life Expectancy Prediction</h2>
        <div class="life-stat">
          <div class="life-stat-label">Estimated Remaining Life</div>
          <div class="life-stat-value">${this.esc(timeDisplay)}</div>
          <span class="confidence-badge ${confidenceClass}">
            ${this.esc(data.confidence)} confidence
          </span>
        </div>

        ${data.warnings && data.warnings.length > 0 ? `
          <div class="warnings-list">
            <strong style="display: block; margin-bottom: 8px;">⚠ Warnings:</strong>
            ${data.warnings.map(w => `<div class="warning-item">• ${this.esc(w)}</div>`).join('')}
          </div>
        ` : ''}

        <div class="factors-grid">
          ${this.renderFactor('Power-On Hours', data.factors.powerOnHoursScore)}
          ${this.renderFactor('Reallocated Sectors', data.factors.reallocatedSectorsScore)}
          ${this.renderFactor('Temperature', data.factors.temperatureScore)}
          ${this.renderFactor('Error Rate', data.factors.errorRateScore)}
          ${this.renderFactor('Trend', data.factors.trendScore)}
        </div>
      </div>
    `;
  }

  renderFactor(label, score) {
    const color = score > 70 ? 'var(--success)' : score > 40 ? 'var(--warning)' : 'var(--danger)';
    return `
      <div class="factor-item">
        <div class="factor-label">${this.esc(label)}</div>
        <div class="factor-bar">
          <div class="factor-fill" style="width: ${score}%; background: ${color};"></div>
        </div>
        <div class="factor-value">${score.toFixed(0)}%</div>
      </div>
    `;
  }

  drawAgeDistribution(disks) {
    const canvas = this.$("#age-chart");
    const ctx = canvas.getContext("2d");
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * 2;
    canvas.height = rect.height * 2;
    ctx.scale(2, 2);

    const ages = disks.map(d => (d.smart?.powerOnHours || 0) / 8760).sort((a, b) => a - b);

    this.drawBarChart(ctx, ages, rect.width, rect.height, "Age (years)", d => `${d.toFixed(1)}y`);
  }

  drawTemperatureOverview(disks) {
    const canvas = this.$("#temp-chart");
    const ctx = canvas.getContext("2d");
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * 2;
    canvas.height = rect.height * 2;
    ctx.scale(2, 2);

    const temps = disks.filter(d => d.smart?.temperature).map(d => d.smart.temperature);

    if (temps.length === 0) {
      ctx.fillStyle = "#666";
      ctx.font = "14px sans-serif";
      ctx.fillText("No temperature data available", 10, rect.height / 2);
      return;
    }

    this.drawBarChart(ctx, temps, rect.width, rect.height, "Temperature (°C)", d => `${d}°C`, true);
  }

  drawPowerOnHours(disks) {
    const canvas = this.$("#power-chart");
    const ctx = canvas.getContext("2d");
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * 2;
    canvas.height = rect.height * 2;
    ctx.scale(2, 2);

    const hours = disks.filter(d => d.smart?.powerOnHours).map(d => d.smart.powerOnHours);

    if (hours.length === 0) {
      ctx.fillStyle = "#666";
      ctx.font = "14px sans-serif";
      ctx.fillText("No power-on hour data available", 10, rect.height / 2);
      return;
    }

    this.drawBarChart(ctx, hours, rect.width, rect.height, "Hours", d => `${Math.round(d / 1000)}k`);
  }

  drawHealthStatus(disks) {
    const canvas = this.$("#health-chart");
    const ctx = canvas.getContext("2d");
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * 2;
    canvas.height = rect.height * 2;
    ctx.scale(2, 2);

    const healthy = disks.filter(d => d.smart?.healthy).length;
    const unhealthy = disks.filter(d => d.smart && !d.smart.healthy).length;
    const unknown = disks.filter(d => !d.smart).length;

    this.drawPieChart(ctx, [
      { label: "Healthy", value: healthy, color: "#10b981" },
      { label: "Unhealthy", value: unhealthy, color: "#ef4444" },
      { label: "Unknown", value: unknown, color: "#6b7280" }
    ], rect.width, rect.height);
  }

  drawTemperatureHistory(history) {
    const canvas = this.$("#temp-history-chart");
    const ctx = canvas.getContext("2d");
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * 2;
    canvas.height = rect.height * 2;
    ctx.scale(2, 2);

    const data = history.filter(h => h.temperature).map(h => h.temperature);
    this.drawLineChart(ctx, data, rect.width, rect.height, "Temperature (°C)");
  }

  drawPowerOnHistory(history) {
    const canvas = this.$("#power-history-chart");
    const ctx = canvas.getContext("2d");
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * 2;
    canvas.height = rect.height * 2;
    ctx.scale(2, 2);

    const data = history.filter(h => h.powerOnHours).map(h => h.powerOnHours);
    this.drawLineChart(ctx, data, rect.width, rect.height, "Hours");
  }

  drawBarChart(ctx, data, width, height, label, formatter, useColorZones = false) {
    const padding = 40;
    const chartWidth = width - padding * 2;
    const chartHeight = height - padding * 2;

    ctx.fillStyle = "#1e293b";
    ctx.fillRect(0, 0, width, height);

    if (data.length === 0) return;

    const max = Math.max(...data);
    const barWidth = chartWidth / data.length - 4;

    data.forEach((value, i) => {
      const barHeight = (value / max) * chartHeight;
      const x = padding + i * (barWidth + 4);
      const y = height - padding - barHeight;

      let color = "#5b9dff";
      if (useColorZones && label.includes("Temperature")) {
        color = value < 40 ? "#10b981" : value < 50 ? "#f59e0b" : "#ef4444";
      }

      ctx.fillStyle = color;
      ctx.fillRect(x, y, barWidth, barHeight);

      ctx.fillStyle = "#94a3b8";
      ctx.font = "10px sans-serif";
      ctx.textAlign = "center";
      const text = formatter ? formatter(value) : value.toString();
      ctx.fillText(text, x + barWidth / 2, y - 4);
    });

    ctx.fillStyle = "#64748b";
    ctx.font = "12px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(label, padding, padding - 10);
  }

  drawLineChart(ctx, data, width, height, label) {
    const padding = 40;
    const chartWidth = width - padding * 2;
    const chartHeight = height - padding * 2;

    ctx.fillStyle = "#1e293b";
    ctx.fillRect(0, 0, width, height);

    if (data.length < 2) return;

    const max = Math.max(...data);
    const min = Math.min(...data);
    const range = max - min || 1;

    ctx.strokeStyle = "#5b9dff";
    ctx.lineWidth = 2;
    ctx.beginPath();

    data.forEach((value, i) => {
      const x = padding + (i / (data.length - 1)) * chartWidth;
      const y = height - padding - ((value - min) / range) * chartHeight;

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });

    ctx.stroke();

    ctx.fillStyle = "#64748b";
    ctx.font = "12px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(label, padding, padding - 10);
    ctx.fillText(`Min: ${min.toFixed(1)}`, padding, height - 10);
    ctx.fillText(`Max: ${max.toFixed(1)}`, width - padding - 80, height - 10);
  }

  drawPieChart(ctx, data, width, height) {
    ctx.fillStyle = "#1e293b";
    ctx.fillRect(0, 0, width, height);

    const total = data.reduce((sum, d) => sum + d.value, 0);
    if (total === 0) return;

    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(width, height) / 3;

    let currentAngle = -Math.PI / 2;

    data.forEach(item => {
      const sliceAngle = (item.value / total) * 2 * Math.PI;

      ctx.fillStyle = item.color;
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.arc(centerX, centerY, radius, currentAngle, currentAngle + sliceAngle);
      ctx.closePath();
      ctx.fill();

      const labelAngle = currentAngle + sliceAngle / 2;
      const labelX = centerX + Math.cos(labelAngle) * (radius + 30);
      const labelY = centerY + Math.sin(labelAngle) * (radius + 30);

      ctx.fillStyle = "#e2e8f0";
      ctx.font = "12px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(`${item.label}: ${item.value}`, labelX, labelY);

      currentAngle += sliceAngle;
    });
  }

  esc(str) {
    const el = document.createElement("span");
    el.textContent = String(str);
    return el.innerHTML;
  }
}

customElements.define("disk-analytics", DiskAnalytics);
