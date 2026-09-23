/* =========================================================
   DASHBOARD CHARTS
========================================================= */

let activityChart = null;
let comparisonChart = null;

/* =========================================================
   CHART DEFAULTS
========================================================= */

const chartColors = {
  blue: "#2563eb",
  blueLight: "rgba(37, 99, 235, 0.12)",

  green: "#16a34a",
  greenLight: "rgba(22, 163, 74, 0.12)",

  grid: "#e5e7eb",
  text: "#6b7280",
};

/* =========================================================
   DESTROY EXISTING CHARTS
========================================================= */

function destroyCharts() {
  if (activityChart) {
    activityChart.destroy();
    activityChart = null;
  }

  if (comparisonChart) {
    comparisonChart.destroy();
    comparisonChart = null;
  }
}

/* =========================================================
   RENDER ACTIVITY LINE CHART
========================================================= */

function renderActivityChart(activity) {
  const canvas = document.getElementById("dashboard-activity-chart");

  if (!canvas) {
    console.warn("Dashboard activity chart canvas not found.");
    return;
  }

  const labels = activity && activity.labels ? activity.labels : [];

  const conversations =
    activity && activity.conversations ? activity.conversations : [];

  const messages = activity && activity.messages ? activity.messages : [];

  const context = canvas.getContext("2d");

  activityChart = new Chart(context, {
    type: "line",

    data: {
      labels: labels,

      datasets: [
        {
          label: "Conversations",
          data: conversations,
          borderColor: chartColors.blue,
          backgroundColor: chartColors.blueLight,
          borderWidth: 2,
          fill: true,
          tension: 0.35,
          pointRadius: 4,
          pointHoverRadius: 6,
          pointBackgroundColor: chartColors.blue,
          pointBorderColor: "#ffffff",
          pointBorderWidth: 2,
        },
        {
          label: "Messages",
          data: messages,
          borderColor: chartColors.green,
          backgroundColor: chartColors.greenLight,
          borderWidth: 2,
          fill: true,
          tension: 0.35,
          pointRadius: 4,
          pointHoverRadius: 6,
          pointBackgroundColor: chartColors.green,
          pointBorderColor: "#ffffff",
          pointBorderWidth: 2,
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
          position: "top",

          labels: {
            usePointStyle: true,
            boxWidth: 8,
            color: chartColors.text,

            font: {
              size: 12,
              weight: "600",
            },
          },
        },

        tooltip: {
          mode: "index",
          intersect: false,
          backgroundColor: "#111827",
          titleColor: "#ffffff",
          bodyColor: "#ffffff",
          padding: 12,
          cornerRadius: 8,
        },
      },

      scales: {
        x: {
          grid: {
            display: false,
          },

          ticks: {
            color: chartColors.text,

            font: {
              size: 11,
            },
          },
        },

        y: {
          beginAtZero: true,

          ticks: {
            precision: 0,
            color: chartColors.text,

            font: {
              size: 11,
            },
          },

          grid: {
            color: chartColors.grid,
            drawBorder: false,
          },
        },
      },
    },
  });
}

/* =========================================================
   RENDER COMPARISON BAR CHART
========================================================= */

function renderComparisonChart(activity) {
  const canvas = document.getElementById("dashboard-comparison-chart");

  if (!canvas) {
    console.warn("Dashboard comparison chart canvas not found.");
    return;
  }

  const labels = activity && activity.labels ? activity.labels : [];

  const conversations =
    activity && activity.conversations ? activity.conversations : [];

  const messages = activity && activity.messages ? activity.messages : [];

  const context = canvas.getContext("2d");

  comparisonChart = new Chart(context, {
    type: "bar",

    data: {
      labels: labels,

      datasets: [
        {
          label: "Conversations",
          data: conversations,
          backgroundColor: chartColors.blue,
          borderRadius: 5,
          borderSkipped: false,
        },
        {
          label: "Messages",
          data: messages,
          backgroundColor: chartColors.green,
          borderRadius: 5,
          borderSkipped: false,
        },
      ],
    },

    options: {
      responsive: true,
      maintainAspectRatio: false,

      plugins: {
        legend: {
          position: "top",

          labels: {
            usePointStyle: true,
            boxWidth: 8,
            color: chartColors.text,

            font: {
              size: 12,
              weight: "600",
            },
          },
        },

        tooltip: {
          backgroundColor: "#111827",
          titleColor: "#ffffff",
          bodyColor: "#ffffff",
          padding: 12,
          cornerRadius: 8,
        },
      },

      scales: {
        x: {
          grid: {
            display: false,
          },

          ticks: {
            color: chartColors.text,

            font: {
              size: 11,
            },
          },
        },

        y: {
          beginAtZero: true,

          ticks: {
            precision: 0,
            color: chartColors.text,

            font: {
              size: 11,
            },
          },

          grid: {
            color: chartColors.grid,
            drawBorder: false,
          },
        },
      },
    },
  });
}

/* =========================================================
   PUBLIC RENDER FUNCTION
========================================================= */

export function renderDashboardCharts(activity) {
  if (typeof Chart === "undefined") {
    console.error("Chart.js is not loaded.");

    return;
  }

  destroyCharts();

  renderActivityChart(activity);

  renderComparisonChart(activity);
}

/* =========================================================
   CLEANUP
========================================================= */

export function destroyDashboardCharts() {
  destroyCharts();
}
