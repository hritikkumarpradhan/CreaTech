// Constants and Data Models for AI Simulation
const CONFIG = {
    baseline: {
        cycleTime: 24, // hrs
        cost: 1200     // per element
    },
    mixFactors: {
        'm30': { strengthMultiplier: 1.0, costAdd: 0 },
        'm40': { strengthMultiplier: 1.25, costAdd: 150 },
        'm50': { strengthMultiplier: 1.5, costAdd: 350 },
        'scc': { strengthMultiplier: 1.35, costAdd: 450 }
    },
    curingFactors: {
        'ambient': { timeMultiplier: 1.0, costAdd: 0, desc: "Ambient curing takes longer to reach target strength but requires no additional energy costs." },
        'water': { timeMultiplier: 0.85, costAdd: 80, desc: "Water sprinkling yields slight hydration improvements for a minimal cost." },
        'steam': { timeMultiplier: 0.35, costAdd: 500, desc: "Steam curing drastically accelerates the hydration phase, cutting cycle time by over 60%, albeit at a high energy premium." },
        'heated_formwork': { timeMultiplier: 0.45, costAdd: 380, desc: "Heated formworks provide fast, consistent surface strength gain with optimized thermal distribution." }
    },
    automationFactors: {
        'manual': { timeAdd: 2.5, costMultiplier: 1.0 },
        'semi': { timeAdd: 0.5, costMultiplier: 1.15 },
        'full': { timeAdd: -1.5, costMultiplier: 1.35 } // Carousel systems speed up handling
    },
    climateFactors: {
        'cold': { timeMultiplier: 1.3 }, // Slows hydration
        'moderate': { timeMultiplier: 1.0 },
        'hot': { timeMultiplier: 0.75 }, // Speeds hydration naturally
        'humid': { timeMultiplier: 0.9 }
    }
};

// Global Chart Instances
let strengthChartInstance = null;
let costChartInstance = null;

document.addEventListener('DOMContentLoaded', () => {
    // Navigation Logic
    const navItems = document.querySelectorAll('.nav-item');
    const aiOptimizerView = document.getElementById('aiOptimizerView');
    const analyticsView = document.getElementById('analyticsView');
    const scenariosView = document.getElementById('scenariosView');
    const erpSyncView = document.getElementById('erpSyncView');
    const climateApiView = document.getElementById('climateApiView');
    // Ensure placeholder is kept only if we fall back to it
    const placeholderView = document.getElementById('placeholderView');

    function hideAllViews() {
        aiOptimizerView.style.display = 'none';
        analyticsView.style.display = 'none';
        scenariosView.style.display = 'none';
        erpSyncView.style.display = 'none';
        climateApiView.style.display = 'none';
        if (placeholderView) placeholderView.style.display = 'none';
    }

    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const title = item.querySelector('span').textContent;

            navItems.forEach(i => i.classList.remove('active'));
            item.classList.add('active');

            hideAllViews();

            if (title === 'AI Optimizer') {
                aiOptimizerView.style.display = 'grid';
                setTimeout(() => {
                    if (strengthChartInstance) strengthChartInstance.resize();
                    if (costChartInstance) costChartInstance.resize();
                }, 10);
            } else if (title === 'Analytics') {
                analyticsView.style.display = 'block';
                setTimeout(() => {
                    if (window.analyticsChartInstance) window.analyticsChartInstance.resize();
                }, 10);
            } else if (title === 'Project Scenarios') {
                scenariosView.style.display = 'block';
            } else if (title === 'ERP Data Sync') {
                erpSyncView.style.display = 'block';
            } else if (title === 'Climate APIs') {
                climateApiView.style.display = 'block';
            }
        });
    });

    // UI Elements
    const form = document.getElementById('optimizerForm');
    const simulateBtn = document.getElementById('simulateBtn');
    const targetStrengthSlider = document.getElementById('targetStrength');
    const strengthValueDisplay = document.getElementById('strengthValue');

    // Form Inputs Event Listeners for Live Updates
    const inputs = form.querySelectorAll('select, input');
    inputs.forEach(input => {
        input.addEventListener('change', () => {
            // Optional: Auto-run on change or wait for button
            // If we want auto-update, we could call a debounced runSimulation here
        });
    });

    // Update slider value display immediately
    targetStrengthSlider.addEventListener('input', (e) => {
        strengthValueDisplay.textContent = e.target.value;
    });

    // Handle Optimization Simulation Submission
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        // 1. Enter Loading State
        simulateBtn.classList.add('loading');
        simulateBtn.innerHTML = `<i class="fa-solid fa-microchip fa-fade"></i> <span class="btn-text">AI Processing Scenario...</span>`;
        simulateBtn.style.opacity = '0.8';
        simulateBtn.style.pointerEvents = 'none';

        // Add minimal pulse effect to dashboard wrapper
        const dashboard = document.querySelector('.results-panel');
        dashboard.style.opacity = '0.5';
        dashboard.style.transition = 'opacity 0.3s ease';

        // 2. Gather Configuration Inputs
        const formData = new FormData(form);
        const scenarioInputs = {
            mix: formData.get('mixDesign'),
            curing: formData.get('curingMethod'),
            automation: formData.get('automationLevel'),
            climate: formData.get('climateRegion'),
            targetStrength: parseInt(formData.get('targetStrength'))
        };

        // 3. Connect to AI Optimization API
        await runSimulation(scenarioInputs);

        // Exit Loading State
        simulateBtn.classList.remove('loading');
        simulateBtn.innerHTML = `<span class="btn-text">Run Optimization Again</span> <i class="fa-solid fa-bolt"></i>`;
        simulateBtn.style.opacity = '1';
        simulateBtn.style.pointerEvents = 'auto';
        dashboard.style.opacity = '1';

        // Add flash effect to KPIs
        document.querySelectorAll('.kpi-value').forEach(el => {
            el.style.color = '#10b981'; // flash green
            setTimeout(() => el.style.color = 'white', 500);
        });
    });

    const downloadReportBtn = document.getElementById('downloadReportBtn');
    const exportBtn = document.getElementById('exportBtn');

    const handlePdfDownload = async (btnElement) => {
        // UI Feedback
        const originalText = btnElement.innerHTML;
        btnElement.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Generating PDF...';
        btnElement.disabled = true;

        // Populate the PDF Template
        const dateStr = new Date().toLocaleString();
        document.getElementById('pdfDate').innerText = dateStr;

        const mixSelect = document.getElementById('mixDesign');
        const curingSelect = document.getElementById('curingMethod');
        const autoSelect = document.getElementById('automationLevel');
        const climateSelect = document.getElementById('climateRegion');

        document.getElementById('pdfMix').innerText = mixSelect.options[mixSelect.selectedIndex].text;
        document.getElementById('pdfCuring').innerText = curingSelect.options[curingSelect.selectedIndex].text;
        document.getElementById('pdfAutomation').innerText = autoSelect.options[autoSelect.selectedIndex].text;
        document.getElementById('pdfClimate').innerText = climateSelect.options[climateSelect.selectedIndex].text;
        document.getElementById('pdfTarget').innerText = document.getElementById('targetStrength').value + ' MPa';

        // Check if report is generated by ensuring cycleTimeVal is not empty/hyphens
        const cycleTime = document.getElementById('cycleTimeVal').innerText;
        if (cycleTime === '--') {
            document.getElementById('pdfCycle').innerText = 'N/A';
            document.getElementById('pdfCost').innerText = 'N/A';
            document.getElementById('pdfEfficiency').innerText = 'N/A';
        } else {
            document.getElementById('pdfCycle').innerText = cycleTime + ' hrs';
            document.getElementById('pdfCost').innerText = '₹' + document.getElementById('costVal').innerText;
            document.getElementById('pdfEfficiency').innerText = document.getElementById('efficiencyVal').innerText + '%';
        }

        // Clone AI insight HTML, but adjust color classes to be readable on light backgrounds
        const insightEl = document.getElementById('aiInsightText');
        const clonedInsight = insightEl.cloneNode(true);
        // Replace icons inside to have better colors if necessary (warning color might still work)
        document.getElementById('pdfInsight').innerHTML = clonedInsight.innerHTML;

        // Convert Chart.js canvases to Base64 image and assign to image tags in template
        if (strengthChartInstance) {
            document.getElementById('pdfStrengthChartImg').src = strengthChartInstance.toBase64Image('image/png', 1);
        }
        if (costChartInstance) {
            document.getElementById('pdfCostChartImg').src = costChartInstance.toBase64Image('image/png', 1);
        }

        const reportTemplate = document.getElementById('pdf-report-template');

        // Bring template into view temporarily but hidden behind other elements
        reportTemplate.style.top = window.scrollY + 'px';
        reportTemplate.style.left = '0';
        reportTemplate.style.zIndex = '-99';

        // Small delay to allow renderer to catch up with template position and chart rendering
        await new Promise(resolve => setTimeout(resolve, 200));

        try {
            const canvas = await html2canvas(reportTemplate, {
                scale: 2,
                useCORS: true,
                allowTaint: false,
                backgroundColor: '#ffffff'
            });

            const imgData = canvas.toDataURL('image/jpeg', 1.0);
            const { jsPDF } = window.jspdf;

            // hide template again
            reportTemplate.style.left = '-15000px';

            // create portrait A4
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

            pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
            pdf.save('CreaTech_Professional_Report.pdf');

        } catch (error) {
            console.error('Error generating PDF:', error);
            const errorMsg = error ? (error.message || error.toString()) : 'Unknown error';
            alert(`There was an error generating the PDF: ${errorMsg}\n\nPlease check the console for more details.`);
            reportTemplate.style.left = '-15000px';
        } finally {
            btnElement.innerHTML = originalText;
            btnElement.disabled = false;
        }
    };

    if (downloadReportBtn) {
        downloadReportBtn.addEventListener('click', () => handlePdfDownload(downloadReportBtn));
    }
    if (exportBtn) {
        exportBtn.addEventListener('click', () => handlePdfDownload(exportBtn));
    }

    // Initialize Dashboard with Default Data
    initCharts();

    // Auto-populate with random values and trigger simulation for testing
    const randomizeSelect = (id) => {
        const el = document.getElementById(id);
        if (el) el.selectedIndex = Math.floor(Math.random() * el.options.length);
    };

    randomizeSelect('mixDesign');
    randomizeSelect('curingMethod');
    randomizeSelect('automationLevel');
    randomizeSelect('climateRegion');

    const strengthSlider = document.getElementById('targetStrength');
    if (strengthSlider) {
        const randomStrength = Math.floor(Math.random() * (parseInt(strengthSlider.max) - parseInt(strengthSlider.min) + 1)) + parseInt(strengthSlider.min);
        strengthSlider.value = randomStrength;
        const strValDisplay = document.getElementById('strengthValue');
        if (strValDisplay) strValDisplay.textContent = randomStrength;
    }

    // Auto-click the simulate button after a short delay to show the graphs on load
    setTimeout(() => {
        if (simulateBtn) simulateBtn.click();
    }, 500);
});

/**
 * Core Logic Engine for Precast Optimization
 */
async function runSimulation(inputs) {
    try {
        const response = await fetch('http://localhost:8000/simulate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(inputs)
        });

        if (!response.ok) {
            throw new Error(`Server returned ${response.status}`);
        }

        const data = await response.json();
        if (data.status === "error") {
            console.error("Simulation error:", data.message);
            alert("Simulation could not reach target parameters within reasonable timeframe.");
            return;
        }

        const finalCycleTime = data.finalCycleTime;
        const finalCost = data.finalCost;
        const efficiencyGain = data.efficiencyGain;
        const matCost = data.matCost;
        const cureCost = data.cureCost;
        const strengthTensionHrs = data.timeTensionHrs; // We use this for chart alignment

        // Step 4: Update UI Values with Smooth Count-up Animations
        animateCounter('cycleTimeVal', finalCycleTime, 1200, 1);
        animateCounter('costVal', finalCost, 1200, 0);
        animateCounter('efficiencyVal', efficiencyGain, 1200, 1);

        // Step 5: Update KPI Trend Subtitles
        updateTrendDisplay('cycleTimeTrend', finalCycleTime, CONFIG.baseline.cycleTime, true, 'hrs vs standard');
        updateTrendDisplay('costTrend', finalCost, CONFIG.baseline.cost, false, 'INR vs standard');

        const effTrendEl = document.getElementById('efficiencyTrend');
        if (efficiencyGain > 0) {
            effTrendEl.className = 'kpi-trend positive';
            effTrendEl.innerHTML = `<i class="fa-solid fa-arrow-trend-up"></i> Net positive efficiency`;
        } else {
            effTrendEl.className = 'kpi-trend negative';
            effTrendEl.innerHTML = `<i class="fa-solid fa-arrow-trend-down"></i> Efficiency deficit`;
        }

        // Step 6: Generate AI Natural Language Insight
        generateAiInsightText(inputs, finalCycleTime, finalCost, efficiencyGain);

        // Step 7: Update Data Visualizations
        updateCharts(inputs, strengthTensionHrs, matCost, cureCost, finalCost);

    } catch (err) {
        console.error("Failed to connect to backend", err);
        alert("Could not connect to AI Optimizer Backend. Ensure the FastAPI server is running.");
    }
}

/**
 * Natural Language Generation for the Recommendation Box
 */
function generateAiInsightText(inputs, time, cost, eff) {
    const insightEl = document.getElementById('aiInsightText');

    const climateName = document.querySelector(`#climateRegion option[value="${inputs.climate}"]`).text.split(' ')[0];

    let html = `<p>Operating in <b>${climateName}</b> conditions, combining a <b>${inputs.mix.toUpperCase()} mix</b> with <b>${inputs.curing.replace('_', ' ')} curing</b> `;

    if (eff > 25) {
        html += `yields a <b>highly optimal strategy</b>. `;
    } else if (eff > 0) {
        html += `provides <b>moderate efficiency gains</b> over traditional methods. `;
    } else {
        html += `results in <b>suboptimal economics</b> due to high overheads outweighing time savings. `;
    }

    // Add specific curing insight from config
    html += `<br><br><i class="fa-solid fa-lightbulb" style="color:var(--warning); margin-right:6px"></i> ${CONFIG.curingFactors[inputs.curing].desc} `;

    // Edge case logical deductions
    if (inputs.automation === 'full' && cost > 1300) {
        html += `While fully automated handling minimizes yard bottlenecks, it significantly drives up the cost per element to ₹${cost.toFixed(0)}. Re-evaluate if project volume (scale) justifies this CAPEX.`;
    } else if (time <= 12) {
        html += `Achieving a <b>${time.toFixed(1)}hr cycle</b> permits <b>two casts per day</b> per mould, effectively doubling your yard capacity and asset utilization.`;
    } else if (inputs.climate === 'cold' && inputs.curing === 'ambient') {
        html += `<i>Warning:</i> Ambient curing in cold climates causes severe hydration delays. Consider heated formworks to maintain schedules.`;
    }

    insightEl.innerHTML = html;
}

/**
 * Number counting animation for KPIs
 */
function animateCounter(id, endValue, duration, decimals) {
    const obj = document.getElementById(id);
    const startValue = parseFloat(obj.innerText) || 0;
    const range = endValue - startValue;

    if (range === 0) return;

    let startTime = null;

    function step(timestamp) {
        if (!startTime) startTime = timestamp;
        const progress = Math.min((timestamp - startTime) / duration, 1);

        // easeOutQuart
        const ease = 1 - Math.pow(1 - progress, 4);
        const current = startValue + (range * ease);

        obj.innerHTML = current.toFixed(decimals);

        if (progress < 1) {
            window.requestAnimationFrame(step);
        } else {
            obj.innerHTML = endValue.toFixed(decimals);
        }
    }

    window.requestAnimationFrame(step);
}

function updateTrendDisplay(id, currentVal, baseline, lowerIsBetter, suffix) {
    const el = document.getElementById(id);
    const diff = currentVal - baseline;
    const isPositive = lowerIsBetter ? diff < 0 : diff > 0;

    if (Math.abs(diff) < 0.1) {
        el.className = 'kpi-trend';
        el.innerHTML = `At baseline`;
        return;
    }

    el.className = `kpi-trend ${isPositive ? 'positive' : 'negative'}`;
    const icon = isPositive ? (lowerIsBetter ? 'arrow-down' : 'arrow-up') : (lowerIsBetter ? 'arrow-up' : 'arrow-down');
    const symbol = diff > 0 ? '+' : '';
    el.innerHTML = `<i class="fa-solid fa-${icon}"></i> ${symbol}${diff.toFixed(1)} ${suffix}`;
}

// ======================== Chart.js Visualizations ========================

function initCharts() {
    // Global Chart Configuration for Dark Theme
    Chart.defaults.color = '#94a3b8';
    Chart.defaults.font.family = "'Inter', sans-serif";
    Chart.defaults.plugins.tooltip.backgroundColor = 'rgba(15, 23, 42, 0.9)';
    Chart.defaults.plugins.tooltip.titleColor = '#f8fafc';
    Chart.defaults.plugins.tooltip.padding = 10;
    Chart.defaults.plugins.tooltip.borderColor = 'rgba(59, 130, 246, 0.3)';
    Chart.defaults.plugins.tooltip.borderWidth = 1;

    // 1. Strength vs Time Line Chart
    const ctxStrength = document.getElementById('strengthChart').getContext('2d');

    // Create gradient for line chart
    const gradientBlue = ctxStrength.createLinearGradient(0, 0, 0, 400);
    gradientBlue.addColorStop(0, 'rgba(59, 130, 246, 0.5)');
    gradientBlue.addColorStop(1, 'rgba(59, 130, 246, 0.0)');

    strengthChartInstance = new Chart(ctxStrength, {
        type: 'line',
        data: {
            labels: [0, 4, 8, 12, 16, 20, 24, 30, 36],
            datasets: [{
                label: 'Strength (MPa)',
                data: [0, 0, 0, 0, 0, 0, 0, 0, 0], // Empty init
                borderColor: '#3b82f6',
                backgroundColor: gradientBlue,
                borderWidth: 3,
                pointBackgroundColor: '#0f172a',
                pointBorderColor: '#3b82f6',
                pointBorderWidth: 2,
                pointRadius: 4,
                pointHoverRadius: 6,
                fill: true,
                tension: 0.4 // Smooth curves
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    suggestedMax: 45,
                    grid: { color: 'rgba(255,255,255,0.05)', drawBorder: false },
                    title: { display: true, text: 'Compressive Strength (MPa)', color: '#64748b' }
                },
                x: {
                    grid: { color: 'rgba(255,255,255,0.05)', drawBorder: false },
                    title: { display: true, text: 'Curing Hours', color: '#64748b' }
                }
            },
            animation: {
                duration: 1000,
                easing: 'easeOutQuart'
            }
        }
    });

    // 2. Cost Doughnut Chart
    const ctxCost = document.getElementById('costChart').getContext('2d');
    costChartInstance = new Chart(ctxCost, {
        type: 'doughnut',
        data: {
            labels: ['Concrete Mix', 'Curing Energy', 'Labor / Overhead'],
            datasets: [{
                data: [33, 33, 34], // Empty init
                backgroundColor: ['#3b82f6', '#10b981', '#8b5cf6'],
                borderWidth: 0,
                hoverOffset: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { color: '#e2e8f0', padding: 20, usePointStyle: true, boxWidth: 8 }
                }
            },
            cutout: '75%',
            animation: {
                animateScale: true,
                animateRotate: true,
                duration: 1000
            }
        }
    });

    // 3. Analytics Historical Bar Chart (Newly Added)
    const ctxAnalytics = document.getElementById('analyticsTimelineChart');
    if (ctxAnalytics) {
        window.analyticsChartInstance = new Chart(ctxAnalytics.getContext('2d'), {
            type: 'bar',
            data: {
                labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul'],
                datasets: [{
                    label: 'Avg Cycle Time (hrs)',
                    data: [26, 24, 22, 19, 18.5, 17, 16],
                    backgroundColor: 'rgba(16, 185, 129, 0.7)',
                    borderColor: '#10b981',
                    borderWidth: 1,
                    borderRadius: 4
                }, {
                    label: 'Baseline Target (24hr)',
                    data: [24, 24, 24, 24, 24, 24, 24],
                    type: 'line',
                    borderColor: 'rgba(239, 68, 68, 0.8)',
                    borderWidth: 2,
                    borderDash: [5, 5],
                    pointRadius: 0,
                    fill: false
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: { color: 'rgba(255,255,255,0.05)', drawBorder: false },
                        title: { display: true, text: 'Hours', color: '#64748b' }
                    },
                    x: {
                        grid: { display: false, drawBorder: false }
                    }
                },
                plugins: {
                    legend: {
                        position: 'top',
                        labels: { color: '#e2e8f0', usePointStyle: true, boxWidth: 8 }
                    }
                }
            }
        });
    }
}

function updateCharts(inputs, timeTensionHrs, matCost, cureCost, totalCost) {
    // Update Strength Chart
    const maxStrength = 45 * CONFIG.mixFactors[inputs.mix].strengthMultiplier;

    const dataPoints = [];
    const labels = strengthChartInstance.data.labels; // [0, 4, 8, 12, 16, 20, 24, 30, 36]

    labels.forEach(h => {
        // Delay hydration start for ambient/cold scenarios
        let delay = (inputs.curing === 'ambient' || inputs.climate === 'cold') ? 3 : 1;

        if (h <= delay) {
            dataPoints.push(0);
        } else {
            // Asymptotic curve formula mimicking concrete hydration
            // Time at which strength is half of max
            const t_half = timeTensionHrs * 0.6;
            let s = maxStrength * ((h - delay) / ((h - delay) + t_half));
            dataPoints.push(Math.min(s, maxStrength).toFixed(1));
        }
    });

    strengthChartInstance.data.datasets[0].data = dataPoints;
    strengthChartInstance.update();

    // Update Cost Chart
    let labCost = totalCost - matCost - cureCost;
    if (labCost < 100) labCost = 150; // Add floor

    costChartInstance.data.datasets[0].data = [matCost, cureCost, labCost];
    costChartInstance.update();
}
