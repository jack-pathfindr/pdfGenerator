export const config = {
  runtime: 'edge',
};

export default async function handler(req) {
  const { searchParams } = new URL(req.url);
  const pageUrl = searchParams.get('url');
  
  if (!pageUrl) {
    return new Response(
      JSON.stringify({ error: 'Please provide a URL' }), 
      {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
  
  try {
    // Get token from environment variable
    const BROWSERLESS_TOKEN = process.env.BROWSERLESS_TOKEN;
    const SITE_PASSWORD = 'SuperchargeToday';
    
    if (!BROWSERLESS_TOKEN) {
      throw new Error('BROWSERLESS_TOKEN not configured');
    }
    
    const browserlessUrl = `https://production-sfo.browserless.io/function?token=${BROWSERLESS_TOKEN}`;
    
    // Puppeteer script to handle password authentication
    const puppeteerScript = `
export default async ({ page }) => {
  // Navigate to the page
  await page.goto('${pageUrl.replace(/'/g, "\\'")}', { 
    waitUntil: 'networkidle0',
    timeout: 30000 
  });
  
  // Check if there's a password field and fill it
  const passwordInput = await page.$('input[type="password"]');
  if (passwordInput) {
    await passwordInput.type('${SITE_PASSWORD}');
    
    // Find and click the access/submit button
    const submitButton = await page.$('button[type="submit"]') || await page.$('button');
    if (submitButton) {
      await submitButton.click();
      await page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 10000 }).catch(() => {});
    }
  }
  
  // Wait a bit for page to fully load
  await page.waitForTimeout(3000);
  
  // Expand all hidden sections
  await page.evaluate(() => {
    document.querySelectorAll('[aria-expanded="false"]').forEach(el => {
      try { el.click(); } catch(e) {}
    });
    
    document.querySelectorAll('details:not([open])').forEach(el => {
      el.setAttribute('open', '');
    });
    
    document.querySelectorAll('.collapsed').forEach(el => {
      el.classList.remove('collapsed');
    });
  });
  
  await page.waitForTimeout(2000);
  
  // Add print styles
  await page.addStyleTag({
    content: \`
      @media print {
        nav, .sidebar, header.fixed, .nav-header, footer { 
          display: none !important; 
        }
        main, article, .content { 
          max-width: 100% !important;
          margin: 0 !important;
        }
        pre, code, img, table { 
          page-break-inside: avoid; 
        }
      }
    \`
  });
  
  // Generate PDF
  const pdf = await page.pdf({
    format: 'A4',
    printBackground: true,
    margin: { 
      top: '0.75in', 
      bottom: '0.75in', 
      left: '0.6in', 
      right: '0.6in' 
    },
    displayHeaderFooter: true,
    footerTemplate: \`
      <div style="font-size: 9px; text-align: center; width: 100%; color: #666; padding-top: 5px;">
        Page <span class="pageNumber"></span> of <span class="totalPages"></span>
      </div>
    \`
  });
  
  return {
    data: pdf,
    type: 'application/pdf'
  };
};
    `;
    
    const response = await fetch(browserlessUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/javascript',
      },
      body: puppeteerScript
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Browserless returned ${response.status}: ${errorText}`);
    }
    
    const pdfBuffer = await response.arrayBuffer();
    
    return new Response(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="documentation.pdf"',
      }
    });
    
  } catch (error) {
    console.error('PDF generation error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Failed to generate PDF',
        details: error.message 
      }), 
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}
