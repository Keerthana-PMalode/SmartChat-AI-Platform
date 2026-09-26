/* =========================================================
   DASHBOARD CHART STATE
========================================================= */

let activityChart = null;
let comparisonChart = null;

/* =========================================================
   GET CANVAS
========================================================= */

function getElement(id) {
  return document.getElementById(id);
}

/* =========================================================
   DESTROY CHART
========================================================= */

function destroyChart(chart) {
  if (!chart) {
    return null;
  }

  try {
    chart.destroy();
  } catch (error) {
    console.warn("DASHBOARD CHART: failed to destroy chart:", error);
  }

  return null;
}

/* =========================================================
   DESTROY ALL DASHBOARD CHARTS
========================================================= */

export function destroyDashboardCharts() {
  activityChart = destroyChart(activityChart);
  comparisonChart = destroyChart(comparisonChart);

  /*
   * Defensive cleanup.
   *
   * This handles a chart instance that may have been
   * created by an older version of the code but is no
   * longer referenced by our local variables.
   */
  const activityCanvas = getElement("dashboard-activity-chart");

  if (activityCanvas && typeof Chart !== "undefined") {
    const existingActivityChart = Chart.getChart(activityCanvas);

    if (existingActivityChart) {
      existingActivityChart.destroy();
    }
  }

  const comparisonCanvas = getElement("dashboard-comparison-chart");

  if (comparisonCanvas && typeof Chart !== "undefined") {
    const existingComparisonChart = Chart.getChart(comparisonCanvas);

    if (existingComparisonChart) {
      existingComparisonChart.destroy();
    }
  }
}

/* =========================================================
   ACTIVITY CHART
========================================================= */

function renderActivityChart(data) {
  const canvas = getElement("dashboard-activity-chart");

  if (!canvas) {
    console.warn("Dashboard activity chart canvas not found.");

    return;
  }

  if (typeof Chart === "undefined") {
    console.error("Chart.js is not loaded.");

    return;
  }

  /*
   * Always destroy the Chart.js instance associated
   * with this exact canvas before creating another one.
   */
  const existingChart = Chart.getChart(canvas);

  if (existingChart) {
    existingChart.destroy();
  }

  activityChart = null;

  activityChart = new Chart(canvas, {
    type: "line",

    data: {
      labels: data.labels,

      datasets: [
        {
          label: "Conversations",

          data: data.conversations,

          borderColor: "#4f46e5",

          backgroundColor: "rgba(79, 70, 229, 0.12)",

          borderWidth: 2,

          tension: 0.35,

          fill: true,

          pointRadius: 3,

          pointHoverRadius: 5,
        },

        {
          label: "Messages",

          data: data.messages,

          borderColor: "#06b6d4",

          backgroundColor: "rgba(6, 182, 212, 0.08)",

          borderWidth: 2,

          tension: 0.35,

          fill: false,

          pointRadius: 3,

          pointHoverRadius: 5,
        },
      ],
    },

    options: {
      responsive: true,

      maintainAspectRatio: false,

      interaction: {
        mode: "index",

        intersect: false,
      },

      plugins: {
        legend: {
          display: true,

          position: "top",
        },

        tooltip: {
          enabled: true,
        },
      },

      scales: {
        x: {
          grid: {
            display: false,
          },
        },

        y: {
          beginAtZero: true,

          ticks: {
            precision: 0,
          },
        },
      },
    },
  });
}

/* =========================================================
   COMPARISON CHART
========================================================= */

function renderComparisonChart(data) {
  const canvas = getElement("dashboard-comparison-chart");

  if (!canvas) {
    console.warn("Dashboard comparison chart canvas not found.");

    return;
  }

  if (typeof Chart === "undefined") {
    console.error("Chart.js is not loaded.");

    return;
  }

  const existingChart = Chart.getChart(canvas);

  if (existingChart) {
    existingChart.destroy();
  }

  comparisonChart = null;

  comparisonChart = new Chart(canvas, {
    type: "bar",

    data: {
      labels: data.labels,

      datasets: [
        {
          label: "Conversations",

          data: data.conversations,

          backgroundColor: "rgba(79, 70, 229, 0.75)",

          borderColor: "#4f46e5",

          borderWidth: 1,

          borderRadius: 4,
        },

        {
          label: "Messages",

          data: data.messages,

          backgroundColor: "rgba(6, 182, 212, 0.75)",

          borderColor: "#06b6d4",

          borderWidth: 1,

          borderRadius: 4,
        },
      ],
    },

    options: {
      responsive: true,

      maintainAspectRatio: false,

      plugins: {
        legend: {
          display: true,

          position: "top",
        },

        tooltip: {
          enabled: true,
        },
      },

      scales: {
        x: {
          grid: {
            display: false,
          },
        },

        y: {
          beginAtZero: true,

          ticks: {
            precision: 0,
          },
        },
      },
    },
  });
}

/* =========================================================
   RENDER ALL DASHBOARD CHARTS
========================================================= */

export function renderDashboardCharts(data) {
  if (!data) {
    console.warn("DASHBOARD CHARTS: no data supplied.");

    destroyDashboardCharts();

    return;
  }

  /*
   * Important:
   *
   * This is the only place where dashboard charts
   * should be rendered.
   */
  destroyDashboardCharts();

  renderActivityChart(data);
  renderComparisonChart(data);
}