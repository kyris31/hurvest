import { PDFDocument, StandardFonts, rgb, PDFFont, RGB } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import type { Sale, SaleItem, Customer, HarvestLog, PlantingLog, Crop, SeedBatch, Invoice } from './db';
import { db } from './db';

// Extend the Window interface to include showSaveFilePicker for TypeScript
declare global {
  interface Window {
    showSaveFilePicker?: (options?: {
      suggestedName?: string;
      types?: Array<{
        description?: string;
        accept?: Record<string, string | string[]>;
      }>;
    }) => Promise<FileSystemFileHandle>;
  }
  // Assuming FileSystemFileHandle and FileSystemWritableFileStream are already globally defined
}
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

    // Pre-fetch all potentially needed related data to avoid N+1 queries in map
    const plantingLogIds = items.map(item => item.harvest_log_id ? db.harvestLogs.get(item.harvest_log_id).then(hl => hl?.planting_log_id) : Promise.resolve(undefined))
                                .filter(id => id !== undefined) as Promise<string>[];
    const resolvedPlantingLogIds = (await Promise.all(plantingLogIds)).filter(id => id) as string[];
    
    const relevantPlantingLogs = resolvedPlantingLogIds.length > 0 ? await db.plantingLogs.where('id').anyOf(resolvedPlantingLogIds).and(pl => pl.is_deleted !== 1).toArray() : [];
    const plantingLogsMap = new Map(relevantPlantingLogs.map(pl => [pl.id, pl]));

    const seedBatchIdsFromPL = relevantPlantingLogs.map(pl => pl.seed_batch_id).filter(id => id) as string[];
    const seedlingLogIdsFromPL = relevantPlantingLogs.map(pl => pl.seedling_production_log_id).filter(id => id) as string[];
    const inventoryIdsFromPL = relevantPlantingLogs.map(pl => pl.input_inventory_id).filter(id => id) as string[];

    const relevantSeedlingLogs = seedlingLogIdsFromPL.length > 0 ? await db.seedlingProductionLogs.where('id').anyOf(seedlingLogIdsFromPL).and(sl => sl.is_deleted !== 1).toArray() : [];
    const seedlingLogsMap = new Map(relevantSeedlingLogs.map(sl => [sl.id, sl]));

    const seedBatchIdsFromSL = relevantSeedlingLogs.map(sl => sl.seed_batch_id).filter(id => id) as string[];
    const allSeedBatchIds = [...new Set([...seedBatchIdsFromPL, ...seedBatchIdsFromSL])];
    
    const relevantSeedBatches = allSeedBatchIds.length > 0 ? await db.seedBatches.where('id').anyOf(allSeedBatchIds).and(sb => sb.is_deleted !== 1).toArray() : [];
    const seedBatchesMap = new Map(relevantSeedBatches.map(sb => [sb.id, sb]));

    const relevantInventoryItems = inventoryIdsFromPL.length > 0 ? await db.inputInventory.where('id').anyOf(inventoryIdsFromPL).and(ii => ii.is_deleted !== 1).toArray() : [];
    const inventoryItemsMap = new Map(relevantInventoryItems.map(ii => [ii.id, ii]));

    const cropIds = [
        ...relevantPlantingLogs.map(pl => {
            if (pl.input_inventory_id) return inventoryItemsMap.get(pl.input_inventory_id)?.crop_id;
            if (pl.seedling_production_log_id) return seedlingLogsMap.get(pl.seedling_production_log_id)?.crop_id;
            if (pl.seed_batch_id) return seedBatchesMap.get(pl.seed_batch_id)?.crop_id;
            return undefined;
        }),
        ...relevantSeedlingLogs.map(sl => sl.crop_id),
        ...relevantSeedlingLogs.map(sl => sl.seed_batch_id ? seedBatchesMap.get(sl.seed_batch_id)?.crop_id : undefined),
        ...relevantSeedBatches.map(sb => sb.crop_id)
    ].filter(id => id) as string[];
    
    const relevantCrops = cropIds.length > 0 ? await db.crops.where('id').anyOf([...new Set(cropIds)]).and(c => c.is_deleted !== 1).toArray() : [];
    const cropsMap = new Map(relevantCrops.map(c => [c.id, c]));

    const detailedItems = await Promise.all(items.map(async (item) => {
        let productName = 'Unknown Product';
        let productDetails = '';
        if (item.harvest_log_id) {
            const harvestLog = await db.harvestLogs.get(item.harvest_log_id);
            if (harvestLog && harvestLog.is_deleted !== 1) {
                productDetails = `(Harvested: ${new Date(harvestLog.harvest_date).toLocaleDateString()})`;
                const plantingLog = plantingLogsMap.get(harvestLog.planting_log_id);
                
                if (plantingLog) {
                    let crop: Crop | undefined;
                    // ... (existing logic for harvested item name) ...
                    if (plantingLog.input_inventory_id) {
                        const invItem = inventoryItemsMap.get(plantingLog.input_inventory_id);
                        if (invItem && invItem.crop_id) crop = cropsMap.get(invItem.crop_id);
                        else if (invItem) productName = invItem.name; // Use inv name if no crop
                    } else if (plantingLog.seedling_production_log_id) {
                        const seedlingLog = seedlingLogsMap.get(plantingLog.seedling_production_log_id);
                        if (seedlingLog) {
                            if (seedlingLog.crop_id) crop = cropsMap.get(seedlingLog.crop_id);
                            if (!crop && seedlingLog.seed_batch_id) {
                                const seedBatch = seedBatchesMap.get(seedlingLog.seed_batch_id);
                                if (seedBatch && seedBatch.crop_id) crop = cropsMap.get(seedBatch.crop_id);
                            }
                        }
                    } else if (plantingLog.seed_batch_id) {
                        const seedBatch = seedBatchesMap.get(plantingLog.seed_batch_id);
                        if (seedBatch && seedBatch.crop_id) crop = cropsMap.get(seedBatch.crop_id);
                    }
                    if (crop) productName = crop.name || 'Unnamed Crop';
                }
            }
        } else if (item.input_inventory_id) {
            // Fetch the InputInventory item to get its name
            const inventoryItem = await db.inputInventory.get(item.input_inventory_id);
            if (inventoryItem && inventoryItem.is_deleted !== 1) {
                productName = inventoryItem.name;
                productDetails = `(Stock ID: ${inventoryItem.id.substring(0,8)}...)`; // Or other relevant detail
            }
        }
        return { ...item, productName, productDetails };
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
    pdfDoc.registerFontkit(fontkit);
    let page = pdfDoc.addPage([612, 792]); // Standard US Letter size, declare with let
    const { width, height } = page.getSize();
    
    // --- Font Handling for Greek Characters ---
    // Standard fonts like Helvetica don't support Greek well.
    // You need to embed a font that includes Greek glyphs.
    // Example: Download NotoSansGreek-Regular.ttf and NotoSansGreek-Bold.ttf
    // and place them in your /public/fonts/ directory.

    let font: PDFFont;
    let boldFont: PDFFont;

    try {
      // Use the correct paths to NotoSans fonts
      const fontBytes = await fetch('/fonts/static/NotoSans-Regular.ttf').then(res => {
        if (!res.ok) throw new Error(`Failed to fetch regular font: ${res.statusText}`);
        return res.arrayBuffer();
      });
      const boldFontBytes = await fetch('/fonts/static/NotoSans-Bold.ttf').then(res => {
        if (!res.ok) throw new Error(`Failed to fetch bold font: ${res.statusText}`);
        return res.arrayBuffer();
      });
      
      font = await pdfDoc.embedFont(fontBytes);
      boldFont = await pdfDoc.embedFont(boldFontBytes);
      console.log("Successfully embedded NotoSans fonts for invoice.");

    } catch (e) {
      console.error("Error embedding NotoSans font for invoice, falling back to Helvetica. Greek characters will likely not work.", e);
      // Fallback to standard font if custom font loading fails.
      // NOTE: Standard fonts will NOT render Greek characters correctly.
      font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    }
    // --- End Font Handling ---
    
    let logoImage;
    try {
        console.log("Attempting to fetch /LOGO.png");
        const logoRes = await fetch('/LOGO.png');
        console.log("Logo fetch response status:", logoRes.status, "ok:", logoRes.ok);
        if (!logoRes.ok) {
            console.error("Failed to fetch logo. Status:", logoRes.status, logoRes.statusText);
            throw new Error(`Failed to fetch logo: ${logoRes.status} ${logoRes.statusText}`);
        }
        const logoBytes = await logoRes.arrayBuffer();
        console.log("Logo bytes fetched, length:", logoBytes.byteLength);
        if (logoBytes.byteLength === 0) {
            console.error("Fetched logo bytes are empty.");
            throw new Error("Fetched logo bytes are empty.");
        }
        logoImage = await pdfDoc.embedPng(logoBytes);
        console.log("Logo embedded successfully into PDF document. logoImage object:", logoImage ? 'Exists' : 'Does not exist');
    } catch (e) {
        console.error("Error during logo processing (fetch or embed):", e);
        // Keep console.warn for less critical fallback path if needed, but error is more accurate here.
        // console.warn("LOGO.png not found or could not be embedded:", e);
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
    let mainTitle = 'Invoice'; // Default title

    if (sale.payment_status === 'paid') {
      if (sale.payment_method === 'cash') {
        mainTitle = 'CASH RECEIPT';
      } else {
        mainTitle = 'PAID INVOICE'; // Or "RECEIPT"
      }
    } else { // Status is 'unpaid', 'partially_paid', or undefined
      if (sale.payment_method === 'cash') {
        mainTitle = 'CASH SALE'; // Indicates a cash transaction not yet fully settled as 'paid'
      }
      // Otherwise, it remains 'Invoice' for other methods if not fully paid
    }

    invoiceInfoY = drawText(mainTitle, headerRightX, invoiceInfoY, { font: boldFont, size: 18 });
    invoiceInfoY -= 3;
    invoiceInfoY = drawText(`Number: ${invoiceRecord.invoice_number}`, headerRightX, invoiceInfoY, { font: boldFont, size: 9 });
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

    // Payment Status & Method (Optional display on invoice)
    if (sale.payment_status) {
        const statusText = `Payment Status: ${sale.payment_status.charAt(0).toUpperCase() + sale.payment_status.slice(1)}`;
        y = drawText(statusText, margin, y, { size: 9, font: boldFont });
    }
    if (sale.payment_method) {
        const methodText = `Payment Method: ${sale.payment_method.charAt(0).toUpperCase() + sale.payment_method.slice(1).replace('_', ' ')}`;
        y = drawText(methodText, margin, y, { size: 9 });
    }
     if (sale.payment_status === 'paid' && sale.amount_paid && sale.amount_paid > 0) {
        const paidText = `Amount Paid: €${sale.amount_paid.toFixed(2)}`;
        drawText(paidText, width - margin - font.widthOfTextAtSize(paidText, 9) - 5, y + (sale.payment_method ? 0 : lineheight*0.8) , { size: 9 }); // Align near total if space
    }


    // Notes
    if (sale.notes) {
      y -= lineheight * (sale.payment_status || sale.payment_method ? 0.5 : 1.5) ; // Adjust spacing based on whether payment info was shown
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
        const saleRecord = await db.sales.get(saleId); // Fetch sale record for payment status

        let folder = 'invoices';
        let baseFileName = `Invoice-${invoiceRecord?.invoice_number || saleId.substring(0,8)}.pdf`;

        if (saleRecord?.payment_status === 'paid') {
            folder = 'receipts';
            // Optionally, change the base file name for receipts
            if (saleRecord.payment_method === 'cash') {
                baseFileName = `CashReceipt-${invoiceRecord?.invoice_number || saleId.substring(0,8)}.pdf`;
            } else {
                baseFileName = `PaidInvoice-${invoiceRecord?.invoice_number || saleId.substring(0,8)}.pdf`;
            }
        }
        
        const suggestedName = `${folder}/${baseFileName}`;
        
        if (typeof window.showSaveFilePicker === 'function') {
            try {
                const handle = await window.showSaveFilePicker({
                    suggestedName: suggestedName,
                    types: [{ description: 'PDF Files', accept: { 'application/pdf': ['.pdf'] } }],
                });
                const writable = await handle.createWritable();
                await writable.write(blob);
                await writable.close();
            } catch (err: any) {
                if (err.name !== 'AbortError') {
                    console.error("Error saving Invoice/Receipt PDF with File System Access API:", err);
                    alert(`Error saving file: ${err.message}. File will be downloaded conventionally.`);
                    saveAs(blob, suggestedName);
                } else {
                    console.log("Invoice/Receipt PDF save cancelled by user.");
                }
            }
        } else {
            console.warn("File System Access API not supported for Invoice/Receipt PDF. Using default download.");
            saveAs(blob, suggestedName);
        }

        // Optionally, update Dexie with a local blob URL or mark as downloaded
        // For now, we assume the PDF is generated on-demand for download/print
        if (invoiceRecord && invoiceRecord.pdf_url?.startsWith('placeholder_')) {
             // This is a placeholder update. In reality, you'd get a real URL if storing.
            await db.invoices.update(invoiceRecord.id, { pdf_url: `local_generated_${suggestedName}`, _synced: 0, _last_modified: Date.now() });
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
