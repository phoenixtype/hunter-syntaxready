const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: false }); // For debugging locally if you were watching, but headless: true for CI
  const page = await browser.newPage();
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log('Browser log:', msg.text());
    }
  });
  page.on('pageerror', error => {
    console.log('Page Error:', error.message);
    console.log('Page Error Stack:', error.stack);
  });
  await page.goto('http://localhost:8080/dashboard');
  await new Promise(r => setTimeout(r, 5000));
  await browser.close();
})();