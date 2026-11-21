import puppeteer from 'puppeteer';
import path from 'node:path';

async function generateSocialPreview() {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 640, deviceScaleFactor: 2 });

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&family=JetBrains+Mono:wght@400;500;600&family=Plus+Jakarta+Sans:wght@600;700;800&display=swap" rel="stylesheet" />
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body {
            width: 1280px;
            height: 640px;
            background-color: #050506;
            color: #fafafa;
            font-family: 'DM Sans', sans-serif;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            padding: 64px 72px;
            border: 1px solid #27272b;
            position: relative;
            overflow: hidden;
          }
          /* Subtle background coordinate grid */
          .grid-bg {
            position: absolute;
            top: 0; left: 0; right: 0; bottom: 0;
            background-image: linear-gradient(to right, rgba(39, 39, 43, 0.4) 1px, transparent 1px),
                              linear-gradient(to bottom, rgba(39, 39, 43, 0.4) 1px, transparent 1px);
            background-size: 48px 48px;
            opacity: 0.45;
            pointer-events: none;
          }
          .header {
            position: relative;
            z-index: 2;
            display: flex;
            align-items: center;
            justify-content: space-between;
          }
          .badge {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            padding: 6px 14px;
            border-radius: 6px;
            background: #141417;
            border: 1px solid #27272b;
            font-family: 'JetBrains Mono', monospace;
            font-size: 13px;
            color: #a1a1aa;
          }
          .badge-dot {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background: #5ea885;
          }
          .content {
            position: relative;
            z-index: 2;
            max-width: 880px;
          }
          .title {
            font-family: 'Plus Jakarta Sans', sans-serif;
            font-size: 72px;
            font-weight: 800;
            letter-spacing: -0.03em;
            line-height: 1.05;
            color: #fafafa;
            margin-bottom: 20px;
          }
          .tagline {
            font-size: 24px;
            line-height: 1.45;
            color: #a1a1aa;
            font-weight: 400;
          }
          .tagline strong {
            color: #fafafa;
            font-weight: 600;
          }
          .footer {
            position: relative;
            z-index: 2;
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding-top: 24px;
            border-top: 1px solid #27272b;
          }
          .pills {
            display: flex;
            gap: 12px;
          }
          .pill {
            padding: 6px 12px;
            border-radius: 4px;
            background: rgba(255, 255, 255, 0.04);
            border: 1px solid #27272b;
            font-family: 'JetBrains Mono', monospace;
            font-size: 12px;
            color: #d4d4d8;
          }
          .math {
            font-family: 'JetBrains Mono', monospace;
            font-size: 13px;
            color: #71717a;
          }
        </style>
      </head>
      <body>
        <div class="grid-bg"></div>
        <div class="header">
          <div class="badge">
            <span class="badge-dot"></span>
            v1.0.0 &middot; Python 3.11+ &middot; Euler &amp; RK4
          </div>
          <div class="pill">Apache-2.0 Open Source</div>
        </div>
        <div class="content">
          <h1 class="title">ORBIT</h1>
          <p class="tagline">
            <strong>Open-ended Reasoning &amp; Behavior Intelligence</strong> for Simulation and Testing.
            Transform natural-language system descriptions into validated, deterministic mathematical models.
          </p>
        </div>
        <div class="footer">
          <div class="pills">
            <span class="pill">Stock &amp; Flow Dynamics</span>
            <span class="pill">AST Sandbox (Zero eval)</span>
            <span class="pill">Server-Side Gemini</span>
            <span class="pill">Cytoscape Graphs</span>
            <span class="pill">SQLite Persistence</span>
          </div>
          <div class="math">dS/dt = &Sigma; Inflows - &Sigma; Outflows</div>
        </div>
      </body>
    </html>
  `;

  await page.setContent(html, { waitUntil: 'load' });
  const outPath = path.resolve(process.cwd(), 'docs', 'assets', 'orbit_social_preview.png');
  await page.screenshot({ path: outPath });
  await browser.close();
  console.log('Generated social preview at:', outPath);
}

generateSocialPreview().catch(err => {
  console.error(err);
  process.exit(1);
});
