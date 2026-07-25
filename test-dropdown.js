const http = require('http');
const fs = require('fs');

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const { spawn } = require('child_process');

function httpGet(url) {
    return new Promise((resolve, reject) => {
        http.get(url, res => {
            let d = '';
            res.on('data', c => d += c);
            res.on('end', () => resolve(JSON.parse(d)));
        }).on('error', reject);
    });
}

function httpGetText(url) {
    return new Promise((resolve, reject) => {
        http.get(url, res => {
            let d = '';
            res.on('data', c => d += c);
            res.on('end', () => resolve(d));
        }).on('error', reject);
    });
}

async function main() {
    const port = 9223;
    const userDataDir = process.TEMP + '\\chrome-dd-test-' + Date.now();

    console.log('Launching Chrome headless...');
    const chrome = spawn(CHROME, [
        '--headless=new',
        '--disable-gpu',
        '--no-sandbox',
        `--remote-debugging-port=${port}`,
        `--user-data-dir=${userDataDir}`,
        '--disable-extensions',
        'about:blank'
    ], { stdio: 'ignore' });

    chrome.on('error', (e) => console.log('Chrome error:', e.message));

    // Wait for Chrome to start
    await new Promise(r => setTimeout(r, 4000));

    const pages = [
        { name: 'Buyer Dashboard', url: 'http://localhost:5000/buyer-dashboard' },
        { name: 'Farmer Dashboard', url: 'http://localhost:5000/dashboard' },
        { name: 'Admin Dashboard', url: 'http://localhost:5000/admin.html' },
    ];

    for (const pg of pages) {
        console.log(`\n${'='.repeat(60)}`);
        console.log(`TESTING: ${pg.name}`);
        console.log(`${'='.repeat(60)}`);

        try {
            const targets = await httpGet(`http://127.0.0.1:${port}/json`);
            const pageTarget = targets.find(t => t.type === 'page');
            if (!pageTarget) { console.log('No page target'); continue; }

            // Connect via WebSocket using ws module
            const WebSocket = require('ws');
            const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);

            await new Promise((resolve, reject) => {
                ws.on('open', resolve);
                ws.on('error', reject);
            });

            let msgId = 1;
            function sendCommand(method, params) {
                return new Promise((resolve, reject) => {
                    const id = msgId++;
                    const handler = (data) => {
                        const msg = JSON.parse(data);
                        if (msg.id === id) {
                            ws.removeListener('message', handler);
                            resolve(msg);
                        }
                    };
                    ws.on('message', handler);
                    ws.send(JSON.stringify({ id, method, params }));
                    setTimeout(() => { ws.removeListener('message', handler); reject(new Error('timeout')); }, 10000);
                });
            }

            // Enable page events
            await sendCommand('Page.enable', {});
            await sendCommand('Runtime.enable', {});

            // Navigate
            await sendCommand('Page.navigate', { url: pg.url });

            // Wait for page load
            await new Promise(r => setTimeout(r, 5000));

            // Execute test script
            const evalResult = await sendCommand('Runtime.evaluate', {
                expression: `
(function() {
    var output = [];
    
    var dd = document.getElementById('profileDropdown');
    var trigger = document.getElementById('profileTrigger');
    var menu = document.getElementById('profileMenu');
    
    output.push('=== ELEMENT CHECK ===');
    output.push('profileDropdown: ' + (dd ? 'FOUND (' + dd.tagName + ')' : 'MISSING'));
    output.push('profileTrigger: ' + (trigger ? 'FOUND (' + trigger.tagName + ')' : 'MISSING'));
    output.push('profileMenu: ' + (menu ? 'FOUND (' + menu.tagName + ')' : 'MISSING'));
    
    if (!dd || !trigger || !menu) {
        output.push('ABORT: Missing elements');
        return output.join('\\n');
    }
    
    output.push('\\n=== INITIAL STATE ===');
    output.push('dd classes: "' + dd.className + '"');
    output.push('dd id: ' + dd.id);
    
    var cs = window.getComputedStyle(menu);
    output.push('menu computed:');
    output.push('  display=' + cs.display);
    output.push('  visibility=' + cs.visibility);
    output.push('  opacity=' + cs.opacity);
    output.push('  pointer-events=' + cs.pointerEvents);
    output.push('  z-index=' + cs.zIndex);
    output.push('  position=' + cs.position);
    output.push('  transform=' + cs.transform);
    
    // Check parent overflow chain
    output.push('\\n=== PARENT OVERFLOW CHAIN ===');
    var el = dd;
    var depth = 0;
    while (el && el !== document.documentElement && depth < 20) {
        var cel = window.getComputedStyle(el);
        var ovf = cel.overflow + '|' + cel.overflowX + '|' + cel.overflowY;
        if (ovf !== 'visible|visible|visible') {
            output.push('  ' + el.tagName + (el.id ? '#' + el.id : '') + (el.className ? '.' + String(el.className).substring(0,25) : '') + ' => overflow: ' + cel.overflow + ' ox:' + cel.overflowX + ' oy:' + cel.overflowY);
        }
        el = el.parentElement;
        depth++;
    }
    
    // Check position chain
    output.push('\\n=== POSITION CHAIN ===');
    el = dd;
    depth = 0;
    while (el && el !== document.documentElement && depth < 20) {
        var cel2 = window.getComputedStyle(el);
        if (cel2.position !== 'static') {
            var info = el.tagName + (el.id ? '#' + el.id : '') + ' => position:' + cel2.position;
            if (cel2.zIndex !== 'auto') info += ' z:' + cel2.zIndex;
            if (cel2.transform !== 'none') info += ' transform:' + cel2.transform;
            if (cel2.opacity !== '1') info += ' opacity:' + cel2.opacity;
            if (cel2.contain !== 'none') info += ' contain:' + cel2.contain;
            output.push('  ' + info);
        }
        el = el.parentElement;
        depth++;
    }
    
    // Click the trigger
    output.push('\\n=== CLICK TEST ===');
    output.push('Before click - dd classes: "' + dd.className + '"');
    
    trigger.click();
    
    output.push('After click - dd classes: "' + dd.className + '"');
    output.push('open class present: ' + dd.classList.contains('open'));
    
    if (dd.classList.contains('open')) {
        var cs2 = window.getComputedStyle(menu);
        output.push('Menu after open:');
        output.push('  display=' + cs2.display);
        output.push('  visibility=' + cs2.visibility);
        output.push('  opacity=' + cs2.opacity);
        output.push('  z-index=' + cs2.zIndex);
        
        var rect = menu.getBoundingClientRect();
        output.push('  rect: top=' + Math.round(rect.top) + ' left=' + Math.round(rect.left) + ' w=' + Math.round(rect.width) + ' h=' + Math.round(rect.height));
        
        var tRect = trigger.getBoundingClientRect();
        output.push('  trigger rect: top=' + Math.round(tRect.top) + ' left=' + Math.round(tRect.left) + ' w=' + Math.round(tRect.width) + ' h=' + Math.round(tRect.height));
        
        // Check elementFromPoint
        var checkPoints = [
            [tRect.left + tRect.width/2, tRect.bottom + 5, 'below trigger'],
            [tRect.left + tRect.width/2, tRect.top - 5, 'above trigger'],
        ];
        for (var cp of checkPoints) {
            var efp = document.elementFromPoint(cp[0], cp[1]);
            if (efp) {
                output.push('  elementFromPoint(' + cp[2] + '): ' + efp.tagName + (efp.id ? '#' + efp.id : '') + (efp.className ? '.' + String(efp.className).substring(0,30) : ''));
            }
        }
    } else {
        output.push('WARNING: open class NOT present after click!');
        
        // Check if there's an error in console
        output.push('Checking if class was removed immediately...');
        
        // Try again with observer
        dd.classList.add('open');
        output.push('Manually added open. Classes: "' + dd.className + '"');
        
        var cs3 = window.getComputedStyle(menu);
        output.push('Menu display after manual add: ' + cs3.display);
        output.push('Menu visibility after manual add: ' + cs3.visibility);
        output.push('Menu opacity after manual add: ' + cs3.opacity);
    }
    
    return output.join('\\n');
})()
`,
                returnByValue: true,
                awaitPromise: false
            });

            if (evalResult.result && evalResult.result.result) {
                console.log(evalResult.result.result.value || JSON.stringify(evalResult.result.result));
            } else {
                console.log('Eval error:', JSON.stringify(evalResult.result || evalResult));
            }

            ws.close();
        } catch (e) {
            console.log('Error testing ' + pg.name + ':', e.message);
        }
    }

    // Cleanup
    chrome.kill();
    try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch(e) {}
    
    console.log('\n' + '='.repeat(60));
    console.log('ALL TESTS COMPLETE');
}

main().catch(e => { console.error(e); process.exit(1); });
