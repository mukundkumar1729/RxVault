// ════════════════════════════════════════════════════════════
//  VITALS-CHART.JS — Visualizing health trends for patients
// ════════════════════════════════════════════════════════════

/**
 * Renders a vitals trend chart for a specific patient.
 * @param {string} patientId - The unique ID of the patient.
 * @param {string} containerId - The ID of the canvas element.
 */
async function renderVitalsChart(patientId, containerId) {
  var canvas = document.getElementById(containerId);
  if (!canvas) return;

  // 1. Fetch historical vitals from Supabase
  var vitalsData = await dbGetPatientVitals(patientId);
  if (!vitalsData || !vitalsData.length) {
    var ctx = canvas.getContext('2d');
    ctx.font = '12px DM Sans';
    ctx.fillStyle = '#8fa0b3';
    ctx.textAlign = 'center';
    ctx.fillText('No historical vitals recorded yet.', canvas.width / 2, canvas.height / 2);
    return;
  }

  // 2. Prepare data for Chart.js
  // Sort by date ascending
  vitalsData.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

  var labels = vitalsData.map(v => new Date(v.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }));
  var bpSys = vitalsData.map(v => v.bp_sys || null);
  var bpDia = vitalsData.map(v => v.bp_dia || null);
  var weight = vitalsData.map(v => v.weight || null);

  // 3. Create Chart
  new Chart(canvas, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'BP Sys',
          data: bpSys,
          borderColor: '#ef4444',
          backgroundColor: 'rgba(239, 68, 68, 0.1)',
          borderWidth: 2,
          tension: 0.3,
          pointRadius: 3
        },
        {
          label: 'BP Dia',
          data: bpDia,
          borderColor: '#f97316',
          backgroundColor: 'rgba(249, 115, 22, 0.1)',
          borderWidth: 2,
          tension: 0.3,
          pointRadius: 3
        },
        {
          label: 'Weight (kg)',
          data: weight,
          borderColor: '#10b981',
          borderWidth: 2,
          tension: 0.3,
          pointRadius: 3,
          yAxisID: 'yWeight'
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false,
      },
      plugins: {
        legend: {
          position: 'top',
          labels: { font: { family: 'DM Sans', size: 11 }, boxWidth: 10 }
        },
        tooltip: {
          backgroundColor: 'rgba(26, 26, 46, 0.9)',
          titleFont: { family: 'DM Sans', weight: 700 },
          bodyFont: { family: 'DM Sans' }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { font: { family: 'DM Sans', size: 10 } }
        },
        y: {
          beginAtZero: false,
          ticks: { font: { family: 'DM Sans', size: 10 } }
        },
        yWeight: {
          position: 'right',
          beginAtZero: false,
          grid: { display: false },
          ticks: { font: { family: 'DM Sans', size: 10 }, color: '#10b981' }
        }
      }
    }
  });
}

/**
 * Helper to fetch vitals for a patient.
 * (Assumes a 'vitals' table exists with patient_id column)
 */
async function dbGetPatientVitals(patientId) {
  try {
    var { data, error } = await db.from('vitals')
      .select('*')
      .eq('patient_id', patientId)
      .order('created_at', { ascending: false })
      .limit(10);
    if (error) throw error;
    return data;
  } catch(e) {
    console.warn('[VitalsChart] Error:', e.message);
    return [];
  }
}
