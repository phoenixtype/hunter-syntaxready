const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  
  await page.goto('http://localhost:8080/dashboard');
  await new Promise(r => setTimeout(r, 4000));
  
  await page.screenshot({ path: 'dashboard.png', fullPage: true });
  await browser.close();
})();