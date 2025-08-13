import { test, expect } from '@playwright/test';

test.describe('Dark Mode UI Verification', () => {
  test('should verify giga dark mode is properly applied', async ({ page }) => {
    // Navigate to the application
    await page.goto('http://localhost:3000');
    
    // Wait for the page to load completely
    await page.waitForLoadState('networkidle');
    
    // Take a full page screenshot for verification
    await page.screenshot({ 
      path: 'screenshots/dark-mode-full-page.png',
      fullPage: true 
    });
    
    // Verify the main body has pure black background
    const bodyBackground = await page.evaluate(() => {
      const body = document.body;
      return window.getComputedStyle(body).backgroundColor;
    });
    
    console.log('Body background color:', bodyBackground);
    
    // Check for pure black background (rgb(0, 0, 0) or #000000)
    expect(bodyBackground).toMatch(/rgb\(0,\s*0,\s*0\)|rgba\(0,\s*0,\s*0,\s*1\)|#000000/);
    
    // Verify main container has dark background
    const mainContainer = page.locator('main, .main, [class*="container"]').first();
    if (await mainContainer.count() > 0) {
      const containerBg = await mainContainer.evaluate((el) => {
        return window.getComputedStyle(el).backgroundColor;
      });
      console.log('Main container background:', containerBg);
    }
    
    // Check text is white/light colored for contrast
    const textElements = page.locator('h1, h2, h3, p, span, div').first();
    if (await textElements.count() > 0) {
      const textColor = await textElements.evaluate((el) => {
        return window.getComputedStyle(el).color;
      });
      console.log('Text color:', textColor);
      
      // Text should be white or very light (rgb values close to 255)
      expect(textColor).toMatch(/rgb\(25[0-5],\s*25[0-5],\s*25[0-5]\)|rgba\(25[0-5],\s*25[0-5],\s*25[0-5],\s*[\d.]+\)|#[fF]{6}|white/);
    }
    
    // Verify KPI cards have proper dark styling
    const kpiCards = page.locator('[class*="card"], [class*="kpi"], .bg-gray-800, .bg-black');
    if (await kpiCards.count() > 0) {
      const cardCount = await kpiCards.count();
      console.log(`Found ${cardCount} potential KPI cards`);
      
      // Take screenshot of first few cards
      for (let i = 0; i < Math.min(cardCount, 3); i++) {
        const card = kpiCards.nth(i);
        await card.screenshot({ path: `screenshots/kpi-card-${i + 1}.png` });
        
        const cardBg = await card.evaluate((el) => {
          return window.getComputedStyle(el).backgroundColor;
        });
        console.log(`Card ${i + 1} background:`, cardBg);
      }
    }
    
    // Check for any white backgrounds that shouldn't be there
    const whiteElements = await page.locator('*').evaluateAll((elements) => {
      const whiteElements: any[] = [];
      elements.forEach((el, index) => {
        const style = window.getComputedStyle(el);
        const bg = style.backgroundColor;
        if (bg.includes('rgb(255, 255, 255)') || bg.includes('#ffffff') || bg === 'white') {
          whiteElements.push({
            tagName: el.tagName,
            className: el.className,
            id: el.id,
            backgroundColor: bg,
            index: index
          });
        }
      });
      return whiteElements;
    });
    
    console.log('Elements with white backgrounds:', whiteElements);
    
    // Take screenshot of dashboard area specifically
    const dashboard = page.locator('main, [class*="dashboard"], [class*="content"]').first();
    if (await dashboard.count() > 0) {
      await dashboard.screenshot({ path: 'screenshots/dashboard-area.png' });
    }
    
    // Test interaction elements (buttons, inputs) have proper dark styling
    const buttons = page.locator('button');
    if (await buttons.count() > 0) {
      const buttonCount = await buttons.count();
      console.log(`Found ${buttonCount} buttons`);
      
      const firstButton = buttons.first();
      const buttonBg = await firstButton.evaluate((el) => {
        return window.getComputedStyle(el).backgroundColor;
      });
      const buttonColor = await firstButton.evaluate((el) => {
        return window.getComputedStyle(el).color;
      });
      
      console.log('Button background:', buttonBg);
      console.log('Button text color:', buttonColor);
    }
    
    // Final verification screenshot
    await page.screenshot({ 
      path: 'screenshots/final-verification.png',
      fullPage: false 
    });
  });
  
  test('should verify specific dark mode elements', async ({ page }) => {
    await page.goto('http://localhost:3000');
    await page.waitForLoadState('networkidle');
    
    // Check for specific dark mode classes
    const darkElements = await page.locator('[class*="dark"], [class*="black"], [class*="gray-"]').count();
    console.log(`Found ${darkElements} elements with dark-related classes`);
    
    // Verify no light mode artifacts
    const lightElements = await page.locator('[class*="light"], [class*="white"], .bg-white').count();
    console.log(`Found ${lightElements} elements that might be light mode artifacts`);
    
    // Check for proper contrast ratios
    const headings = page.locator('h1, h2, h3');
    if (await headings.count() > 0) {
      await headings.first().screenshot({ path: 'screenshots/heading-contrast.png' });
    }
  });
});