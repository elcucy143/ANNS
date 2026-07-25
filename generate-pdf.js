import puppeteer from 'puppeteer';
import { PDFDocument } from 'pdf-lib';
import fs from 'fs';

const BASE_URL = 'http://localhost:5173';
const ROUTES = [
    '/',
    '/womens-wear',
    '/accessories',
    '/mens-wear',
    '/gifts',
    '/jewellery',
    '/sale',
    '/contact'
];

async function generatePdf() {
    console.log('Launching browser...');
    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const mergedPdf = await PDFDocument.create();

    try {
        for (const route of ROUTES) {
            console.log(`Processing ${route}...`);
            const page = await browser.newPage();
            await page.setViewport({ width: 1280, height: 800 }); // Desktop view

            // Navigate and wait for network idle
            await page.goto(`${BASE_URL}${route}`, { waitUntil: 'networkidle0' });

            // Add a small delay to ensure images/animations settle
            await new Promise(resolve => setTimeout(resolve, 1000));

            // Generate PDF for this page
            const pdfBuffer = await page.pdf({
                format: 'A4',
                printBackground: true,
                margin: { top: '20px', bottom: '20px' }
            });

            // Load the generated PDF
            const pagePdf = await PDFDocument.load(pdfBuffer);

            // Copy pages to merged document
            const copiedPages = await mergedPdf.copyPages(pagePdf, pagePdf.getPageIndices());
            copiedPages.forEach((page) => mergedPdf.addPage(page));

            await page.close();
        }

        // Save the merged PDF
        const pdfBytes = await mergedPdf.save();
        fs.writeFileSync('ANNS_Website.pdf', pdfBytes);
        console.log('Successfully created ANNS_Website.pdf');

    } catch (error) {
        console.error('Error generating PDF:', error);
    } finally {
        await browser.close();
    }
}

generatePdf();
