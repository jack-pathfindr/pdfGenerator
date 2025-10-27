const chrome = require('chrome-aws-lambda');
const puppeteer = require('puppeteer-core');

module.exports = async (req, res) => {
    const pageUrl = req.query.url;
    
    if (!pageUrl) {
        return res.status(400).json({ 
            error: 'Please provide a URL' 
        });
    }
    
    let browser = null;
    
    try {
        console.log('Launching browser...');
        
        browser = await puppeteer.launch({
            args: chrome.args,
            executablePath: await chrome.executablePath,
            headless: chrome.headless
        });
        
        const page = await browser.newPage();
        
        await page.setViewport({ width: 1200, height: 800 });
        
        console.log('Loading page:', pageUrl);
        
        await page.goto(pageUrl, { 
            waitUntil: 'networkidle0',
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
        
        await page.waitForTimeout(2000);
        
        console.log('Adding print styles...');
        
        await page.addStyleTag({
            content: `
                @media print {
                    nav, .sidebar, header.fixed, .nav-header { 
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
            footerTemplate: `
                <div style="font-size: 9px; text-align: center; width: 100%; color: #666; padding-top: 5px;">
                    Page <span class="pageNumber"></span> of <span class="totalPages"></span>
                </div>
            `
        });
        
        console.log('PDF generated successfully');
        
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
        if (browser !== null) {
            await browser.close();
        }
    }
};
