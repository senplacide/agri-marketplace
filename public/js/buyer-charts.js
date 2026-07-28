(function() {
    var token = localStorage.getItem('token');
    if (!token) return;
    var bCharts = {};

    function isDark() { return document.body.classList.contains('dark-mode'); }
    function chartTextColor() { return '#94a3b8'; }
    function chartGridColor() { return isDark() ? 'rgba(148,163,184,0.1)' : 'rgba(148,163,184,0.08)'; }
    function chartTooltipBg() { return isDark() ? '#334155' : '#1e293b'; }
    function chartLegendColor() { return isDark() ? '#94a3b8' : '#64748b'; }

    function tipOpts() { return { backgroundColor: chartTooltipBg(), titleColor: '#f8fafc', bodyColor: '#cbd5e1', titleFont: { size: 13, weight: '600' }, bodyFont: { size: 12 }, padding: { top: 10, bottom: 10, left: 14, right: 14 }, cornerRadius: 10, displayColors: true, boxWidth: 10, boxHeight: 10, boxPadding: 6, usePointStyle: true }; }
    function legOpts() { return { color: chartLegendColor(), font: { size: 12, weight: '500' }, padding: 20, usePointStyle: true, pointStyleWidth: 8 }; }

    function fmt(n) { return Number(n || 0).toLocaleString(); }

    function animateVal(el, target) {
        if (!el) return;
        var cur = 0;
        var inc = Math.max(1, Math.ceil(target / 50));
        var t = setInterval(function() { cur += inc; if (cur >= target) { cur = target; clearInterval(t); } el.textContent = fmt(cur); }, 18);
    }

    function destroyBC() { Object.keys(bCharts).forEach(function(k) { if (bCharts[k]) bCharts[k].destroy(); bCharts[k] = null; }); }

    function renderBuyerCharts(data) {
        destroyBC();
        var monthly = data.monthlyPurchases || [];

        if (monthly.length > 0) {
            var mLabels = monthly.map(function(m) { return new Date(m._id.year, m._id.month - 1).toLocaleString('default', { month: 'short' }); });
            var mCounts = monthly.map(function(m) { return m.count || 0; });
            var mAmounts = monthly.map(function(m) { return m.amount || 0; });

            var c1 = document.getElementById('buyerMonthlyChart');
            if (c1) {
                var g1 = c1.getContext('2d').createLinearGradient(0, 0, 0, 350);
                g1.addColorStop(0, 'rgba(21,101,192,0.25)');
                g1.addColorStop(0.6, 'rgba(21,101,192,0.05)');
                g1.addColorStop(1, 'rgba(21,101,192,0)');
                bCharts.monthly = new Chart(c1, {
                    type: 'line',
                    data: { labels: mLabels, datasets: [{ label: 'Orders', data: mCounts, borderColor: '#1565c0', backgroundColor: g1, fill: true, tension: 0.4, borderWidth: 2.5, pointRadius: 5, pointHoverRadius: 8, pointBackgroundColor: '#fff', pointBorderColor: '#1565c0', pointBorderWidth: 2.5, pointHoverBackgroundColor: '#1565c0', pointHoverBorderColor: '#fff', pointHoverBorderWidth: 2.5 }] },
                    options: { responsive: true, maintainAspectRatio: false, animation: { duration: 1400, easing: 'easeOutQuart' }, plugins: { legend: { display: true, labels: legOpts() }, tooltip: tipOpts() }, scales: { x: { border: { display: false }, grid: { display: false }, ticks: { color: chartTextColor(), font: { size: 11 } } }, y: { beginAtZero: true, border: { display: false }, ticks: { stepSize: 1, color: chartTextColor(), font: { size: 11 } }, grid: { color: chartGridColor(), drawBorder: false } } } }
                });
            }

            var c2 = document.getElementById('buyerSpendingChart');
            if (c2) {
                var g2 = c2.getContext('2d').createLinearGradient(0, 0, 0, 350);
                g2.addColorStop(0, 'rgba(142,68,173,0.25)');
                g2.addColorStop(0.6, 'rgba(142,68,173,0.05)');
                g2.addColorStop(1, 'rgba(142,68,173,0)');
                bCharts.spending = new Chart(c2, {
                    type: 'bar',
                    data: { labels: mLabels, datasets: [{ label: 'Amount Spent (RWF)', data: mAmounts, backgroundColor: g2, borderRadius: 8, borderSkipped: false, maxBarThickness: 56 }] },
                    options: { responsive: true, maintainAspectRatio: false, animation: { duration: 1200, easing: 'easeOutQuart' }, plugins: { legend: { display: false }, tooltip: tipOpts() }, scales: { x: { border: { display: false }, grid: { display: false }, ticks: { color: chartTextColor(), font: { size: 11 } } }, y: { beginAtZero: true, border: { display: false }, ticks: { color: chartTextColor(), font: { size: 11 } }, grid: { color: chartGridColor(), drawBorder: false } } } }
                });
            }
        } else {
            ['buyerMonthlyChart', 'buyerSpendingChart'].forEach(function(id) {
                var el = document.getElementById(id);
                if (el) { el.style.display = 'none'; var p = el.closest('.chart-card'); if (p && !p.querySelector('.empty-state')) p.insertAdjacentHTML('beforeend', '<div class="empty-state"><span class="empty-state-icon">📊</span><span class="empty-state-text">No purchase data yet.</span></div>'); }
            });
        }
    }

    async function loadBuyerAnalytics(period) {
        try {
            var url = '/api/analytics/buyer' + (period && period !== 'all' ? '?period=' + period : '');
            var res = await fetch(url, { headers: { 'Authorization': 'Bearer ' + token } });
            if (res.status === 401) { localStorage.removeItem('token'); location.href = '/auth'; return; }
            if (!res.ok) throw new Error('Failed to load analytics');
            var data = await res.json();

            animateVal(document.getElementById('bTotalOrders'), data.totalOrders || 0);
            animateVal(document.getElementById('bCompletedOrders'), data.completedOrders || 0);
            animateVal(document.getElementById('bPendingOrders'), data.pendingOrders || 0);
            animateVal(document.getElementById('bTotalSpent'), data.totalAmountSpent || 0);

            renderBuyerCharts(data);
        } catch (e) { console.error('Buyer analytics error:', e); }
    }

    function exportBuyerCsv(data) {
        var rows = [['Metric', 'Value']];
        rows.push(['Total Orders', data.totalOrders || 0]);
        rows.push(['Completed Orders', data.completedOrders || 0]);
        rows.push(['Pending Orders', data.pendingOrders || 0]);
        rows.push(['Total Spent (RWF)', data.totalAmountSpent || 0]);
        rows.push([]);
        rows.push(['Month', 'Orders', 'Amount (RWF)']);
        (data.monthlyPurchases || []).forEach(function(m) { rows.push([m._id.year + '-' + m._id.month, m.count || 0, m.amount || 0]); });
        var csv = rows.map(function(r) { return r.map(function(c) { var s = ('' + c).replace(/"/g, '""'); return '"' + s + '"'; }).join(','); }).join('\n');
        var blob = new Blob([csv], { type: 'text/csv' });
        var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'purchase-analytics.csv'; a.click();
    }

    var bf = document.getElementById('buyerPeriodFilter');
    var be = document.getElementById('exportBuyerCsv');
    if (bf) bf.addEventListener('change', function() { loadBuyerAnalytics(this.value); });
    if (be) be.addEventListener('click', function() {
        var p = bf ? bf.value : 'all';
        fetch('/api/analytics/buyer' + (p !== 'all' ? '?period=' + p : ''), { headers: { 'Authorization': 'Bearer ' + token } })
            .then(function(r) { return r.json(); }).then(function(d) { exportBuyerCsv(d); }).catch(function() {});
    });

    setTimeout(function() { loadBuyerAnalytics('all'); }, 600);
})();
