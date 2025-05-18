import { db } from './db';
import type { Sale, SaleItem, Customer, HarvestLog, PlantingLog, Crop, SeedBatch, Invoice, InputInventory } from './db';
import { saveAs } from 'file-saver';
import { PDFDocument, StandardFonts, rgb, PDFFont, PDFPage, RGB } from 'pdf-lib';

// Removed unused interface DetailedSaleItemReport

interface SaleReportItem {
    saleId: string;
    saleDate: string;
    customerName: string;
    invoiceNumber: string;
    invoiceStatus: string;
    productName: string;
    productDetails: string;
    quantitySold: number;
    pricePerUnit: number; // Price before discount
    discountDisplay: string; // e.g., "€5.00" or "10% (€2.50)"
    itemTotal: number; // Price after discount
    saleNotes?: string;
}

interface DateRangeFilters {
    startDate?: string | null;
    endDate?: string | null;
}

// Function to fetch all details for all sales (for comprehensive report)
async function getAllDetailedSalesForReport(filters?: DateRangeFilters): Promise<SaleReportItem[]> {
    let salesQuery = db.sales.filter(s => s.is_deleted !== 1);

    if (filters?.startDate) {
        const start = new Date(filters.startDate).toISOString().split('T')[0]; // Ensure YYYY-MM-DD for comparison
        salesQuery = salesQuery.and(s => s.sale_date >= start);
    }
    if (filters?.endDate) {
        const end = new Date(filters.endDate).toISOString().split('T')[0]; // Ensure YYYY-MM-DD for comparison
        salesQuery = salesQuery.and(s => s.sale_date <= end);
    }

    const sales = await salesQuery.toArray();
    const saleIds = sales.map(s => s.id);

    // Fetch related data only for the filtered sales
    const [saleItems, customers, harvestLogs, plantingLogs, seedBatches, crops, invoices] = await Promise.all([
        db.saleItems.where('sale_id').anyOf(saleIds).and(si => si.is_deleted !== 1).toArray(),
        db.customers.filter(c => c.is_deleted !== 1).toArray(),
        db.harvestLogs.filter(h => h.is_deleted !== 1).toArray(),
        db.plantingLogs.filter(p => p.is_deleted !== 1).toArray(),
        db.seedBatches.filter(sb => sb.is_deleted !== 1).toArray(),
        db.crops.filter(c => c.is_deleted !== 1).toArray(),
        db.invoices.where('sale_id').anyOf(saleIds).and(i => i.is_deleted !== 1).toArray()
    ]);
    // Removed redundant declarations of harvestLogs, plantingLogs, seedBatches, crops, invoices

    const reportItems: SaleReportItem[] = [];

    for (const sale of sales) {
        const customer = customers.find(c => c.id === sale.customer_id);
        const invoice = invoices.find(i => i.sale_id === sale.id);
        const itemsForThisSale = saleItems.filter(si => si.sale_id === sale.id);

        if (itemsForThisSale.length === 0) { // Include sales even if they have no items (though unlikely)
            reportItems.push({
                saleId: sale.id,
                saleDate: new Date(sale.sale_date).toLocaleDateString(),
                customerName: customer?.name || 'N/A',
                invoiceNumber: invoice?.invoice_number || 'N/A',
                invoiceStatus: invoice?.status || 'N/A',
                productName: 'N/A - No items',
                productDetails: '',
                quantitySold: 0,
                pricePerUnit: 0,
                discountDisplay: '-', // Add default for sales with no items
                itemTotal: 0,
                saleNotes: sale.notes,
            });
        } else {
            for (const item of itemsForThisSale) {
                let productName = 'Product (Info Missing)'; // Default if no link found
                let productDetails = '';
                if (item.harvest_log_id) {
                    const harvestLog = harvestLogs.find(h => h.id === item.harvest_log_id);
                    if (harvestLog) {
                        const plantingLog = plantingLogs.find(pl => pl.id === harvestLog.planting_log_id);
                        if (plantingLog && plantingLog.seed_batch_id) {
                            const seedBatch = seedBatches.find(sb => sb.id === plantingLog.seed_batch_id);
                            if (seedBatch) {
                                const crop = crops.find(c => c.id === seedBatch.crop_id);
                                productName = crop?.name || 'Crop (Name Missing)';
                                productDetails = `Batch: ${seedBatch.batch_code}, Harvest: ${new Date(harvestLog.harvest_date).toLocaleDateString()}`;
                            } else {
                                productName = 'Product (Seed Batch Missing)';
                            }
                        } else {
                            productName = 'Product (Planting/Seed Link Missing)';
                        }
                    } else {
                        productName = 'Product (Harvest Log Missing)';
                    }
                }

                const itemSubtotal = item.quantity_sold * item.price_per_unit;
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

                reportItems.push({
                    saleId: sale.id,
                    saleDate: new Date(sale.sale_date).toLocaleDateString(),
                    customerName: customer?.name || 'N/A',
                    invoiceNumber: invoice?.invoice_number || 'N/A',
                    invoiceStatus: invoice?.status || 'N/A',
                    productName,
                    productDetails,
                    quantitySold: item.quantity_sold,
                    pricePerUnit: item.price_per_unit,
                    discountDisplay: discountDisplay,
                    itemTotal: finalItemTotal,
                    saleNotes: sale.notes,
                });
            }
        }
    }
    return reportItems;
}

function convertToCSV(data: SaleReportItem[]): string {
    if (data.length === 0) return '';

    const headers = [
        "Sale ID", "Sale Date", "Customer Name", "Invoice Number", "Invoice Status",
        "Product Name", "Product Details", "Quantity Sold", "Price Per Unit (€)", "Discount Applied", "Item Total (€)", "Sale Notes"
    ];
    const csvRows = [headers.join(',')];

    data.forEach(item => {
        const row = [
            `"${item.saleId}"`,
            `"${item.saleDate}"`,
            `"${item.customerName.replace(/"/g, '""')}"`,
            `"${item.invoiceNumber}"`,
            `"${item.invoiceStatus}"`,
            `"${item.productName.replace(/"/g, '""')}"`,
            `"${item.productDetails.replace(/"/g, '""')}"`,
            item.quantitySold,
            item.pricePerUnit.toFixed(2),
            `"${item.discountDisplay.replace(/"/g, '""')}"`,
            item.itemTotal.toFixed(2),
            `"${(item.saleNotes || '').replace(/"/g, '""')}"`
        ];
        csvRows.push(row.join(','));
    });

    return csvRows.join('\n');
}

export async function exportSalesToCSV(filters?: DateRangeFilters): Promise<void> {
    try {
        console.log("Fetching sales data for CSV export with filters:", filters);
        const salesReportData = await getAllDetailedSalesForReport(filters);
        if (salesReportData.length === 0) {
            alert("No sales data available for the selected filters.");
            return;
        }
        console.log(`Fetched ${salesReportData.length} items for CSV report.`);
        
        const csvData = convertToCSV(salesReportData);
        const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
        
        const now = new Date();
        const dateStamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        saveAs(blob, `Hurvesthub_Sales_Report_${dateStamp}.csv`);
        console.log("Sales CSV export initiated.");

    } catch (error) {
        console.error("Failed to export sales to CSV:", error);
        alert(`Error exporting sales data: ${error instanceof Error ? error.message : String(error)}`);
    }
}

interface InventoryReportItem {
    itemId: string;
    itemName: string;
    itemType: string; // 'General Input' or 'Seed Batch'
    cropName?: string; // For seed batches
    batchCode?: string; // For seed batches
    supplier?: string;
    purchaseDate?: string;
    initialQuantity?: number;
    currentQuantity?: number;
    quantityUnit?: string;
    costPerUnit?: number;
    notes?: string;
    lastModified: string;
}

interface InventoryReportFilters {
    category?: string | null;
    startDate?: string | null;
    endDate?: string | null;
}

async function getAllInventoryForReport(filters?: InventoryReportFilters): Promise<InventoryReportItem[]> {
    let inputsQuery = db.inputInventory.filter(i => i.is_deleted !== 1);
    let seedBatchesQuery = db.seedBatches.filter(sb => sb.is_deleted !== 1);

    if (filters?.category) {
        if (filters.category === 'Seed Batch') {
            inputsQuery = inputsQuery.and(() => false); // Effectively exclude all general inputs
        } else { // General input category
            inputsQuery = inputsQuery.and(i => i.type === filters.category);
            seedBatchesQuery = seedBatchesQuery.and(() => false); // Exclude all seed batches
        }
    }

    if (filters?.startDate) {
        const start = new Date(filters.startDate).toISOString();
        inputsQuery = inputsQuery.and(i => !!i.purchase_date && i.purchase_date >= start);
        seedBatchesQuery = seedBatchesQuery.and(sb => !!sb.purchase_date && sb.purchase_date >= start);
    }
    if (filters?.endDate) {
        const end = new Date(filters.endDate).toISOString();
        inputsQuery = inputsQuery.and(i => !!i.purchase_date && i.purchase_date <= end);
        seedBatchesQuery = seedBatchesQuery.and(sb => !!sb.purchase_date && sb.purchase_date <= end);
    }
    
    const [inputs, seedBatches, crops] = await Promise.all([
        inputsQuery.toArray(),
        seedBatchesQuery.toArray(),
        db.crops.filter(c => c.is_deleted !== 1).toArray()
    ]);

    const reportItems: InventoryReportItem[] = [];

    inputs.forEach(input => {
        reportItems.push({
            itemId: input.id,
            itemName: input.name,
            itemType: input.type || 'General Input', // Ensure itemType is set
            supplier: input.supplier,
            purchaseDate: input.purchase_date ? new Date(input.purchase_date).toLocaleDateString() : '',
            initialQuantity: input.initial_quantity,
            currentQuantity: input.current_quantity,
            quantityUnit: input.quantity_unit,
            costPerUnit: undefined,
            notes: input.notes,
            lastModified: input._last_modified ? new Date(input._last_modified).toLocaleString() : (input.updated_at ? new Date(input.updated_at).toLocaleString() : '')
        });
    });

    seedBatches.forEach(batch => {
        const crop = crops.find(c => c.id === batch.crop_id);
        reportItems.push({
            itemId: batch.id,
            itemName: `${crop?.name || 'Unknown Crop'} Seeds`,
            itemType: 'Seed Batch',
            cropName: crop?.name || 'Unknown Crop',
            batchCode: batch.batch_code,
            supplier: batch.supplier,
            purchaseDate: batch.purchase_date ? new Date(batch.purchase_date).toLocaleDateString() : '',
            initialQuantity: batch.initial_quantity,
            currentQuantity: batch.current_quantity, // Use the actual current_quantity
            quantityUnit: batch.quantity_unit,
            costPerUnit: (batch.initial_quantity && batch.total_purchase_cost && batch.initial_quantity > 0)
                            ? (batch.total_purchase_cost / batch.initial_quantity)
                            : undefined,
            notes: batch.notes,
            lastModified: batch._last_modified ? new Date(batch._last_modified).toLocaleString() : (batch.updated_at ? new Date(batch.updated_at).toLocaleString() : '')
        });
    });
    
    reportItems.sort((a, b) => {
        if (a.itemName.toLowerCase() < b.itemName.toLowerCase()) return -1;
        if (a.itemName.toLowerCase() > b.itemName.toLowerCase()) return 1;
        if (a.itemType < b.itemType) return -1;
        if (a.itemType > b.itemType) return 1;
        return 0;
    });

    return reportItems;
}

function convertInventoryToCSV(data: InventoryReportItem[]): string {
    if (data.length === 0) return '';
    const headers = [
        "Item ID", "Item Name", "Item Type", "Crop Name", "Batch Code", "Supplier",
        "Purchase Date", "Initial Quantity", "Current Quantity", "Quantity Unit",
        "Notes", "Last Modified"
    ];
    const csvRows = [headers.join(',')];

    data.forEach(item => {
        const row = [
            `"${item.itemId}"`,
            `"${item.itemName.replace(/"/g, '""')}"`,
            `"${item.itemType}"`,
            `"${(item.cropName || '').replace(/"/g, '""')}"`,
            `"${(item.batchCode || '').replace(/"/g, '""')}"`,
            `"${(item.supplier || '').replace(/"/g, '""')}"`,
            `"${item.purchaseDate || ''}"`,
            item.initialQuantity ?? '',
            item.currentQuantity ?? '',
            `"${item.quantityUnit || ''}"`,
            `"${(item.notes || '').replace(/"/g, '""')}"`,
            `"${item.lastModified}"`
        ];
        csvRows.push(row.join(','));
    });
    return csvRows.join('\n');
}

export async function exportInventoryToCSV(filters?: InventoryReportFilters): Promise<void> {
    try {
        console.log("Fetching inventory data for CSV export with filters:", filters);
        const inventoryReportData = await getAllInventoryForReport(filters);
        if (inventoryReportData.length === 0) {
            alert("No inventory data available for the selected filters.");
            return;
        }
        console.log(`Fetched ${inventoryReportData.length} inventory items for CSV report.`);
        
        const csvData = convertInventoryToCSV(inventoryReportData);
        const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
        
        const now = new Date();
        const dateStamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        saveAs(blob, `Hurvesthub_Inventory_Summary_Report_${dateStamp}.csv`);
        console.log("Inventory Summary CSV export initiated.");

    } catch (error) {
        console.error("Failed to export inventory to CSV:", error);
        alert(`Error exporting inventory data: ${error instanceof Error ? error.message : String(error)}`);
    }
}

interface HarvestReportItem {
    harvestId: string;
    harvestDate: string;
    plantingLogId: string;
    plantingDate?: string;
    cropName?: string;
    cropVariety?: string;
    cropType?: string;
    cropNotes?: string;
    // seedBatchCode?: string; // No longer needed for display in this enhanced format
    location?: string;
    quantityHarvested: number;
    quantityUnit: string;
    qualityGrade?: string;
    notes?: string; // These are harvest-specific notes
    lastModified: string;
}

async function getAllHarvestLogsForReport(filters?: DateRangeFilters): Promise<HarvestReportItem[]> {
    let harvestLogsQuery = db.harvestLogs.filter(h => h.is_deleted !== 1);

    if (filters?.startDate) {
        const start = new Date(filters.startDate).toISOString().split('T')[0];
        harvestLogsQuery = harvestLogsQuery.and(h => h.harvest_date >= start);
    }
    if (filters?.endDate) {
        const end = new Date(filters.endDate).toISOString().split('T')[0];
        harvestLogsQuery = harvestLogsQuery.and(h => h.harvest_date <= end);
    }

    const harvestLogs = await harvestLogsQuery.toArray();
    const plantingLogIds = harvestLogs.map(h => h.planting_log_id);
    
    const [plantingLogs, seedBatches, cropsData] = await Promise.all([
        db.plantingLogs.where('id').anyOf(plantingLogIds).and(p => p.is_deleted !== 1).toArray(),
        db.seedBatches.filter(sb => sb.is_deleted !== 1).toArray(), // Still need seedBatches to link plantingLog to crop
        db.crops.filter(c => c.is_deleted !== 1).toArray() // Fetches name, variety, type, notes
    ]);
    
    const reportItems: HarvestReportItem[] = [];

    for (const hLog of harvestLogs) {
        const pLog = plantingLogs.find(pl => pl.id === hLog.planting_log_id);
        let crop: Crop | undefined;
        // let seedBatchCode: string | undefined; // Not displayed directly anymore

        if (pLog && pLog.seed_batch_id) {
            const sBatch = seedBatches.find(sb => sb.id === pLog.seed_batch_id);
            if (sBatch) {
                // seedBatchCode = sBatch.batch_code; // Still available if needed elsewhere
                crop = cropsData.find(c => c.id === sBatch.crop_id);
            }
        }

        reportItems.push({
            harvestId: hLog.id,
            harvestDate: new Date(hLog.harvest_date).toLocaleDateString(),
            plantingLogId: hLog.planting_log_id,
            plantingDate: pLog ? new Date(pLog.planting_date).toLocaleDateString() : undefined,
            cropName: crop?.name || 'N/A',
            cropVariety: crop?.variety,
            cropType: crop?.type,
            cropNotes: crop?.notes,
            // seedBatchCode: seedBatchCode || 'N/A', // Removed from direct report item for this view
            location: pLog?.location_description || 'N/A',
            quantityHarvested: hLog.quantity_harvested,
            quantityUnit: hLog.quantity_unit,
            qualityGrade: hLog.quality_grade,
            notes: hLog.notes, // Harvest specific notes
            lastModified: hLog._last_modified ? new Date(hLog._last_modified).toLocaleString() : (hLog.updated_at ? new Date(hLog.updated_at).toLocaleString() : '')
        });
    }
    
    reportItems.sort((a,b) => new Date(b.harvestDate).getTime() - new Date(a.harvestDate).getTime());

    return reportItems;
}

function convertHarvestLogsToCSV(data: HarvestReportItem[]): string {
    if (data.length === 0) return '';
    const headers = [
        "Harvest ID", "Harvest Date", "Crop Name", "Crop Variety", "Crop Type", "Crop Notes",
        "Quantity Harvested", "Unit", "Quality Grade", "Planting Log ID", "Planting Date",
        "Location", "Harvest Notes", "Last Modified"
    ];
    const csvRows = [headers.join(',')];

    data.forEach(item => {
        const row = [
            `"${item.harvestId}"`,
            `"${item.harvestDate}"`,
            `"${(item.cropName || '').replace(/"/g, '""')}"`,
            `"${(item.cropVariety || '').replace(/"/g, '""')}"`,
            `"${(item.cropType || '').replace(/"/g, '""')}"`,
            `"${(item.cropNotes || '').replace(/"/g, '""')}"`,
            item.quantityHarvested,
            `"${item.quantityUnit}"`,
            `"${(item.qualityGrade || '').replace(/"/g, '""')}"`,
            `"${item.plantingLogId}"`,
            `"${item.plantingDate || ''}"`,
            `"${(item.location || '').replace(/"/g, '""')}"`,
            `"${(item.notes || '').replace(/"/g, '""')}"`, // These are harvest-specific notes
            `"${item.lastModified}"`
        ];
        csvRows.push(row.join(','));
    });
    return csvRows.join('\n');
}

export async function exportHarvestLogsToCSV(filters?: DateRangeFilters): Promise<void> {
    try {
        console.log("Fetching harvest log data for CSV export with filters:", filters);
        const harvestReportData = await getAllHarvestLogsForReport(filters);
        if (harvestReportData.length === 0) {
            alert("No harvest log data available for the selected filters.");
            return;
        }
        console.log(`Fetched ${harvestReportData.length} harvest logs for CSV report.`);
        
        const csvData = convertHarvestLogsToCSV(harvestReportData);
        const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
        
        const now = new Date();
        const dateStamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        saveAs(blob, `Hurvesthub_HarvestLogs_Report_${dateStamp}.csv`);
        console.log("Harvest Logs CSV export initiated.");

    } catch (error) {
        console.error("Failed to export harvest logs to CSV:", error);
        alert(`Error exporting harvest log data: ${error instanceof Error ? error.message : String(error)}`);
    }
}


// --- (Existing code for Sales, Inventory (non-value), Harvest reports) ... ---

// --- Inventory Value Report Specific Logic ---

interface InventoryValueReportDataItem {
    itemId: string;
    itemName: string;
    itemType: string; // 'General Input' or 'Seed Batch'
    cropName?: string; // For seed batches
    batchCode?: string; // For seed batches
    supplier?: string;
    purchaseDate?: string;
    initialQuantity?: number; // For reference
    currentQuantity?: number;
    quantityUnit?: string;
    costPerUnit?: number;     // Calculated
    totalValue: number;      // Calculated: currentQuantity * costPerUnit
    notes?: string;
    lastModified: string;
}

async function getInventoryValueReportData(filters?: InventoryReportFilters): Promise<InventoryValueReportDataItem[]> {
    const inventoryItems = await getAllInventoryForReport(filters); // Re-use existing filtered fetch
    const reportItems: InventoryValueReportDataItem[] = [];

    inventoryItems.forEach(item => {
        let costPerUnit = item.costPerUnit; // Already calculated for seed batches in getAllInventoryForReport
        let totalValue = 0;

        if (item.itemType !== 'Seed Batch' && item.itemId) { // For general inputs, try to find original cost
            const originalInput = db.inputInventory.get(item.itemId).then(orig => { // This is async, needs await or Promise.all
                if (orig && orig.total_purchase_cost && orig.initial_quantity && orig.initial_quantity > 0) {
                    return orig.total_purchase_cost / orig.initial_quantity;
                }
                return undefined;
            });
            // This approach is problematic within a forEach. Refactor needed for proper async handling.
            // For simplicity in this pass, we'll assume costPerUnit is not available for general inputs here
            // or needs to be pre-calculated and passed if essential for this specific report view.
            // The current `item.costPerUnit` is undefined for general inputs from `getAllInventoryForReport`.
        }
        
        if (costPerUnit !== undefined && item.currentQuantity !== undefined) {
            totalValue = item.currentQuantity * costPerUnit;
        }

        reportItems.push({
            ...item,
            costPerUnit: costPerUnit, // May be undefined
            totalValue: totalValue,
        });
    });
    
    // The async issue with fetching originalInput needs to be addressed for accurate general input valuation.
    // For now, general inputs will likely show 0 value if costPerUnit isn't derived elsewhere.
    // A better approach would be to fetch all inputs with their costs initially in getAllInventoryForReport
    // or do a separate loop with Promise.all for general inputs if their valuation is critical here.

    // Let's refine the general input cost calculation part
    const valuedReportItems: InventoryValueReportDataItem[] = [];
    for (const item of inventoryItems) {
        let calculatedCostPerUnit = item.costPerUnit; // Already calculated for seed batches

        if (item.itemType !== 'Seed Batch' && item.itemId) {
            const originalInput = await db.inputInventory.get(item.itemId);
            if (originalInput && originalInput.total_purchase_cost && originalInput.initial_quantity && originalInput.initial_quantity > 0) {
                calculatedCostPerUnit = originalInput.total_purchase_cost / originalInput.initial_quantity;
            }
        }
        
        let totalValue = 0;
        if (calculatedCostPerUnit !== undefined && item.currentQuantity !== undefined) {
            totalValue = item.currentQuantity * calculatedCostPerUnit;
        }

        valuedReportItems.push({
            ...item,
            costPerUnit: calculatedCostPerUnit,
            totalValue: totalValue,
        });
    }


    valuedReportItems.sort((a, b) => {
        if (a.itemName.toLowerCase() < b.itemName.toLowerCase()) return -1;
        if (a.itemName.toLowerCase() > b.itemName.toLowerCase()) return 1;
        return 0;
    });
    return valuedReportItems;
}


function convertInventoryValueToCSV(data: InventoryValueReportDataItem[]): string {
    if (data.length === 0) return '';
    const headers = [
        "Item ID", "Item Name", "Item Type", "Crop Name", "Batch Code", "Supplier",
        "Purchase Date", "Initial Qty", "Current Qty", "Unit",
        "Cost/Unit (€)", "Total Value (€)", "Notes", "Last Modified"
    ];
    const csvRows = [headers.join(',')];

    data.forEach(item => {
        const row = [
            `"${item.itemId}"`,
            `"${item.itemName.replace(/"/g, '""')}"`,
            `"${item.itemType}"`,
            `"${(item.cropName || '').replace(/"/g, '""')}"`,
            `"${(item.batchCode || '').replace(/"/g, '""')}"`,
            `"${(item.supplier || '').replace(/"/g, '""')}"`,
            `"${item.purchaseDate || ''}"`,
            item.initialQuantity ?? '',
            item.currentQuantity ?? '',
            `"${item.quantityUnit || ''}"`,
            item.costPerUnit !== undefined ? item.costPerUnit.toFixed(2) : '',
            item.totalValue.toFixed(2),
            `"${(item.notes || '').replace(/"/g, '""')}"`,
            `"${item.lastModified}"`
        ];
        csvRows.push(row.join(','));
    });
    return csvRows.join('\n');
}

export async function exportInventoryValueToCSV(filters?: InventoryReportFilters): Promise<void> {
    try {
        const reportData = await getInventoryValueReportData(filters);
        if (reportData.length === 0) {
            alert("No inventory data available for value report with selected filters.");
            return;
        }
        const csvData = convertInventoryValueToCSV(reportData);
        const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
        const now = new Date();
        const dateStamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        saveAs(blob, `Hurvesthub_Inventory_Value_Report_${dateStamp}.csv`);
    } catch (error) {
        console.error("Failed to export inventory value to CSV:", error);
        alert(`Error exporting inventory value data: ${error instanceof Error ? error.message : String(error)}`);
    }
}

export async function exportInventoryValueToPDF(filters?: InventoryReportFilters): Promise<void> {
    try {
        const reportData = await getInventoryValueReportData(filters);
        if (reportData.length === 0) {
            alert("No inventory data for PDF value report with selected filters.");
            return;
        }

        const pdfDoc = await PDFDocument.create();
        let page = pdfDoc.addPage();
        const { height } = page.getSize();
        const margin = 40;
        const yPos = { y: height - margin }; // Use const for yPos object

        await addPdfHeader(pdfDoc, page, yPos); 
        yPos.y -= 10; // Add a bit of space after header

        const tableHeaders = ["Item Name", "Type", "Crop", "Batch", "Current Qty", "Unit", "Cost/Unit", "Total Value"];
        const columnWidths = [120, 80, 70, 70, 50, 50, 60, 70]; 
        
        const tableData = reportData.map(item => [
            item.itemName,
            item.itemType,
            item.cropName || '-',
            item.batchCode || '-',
            item.currentQuantity !== undefined ? String(item.currentQuantity) : '-',
            item.quantityUnit || '-',
            item.costPerUnit !== undefined ? `€${item.costPerUnit.toFixed(2)}` : '-',
            `€${item.totalValue.toFixed(2)}`
        ]);

        page = await drawPdfTable(pdfDoc, page, yPos, tableHeaders, tableData, columnWidths, { margin });

        const pdfBytes = await pdfDoc.save();
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        const now = new Date();
        const dateStamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        saveAs(blob, `Hurvesthub_Inventory_Value_Report_${dateStamp}.pdf`);

    } catch (error) {
        console.error("Failed to export inventory value to PDF:", error);
        alert(`Error generating inventory value PDF: ${error instanceof Error ? error.message : String(error)}`);
    }
}


// Helper function to split text if it's too wide (simple version)
// This function is used by drawPdfTable
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


async function addPdfHeader(pdfDoc: PDFDocument, page: PDFPage, yPos: { y: number }) {
    const { width: pageWidth } = page.getSize(); // height is not used directly here for calculations
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const margin = 40;
    let currentY = yPos.y;

    // Logo
    try {
        const logoBytes = await fetch('/logo.png').then(res => res.arrayBuffer());
        const logoImage = await pdfDoc.embedPng(logoBytes);
        const logoWidth = 50;
        const logoHeight = logoImage.height * (logoWidth / logoImage.width);
        page.drawImage(logoImage, {
            x: margin,
            y: currentY - logoHeight,
            width: logoWidth,
            height: logoHeight,
        });
    } catch (e) {
        console.warn("Could not load or embed logo for PDF header:", e);
    }
    
    // Report Title (example)
    const title = "Report"; // Customize as needed
    const titleSize = 18;
    const titleWidth = boldFont.widthOfTextAtSize(title, titleSize);
    page.drawText(title, {
        x: pageWidth - margin - titleWidth, // Align to right
        y: currentY - titleSize,
        font: boldFont,
        size: titleSize,
        color: rgb(0,0,0)
    });
    currentY -= titleSize + 10; // Space after title

    // Date
    const dateText = `Generated: ${new Date().toLocaleDateString()}`;
    const dateSize = 8;
    const dateWidth = font.widthOfTextAtSize(dateText, dateSize);
    page.drawText(dateText, {
        x: pageWidth - margin - dateWidth,
        y: currentY - dateSize,
        font: font,
        size: dateSize,
        color: rgb(0.3,0.3,0.3)
    });
    currentY -= dateSize + 20; // Space after date

    yPos.y = currentY; // Update yPos for the caller
}


async function drawPdfTable(
    pdfDoc: PDFDocument, 
    page: PDFPage, 
    yPos: { y: number }, 
    tableHeaders: string[], 
    tableData: (string | number | undefined)[][],
    columnWidths: number[],
    options?: {
        font?: PDFFont,
        headerFont?: PDFFont,
        fontSize?: number,
        headerFontSize?: number,
        lineHeight?: number,
        margin?: number,
        pageBottomMargin?: number,
        headerFillColor?: RGB, 
        headerTextColor?: RGB, 
        rowFillColorEven?: RGB, 
        rowFillColorOdd?: RGB, 
        borderColor?: RGB, 
    }
): Promise<PDFPage> { // Return the current page (could be new)
    const { width: pageWidth, height: pageHeight } = page.getSize();
    const effectiveMargin = options?.margin ?? 40;
    const effectivePageBottomMargin = options?.pageBottomMargin ?? effectiveMargin + 40; // Default bottom margin
    const effectiveFont = options?.font ?? await pdfDoc.embedFont(StandardFonts.Helvetica);
    const effectiveHeaderFont = options?.headerFont ?? await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const effectiveFontSize = options?.fontSize ?? 8;
    const effectiveHeaderFontSize = options?.headerFontSize ?? 9;
    const effectiveLineHeight = options?.lineHeight ?? 12;
    const cellPadding = 3;

    const effectiveHeaderFillColor = options?.headerFillColor ?? rgb(0.9, 0.9, 0.9);
    const effectiveHeaderTextColor = options?.headerTextColor ?? rgb(0,0,0);
    const effectiveRowFillColorOdd = options?.rowFillColorOdd ?? rgb(1,1,1);
    const effectiveRowFillColorEven = options?.rowFillColorEven ?? rgb(0.95, 0.95, 0.95);
    const effectiveBorderColor = options?.borderColor ?? rgb(0.7,0.7,0.7);

    let currentY = yPos.y;
    let currentPage = page;

    // Draw Headers
    let x = effectiveMargin;
    const headerLineHeight = effectiveLineHeight * 1.2; // Slightly more for headers

    if (effectiveHeaderFillColor) {
        currentPage.drawRectangle({
            x: effectiveMargin,
            y: currentY - headerLineHeight,
            width: pageWidth - 2 * effectiveMargin,
            height: headerLineHeight,
            color: effectiveHeaderFillColor,
        });
    }
    tableHeaders.forEach((header, i) => {
        const colWidth = columnWidths[i];
        const textWidth = effectiveHeaderFont.widthOfTextAtSize(header, effectiveHeaderFontSize);
        const textX = x + (colWidth - textWidth) / 2; // Center text
        currentPage.drawText(header, { x: textX, y: currentY - headerLineHeight + cellPadding + 2, font: effectiveHeaderFont, size: effectiveHeaderFontSize, color: effectiveHeaderTextColor });
        x += colWidth;
    });
    currentY -= headerLineHeight;

    // Draw table border for header bottom
    currentPage.drawLine({
        start: { x: effectiveMargin, y: currentY },
        end: { x: pageWidth - effectiveMargin, y: currentY },
        thickness: 0.5, color: effectiveBorderColor
    });


    // Draw Rows
    tableData.forEach((row, rowIndex) => {
        let maxRowHeight = effectiveLineHeight; // Min height for a row
        // Pre-calculate max lines for this row to estimate height
        row.forEach((cell, colIndex) => {
            const cellText = cell === undefined || cell === null ? '' : String(cell);
            const lines = splitTextToFit(cellText, columnWidths[colIndex] - 2 * cellPadding, effectiveFont, effectiveFontSize);
            maxRowHeight = Math.max(maxRowHeight, lines.length * effectiveLineHeight);
        });
        
        if (currentY - maxRowHeight < effectivePageBottomMargin) {
            currentPage = pdfDoc.addPage();
            currentY = pageHeight - effectiveMargin; // Reset Y
            // Redraw headers on new page
            x = effectiveMargin;
            if (effectiveHeaderFillColor) {
                currentPage.drawRectangle({ x: effectiveMargin, y: currentY - headerLineHeight, width: pageWidth - 2*effectiveMargin, height: headerLineHeight, color: effectiveHeaderFillColor });
            }
            tableHeaders.forEach((header, i) => {
                const colWidth = columnWidths[i];
                const textWidth = effectiveHeaderFont.widthOfTextAtSize(header, effectiveHeaderFontSize);
                currentPage.drawText(header, { x: x + (colWidth - textWidth) / 2, y: currentY - headerLineHeight + cellPadding + 2, font: effectiveHeaderFont, size: effectiveHeaderFontSize, color: effectiveHeaderTextColor });
                x += colWidth;
            });
            currentY -= headerLineHeight;
            currentPage.drawLine({ start: { x: effectiveMargin, y: currentY }, end: { x: pageWidth - effectiveMargin, y: currentY }, thickness: 0.5, color: effectiveBorderColor });
        }

        const rowFillColor = rowIndex % 2 === 0 ? effectiveRowFillColorEven : effectiveRowFillColorOdd;
        if (rowFillColor) {
             currentPage.drawRectangle({ x: effectiveMargin, y: currentY - maxRowHeight, width: pageWidth - 2*effectiveMargin, height: maxRowHeight, color: rowFillColor });
        }

        let cellX = effectiveMargin;
        let actualRowEndY = currentY; // Track where content actually ends for this row

        row.forEach((cell, colIndex) => {
            const colWidth = columnWidths[colIndex];
            const cellText = cell === undefined || cell === null ? '' : String(cell);
            const textLinesCell = splitTextToFit(String(cellText), colWidth - 2 * cellPadding, effectiveFont, effectiveFontSize);
            
            let lineYOffset = currentY - effectiveFontSize - cellPadding / 2; // Start drawing text from top of cell
            
            textLinesCell.forEach(line => {
                currentPage.drawText(line, {
                    x: cellX + cellPadding,
                    y: lineYOffset,
                    font: effectiveFont,
                    size: effectiveFontSize,
                    color: rgb(0,0,0) // Default text color
                });
                lineYOffset -= effectiveLineHeight;
            });
            actualRowEndY = Math.min(actualRowEndY, lineYOffset + effectiveLineHeight - maxRowHeight); // Adjust based on actual content drawn
            cellX += colWidth;
        });
        currentY -= maxRowHeight; // Move Y down by the calculated max height of the row
        
        // Draw row bottom border
        currentPage.drawLine({ start: { x: effectiveMargin, y: currentY }, end: { x: pageWidth - effectiveMargin, y: currentY }, thickness: 0.5, color: effectiveBorderColor });
    });

    yPos.y = currentY; // Update yPos for the caller
    return currentPage;
}


export async function exportSalesToPDF(filters?: DateRangeFilters): Promise<void> {
    try {
        const salesReportData = await getAllDetailedSalesForReport(filters);
        if (salesReportData.length === 0) {
            alert("No sales data available for PDF report with selected filters.");
            return;
        }

        const pdfDoc = await PDFDocument.create();
        let page = pdfDoc.addPage(); // Initial page
        const { height } = page.getSize();
        const margin = 40;
        const yPos = { y: height - margin };

        await addPdfHeader(pdfDoc, page, yPos);
        yPos.y -= 10;

        const tableHeaders = ["Date", "Customer", "Invoice#", "Product", "Qty", "Price", "Discount", "Total"];
        const columnWidths = [60, 100, 70, 120, 30, 50, 60, 60];
        
        const tableData = salesReportData.map(item => [
            item.saleDate,
            item.customerName,
            item.invoiceNumber,
            item.productName,
            item.quantitySold,
            `€${item.pricePerUnit.toFixed(2)}`,
            item.discountDisplay,
            `€${item.itemTotal.toFixed(2)}`
        ]);

        page = await drawPdfTable(pdfDoc, page, yPos, tableHeaders, tableData, columnWidths, { margin });

        const pdfBytes = await pdfDoc.save();
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        const now = new Date();
        const dateStamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        saveAs(blob, `Hurvesthub_Sales_Report_${dateStamp}.pdf`);

    } catch (error) {
        console.error("Failed to generate sales PDF:", error);
        alert(`Error generating sales PDF: ${error instanceof Error ? error.message : String(error)}`);
    }
}

export async function exportInventoryToPDF(filters?: InventoryReportFilters): Promise<void> {
    try {
        const inventoryReportData = await getAllInventoryForReport(filters);
        if (inventoryReportData.length === 0) {
            alert("No inventory data for PDF report with selected filters.");
            return;
        }

        const pdfDoc = await PDFDocument.create();
        let page = pdfDoc.addPage();
        const { height } = page.getSize();
        const margin = 40;
        const yPos = { y: height - margin };

        await addPdfHeader(pdfDoc, page, yPos);
        yPos.y -=10;

        const tableHeaders = ["Item Name", "Type", "Crop", "Batch", "Supplier", "Current Qty", "Unit"];
        const columnWidths = [120, 80, 80, 80, 80, 60, 50];
        
        const tableData = inventoryReportData.map(item => [
            item.itemName,
            item.itemType,
            item.cropName || '-',
            item.batchCode || '-',
            item.supplier || '-',
            item.currentQuantity !== undefined ? String(item.currentQuantity) : '-',
            item.quantityUnit || '-'
        ]);

        page = await drawPdfTable(pdfDoc, page, yPos, tableHeaders, tableData, columnWidths, { margin });
        
        const pdfBytes = await pdfDoc.save();
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        const now = new Date();
        const dateStamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        saveAs(blob, `Hurvesthub_Inventory_Summary_Report_${dateStamp}.pdf`);

    } catch (error) {
        console.error("Failed to generate inventory PDF:", error);
        alert(`Error generating inventory PDF: ${error instanceof Error ? error.message : String(error)}`);
    }
}


export async function exportHarvestLogsToPDF(filters?: DateRangeFilters): Promise<void> {
    try {
        const harvestReportData = await getAllHarvestLogsForReport(filters);
        if (harvestReportData.length === 0) {
            alert("No harvest log data for PDF report with selected filters.");
            return;
        }
        const pdfDoc = await PDFDocument.create();
        let page = pdfDoc.addPage();
        const { height } = page.getSize();
        const margin = 40;
        const yPos = { y: height - margin };

        await addPdfHeader(pdfDoc, page, yPos);
        yPos.y -= 10;

        const tableHeaders = ["Harvest Date", "Crop", "Variety", "Qty", "Unit", "Quality", "Location"];
        const columnWidths = [70, 100, 80, 50, 50, 70, 100];
        
        const tableData = harvestReportData.map(item => [
            item.harvestDate,
            item.cropName,
            item.cropVariety || '-',
            item.quantityHarvested,
            item.quantityUnit,
            item.qualityGrade || '-',
            item.location || '-'
        ]);

        page = await drawPdfTable(pdfDoc, page, yPos, tableHeaders, tableData, columnWidths, { margin });

        const pdfBytes = await pdfDoc.save();
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        const now = new Date();
        const dateStamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        saveAs(blob, `Hurvesthub_HarvestLogs_Report_${dateStamp}.pdf`);

    } catch (error) {
        console.error("Failed to generate harvest logs PDF:", error);
        alert(`Error generating harvest logs PDF: ${error instanceof Error ? error.message : String(error)}`);
    }
}


// --- Seedling Lifecycle Report ---
export interface SeedlingLifecycleReportItem {
    seedlingLogId: string;
    sowingDate: string;
    cropName?: string;
    seedBatchCode?: string;
    quantitySown?: number; // From SeedlingProductionLog.quantity_sown_value
    sowingUnit?: string; // From SeedlingProductionLog.sowing_unit_from_batch
    actualSeedlingsProduced?: number;
    currentSeedlingsAvailable?: number;
    plantingLogId?: string;
    plantingDate?: string;
    quantityPlanted?: number; // From PlantingLog
    harvestsCount: number;
    totalQuantityHarvested: number;
    totalSalesValueFromHarvests: number;
    notes?: string; // Seedling log notes
}

async function getSeedlingLifecycleReportData(filters?: DateRangeFilters): Promise<SeedlingLifecycleReportItem[]> {
    let seedlingLogsQuery = db.seedlingProductionLogs.filter(sl => sl.is_deleted !== 1);
    if (filters?.startDate) {
        seedlingLogsQuery = seedlingLogsQuery.and(sl => sl.sowing_date >= filters.startDate!);
    }
    if (filters?.endDate) {
        seedlingLogsQuery = seedlingLogsQuery.and(sl => sl.sowing_date <= filters.endDate!);
    }
    const seedlingLogs = await seedlingLogsQuery.toArray();

    const reportItems: SeedlingLifecycleReportItem[] = [];

    for (const sl of seedlingLogs) {
        const crop = await db.crops.get(sl.crop_id);
        const seedBatch = await db.seedBatches.get(sl.seed_batch_id);
        const plantingLog = await db.plantingLogs.where({ seedling_production_log_id: sl.id, is_deleted: 0 }).first();
        
        let harvestsCount = 0;
        let totalQuantityHarvested = 0;
        let totalSalesValueFromHarvests = 0;

        if (plantingLog) {
            const harvestsForThisPlanting = await db.harvestLogs.where({ planting_log_id: plantingLog.id, is_deleted: 0 }).toArray();
            harvestsCount = harvestsForThisPlanting.length;
            harvestsForThisPlanting.forEach(h => {
                totalQuantityHarvested += h.quantity_harvested;
            });

            const harvestLogIds = harvestsForThisPlanting.map(h => h.id);
            if (harvestLogIds.length > 0) {
                const saleItemsForTheseHarvests = await db.saleItems
                    .where('harvest_log_id').anyOf(harvestLogIds)
                    .and(si => si.is_deleted !== 1)
                    .toArray();
                
                saleItemsForTheseHarvests.forEach(si => {
                    let itemTotal = si.quantity_sold * si.price_per_unit;
                    if (si.discount_type && si.discount_value) {
                        if (si.discount_type === 'Amount') itemTotal -= si.discount_value;
                        else if (si.discount_type === 'Percentage') itemTotal -= itemTotal * (si.discount_value / 100);
                    }
                    totalSalesValueFromHarvests += Math.max(0, itemTotal);
                });
            }
        }

        reportItems.push({
            seedlingLogId: sl.id,
            sowingDate: new Date(sl.sowing_date).toLocaleDateString(),
            cropName: crop?.name,
            seedBatchCode: seedBatch?.batch_code,
            quantitySown: sl.quantity_sown_value,
            sowingUnit: sl.sowing_unit_from_batch,
            actualSeedlingsProduced: sl.actual_seedlings_produced,
            currentSeedlingsAvailable: sl.current_seedlings_available,
            plantingLogId: plantingLog?.id,
            plantingDate: plantingLog ? new Date(plantingLog.planting_date).toLocaleDateString() : undefined,
            quantityPlanted: plantingLog?.quantity_planted,
            harvestsCount,
            totalQuantityHarvested,
            totalSalesValueFromHarvests,
            notes: sl.notes
        });
    }
    return reportItems.sort((a,b) => new Date(b.sowingDate).getTime() - new Date(a.sowingDate).getTime());
}

export async function exportSeedlingLifecycleToPDF(filters?: DateRangeFilters): Promise<void> {
    try {
        const reportData = await getSeedlingLifecycleReportData(filters);
        if (reportData.length === 0) {
            alert("No seedling lifecycle data for PDF report.");
            return;
        }
        const pdfDoc = await PDFDocument.create();
        let page = pdfDoc.addPage();
        const { height } = page.getSize();
        const margin = 30; // Smaller margin for more data
        const yPos = { y: height - margin };

        await addPdfHeader(pdfDoc, page, yPos);
        yPos.y -= 5;

        const tableHeaders = ["Sowing Date", "Crop", "Batch", "Sown", "Produced", "Available", "Planted", "Harvests", "Total Harvested", "Sales Value"];
        const columnWidths = [55, 70, 60, 50, 50, 50, 50, 45, 65, 65]; // Adjusted for more columns
        
        const tableData = reportData.map(item => [
            item.sowingDate, item.cropName || '-', item.seedBatchCode || '-',
            `${item.quantitySown || 0} ${item.sowingUnit || ''}`,
            item.actualSeedlingsProduced || 0, item.currentSeedlingsAvailable || 0,
            item.quantityPlanted || (item.plantingLogId ? 0 : '-'), // Show 0 if planted but no qty, '-' if not planted
            item.harvestsCount, item.totalQuantityHarvested, `€${item.totalSalesValueFromHarvests.toFixed(2)}`
        ]);

        page = await drawPdfTable(pdfDoc, page, yPos, tableHeaders, tableData, columnWidths, { margin, fontSize: 7, headerFontSize: 8, lineHeight: 10 });
        
        const pdfBytes = await pdfDoc.save();
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        saveAs(blob, `Hurvesthub_Seedling_Lifecycle_Report_${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (error) {
        console.error("Failed to generate seedling lifecycle PDF:", error);
        alert(`Error generating PDF: ${error instanceof Error ? error.message : String(error)}`);
    }
}

function convertSeedlingLifecycleToCSV(data: SeedlingLifecycleReportItem[]): string {
    const headers = ["Sowing Date", "Crop", "Seed Batch", "Qty Sown", "Sowing Unit", "Seedlings Produced", "Seedlings Available", "Planting Date", "Qty Planted", "Harvests Count", "Total Qty Harvested", "Total Sales Value (€)", "Seedling Log ID", "Planting Log ID", "Notes"];
    const csvRows = [headers.join(',')];
    data.forEach(item => {
        const row = [
            `"${item.sowingDate}"`, `"${item.cropName || ''}"`, `"${item.seedBatchCode || ''}"`,
            item.quantitySown || 0, `"${item.sowingUnit || ''}"`, item.actualSeedlingsProduced || 0,
            item.currentSeedlingsAvailable || 0, `"${item.plantingDate || ''}"`, item.quantityPlanted || '',
            item.harvestsCount, item.totalQuantityHarvested, item.totalSalesValueFromHarvests.toFixed(2),
            `"${item.seedlingLogId}"`, `"${item.plantingLogId || ''}"`, `"${(item.notes || '').replace(/"/g, '""')}"`
        ];
        csvRows.push(row.join(','));
    });
    return csvRows.join('\n');
}

export async function exportSeedlingLifecycleToCSV(filters?: DateRangeFilters): Promise<void> {
    try {
        const reportData = await getSeedlingLifecycleReportData(filters);
        if (reportData.length === 0) {
            alert("No seedling lifecycle data for CSV export.");
            return;
        }
        const csvData = convertSeedlingLifecycleToCSV(reportData);
        const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
        saveAs(blob, `Hurvesthub_Seedling_Lifecycle_Report_${new Date().toISOString().split('T')[0]}.csv`);
    } catch (error) {
        console.error("Failed to export seedling lifecycle to CSV:", error);
        alert(`Error exporting to CSV: ${error instanceof Error ? error.message : String(error)}`);
    }
}

// --- Organic Compliance Report ---
export interface OrganicComplianceReportItem {
    seedBatchId: string;
    batchCode: string;
    cropName?: string;
    supplier?: string;
    purchaseDate?: string;
    organicStatus?: string; // "Certified Organic", "Untreated", "Conventional"
    notes?: string; // Seed batch notes
}

async function getOrganicComplianceReportData(filters?: DateRangeFilters): Promise<OrganicComplianceReportItem[]> {
    let seedBatchesQuery = db.seedBatches.filter(sb => sb.is_deleted !== 1);
    if (filters?.startDate) {
        seedBatchesQuery = seedBatchesQuery.and(sb => !!sb.purchase_date && sb.purchase_date >= filters.startDate!);
    }
    if (filters?.endDate) {
        seedBatchesQuery = seedBatchesQuery.and(sb => !!sb.purchase_date && sb.purchase_date <= filters.endDate!);
    }
    const seedBatches = await seedBatchesQuery.toArray();
    const cropIds = seedBatches.map(sb => sb.crop_id).filter(id => id) as string[];
    const crops = await db.crops.where('id').anyOf(cropIds).toArray();
    const cropMap = new Map(crops.map(c => [c.id, c]));

    return seedBatches.map(sb => ({
        seedBatchId: sb.id,
        batchCode: sb.batch_code,
        cropName: cropMap.get(sb.crop_id)?.name,
        supplier: sb.supplier,
        purchaseDate: sb.purchase_date ? new Date(sb.purchase_date).toLocaleDateString() : undefined,
        organicStatus: sb.organic_status,
        notes: sb.notes
    })).sort((a,b) => (a.cropName || '').localeCompare(b.cropName || '') || (a.purchaseDate || '').localeCompare(b.purchaseDate || ''));
}

function convertOrganicComplianceToCSV(data: OrganicComplianceReportItem[]): string {
    const headers = ["Crop Name", "Seed Batch Code", "Supplier", "Purchase Date", "Organic Status", "Notes", "Seed Batch ID"];
    const csvRows = [headers.join(',')];
    data.forEach(item => {
        const row = [
            `"${item.cropName || ''}"`, `"${item.batchCode}"`, `"${item.supplier || ''}"`,
            `"${item.purchaseDate || ''}"`, `"${item.organicStatus || ''}"`,
            `"${(item.notes || '').replace(/"/g, '""')}"`, `"${item.seedBatchId}"`
        ];
        csvRows.push(row.join(','));
    });
    return csvRows.join('\n');
}
export async function exportOrganicComplianceToCSV(filters?: DateRangeFilters): Promise<void> {
    try {
        const reportData = await getOrganicComplianceReportData(filters);
        if (reportData.length === 0) { alert("No data for Organic Compliance Report."); return; }
        const csvData = convertOrganicComplianceToCSV(reportData);
        const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
        saveAs(blob, `Hurvesthub_Organic_Compliance_Report_${new Date().toISOString().split('T')[0]}.csv`);
    } catch (e) { console.error(e); alert(`Error: ${e instanceof Error ? e.message : String(e)}`); }
}

export async function exportOrganicComplianceToPDF(filters?: DateRangeFilters): Promise<void> {
    try {
        const reportData = await getOrganicComplianceReportData(filters);
        if (reportData.length === 0) { alert("No data for Organic Compliance PDF Report."); return; }
        
        const pdfDoc = await PDFDocument.create();
        let page = pdfDoc.addPage();
        const { height } = page.getSize();
        const margin = 40;
        const yPos = { y: height - margin };

        await addPdfHeader(pdfDoc, page, yPos);
        yPos.y -= 10;

        const tableHeaders = ["Crop", "Batch Code", "Supplier", "Purchase Date", "Organic Status", "Notes"];
        const columnWidths = [100, 80, 100, 70, 100, 100];
        
        const tableData = reportData.map(item => [
            item.cropName || '-',
            item.batchCode,
            item.supplier || '-',
            item.purchaseDate || '-',
            item.organicStatus || '-',
            item.notes || '-'
        ]);

        page = await drawPdfTable(pdfDoc, page, yPos, tableHeaders, tableData, columnWidths, { margin });
        
        const pdfBytes = await pdfDoc.save();
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        saveAs(blob, `Hurvesthub_Organic_Compliance_Report_${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (e) { console.error(e); alert(`Error: ${e instanceof Error ? e.message : String(e)}`); }
}

// --- Input Item Usage Ledger ---
export interface CultivationUsageDetail {
    cultivationLogId: string;
    activityDate: string;
    activityType: string;
    plotAffected?: string;
    quantityUsed?: number;
    notes?: string; // Cultivation log notes
}
export interface InputItemUsageLedgerDataItem {
    itemId: string;
    itemName: string;
    itemType?: string;
    initialQuantity?: number;
    quantityUnit?: string;
    purchaseDate?: string;
    totalUsed: number;
    currentQuantity?: number;
    usageDetails: CultivationUsageDetail[];
}

export async function getInputItemUsageLedgerData(filters?: { itemId?: string }): Promise<InputItemUsageLedgerDataItem[]> {
    const reportItems: InputItemUsageLedgerDataItem[] = [];
    let itemsToProcess: (InputInventory | SeedBatch)[] = [];

    if (filters?.itemId) {
        const inputItem = await db.inputInventory.get(filters.itemId);
        if (inputItem && inputItem.is_deleted !== 1) itemsToProcess.push(inputItem);
        else {
            const seedBatchItem = await db.seedBatches.get(filters.itemId);
            if (seedBatchItem && seedBatchItem.is_deleted !== 1) itemsToProcess.push(seedBatchItem);
        }
        if (itemsToProcess.length === 0) return []; // Item not found or deleted
    } else {
        const inputs = await db.inputInventory.filter(i => i.is_deleted !== 1).toArray();
        const seedBatches = await db.seedBatches.filter(sb => sb.is_deleted !== 1).toArray();
        itemsToProcess = [...inputs, ...seedBatches];
    }
    
    const cropCache = new Map<string, Crop>();

    for (const item of itemsToProcess) {
        const usageDetails: CultivationUsageDetail[] = [];
        let totalUsed = 0;
        let itemName = '';
        let itemType = '';

        if ('batch_code' in item) { // It's a SeedBatch
            itemType = 'Seed Batch';
            let crop = cropCache.get(item.crop_id);
            if (!crop) {
                crop = await db.crops.get(item.crop_id);
                if (crop) cropCache.set(item.crop_id, crop);
            }
            itemName = `${crop?.name || 'Unknown Crop'} Seeds (Batch: ${item.batch_code})`;
            // For seed batches, usage is indirect via SeedlingProductionLog then PlantingLog then CultivationLog (if inputs used on seedlings)
            // Or direct via PlantingLog (direct sowing) then CultivationLog.
            // This report focuses on InputInventory usage in CultivationLogs. Seed batch usage is more complex.
            // For now, we'll assume this report is primarily for InputInventory items.
            // To include seed batch usage, we'd need to trace through planting/seedling logs.
        } else { // It's an InputInventory
            itemName = item.name;
            itemType = item.type || 'General Input';
            const cultivationLogs = await db.cultivationLogs
                .where({ input_inventory_id: item.id, is_deleted: 0 })
                .toArray();

            for (const log of cultivationLogs) {
                const qtyUsed = log.input_quantity_used || 0;
                totalUsed += qtyUsed;
                usageDetails.push({
                    cultivationLogId: log.id,
                    activityDate: new Date(log.activity_date).toLocaleDateString(),
                    activityType: log.activity_type,
                    plotAffected: log.plot_affected,
                    quantityUsed: qtyUsed,
                    notes: log.notes
                });
            }
        }
        
        // Only add if it's an InputInventory item for this version of the report
        if (!('batch_code' in item)) {
            reportItems.push({
                itemId: item.id,
                itemName: itemName,
                itemType: itemType,
                initialQuantity: item.initial_quantity,
                quantityUnit: item.quantity_unit,
                purchaseDate: item.purchase_date ? new Date(item.purchase_date).toLocaleDateString() : undefined,
                totalUsed: totalUsed,
                currentQuantity: item.current_quantity,
                usageDetails: usageDetails.sort((a,b) => new Date(b.activityDate).getTime() - new Date(a.activityDate).getTime()),
            });
        }
    }
    return reportItems.sort((a,b) => a.itemName.localeCompare(b.itemName));
}


export async function exportInputItemUsageLedgerToPDF(filters?: { itemId?: string }): Promise<void> {
    try {
        const reportData = await getInputItemUsageLedgerData(filters);
        if (reportData.length === 0) {
            alert("No data for Input Item Usage Ledger PDF.");
            return;
        }

        const pdfDoc = await PDFDocument.create();
        const mainFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
        const margin = 40;
        let page = pdfDoc.addPage();
        let { width: pageWidth, height: pageHeight } = page.getSize();
        let y = pageHeight - margin;

        const drawTextLine = (text: string, currentY: number, size: number, font: PDFFont = mainFont, xOffset: number = 0) => {
            if (currentY < margin + size) { // Check for new page
                page = pdfDoc.addPage();
                ({ width: pageWidth, height: pageHeight } = page.getSize());
                currentY = pageHeight - margin;
            }
            page.drawText(text, { x: margin + xOffset, y: currentY, font, size });
            return currentY - (size * 1.2);
        };
        
        for (const item of reportData) {
            y = drawTextLine(`Ledger for: ${item.itemName}`, y, 14, boldFont);
            y = drawTextLine(`Item ID: ${item.itemId}`, y, 10);
            y = drawTextLine(`Type: ${item.itemType || 'N/A'}`, y, 10);
            y = drawTextLine(`Purchase Date: ${item.purchaseDate || 'N/A'}`, y, 10);
            y = drawTextLine(`Initial Quantity: ${item.initialQuantity || 0} ${item.quantityUnit || ''}`, y, 10);
            y = drawTextLine(`Total Used: ${item.totalUsed} ${item.quantityUnit || ''}`, y, 10);
            y = drawTextLine(`Current Quantity: ${item.currentQuantity || 0} ${item.quantityUnit || ''}`, y, 10);
            y -= 10; // Extra space

            if (item.usageDetails.length > 0) {
                y = drawTextLine("Usage Details:", y, 12, boldFont);
                
                // Table Headers for usage
                const useHeaders = ["Date", "Activity", "Plot", "Qty Used", "Notes"];
                const useColWidths = [70, 120, 100, 70, pageWidth - margin*2 - 70-120-100-70 -10]; // Last col takes remainder
                let headerX = margin;
                useHeaders.forEach((header, idx) => {
                    page.drawText(header, {x: headerX, y, font: boldFont, size: 9});
                    headerX += useColWidths[idx] + 5;
                });
                y -= 12;

                for (const detail of item.usageDetails) {
                    if (y < margin + 40) { // Check for new page before drawing row
                        page = pdfDoc.addPage();
                        ({ width: pageWidth, height: pageHeight } = page.getSize());
                        y = pageHeight - margin;
                        // Redraw item header if new page for same item
                        y = drawTextLine(`Ledger for: ${item.itemName} (continued)`, y, 14, boldFont);
                        y -=5;
                        headerX = margin;
                        useHeaders.forEach((header, idx) => { // Redraw headers on new page
                            page.drawText(header, {x: headerX, y, font: boldFont, size: 9});
                            headerX += useColWidths[idx] + 5;
                        });
                        y -= 12;
                    }

                    let cellX = margin;
                    const detailRow = [
                        detail.activityDate,
                        detail.activityType,
                        detail.plotAffected || '-',
                        String(detail.quantityUsed || 0),
                        detail.notes || '-'
                    ];
                    detailRow.forEach((cell, idx) => {
                        const lines = splitTextToFit(cell, useColWidths[idx], mainFont, 8);
                        let lineY = y;
                        lines.forEach(l => {
                             page.drawText(l, {x: cellX, y: lineY, font: mainFont, size: 8});
                             lineY -= 9; // line height for 8pt font
                        });
                        if (idx === 0) y = lineY + 9 - (lines.length > 1 ? (lines.length * 9) : 12) ; // Adjust y based on max lines in first cell or fixed
                        cellX += useColWidths[idx] + 5;
                    });
                     y -= (splitTextToFit(detailRow[4], useColWidths[4], mainFont, 8).length * 9) + 3; // Adjust Y based on notes height + padding
                }
            } else {
                y = drawTextLine("No usage recorded.", y, 10);
            }
            y -= 20; // Space before next item
             if (y < margin + 50 && reportData.indexOf(item) < reportData.length -1 ) { // Check for new page before next item
                page = pdfDoc.addPage();
                ({ width: pageWidth, height: pageHeight } = page.getSize());
                y = pageHeight - margin;
            }
        }

        const pdfBytes = await pdfDoc.save();
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        saveAs(blob, `Hurvesthub_InputItem_UsageLedger_${filters?.itemId || 'AllItems'}_${new Date().toISOString().split('T')[0]}.pdf`);

    } catch (error) {
        console.error("Failed to generate Input Item Usage Ledger PDF:", error);
        alert(`Error generating PDF: ${error instanceof Error ? error.message : String(error)}`);
    }
}


// --- Grouped Inventory Summary ---
export interface GroupedInventoryItemReportData {
    itemName: string; // e.g., "Tomato Seeds", "Fertilizer A"
    itemType: string; // "Seed Batch" or specific input type
    totalCurrentQuantity: number;
    quantityUnit: string;
    numberOfBatchesOrItems: number; // Count of distinct seed batches or input items
    detailsLink?: string; // Optional: link to a more detailed view or report
}

export async function getGroupedInventorySummaryData(): Promise<GroupedInventoryItemReportData[]> {
    const allInputs = await db.inputInventory.filter(i => i.is_deleted !== 1).toArray();
    const allSeedBatches = await db.seedBatches.filter(sb => sb.is_deleted !== 1).toArray();
    const allCrops = await db.crops.filter(c => c.is_deleted !== 1).toArray();
    const cropMap = new Map(allCrops.map(c => [c.id, c]));

    const groupedData: Record<string, GroupedInventoryItemReportData> = {};

    allInputs.forEach(item => {
        const key = `${item.name}_${item.type || 'General Input'}_${item.quantity_unit || 'units'}`;
        if (!groupedData[key]) {
            groupedData[key] = {
                itemName: item.name,
                itemType: item.type || 'General Input',
                totalCurrentQuantity: 0,
                quantityUnit: item.quantity_unit || 'units',
                numberOfBatchesOrItems: 0,
            };
        }
        groupedData[key].totalCurrentQuantity += item.current_quantity || 0;
        groupedData[key].numberOfBatchesOrItems += 1;
    });

    allSeedBatches.forEach(batch => {
        const crop = cropMap.get(batch.crop_id);
        const itemName = `${crop?.name || 'Unknown Crop'} Seeds`;
        const key = `${itemName}_Seed Batch_${batch.quantity_unit || 'units'}`;
        if (!groupedData[key]) {
            groupedData[key] = {
                itemName: itemName,
                itemType: 'Seed Batch',
                totalCurrentQuantity: 0,
                quantityUnit: batch.quantity_unit || 'units',
                numberOfBatchesOrItems: 0,
            };
        }
        groupedData[key].totalCurrentQuantity += batch.current_quantity || 0;
        groupedData[key].numberOfBatchesOrItems += 1; // Each batch is distinct
    });

    return Object.values(groupedData).sort((a,b) => a.itemName.localeCompare(b.itemName));
}

export async function exportGroupedInventorySummaryToPDF(): Promise<void> {
    try {
        const reportData = await getGroupedInventorySummaryData();
        if (reportData.length === 0) {
            alert("No data for Grouped Inventory Summary PDF.");
            return;
        }
        const pdfDoc = await PDFDocument.create();
        let page = pdfDoc.addPage();
        const { height } = page.getSize();
        const margin = 40;
        const yPos = { y: height - margin };

        await addPdfHeader(pdfDoc, page, yPos);
        yPos.y -= 10;
        page.drawText("Grouped Inventory Summary", { x: margin, y: yPos.y, font: await pdfDoc.embedFont(StandardFonts.HelveticaBold), size: 16});
        yPos.y -= 20;


        const tableHeaders = ["Item Name", "Type", "Total Current Qty", "Unit", "# Batches/Items"];
        const columnWidths = [150, 100, 100, 80, 80];
        
        const tableData = reportData.map(item => [
            item.itemName,
            item.itemType,
            item.totalCurrentQuantity,
            item.quantityUnit,
            item.numberOfBatchesOrItems
        ]);

        page = await drawPdfTable(pdfDoc, page, yPos, tableHeaders, tableData, columnWidths, { margin });
        
        const pdfBytes = await pdfDoc.save();
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        saveAs(blob, `Hurvesthub_Grouped_Inventory_Summary_${new Date().toISOString().split('T')[0]}.pdf`);

    } catch (error) {
        console.error("Failed to generate Grouped Inventory Summary PDF:", error);
        alert(`Error generating PDF: ${error instanceof Error ? error.message : String(error)}`);
    }
}

// --- Detailed Input Usage Report ---
export interface DetailedInputUsageReportItem {
    cultivationLogId: string;
    activityDate: string;
    activityType: string;
    inputName: string; // Name of the InputInventory item
    inputType?: string;
    quantityUsed?: number;
    quantityUnit?: string;
    plantingLogId: string;
    cropName?: string; // From PlantingLog -> SeedBatch -> Crop
    plotAffected?: string; // From CultivationLog or PlantingLog
    notes?: string; // CultivationLog notes
}

export async function getDetailedInputUsageData(filters?: DateRangeFilters): Promise<DetailedInputUsageReportItem[]> {
    let cultivationLogsQuery = db.cultivationLogs.filter(cl => cl.is_deleted !== 1 && !!cl.input_inventory_id); // Only logs that used an input
    if (filters?.startDate) {
        cultivationLogsQuery = cultivationLogsQuery.and(cl => cl.activity_date >= filters.startDate!);
    }
    if (filters?.endDate) {
        cultivationLogsQuery = cultivationLogsQuery.and(cl => cl.activity_date <= filters.endDate!);
    }
    const cultivationLogs = await cultivationLogsQuery.toArray();

    const inputInventoryIds = cultivationLogs.map(cl => cl.input_inventory_id).filter(id => id) as string[];
    const plantingLogIds = cultivationLogs.map(cl => cl.planting_log_id).filter(id => id) as string[];

    const [inputInventories, plantingLogs, seedBatches, crops] = await Promise.all([
        db.inputInventory.where('id').anyOf(inputInventoryIds).toArray(),
        db.plantingLogs.where('id').anyOf(plantingLogIds).toArray(),
        db.seedBatches.filter(sb => sb.is_deleted !== 1).toArray(), // Fetch all for linking
        db.crops.filter(c => c.is_deleted !== 1).toArray() // Fetch all for linking
    ]);

    const inputMap = new Map(inputInventories.map(i => [i.id, i]));
    const plantingMap = new Map(plantingLogs.map(p => [p.id, p]));
    const seedBatchMap = new Map(seedBatches.map(sb => [sb.id, sb]));
    const cropMap = new Map(crops.map(c => [c.id, c]));

    const reportItems: DetailedInputUsageReportItem[] = [];
    for (const cl of cultivationLogs) {
        const input = inputMap.get(cl.input_inventory_id!);
        const plantingLog = plantingMap.get(cl.planting_log_id);
        let cropName: string | undefined;
        if (plantingLog && plantingLog.seed_batch_id) {
            const seedBatch = seedBatchMap.get(plantingLog.seed_batch_id);
            if (seedBatch) {
                const crop = cropMap.get(seedBatch.crop_id);
                cropName = crop?.name;
            }
        }

        reportItems.push({
            cultivationLogId: cl.id,
            activityDate: new Date(cl.activity_date).toLocaleDateString(),
            activityType: cl.activity_type,
            inputName: input?.name || 'Unknown Input',
            inputType: input?.type,
            quantityUsed: cl.input_quantity_used,
            quantityUnit: cl.input_quantity_unit || input?.quantity_unit,
            plantingLogId: cl.planting_log_id,
            cropName: cropName || (plantingLog ? 'N/A (No Seed Batch)' : 'N/A (No Planting Log)'),
            plotAffected: cl.plot_affected || plantingLog?.plot_affected,
            notes: cl.notes
        });
    }
    return reportItems.sort((a,b) => new Date(b.activityDate).getTime() - new Date(a.activityDate).getTime() || a.inputName.localeCompare(b.inputName));
}

function convertDetailedInputUsageToCSV(data: DetailedInputUsageReportItem[]): string {
  const headers = ["Activity Date", "Activity Type", "Input Name", "Input Type", "Qty Used", "Unit", "Crop Name", "Plot Affected", "Cultivation Notes", "Cultivation Log ID", "Planting Log ID"];
  const csvRows = [headers.join(',')];
  data.forEach(item => {
    const row = [
      `"${item.activityDate}"`, `"${item.activityType}"`, `"${item.inputName}"`, `"${item.inputType || ''}"`,
      item.quantityUsed || 0, `"${item.quantityUnit || ''}"`, `"${item.cropName || ''}"`,
      `"${item.plotAffected || ''}"`, `"${(item.notes || '').replace(/"/g, '""')}"`,
      `"${item.cultivationLogId}"`, `"${item.plantingLogId}"`
    ];
    csvRows.push(row.join(','));
  });
  return csvRows.join('\n');
}

export async function exportDetailedInputUsageToCSV(filters?: DateRangeFilters): Promise<void> {
    try {
        const reportData = await getDetailedInputUsageData(filters);
        if (reportData.length === 0) { alert("No detailed input usage data for CSV."); return; }
        const csvData = convertDetailedInputUsageToCSV(reportData);
        const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
        saveAs(blob, `Hurvesthub_Detailed_Input_Usage_${new Date().toISOString().split('T')[0]}.csv`);
    } catch (e) { console.error(e); alert(`Error: ${e instanceof Error ? e.message : String(e)}`); }
}
export async function exportDetailedInputUsageToPDF(filters?: DateRangeFilters): Promise<void> {
    try {
        const reportData = await getDetailedInputUsageData(filters);
        if (reportData.length === 0) { alert("No detailed input usage data for PDF."); return; }

        const pdfDoc = await PDFDocument.create();
        let page = pdfDoc.addPage();
        const { height } = page.getSize();
        const margin = 35; // Slightly smaller margin
        const yPos = { y: height - margin };

        await addPdfHeader(pdfDoc, page, yPos);
        yPos.y -= 5;
        page.drawText("Detailed Input Usage Report", { x: margin, y: yPos.y, font: await pdfDoc.embedFont(StandardFonts.HelveticaBold), size: 16});
        yPos.y -= 20;

        const tableHeaders = ["Date", "Activity", "Input", "Type", "Qty Used", "Unit", "Crop", "Plot"];
        const columnWidths = [60, 90, 100, 70, 50, 40, 80, 70]; 
        
        const tableData = reportData.map(item => [
            item.activityDate,
            item.activityType,
            item.inputName,
            item.inputType || '-',
            item.quantityUsed !== undefined ? String(item.quantityUsed) : '-',
            item.quantityUnit || '-',
            item.cropName || '-',
            item.plotAffected || '-'
            // item.notes could be added if space allows or in a sub-row
        ]);

        page = await drawPdfTable(pdfDoc, page, yPos, tableHeaders, tableData, columnWidths, { margin, fontSize: 7, headerFontSize: 8, lineHeight: 10 });
        
        const pdfBytes = await pdfDoc.save();
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        saveAs(blob, `Hurvesthub_Detailed_Input_Usage_${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (e) { console.error(e); alert(`Error: ${e instanceof Error ? e.message : String(e)}`); }
}


// --- Seed Source Declaration Report ---
export interface SeedSourceDeclarationReportItem {
    cropName: string;
    variety?: string;
    seedBatchCode: string;
    supplier?: string;
    purchaseDate?: string;
    organicStatus?: string; // "Certified Organic", "Untreated", "GMO", "Non-GMO", "Pelleted" etc.
    lotNumber?: string; // Often part of batch code or a separate field if available
    originCountry?: string; // If available
    conformityDeclarationAvailable: boolean; // e.g., a check if docs exist
    notes?: string; // Seed batch notes
}

export async function getSeedSourceDeclarationData(filters?: DateRangeFilters): Promise<SeedSourceDeclarationReportItem[]> {
    let seedBatchesQuery = db.seedBatches.filter(sb => sb.is_deleted !== 1);
    // Apply date filters if provided (e.g., filter by purchase_date of seed batches)
    if (filters?.startDate) {
        seedBatchesQuery = seedBatchesQuery.and(sb => !!sb.purchase_date && sb.purchase_date >= filters.startDate!);
    }
    if (filters?.endDate) {
        seedBatchesQuery = seedBatchesQuery.and(sb => !!sb.purchase_date && sb.purchase_date <= filters.endDate!);
    }
    const seedBatches = await seedBatchesQuery.toArray();
    const cropIds = seedBatches.map(sb => sb.crop_id).filter(id => id) as string[];
    const crops = await db.crops.where('id').anyOf(cropIds).toArray();
    const cropMap = new Map(crops.map(c => [c.id, c]));

    return seedBatches.map(sb => {
        const crop = cropMap.get(sb.crop_id);
        return {
            cropName: crop?.name || 'Unknown Crop',
            variety: crop?.variety,
            seedBatchCode: sb.batch_code,
            supplier: sb.supplier,
            purchaseDate: sb.purchase_date ? new Date(sb.purchase_date).toLocaleDateString() : undefined,
            organicStatus: sb.organic_status,
            // lotNumber: sb.lot_number, // Assuming lot_number might be a field on SeedBatch
            // originCountry: sb.origin_country, // Assuming origin_country might be a field
            conformityDeclarationAvailable: false, // Placeholder - needs actual logic if tracking docs
            notes: sb.notes
        };
    }).sort((a,b) => a.cropName.localeCompare(b.cropName) || (a.variety || '').localeCompare(b.variety || ''));
}

export async function exportSeedSourceDeclarationToPDF(filters?: DateRangeFilters): Promise<void> {
    try {
        const reportData = await getSeedSourceDeclarationData(filters);
        if (reportData.length === 0) { alert("No data for Seed Source Declaration PDF."); return; }
        
        const pdfDoc = await PDFDocument.create();
        let page = pdfDoc.addPage();
        const { height } = page.getSize();
        const margin = 30;
        const yPos = { y: height - margin };

        await addPdfHeader(pdfDoc, page, yPos);
        yPos.y -= 5;
        page.drawText("Seed Source Declaration Report", { x: margin, y: yPos.y, font: await pdfDoc.embedFont(StandardFonts.HelveticaBold), size: 14});
        yPos.y -= 20;

        const tableHeaders = ["Crop", "Variety", "Batch Code", "Supplier", "Purchase Date", "Organic Status", "Declaration"];
        const columnWidths = [100, 80, 80, 100, 70, 90, 50];
        
        const tableData = reportData.map(item => [
            item.cropName,
            item.variety || '-',
            item.seedBatchCode,
            item.supplier || '-',
            item.purchaseDate || '-',
            item.organicStatus || '-',
            item.conformityDeclarationAvailable ? 'Yes' : 'No'
        ]);

        page = await drawPdfTable(pdfDoc, page, yPos, tableHeaders, tableData, columnWidths, { margin, fontSize: 7, headerFontSize: 8, lineHeight: 10 });
        
        const pdfBytes = await pdfDoc.save();
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        saveAs(blob, `Hurvesthub_Seed_Source_Declaration_${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (e) { console.error(e); alert(`Error: ${e instanceof Error ? e.message : String(e)}`); }
}

function convertSeedSourceDeclarationToCSV(data: SeedSourceDeclarationReportItem[]): string {
  const headers = ["Crop Name", "Variety", "Seed Batch Code", "Supplier", "Purchase Date", "Organic Status", "Conformity Declaration", "Notes"];
  const csvRows = [headers.join(',')];
  data.forEach(item => {
    const row = [
      `"${item.cropName}"`, `"${item.variety || ''}"`, `"${item.seedBatchCode}"`,
      `"${item.supplier || ''}"`, `"${item.purchaseDate || ''}"`, `"${item.organicStatus || ''}"`,
      item.conformityDeclarationAvailable ? 'Yes' : 'No', `"${(item.notes || '').replace(/"/g, '""')}"`
    ];
    csvRows.push(row.join(','));
  });
  return csvRows.join('\n');
}

export async function exportSeedSourceDeclarationToCSV(filters?: DateRangeFilters): Promise<void> {
    try {
        const reportData = await getSeedSourceDeclarationData(filters);
        if (reportData.length === 0) { alert("No data for Seed Source Declaration CSV."); return; }
        const csvData = convertSeedSourceDeclarationToCSV(reportData);
        const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
        saveAs(blob, `Hurvesthub_Seed_Source_Declaration_${new Date().toISOString().split('T')[0]}.csv`);
    } catch (e) { console.error(e); alert(`Error: ${e instanceof Error ? e.message : String(e)}`); }
}