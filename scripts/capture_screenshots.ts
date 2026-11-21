import puppeteer from 'puppeteer';
import path from 'node:path';
import fs from 'node:fs';

const OUT_DIR = path.resolve(process.cwd(), 'docs', 'assets', 'screenshots');
fs.mkdirSync(OUT_DIR, { recursive: true });

async function run() {
  console.log('Launching headless browser...');
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });

  // 1. Landing Page
  console.log('Capturing 01_landing_page.png...');
  await page.goto('http://localhost:3000/#landing', { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 1200));
  await page.screenshot({ path: path.join(OUT_DIR, '01_landing_page.png') });

  // 2. Main Dashboard
  console.log('Capturing 02_dashboard.png...');
  await page.goto('http://localhost:3000/#dashboard', { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 1200));
  await page.screenshot({ path: path.join(OUT_DIR, '02_dashboard.png') });

  // 3. Scenario Builder
  console.log('Capturing 03_scenario_builder.png...');
  await page.goto('http://localhost:3000/#builder', { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 1200));
  await page.screenshot({ path: path.join(OUT_DIR, '03_scenario_builder.png') });

  // 4. Model Editor (Stocks & Flows)
  console.log('Capturing 04_model_editor.png...');
  await page.goto('http://localhost:3000/#editor', { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 1500));
  await page.screenshot({ path: path.join(OUT_DIR, '04_model_editor.png') });

  // 5. Dependency Graph (Click Graph tab in Model Editor)
  console.log('Capturing 06_dependency_graph.png...');
  const graphTabBtn = await page.evaluateHandle(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    return btns.find(b => b.textContent?.includes('Graph View') || b.textContent?.includes('Graph'));
  });
  if (graphTabBtn) {
    await (graphTabBtn as any).click();
    await new Promise(r => setTimeout(r, 2000));
  }
  await page.screenshot({ path: path.join(OUT_DIR, '06_dependency_graph.png') });

  // 6. Simulation Workspace
  console.log('Capturing 05_simulation_workspace.png...');
  await page.goto('http://localhost:3000/#workspace', { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 1500));
  // If run button exists and chart is not yet rendered, click "Run Simulation"
  const runBtn = await page.evaluateHandle(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    return btns.find(b => b.textContent?.includes('Run Simulation') || b.textContent?.includes('Run'));
  });
  if (runBtn) {
    try {
      await (runBtn as any).click();
      await new Promise(r => setTimeout(r, 2500));
    } catch {}
  }
  await page.screenshot({ path: path.join(OUT_DIR, '05_simulation_workspace.png') });

  // 7. Experiment Laboratory
  console.log('Capturing 07_experiment_lab.png...');
  await page.goto('http://localhost:3000/#experiments', { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 2000));
  await page.screenshot({ path: path.join(OUT_DIR, '07_experiment_lab.png') });

  // 8. Reports & Results
  console.log('Capturing 08_reports.png...');
  await page.goto('http://localhost:3000/#reports', { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 2000));
  await page.screenshot({ path: path.join(OUT_DIR, '08_reports.png') });

  // 9. Documentation
  console.log('Capturing 09_documentation.png...');
  await page.goto('http://localhost:3000/#documentation', { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 1200));
  await page.screenshot({ path: path.join(OUT_DIR, '09_documentation.png') });

  // 10. Settings Page
  console.log('Capturing 10_settings.png...');
  await page.goto('http://localhost:3000/#settings', { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 1200));
  await page.screenshot({ path: path.join(OUT_DIR, '10_settings.png') });

  await browser.close();
  console.log('All screenshots captured successfully!');
}

run().catch(err => {
  console.error('Screenshot capture failed:', err);
  process.exit(1);
});
