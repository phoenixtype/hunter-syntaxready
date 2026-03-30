const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  
  await page.goto('http://localhost:8080/dashboard');
  await new Promise(r => setTimeout(r, 4000));
  
  // Try to click the first job card to open the modal
  const jobCards = await page.$$('.job-card, [data-testid="job-card"], [class*="JobCard"], div.border-border.rounded-lg');
  console.log(`Found ${jobCards.length} potential job cards`);
  
  if (jobCards.length > 0) {
    try {
      await jobCards[1].click();
      console.log('Clicked job card');
      await new Promise(r => setTimeout(r, 2000));
    } catch(e) {
      console.log('Could not click card:', e.message);
    }
  }

  await page.screenshot({ path: 'modal.png', fullPage: true });
  await browser.close();
})();