const playwright = require('playwright-core');
const chromium = require('@sparticuz/chromium');

module.exports = async (req, res) => {
    // Get the page URL from the request
    const pageUrl = req.query.url;
    
    // Check if URL was provided
    if (!pageUrl) {
        return res.status(400).json({ 
            error: 'Please provide a URL' 
        });
    }
    
    let browser;
    
    try {
        console.log('Starting browser...');
        
        // Launch browser with Vercel-compatible Chromium
        browser = await playwright.chromium.launch({
            args: chromium.args,
            executablePath: await chromium.executablePath(),
            headless: true
        });
        
        const page = await browser.newPage();
        
        // Set a good size for viewing
        await page.setViewportSize({ width: 1200, height: 800 });
        
        console.log('Loading page:', pageUrl);
        
        // Go to the page
        await page.goto(pageUrl, { 
            waitUntil: 'networkidle',
            timeout: 30000 
        });
        
        console.log('Page loaded, expanding content...');
        
        // Expand all hidden sections
        await page.evaluate(() => {
            // Click accordion buttons
            document.querySelectorAll('[aria-expanded="false"]').forEach(el => {
                try { el.click(); } catch(e) {}
            });
            
            // Open details elements
            document.querySelectorAll('details:not([open])').forEach(el => {
                el.setAttribute('open', '');
            });
            
            // Remove collapsed classes
            document.querySelectorAll('.collapsed').forEach(el => {
                el.classList.remove('collapsed');
            });
        });
        
        // Wait a moment for animations
        await page.waitForTimeout(2000);
        
        console.log('Adding print styles...');
        
        // Add styles to make it look nice in PDF
        await page.addStyleTag({
            content: `
                @media print {
                    /* Hide navigation and sidebars */
                    nav, .sidebar, header.fixed, .nav-header { 
                        display: none !important; 
                    }
                    
                    /* Make content full width */
                    main, article, .content { 
                        max-width: 100% !important;
                        margin: 0 !important;
                    }
                    
                    /* Prevent ugly breaks */
                    pre, code, img, table { 
                        page-break-inside: avoid; 
                    }
                    
                    /* Show link URLs */
                    a[href^="http"]:after { 
                        content: " (" attr(href) ")";
                        font-size: 0.8em;
                        color: #666;
                    }
                }
            `
        });
        
        console.log('Generating PDF...');
        
        // Create the PDF
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
            footerTemplate: `
                <div style="font-size: 9px; text-align: center; width: 100%; color: #666; padding-top: 5px;">
                    Page <span class="pageNumber"></span> of <span class="totalPages"></span>
                </div>
            `
        });
        
        console.log('PDF generated successfully');
        
        // Send the PDF back
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename="documentation.pdf"');
        res.send(pdf);
        
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ 
            error: 'Failed to generate PDF',
            details: error.message 
        });
    } finally {
        if (browser) {
            await browser.close();
        }
    }
};

