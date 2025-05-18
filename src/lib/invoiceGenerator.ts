import { PDFDocument, StandardFonts, rgb, PDFFont, RGB } from 'pdf-lib';
import type { Sale, SaleItem, Customer, HarvestLog, PlantingLog, Crop, SeedBatch, Invoice } from './db';
import { db } from './db';
import { saveAs } from 'file-saver';
import { APP_NAME, KK_BIOFRESH_INFO } from '@/config'; // Using alias, assuming config.ts will be moved

// Removed Unused CompanyInfo interface

async function getFullSaleDetails(saleId: string) {
    const sale = await db.sales.get(saleId);
    if (!sale) throw new Error("Sale not found for invoice generation.");

    const items = await db.saleItems.where('sale_id').equals(saleId).and(item => item.is_deleted !== 1).toArray();
    let customer: Customer | undefined;
    if (sale.customer_id) {
        customer = await db.customers.get(sale.customer_id);
        if (customer?.is_deleted === 1) customer = undefined; // Treat soft-deleted customer as not found for invoice
    }

const detailedItems = await Promise.all(items.map(async (item) => {
        let productName = 'Unknown Product';
        let productDetails = '';
        if (item.harvest_log_id) {
            const harvestLog = await db.harvestLogs.where({id: item.harvest_log_id, is_deleted: 0}).first();
            if (harvestLog) {
                const plantingLog = await db.plantingLogs.where({id: harvestLog.planting_log_id, is_deleted: 0}).first();
                if (plantingLog && plantingLog.seed_batch_id) {
                    const seedBatch = await db.seedBatches.where({id: plantingLog.seed_batch_id, is_deleted: 0}).first();
                    if (seedBatch) {
                        const crop = await db.crops.where({id: seedBatch.crop_id, is_deleted: 0}).first();
                        productName = crop?.name || 'Unknown Crop';
                        productDetails = `(Batch: ${seedBatch.batch_code}, Harvested: ${new Date(harvestLog.harvest_date).toLocaleDateString()})`;
                    }
                }
            }
        }
        return {
            ...item,
            productName,
            productDetails
        };
    }));

    return { sale, items: detailedItems, customer };
}

export async function generateInvoicePDFBytes(saleId: string): Promise<Uint8Array> {
    const { sale, items, customer } = await getFullSaleDetails(saleId);
    const invoiceRecord = await db.invoices.where('sale_id').equals(saleId).and(inv => inv.is_deleted !== 1).first();

    if (!invoiceRecord) {
        throw new Error("Invoice record not found for this sale.");
    }

    const pdfDoc = await PDFDocument.create();
    let page = pdfDoc.addPage([612, 792]); // Standard US Letter size, declare with let
    const { width, height } = page.getSize();
    
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    
    let logoImage;
    try {
        const logoBytes = await fetch('/logo.png').then(res => res.arrayBuffer());
        logoImage = await pdfDoc.embedPng(logoBytes);
    } catch (e) {
        console.warn("logo.png not found or could not be embedded:", e);
    }

    let y = height - 40; // Adjusted top margin
    const margin = 40;
    // const contentWidth = width - 2 * margin; // Removed unused variable
    const lineheight = 18;
    const smallLineHeight = 14;

    // Helper to draw text
    const drawText = (text: string, x: number, currentY: number, options?: { font?: PDFFont, size?: number, color?: RGB }) => {
        page.drawText(text, {
            x,
            y: currentY,
            font: options?.font || font,
            size: options?.size || 10,
            color: options?.color || rgb(0, 0, 0),
        });
        return currentY - (options?.size || 10) * 1.2; // Adjust Y for next line
    };
    
// Helper function to split text if it's too wide (simple version)
const splitTextToFit = (text: string, maxWidth: number, textFont: PDFFont, textSize: number): string[] => {
    const lines: string[] = [];
    let currentLine = "";
    const words = text.split(' ');

    for (const word of words) {
        const testLine = currentLine + (currentLine ? " " : "") + word;
        if (textFont.widthOfTextAtSize(testLine, textSize) > maxWidth && currentLine) {
            lines.push(currentLine);
            currentLine = word;
        } else {
            currentLine = testLine;
        }
    }
    if (currentLine) {
        lines.push(currentLine);
    }
    return lines.length > 0 ? lines : [text]; // Return original text if no split needed or if it's a single very long word
};
    // Header Section
    const fixedLogoWidth = 75;
    const logoPadding = 15;
    const companyInfoX = margin + (logoImage ? fixedLogoWidth + logoPadding : 0);
    const invoiceDetailsApproxWidth = 180; // Approximate width for invoice details block
    const headerRightX = width - margin - invoiceDetailsApproxWidth;

    if (logoImage) {
        const scaleFactor = fixedLogoWidth / logoImage.width;
        const logoDims = {
            width: fixedLogoWidth,
            height: logoImage.height * scaleFactor,
        };
        page.drawImage(logoImage, {
            x: margin,
            y: y - logoDims.height + 10,
            width: logoDims.width,
            height: logoDims.height,
        });
    }
    
    let companyInfoY = y;
    // App Name and Company Details
    // Ensure companyInfoX provides enough space and doesn't overlap with headerRightX
    const maxCompanyInfoWidth = headerRightX - companyInfoX - 10; // 10 for some padding

    // Draw App Name, potentially wrapping if too long (manual wrap for simplicity)
    const appNameSize = 12; // Reduced size for app name
    const appNameLines = splitTextToFit(APP_NAME, maxCompanyInfoWidth, boldFont, appNameSize);
    appNameLines.forEach(line => {
        companyInfoY = drawText(line, companyInfoX, companyInfoY, { font: boldFont, size: appNameSize });
    });
    
    companyInfoY -= 2;
    companyInfoY = drawText(KK_BIOFRESH_INFO.name, companyInfoX, companyInfoY, { font: boldFont, size: 10 }); // Reduced size
    if (KK_BIOFRESH_INFO.addressLine1) companyInfoY = drawText(KK_BIOFRESH_INFO.addressLine1, companyInfoX, companyInfoY, { size: 8 });
    if (KK_BIOFRESH_INFO.addressLine2) companyInfoY = drawText(KK_BIOFRESH_INFO.addressLine2, companyInfoX, companyInfoY, { size: 8 });
    if (KK_BIOFRESH_INFO.contact) companyInfoY = drawText(KK_BIOFRESH_INFO.contact, companyInfoX, companyInfoY, { size: 8 });

    // Invoice Specific Details (Top Right)
    let invoiceInfoY = y;
    invoiceInfoY = drawText('Invoice', headerRightX, invoiceInfoY, { font: boldFont, size: 18 }); // Slightly smaller "Invoice"
    invoiceInfoY -= 3;
    invoiceInfoY = drawText(`Invoice #: ${invoiceRecord.invoice_number}`, headerRightX, invoiceInfoY, { font: boldFont, size: 9 });
    invoiceInfoY = drawText(`Date: ${new Date(invoiceRecord.invoice_date).toLocaleDateString()}`, headerRightX, invoiceInfoY, { size: 9 });
    invoiceInfoY = drawText(`Sale ID: ${sale.id.substring(0,13)}...`, headerRightX, invoiceInfoY, { size: 9 });

    y = Math.min(companyInfoY, invoiceInfoY) - lineheight * 1.5;

    // Customer Info
    if (customer) {
        y -= lineheight / 2;
        y = drawText('Bill To:', margin, y, { font: boldFont, size: 11 });
        y = drawText(customer.name, margin, y, { size: 10 });
        if (customer.contact_info) y = drawText(customer.contact_info, margin, y, { size: 10 });
        if (customer.address) {
            customer.address.split('\n').forEach(line => {
                y = drawText(line, margin, y, { size: 10 });
            });
        }
    }
    y -= lineheight * 1.5;

    // Table Header
    const col1X = margin; // Product
    const col2X = margin + 150; // Details
    const col3X = margin + 250; // Qty
    const col4X = margin + 300; // Unit Price
    const col5X = margin + 370; // Discount
    const col6X = margin + 450; // Item Total

    const drawInvoiceTableHeaders = (currentY: number) => { // Removed unused currentPage parameter
        drawText('Product', col1X, currentY, { font: boldFont, size: 10 });
        drawText('Details', col2X, currentY, { font: boldFont, size: 10 });
        drawText('Qty', col3X, currentY, { font: boldFont, size: 10 });
        drawText('Unit Price', col4X, currentY, { font: boldFont, size: 10 });
        drawText('Discount', col5X, currentY, { font: boldFont, size: 10 });
        drawText('Item Total', col6X, currentY, { font: boldFont, size: 10 });
        return currentY - (lineheight * 1.5); // Return new Y after headers
    };

    y = drawInvoiceTableHeaders(y);

    // Table Items
    let overallTotal = 0;
    const pageBottomMargin = margin + 60; // Where items should stop to leave space for footer etc.

    items.forEach(item => {
        // Check if a page break is needed BEFORE drawing the item
        // Estimate item height (very rough, 2 lines + notes)
        let estimatedItemHeight = smallLineHeight * 2;
        if (item.notes) estimatedItemHeight += smallLineHeight * (item.notes.split('\n').length + 1);
        
        if (y - estimatedItemHeight < pageBottomMargin) {
            page = pdfDoc.addPage();
            y = height - margin; // Reset Y to top margin (or a specific content start Y)
            // It might be desirable to redraw the main invoice header (logo, company, invoice#) here too.
            // For now, just redrawing table headers.
            y = drawInvoiceTableHeaders(y);
        }

        const price = Number(item.price_per_unit);
        const quantity = Number(item.quantity_sold);
        const itemSubtotal = price * quantity;
        let discountDisplay = "-";
        let finalItemTotal = itemSubtotal;

        if (item.discount_type && (item.discount_value !== null && item.discount_value !== undefined)) {
            const discountValue = Number(item.discount_value);
            if (item.discount_type === 'Amount') {
                finalItemTotal -= discountValue;
                discountDisplay = `€${discountValue.toFixed(2)}`;
            } else if (item.discount_type === 'Percentage') {
                const discountAmount = itemSubtotal * (discountValue / 100);
                finalItemTotal -= discountAmount;
                discountDisplay = `${discountValue}% (€${discountAmount.toFixed(2)})`;
            }
        }
        finalItemTotal = Math.max(0, finalItemTotal);
        overallTotal += finalItemTotal;
        
        // let currentLineY = y; // Removed unused variable
        drawText(item.productName, col1X, y, { size: 9 });
        if(item.productDetails) drawText(item.productDetails, col2X, y, {size: 7, color: rgb(0.3,0.3,0.3)});

        // Align numbers to the right of their columns
        const qtyStr = String(quantity);
        page.drawText(qtyStr, { x: col3X + 30 - font.widthOfTextAtSize(qtyStr,9) , y: y, size: 9, font: font });
        
        const priceStr = `€${price.toFixed(2)}`;
        page.drawText(priceStr, { x: col4X + 60 - font.widthOfTextAtSize(priceStr,9), y: y, size: 9, font: font });
        
        page.drawText(discountDisplay, { x: col5X + 70 - font.widthOfTextAtSize(discountDisplay,8), y: y, size: 8, font: font });
        
        const itemTotalStr = `€${finalItemTotal.toFixed(2)}`;
        page.drawText(itemTotalStr, { x: col6X + 60 - font.widthOfTextAtSize(itemTotalStr,9), y: y, size: 9, font: font });
        
        // Add item notes if present, below the main line
        let itemNotesY = y - smallLineHeight * 0.7;
        if (item.notes) {
            itemNotesY = drawText(`  Note: ${item.notes}`, col1X + 5, itemNotesY, {size: 7, color: rgb(0.4,0.4,0.4)});
        }

        y = Math.min(y - smallLineHeight, itemNotesY - smallLineHeight * 0.3);
        y -= smallLineHeight * 0.5;

        // The check for page break is now at the beginning of the item loop.
    });
    
    // Line separator
    y -= smallLineHeight / 2;
    page.drawLine({start: {x: margin, y:y}, end: {x: width - margin, y:y}, thickness:0.5, color: rgb(0.7,0.7,0.7)});
    y -= lineheight;

    // Total
    const totalText = `Total Amount: €${overallTotal.toFixed(2)}`;
    drawText(totalText, width - margin - boldFont.widthOfTextAtSize(totalText, 12), y, { font: boldFont, size: 12 });
    y -= lineheight;

    // Notes
    if (sale.notes) {
        y -= lineheight;
        y = drawText('Notes:', margin, y, { font: boldFont, size: 10 });
        sale.notes.split('\n').forEach(line => {
            y = drawText(line, margin, y, { size: 10 });
        });
    }

    // Footer
    y = margin + 20; // Position footer from bottom
    drawText('Thank you for your business!', width / 2 - font.widthOfTextAtSize('Thank you for your business!', 10) / 2, y, {size: 10, color: rgb(0.5,0.5,0.5)});


    return pdfDoc.save();
}

// Function to trigger download
export async function downloadInvoicePDF(saleId: string) {
    try {
        const pdfBytes = await generateInvoicePDFBytes(saleId);
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        
        const invoiceRecord = await db.invoices.where('sale_id').equals(saleId).first();
        const fileName = invoiceRecord ? `Invoice-${invoiceRecord.invoice_number}.pdf` : `Invoice-${saleId.substring(0,8)}.pdf`;
        
        saveAs(blob, fileName);

        // Optionally, update Dexie with a local blob URL or mark as downloaded
        // For now, we assume the PDF is generated on-demand for download/print
        if (invoiceRecord && invoiceRecord.pdf_url?.startsWith('placeholder_')) {
             // This is a placeholder update. In reality, you'd get a real URL if storing.
            await db.invoices.update(invoiceRecord.id, { pdf_url: `local_generated_${fileName}`, _synced: 0, _last_modified: Date.now() });
        }

    } catch (error) {
        console.error("Failed to generate or download invoice PDF:", error);
        alert(`Error generating invoice: ${error instanceof Error ? error.message : String(error)}`);
    }
}

// The old generateInvoiceHTML can be kept for debugging or removed
export async function generateInvoiceHTML(saleId: string): Promise<string> {
    const { sale: _sale, items, customer: _customer } = await getFullSaleDetails(saleId); // Prefixed unused sale and customer
    const invoiceRecord = await db.invoices.where('sale_id').equals(saleId).first();
    if (!invoiceRecord) return "<p>Invoice record not found.</p>";
    const totalAmount = items.reduce((sum, item) => sum + (item.quantity_sold * item.price_per_unit),0);
    // ... (rest of HTML generation, can be simplified or removed if PDF is primary)
    return `<div>HTML for Invoice ${invoiceRecord.invoice_number} - Total: €${totalAmount.toFixed(2)}</div>`;
}
