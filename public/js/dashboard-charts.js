(function() {
    var token = localStorage.getItem('token');
    if (!token) return;
    var salesCharts = {};

    function isDark() { return document.body.classList.contains('dark-mode'); }
    function chartTextColor() { return '#94a3b8'; }
    function chartGridColor() { return isDark() ? 'rgba(148,163,184,0.1)' : 'rgba(148,163,184,0.08)'; }
    function chartTooltipBg() { return isDark() ? '#334155' : '#1e293b'; }
    function chartLegendColor() { return isDark() ? '#94a3b8' : '#64748b'; }

    function tooltipOpts() {
        return { backgroundColor: chartTooltipBg(), titleColor: '#f8fafc', bodyColor: '#cbd5e1', titleFont: { size: 13, weight: '600' }, bodyFont: { size: 12 }, padding: { top: 10, bottom: 10, left: 14, right: 14 }, cornerRadius: 10, displayColors: true, boxWidth: 10, boxHeight: 10, boxPadding: 6, usePointStyle: true };
    }
    function legendOpts() {
        return { color: chartLegendColor(), font: { size: 12, weight: '500' }, padding: 20, usePointStyle: true, pointStyleWidth: 8 };
    }

    function fmt(n) { return Number(n || 0).toLocaleString(); }

    function animateVal(el, target) {
        if (!el) return;
        var cur = 0;
        var inc = Math.max(1, Math.ceil(target / 50));
        var t = setInterval(function() { cur += inc; if (cur >= target) { cur = target; clearInterval(t); } el.textContent = fmt(cur); }, 18);
    }

    function destroySalesCharts() {
        Object.keys(salesCharts).forEach(function(k) { if (salesCharts[k]) salesCharts[k].destroy(); salesCharts[k] = null; });
    }

    function renderSalesCharts(data) {
        destroySalesCharts();

        var monthly = data.monthlySales || [];
        var statusData = data.ordersByStatus || [];
        var bestSelling = data.bestSellingProducts || [];

        if (monthly.length > 0) {
            var mLabels = monthly.map(function(m) { return new Date(m._id.year, m._id.month - 1).toLocaleString('default', { month: 'short' }); });
            var mSales = monthly.map(function(m) { return m.sales || 0; });
            var ctx = document.getElementById('salesMonthlyChart');
            if (ctx) {
                var grad = ctx.getContext('2d').createLinearGradient(0, 0, 0, 350);
                grad.addColorStop(0, 'rgba(22,163,74,0.25)');
                grad.addColorStop(0.6, 'rgba(22,163,74,0.05)');
                grad.addColorStop(1, 'rgba(22,163,74,0)');
                salesCharts.monthly = new Chart(ctx, {
                    type: 'line',
                    data: { labels: mLabels, datasets: [{ label: 'Sales (RWF)', data: mSales, borderColor: '#16a34a', backgroundColor: grad, fill: true, tension: 0.4, borderWidth: 2.5, pointRadius: 5, pointHoverRadius: 8, pointBackgroundColor: '#fff', pointBorderColor: '#16a34a', pointBorderWidth: 2.5, pointHoverBackgroundColor: '#16a34a', pointHoverBorderColor: '#fff', pointHoverBorderWidth: 2.5 }] },
                    options: { responsive: true, maintainAspectRatio: false, animation: { duration: 1400, easing: 'easeOutQuart' }, plugins: { legend: { display: true, labels: legendOpts() }, tooltip: tooltipOpts() }, scales: { x: { border: { display: false }, grid: { display: false }, ticks: { color: chartTextColor(), font: { size: 11 } } }, y: { beginAtZero: true, border: { display: false }, ticks: { color: chartTextColor(), font: { size: 11 } }, grid: { color: chartGridColor(), drawBorder: false } } } }
                });
            }
        } else {
            var mc = document.getElementById('salesMonthlyChart');
            if (mc) { mc.style.display = 'none'; var p = mc.closest('.chart-card'); if (p && !p.querySelector('.empty-state')) p.insertAdjacentHTML('beforeend', '<div class="empty-state"><span class="empty-state-icon">📊</span><span class="empty-state-text">No sales data yet.</span></div>'); }
        }

        if (statusData.length > 0) {
            var sLabels = statusData.map(function(s) { return s.status; });
            var sCounts = statusData.map(function(s) { return s.count; });
            var sColors = sLabels.map(function(s) { var c = { 'Pending': '#e67e22', 'Completed': '#16a34a', 'Rejected': '#d32f2f' }; return c[s] || '#94a3b8'; });
            var sc = document.getElementById('salesStatusChart');
            if (sc) {
                salesCharts.status = new Chart(sc, {
                    type: 'doughnut',
                    data: { labels: sLabels, datasets: [{ data: sCounts, backgroundColor: sColors, borderWidth: 2, borderColor: isDark() ? '#1e293b' : '#fff', hoverOffset: 6 }] },
                    options: { responsive: true, maintainAspectRatio: false, animation: { duration: 1200, easing: 'easeOutQuart' }, cutout: '60%', plugins: { legend: { position: 'bottom', labels: legendOpts() }, tooltip: tooltipOpts() } }
                });
            }
        } else {
            var sc2 = document.getElementById('salesStatusChart');
            if (sc2) { sc2.style.display = 'none'; var p2 = sc2.closest('.chart-card'); if (p2 && !p2.querySelector('.empty-state')) p2.insertAdjacentHTML('beforeend', '<div class="empty-state"><span class="empty-state-icon">📊</span><span class="empty-state-text">No order data yet.</span></div>'); }
        }

        if (bestSelling.length > 0) {
            var bLabels = bestSelling.map(function(b) { return b.productName; });
            var bCounts = bestSelling.map(function(b) { return b.totalQuantity; });
            var bc = document.getElementById('salesBestSellingChart');
            if (bc) {
                var bGrad = bc.getContext('2d').createLinearGradient(0, 0, 0, 350);
                bGrad.addColorStop(0, '#16a34a');
                bGrad.addColorStop(1, 'rgba(22,163,74,0.3)');
                salesCharts.bestSelling = new Chart(bc, {
                    type: 'bar',
                    data: { labels: bLabels, datasets: [{ label: 'Quantity Sold', data: bCounts, backgroundColor: bGrad, borderRadius: 8, borderSkipped: false, maxBarThickness: 56 }] },
                    options: { responsive: true, maintainAspectRatio: false, animation: { duration: 1200, easing: 'easeOutQuart' }, plugins: { legend: { display: false }, tooltip: tooltipOpts() }, scales: { x: { border: { display: false }, grid: { display: false }, ticks: { color: chartTextColor(), font: { size: 11 }, maxRotation: 45 } }, y: { beginAtZero: true, border: { display: false }, ticks: { stepSize: 1, color: chartTextColor(), font: { size: 11 } }, grid: { color: chartGridColor(), drawBorder: false } } } }
                });
            }
        } else {
            var bc2 = document.getElementById('salesBestSellingChart');
            if (bc2) { bc2.style.display = 'none'; var p3 = bc2.closest('.chart-card'); if (p3 && !p3.querySelector('.empty-state')) p3.insertAdjacentHTML('beforeend', '<div class="empty-state"><span class="empty-state-icon">📦</span><span class="empty-state-text">No product sales data yet.</span></div>'); }
        }
    }

    async function loadSalesAnalytics(period) {
        try {
            var url = '/api/analytics/farmer' + (period && period !== 'all' ? '?period=' + period : '');
            var res = await fetch(url, { headers: { 'Authorization': 'Bearer ' + token } });
            if (res.status === 401) { localStorage.removeItem('token'); location.href = '/auth'; return; }
            if (!res.ok) throw new Error('Failed to load analytics');
            var data = await res.json();

            animateVal(document.getElementById('salesTotalRevenue'), data.totalSales || 0);
            animateVal(document.getElementById('salesNetRevenue'), data.totalRevenue || 0);
            animateVal(document.getElementById('salesTotalOrders'), data.totalOrders || 0);
            animateVal(document.getElementById('salesCompletedOrders'), data.completedOrders || 0);
            animateVal(document.getElementById('salesPendingOrders'), data.pendingOrders || 0);
            animateVal(document.getElementById('salesRejectedOrders'), data.rejectedOrders || 0);

            renderSalesCharts(data);
        } catch (e) {
            console.error('Sales analytics error:', e);
        }
    }

    function exportSalesCsv(data) {
        var rows = [['Period', 'Total Sales', 'Net Revenue', 'Total Orders', 'Completed', 'Pending', 'Rejected']];
        rows.push(['All', data.totalSales || 0, data.totalRevenue || 0, data.totalOrders || 0, data.completedOrders || 0, data.pendingOrders || 0, data.rejectedOrders || 0]);
        rows.push([]);
        rows.push(['Monthly Sales']);
        rows.push(['Month', 'Sales', 'Orders']);
        (data.monthlySales || []).forEach(function(m) { rows.push([m._id.year + '-' + m._id.month, m.sales || 0, m.count || 0]); });
        rows.push([]);
        rows.push(['Best Selling Products']);
        rows.push(['Product', 'Quantity Sold', 'Revenue']);
        (data.bestSellingProducts || []).forEach(function(p) { rows.push([p.productName, p.totalQuantity, p.totalRevenue]); });
        var csv = rows.map(function(r) { return r.map(function(c) { var s = ('' + c).replace(/"/g, '""'); return '"' + s + '"'; }).join(','); }).join('\n');
        var blob = new Blob([csv], { type: 'text/csv' });
        var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'sales-analytics.csv'; a.click();
    }

    var lastData = null;
    var periodFilter = document.getElementById('salesPeriodFilter');
    var exportBtn = document.getElementById('exportSalesCsv');

    if (periodFilter) {
        periodFilter.addEventListener('change', function() { loadSalesAnalytics(this.value); });
    }
    if (exportBtn) {
        exportBtn.addEventListener('click', function() {
            if (lastData) exportSalesCsv(lastData);
            else {
                var p = periodFilter ? periodFilter.value : 'all';
                fetch('/api/analytics/farmer' + (p !== 'all' ? '?period=' + p : ''), { headers: { 'Authorization': 'Bearer ' + token } })
                    .then(function(r) { return r.json(); }).then(function(d) { exportSalesCsv(d); }).catch(function() {});
            }
        });
    }

    var origLoad = loadDashboardData;
    if (typeof origLoad === 'function') {
        var origLoadDashboardData = window.loadDashboardData;
    }

    setTimeout(function() { loadSalesAnalytics('all'); }, 600);
})();
