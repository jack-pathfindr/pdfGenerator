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
    // Use Browserless.io free tier for PDF generation
    const browserlessUrl = 'https://chrome.browserless.io/pdf';
    
    const response = await fetch(browserlessUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: pageUrl,
        options: {
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
        },
        gotoOptions: {
          waitUntil: 'networkidle0',
          timeout: 30000
        }
      })
    });
    
    if (!response.ok) {
      throw new Error(`PDF service returned ${response.status}`);
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
