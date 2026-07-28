(function() {
    var token = localStorage.getItem('token');
    if (!token) return;
    var aCharts = {};

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

    function destroyAC() { Object.keys(aCharts).forEach(function(k) { if (aCharts[k]) aCharts[k].destroy(); aCharts[k] = null; }); }

    var categoryColors = ['#16a34a', '#1565c0', '#e67e22', '#8e44ad', '#d32f2f', '#0288d1', '#fbbf24', '#6366f1', '#ec4899', '#14b8a6'];

    function renderAdminCharts(data) {
        destroyAC();

        var revenueByMonth = data.revenueByMonth || [];
        var monthlyOrders = data.monthlyOrders || [];
        var salesByCategory = data.salesByCategory || [];
        var mostPurchased = data.mostPurchasedProducts || [];

        if (revenueByMonth.length > 0) {
            var rLabels = revenueByMonth.map(function(m) { return new Date(m._id.year, m._id.month - 1).toLocaleString('default', { month: 'short' }); });
            var rData = revenueByMonth.map(function(m) { return m.revenue || 0; });
            var rc = document.getElementById('adminRevenueChart');
            if (rc) {
                var rg = rc.getContext('2d').createLinearGradient(0, 0, 0, 350);
                rg.addColorStop(0, 'rgba(22,163,74,0.25)');
                rg.addColorStop(0.6, 'rgba(22,163,74,0.05)');
                rg.addColorStop(1, 'rgba(22,163,74,0)');
                aCharts.revenue = new Chart(rc, {
                    type: 'line',
                    data: { labels: rLabels, datasets: [{ label: 'Revenue (RWF)', data: rData, borderColor: '#16a34a', backgroundColor: rg, fill: true, tension: 0.4, borderWidth: 2.5, pointRadius: 5, pointHoverRadius: 8, pointBackgroundColor: '#fff', pointBorderColor: '#16a34a', pointBorderWidth: 2.5, pointHoverBackgroundColor: '#16a34a', pointHoverBorderColor: '#fff', pointHoverBorderWidth: 2.5 }] },
                    options: { responsive: true, maintainAspectRatio: false, animation: { duration: 1400, easing: 'easeOutQuart' }, plugins: { legend: { display: true, labels: legOpts() }, tooltip: tipOpts() }, scales: { x: { border: { display: false }, grid: { display: false }, ticks: { color: chartTextColor(), font: { size: 11 } } }, y: { beginAtZero: true, border: { display: false }, ticks: { color: chartTextColor(), font: { size: 11 } }, grid: { color: chartGridColor(), drawBorder: false } } } }
                });
            }
        }

        if (monthlyOrders.length > 0) {
            var oLabels = monthlyOrders.map(function(m) { return new Date(m._id.year, m._id.month - 1).toLocaleString('default', { month: 'short' }); });
            var oData = monthlyOrders.map(function(m) { return m.count || 0; });
            var oc = document.getElementById('adminOrdersMonthChart');
            if (oc) {
                var og = oc.getContext('2d').createLinearGradient(0, 0, 0, 350);
                og.addColorStop(0, '#1565c0');
                og.addColorStop(1, 'rgba(21,101,192,0.3)');
                aCharts.ordersMonth = new Chart(oc, {
                    type: 'bar',
                    data: { labels: oLabels, datasets: [{ label: 'Orders', data: oData, backgroundColor: og, borderRadius: 8, borderSkipped: false, maxBarThickness: 56 }] },
                    options: { responsive: true, maintainAspectRatio: false, animation: { duration: 1200, easing: 'easeOutQuart' }, plugins: { legend: { display: false }, tooltip: tipOpts() }, scales: { x: { border: { display: false }, grid: { display: false }, ticks: { color: chartTextColor(), font: { size: 11 } } }, y: { beginAtZero: true, border: { display: false }, ticks: { stepSize: 1, color: chartTextColor(), font: { size: 11 } }, grid: { color: chartGridColor(), drawBorder: false } } } }
                });
            }
        }

        if (salesByCategory.length > 0) {
            var catLabels = salesByCategory.map(function(c) { return c.category; });
            var catData = salesByCategory.map(function(c) { return c.revenue || 0; });
            var cc = document.getElementById('adminCategoryChart');
            if (cc) {
                aCharts.category = new Chart(cc, {
                    type: 'doughnut',
                    data: { labels: catLabels, datasets: [{ data: catData, backgroundColor: categoryColors.slice(0, catLabels.length), borderWidth: 2, borderColor: isDark() ? '#1e293b' : '#fff', hoverOffset: 6 }] },
                    options: { responsive: true, maintainAspectRatio: false, animation: { duration: 1200, easing: 'easeOutQuart' }, cutout: '60%', plugins: { legend: { position: 'bottom', labels: legOpts() }, tooltip: tipOpts() } }
                });
            }
        }

        if (mostPurchased.length > 0) {
            var pLabels = mostPurchased.map(function(p) { return p.productName; });
            var pData = mostPurchased.map(function(p) { return p.totalQuantity; });
            var pc = document.getElementById('adminTopProductsChart');
            if (pc) {
                var pg = pc.getContext('2d').createLinearGradient(0, 0, 0, 350);
                pg.addColorStop(0, '#e67e22');
                pg.addColorStop(1, 'rgba(230,126,34,0.3)');
                aCharts.topProducts = new Chart(pc, {
                    type: 'bar',
                    data: { labels: pLabels, datasets: [{ label: 'Quantity Sold', data: pData, backgroundColor: pg, borderRadius: 8, borderSkipped: false, maxBarThickness: 56 }] },
                    options: { responsive: true, maintainAspectRatio: false, animation: { duration: 1200, easing: 'easeOutQuart' }, plugins: { legend: { display: false }, tooltip: tipOpts() }, scales: { x: { border: { display: false }, grid: { display: false }, ticks: { color: chartTextColor(), font: { size: 11 }, maxRotation: 45 } }, y: { beginAtZero: true, border: { display: false }, ticks: { stepSize: 1, color: chartTextColor(), font: { size: 11 } }, grid: { color: chartGridColor(), drawBorder: false } } } }
                });
            }
        }

        var ft = document.getElementById('adminTopFarmersTable');
        if (ft) {
            var farmers = data.topFarmers || [];
            if (farmers.length === 0) { ft.innerHTML = '<tr><td colspan="3"><div class="empty-state"><span class="empty-state-text">No farmer data yet.</span></div></td></tr>'; }
            else {
                ft.innerHTML = farmers.map(function(f) {
                    return '<tr><td><strong>' + (f.name || 'Unknown') + '</strong></td><td>' + (f.orderCount || 0) + '</td><td><strong>' + fmt(f.totalSales) + ' RWF</strong></td></tr>';
                }).join('');
            }
        }

        var bt = document.getElementById('adminTopBuyersTable');
        if (bt) {
            var buyers = data.topBuyers || [];
            if (buyers.length === 0) { bt.innerHTML = '<tr><td colspan="3"><div class="empty-state"><span class="empty-state-text">No buyer data yet.</span></div></td></tr>'; }
            else {
                bt.innerHTML = buyers.map(function(b) {
                    return '<tr><td><strong>' + (b.name || 'Unknown') + '</strong></td><td>' + (b.orderCount || 0) + '</td><td><strong>' + fmt(b.totalSpent) + ' RWF</strong></td></tr>';
                }).join('');
            }
        }
    }

    async function loadAdminAnalytics(period) {
        try {
            var url = '/api/analytics/admin' + (period && period !== 'all' ? '?period=' + period : '');
            var res = await fetch(url, { headers: { 'Authorization': 'Bearer ' + token } });
            if (res.status === 401) { localStorage.removeItem('token'); location.href = '/auth'; return; }
            if (!res.ok) throw new Error('Failed to load analytics');
            var data = await res.json();

            animateVal(document.getElementById('aTotalOrders'), data.totalOrders || 0);
            animateVal(document.getElementById('aRevenue'), data.marketplaceRevenue || 0);

            renderAdminCharts(data);
        } catch (e) { console.error('Admin analytics error:', e); }
    }

    function exportAdminCsv(data) {
        var rows = [['Metric', 'Value']];
        rows.push(['Total Orders', data.totalOrders || 0]);
        rows.push(['Marketplace Revenue (RWF)', data.marketplaceRevenue || 0]);
        rows.push([]);
        rows.push(['Monthly Revenue']);
        rows.push(['Month', 'Revenue (RWF)']);
        (data.revenueByMonth || []).forEach(function(m) { rows.push([m._id.year + '-' + m._id.month, m.revenue || 0]); });
        rows.push([]);
        rows.push(['Sales by Category']);
        rows.push(['Category', 'Revenue (RWF)', 'Orders']);
        (data.salesByCategory || []).forEach(function(c) { rows.push([c.category, c.revenue || 0, c.count || 0]); });
        rows.push([]);
        rows.push(['Top Farmers']);
        rows.push(['Farmer', 'Orders', 'Sales (RWF)']);
        (data.topFarmers || []).forEach(function(f) { rows.push([f.name, f.orderCount || 0, f.totalSales || 0]); });
        rows.push([]);
        rows.push(['Top Buyers']);
        rows.push(['Buyer', 'Orders', 'Spent (RWF)']);
        (data.topBuyers || []).forEach(function(b) { rows.push([b.name, b.orderCount || 0, b.totalSpent || 0]); });
        var csv = rows.map(function(r) { return r.map(function(c) { var s = ('' + c).replace(/"/g, '""'); return '"' + s + '"'; }).join(','); }).join('\n');
        var blob = new Blob([csv], { type: 'text/csv' });
        var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'admin-order-analytics.csv'; a.click();
    }

    var apf = document.getElementById('adminPeriodFilter');
    var aeb = document.getElementById('exportAdminAnalyticsCsv');
    if (apf) apf.addEventListener('change', function() { loadAdminAnalytics(this.value); });
    if (aeb) aeb.addEventListener('click', function() {
        var p = apf ? apf.value : 'all';
        fetch('/api/analytics/admin' + (p !== 'all' ? '?period=' + p : ''), { headers: { 'Authorization': 'Bearer ' + token } })
            .then(function(r) { return r.json(); }).then(function(d) { exportAdminCsv(d); }).catch(function() {});
    });

    setTimeout(function() { loadAdminAnalytics('all'); }, 600);
})();
