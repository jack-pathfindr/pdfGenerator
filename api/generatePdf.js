const chromium = require('@sparticuz/chromium');
const puppeteer = require('puppeteer-core');

// Optimize Chromium for Vercel
chromium.setHeadlessMode = true;
chromium.setGraphicsMode = false;

module.exports = async (req, res) => {
    const pageUrl = req.query.url;
    
    if (!pageUrl) {
        return res.status(400).json({ 
            error: 'Please provide a URL' 
        });
    }
    
    let browser = null;
    
    try {
        console.log('Starting PDF generation for:', pageUrl);
        
        // Launch browser with optimized settings for Vercel
        browser = await puppeteer.launch({
            args: [
                ...chromium.args,
                '--disable-gpu',
                '--disable-dev-shm-usage',
                '--disable-setuid-sandbox',
                '--no-first-run',
                '--no-sandbox',
                '--no-zygote',
                '--single-process'
            ],
            defaultViewport: { width: 1200, height: 800 },
            executablePath: await chromium.executablePath(),
            headless: 'new',
            ignoreHTTPSErrors: true
        });
        
        console.log('Browser launched successfully');
        
        const page = await browser.newPage();
        
        console.log('Navigating to:', pageUrl);
        
        await page.goto(pageUrl, { 
            waitUntil: ['networkidle0', 'domcontentloaded'],
            timeout: 30000 
        });
        
        console.log('Page loaded, expanding content...');
        
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
        
        // Wait for animations
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        console.log('Adding print styles...');
        
        await page.addStyleTag({
            content: `
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
                    a[href^="http"]:after { 
                        content: " (" attr(href) ")";
                        font-size: 0.8em;
                        color: #666;
                    }
                }
            `
        });
        
        console.log('Generating PDF...');
        
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
            headerTemplate: '<div></div>',
            footerTemplate: `
                <div style="font-size: 9px; text-align: center; width: 100%; color: #666; padding-top: 5px;">
                    <span class="pageNumber"></span> / <span class="totalPages"></span>
                </div>
            `,
            preferCSSPageSize: false
        });
        
        console.log('PDF generated successfully, size:', pdf.length, 'bytes');
        
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename="documentation.pdf"');
        res.setHeader('Content-Length', pdf.length);
        res.send(pdf);
        
    } catch (error) {
        console.error('PDF generation failed:', error);
        res.status(500).json({ 
            error: 'Failed to generate PDF',
            details: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    } finally {
        if (browser !== null) {
            try {
                await browser.close();
                console.log('Browser closed');
            } catch (closeError) {
                console.error('Error closing browser:', closeError);
            }
        }
    }
};
