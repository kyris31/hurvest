import { db } from './db';
import type { Sale, SaleItem, Customer, HarvestLog, PlantingLog, Crop, SeedBatch, Invoice, InputInventory, Supplier, Flock, FeedLog, FlockRecord } from './db'; // Added Flock, FeedLog, FlockRecord
import { saveAs } from 'file-saver';
import { PDFDocument, StandardFonts, rgb, PDFFont, PDFPage, RGB } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';

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
    console.log("[getAllInventoryForReport] Filters received:", JSON.stringify(filters));

    let inputsQuery = db.inputInventory.filter(i => i.is_deleted !== 1);
    let seedBatchesQueryInitial = db.seedBatches.filter(sb => sb.is_deleted !== 1); // Initial query for seed batches

    if (filters?.category) {
        console.log(`[getAllInventoryForReport] Filtering by category: ${filters.category}`);
        if (filters.category === 'Seed Batch') {
            inputsQuery = inputsQuery.and(() => false);
        } else {
            inputsQuery = inputsQuery.and(i => i.type === filters.category);
            seedBatchesQueryInitial = seedBatchesQueryInitial.and(() => false);
        }
    }
    
    // Log count before date filtering for the active category
    if (!filters?.category || filters.category === 'Seed Batch') {
        const preDateFilterSeedBatches = await db.seedBatches.filter(sb => sb.is_deleted !== 1).toArray();
        console.log(`[getAllInventoryForReport] Total Seed Batches (is_deleted !== 1): ${preDateFilterSeedBatches.length}`);
    }


    let seedBatchesFilteredByDate = await seedBatchesQueryInitial.toArray(); // Get initial set based on category
    console.log(`[getAllInventoryForReport] Seed Batches after category filter (before date): ${seedBatchesFilteredByDate.length}`);


    if (filters?.startDate) {
        const startFilter = new Date(filters.startDate).toISOString().split('T')[0];
        console.log(`[getAllInventoryForReport] Applying startDate filter: ${startFilter}`);
        inputsQuery = inputsQuery.and(i => {
            const itemDateSource = i.purchase_date || i.created_at;
            const itemDate = itemDateSource ? itemDateSource.split('T')[0] : null;
            return !!itemDate && itemDate >= startFilter;
        });
        // Filter seedBatchesFilteredByDate array manually for logging and precision
        seedBatchesFilteredByDate = seedBatchesFilteredByDate.filter(sb => {
            const itemDateSource = sb.date_added_to_inventory || sb.purchase_date || sb.created_at;
            const itemDate = itemDateSource ? itemDateSource.split('T')[0] : null;
            const passes = !!itemDate && itemDate >= startFilter;
            // console.log(`[SeedBatch Start Check] ID: ${sb.id}, Date: ${itemDate}, Filter: ${startFilter}, Passes: ${passes}`);
            return passes;
        });
    }
    if (filters?.endDate) {
        const endFilter = new Date(filters.endDate).toISOString().split('T')[0];
        console.log(`[getAllInventoryForReport] Applying endDate filter: ${endFilter}`);
        inputsQuery = inputsQuery.and(i => {
            const itemDateSource = i.purchase_date || i.created_at;
            const itemDate = itemDateSource ? itemDateSource.split('T')[0] : null;
            return !!itemDate && itemDate <= endFilter;
        });
        // Filter seedBatchesFilteredByDate array manually
        seedBatchesFilteredByDate = seedBatchesFilteredByDate.filter(sb => {
            const itemDateSource = sb.date_added_to_inventory || sb.purchase_date || sb.created_at;
            const itemDate = itemDateSource ? itemDateSource.split('T')[0] : null;
            const passes = !!itemDate && itemDate <= endFilter;
            // console.log(`[SeedBatch End Check] ID: ${sb.id}, Date: ${itemDate}, Filter: ${endFilter}, Passes: ${passes}`);
            return passes;
        });
    }
    
    const [inputs, crops, suppliers] = await Promise.all([
        inputsQuery.toArray(),
        // seedBatchesQuery.toArray(), // We use seedBatchesFilteredByDate now
        db.crops.filter(c => c.is_deleted !== 1).toArray(),
        db.suppliers.filter(s => s.is_deleted !== 1).toArray()
    ]);
    const seedBatches = seedBatchesFilteredByDate; // Use the manually filtered array

    console.log(`[getAllInventoryForReport] Inputs count after all filters: ${inputs.length}`);
    console.log(`[getAllInventoryForReport] Seed Batches count after all filters: ${seedBatches.length}`);

    const supplierMap = new Map(suppliers.map(s => [s.id, s.name]));

    const reportItems: InventoryReportItem[] = [];

    inputs.forEach(input => {
        reportItems.push({
            itemId: input.id,
            itemName: input.name,
            itemType: input.type || 'General Input', // Ensure itemType is set
            supplier: input.supplier_id ? supplierMap.get(input.supplier_id) : undefined,
            purchaseDate: input.purchase_date ? new Date(input.purchase_date).toLocaleDateString() : '',
            initialQuantity: input.initial_quantity,
            currentQuantity: input.current_quantity,
            quantityUnit: input.quantity_unit,
            costPerUnit: undefined, // This report doesn't show cost per unit, value report does
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
            supplier: batch.supplier_id ? supplierMap.get(batch.supplier_id) : undefined,
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
        db.seedBatches.filter(sb => sb.is_deleted !== 1).toArray(), 
        db.crops.filter(c => c.is_deleted !== 1).toArray() 
    ]);
    
    const reportItems: HarvestReportItem[] = [];

    for (const hLog of harvestLogs) {
        const pLog = plantingLogs.find(pl => pl.id === hLog.planting_log_id);
        let crop: Crop | undefined;

        if (pLog && pLog.seed_batch_id) {
            const sBatch = seedBatches.find(sb => sb.id === pLog.seed_batch_id);
            if (sBatch) {
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
            location: pLog?.location_description || 'N/A',
            quantityHarvested: hLog.quantity_harvested,
            quantityUnit: hLog.quantity_unit,
            qualityGrade: hLog.quality_grade,
            notes: hLog.notes, 
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
            `"${(item.notes || '').replace(/"/g, '""')}"`, 
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
    const inventoryItems = await getAllInventoryForReport(filters); // Re-use the detailed fetch
    const valuedReportItems: InventoryValueReportDataItem[] = [];

    inventoryItems.forEach(item => {
        let costPerUnit = item.costPerUnit; // From getAllInventoryForReport (already calculated for seed batches)
        
        if (item.itemType !== 'Seed Batch' && item.itemId) {
            // For general inputs, we might need to fetch original cost if not directly on item
            // This example assumes costPerUnit might be missing or needs recalculation
            // For simplicity, if costPerUnit is undefined, we'll try to derive it if possible
            // or leave it as is. A more robust solution might fetch original purchase details.
            // The current `getAllInventoryForReport` sets costPerUnit to undefined for general inputs.
            // We'll need to adjust if general inputs should have costs calculated here.
            // For now, we'll assume general inputs don't have a costPerUnit for this report
            // unless it was somehow populated (which it isn't by default in getAllInventoryForReport).
        }

        const currentQuantity = item.currentQuantity ?? 0;
        const calculatedCostPerUnit = costPerUnit ?? 0; // Default to 0 if undefined
        const totalValue = currentQuantity * calculatedCostPerUnit;

        valuedReportItems.push({
            ...item,
            costPerUnit: calculatedCostPerUnit,
            totalValue,
        });
    });
    
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
        "Purchase Date", "Initial Quantity", "Current Quantity", "Quantity Unit",
        "Cost Per Unit (€)", "Total Value (€)", "Notes", "Last Modified"
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
            item.costPerUnit?.toFixed(2) ?? '0.00',
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
            alert("No inventory value data available for CSV export.");
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
            alert("No inventory value data available for PDF report with selected filters.");
            return;
        }

        const pdfDoc = await PDFDocument.create();
        pdfDoc.registerFontkit(fontkit);
        let page = pdfDoc.addPage();
        const { height } = page.getSize();
        const margin = 40;
        const yPos = { y: height - margin };

        const fontBytes = await fetch('/fonts/static/NotoSans-Regular.ttf').then(res => res.arrayBuffer());
        const boldFontBytes = await fetch('/fonts/static/NotoSans-Bold.ttf').then(res => res.arrayBuffer());
        const customFont = await pdfDoc.embedFont(fontBytes);
        const customBoldFont = await pdfDoc.embedFont(boldFontBytes);

        await addPdfHeader(pdfDoc, page, yPos, customFont, customBoldFont); 
        yPos.y -= 10; // Space after header

        const tableHeaders = ["Item Name", "Type", "Crop", "Batch", "Supplier", "Qty", "Cost/Unit", "Total Value"];
        const columnWidths = [100, 70, 70, 70, 80, 40, 50, 70]; 
        
        const tableData = reportData.map(item => [
            item.itemName,
            item.itemType,
            item.cropName || '',
            item.batchCode || '',
            item.supplier || '',
            item.currentQuantity ?? '',
            item.costPerUnit ? `€${item.costPerUnit.toFixed(2)}` : '-',
            `€${item.totalValue.toFixed(2)}`
        ]);

        page = await drawPdfTable(pdfDoc, page, yPos, tableHeaders, tableData, columnWidths, { margin, font: customFont, boldFont: customBoldFont });

        const pdfBytes = await pdfDoc.save();
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        const now = new Date();
        const dateStamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        saveAs(blob, `Hurvesthub_Inventory_Value_Report_${dateStamp}.pdf`);

    } catch (error) {
        console.error("Failed to generate inventory value PDF:", error);
        alert(`Error generating inventory value PDF: ${error instanceof Error ? error.message : String(error)}`);
    }
}


// Helper function to split text to fit within a cell width
const splitTextToFit = (text: string, maxWidth: number, textFont: PDFFont, textSize: number): string[] => {
    const words = text.split(' ');
    const lines: string[] = [];
    let currentLine = '';

    for (const word of words) {
        const testLine = currentLine ? `${currentLine} ${word}` : word;
        const width = textFont.widthOfTextAtSize(testLine, textSize);
        if (width < maxWidth) {
            currentLine = testLine;
        } else {
            if (currentLine) lines.push(currentLine); // Push the line before it got too long
            currentLine = word; // Start new line with the word that was too long
            // If a single word is too long, it will be pushed as is and overflow.
            // A more sophisticated solution might break words, but this is simpler.
            if (textFont.widthOfTextAtSize(currentLine, textSize) > maxWidth) {
                 lines.push(currentLine); // Push the long word on its own line
                 currentLine = '';
            }
        }
    }
    if (currentLine) lines.push(currentLine); // Push the last line
    return lines.length > 0 ? lines : ['']; // Ensure at least one empty line if text was empty
};

async function addPdfHeader(pdfDoc: PDFDocument, page: PDFPage, yPos: { y: number }, font: PDFFont, boldFont: PDFFont) {
    const { width: pageWidth } = page.getSize();
    const margin = 40;
    let currentY = yPos.y;
    let logoImage: import('pdf-lib').PDFImage | undefined = undefined;
    let logoHeightForCalc = 0;

    // Logo
    try {
        const logoBytes = await fetch('/LOGO.png').then(res => res.arrayBuffer());
        logoImage = await pdfDoc.embedPng(logoBytes);
        const logoWidth = 50;
        logoHeightForCalc = logoImage.height * (logoWidth / logoImage.width);
        page.drawImage(logoImage, {
            x: margin,
            y: currentY - logoHeightForCalc,
            width: logoWidth,
            height: logoHeightForCalc,
        });
    } catch (e) {
        console.warn("Could not load or embed logo for PDF header:", e);
    }
    
    // Company Details
    const companyDetails = [
        "K.K. Biofresh",
        "1ης Απριλίου 300",
        "7520 Ξυλοφάγου, Λάρνακα",
        "Phone: 99611241",
        "Email: kyris31@gmail.com"
    ];
    const companyDetailSize = 8;
    const companyDetailLineHeight = 10;
    let companyDetailsY = currentY - logoHeightForCalc - companyDetailLineHeight; // Start below logo

    if (logoImage) { // If logo is present, start details below it
         companyDetailsY = currentY - logoHeightForCalc - companyDetailLineHeight;
    } else { // If no logo, start from a bit lower than the top margin
         companyDetailsY = currentY - companyDetailLineHeight - 10;
    }

    companyDetails.forEach(detail => {
        page.drawText(detail, {
            x: margin,
            y: companyDetailsY,
            font: font,
            size: companyDetailSize,
            color: rgb(0.2, 0.2, 0.2)
        });
        companyDetailsY -= companyDetailLineHeight;
    });
    
    // Date (align with right margin, ensure it's below logo or at a similar height)
    const dateText = `Generated: ${new Date().toLocaleDateString()}`;
    const dateSize = 8;
    const dateWidth = font.widthOfTextAtSize(dateText, dateSize);
    
    // Adjust Y for date to be roughly aligned with top of logo or slightly below if no logo
    const dateYPosition = currentY - dateSize - 5;

    page.drawText(dateText, {
        x: pageWidth - margin - dateWidth,
        y: dateYPosition,
        font: font,
        size: dateSize,
        color: rgb(0.3,0.3,0.3)
    });
    
    // Determine the lowest point reached by either logo/company details or the date text to set the new currentY
    const bottomOfCompanyDetails = companyDetailsY + companyDetailLineHeight; // add back one line height as companyDetailsY is the start of the next line
    const bottomOfDate = dateYPosition - dateSize; // Approximate bottom of date text
    
    currentY = Math.min(bottomOfCompanyDetails, bottomOfDate) - 20; // Space after header elements

    yPos.y = currentY;
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
        boldFont?: PDFFont, 
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
): Promise<PDFPage> { 
    const { width: pageWidth, height: pageHeight } = page.getSize();
    const effectiveMargin = options?.margin ?? 40;
    const effectivePageBottomMargin = options?.pageBottomMargin ?? effectiveMargin + 40; 
    const effectiveFont = options?.font ?? await pdfDoc.embedFont(StandardFonts.Helvetica);
    const effectiveHeaderFont = options?.headerFont ?? options?.boldFont ?? await pdfDoc.embedFont(StandardFonts.HelveticaBold); 
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
    const headerLineHeight = effectiveLineHeight * 1.2; 

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
        // const textWidth = effectiveHeaderFont.widthOfTextAtSize(header, effectiveHeaderFontSize); // Not needed for left align
        // const textX = x + (colWidth - textWidth) / 2; // Center text
        currentPage.drawText(header, { x: x + cellPadding, y: currentY - headerLineHeight + cellPadding + 2, font: effectiveHeaderFont, size: effectiveHeaderFontSize, color: effectiveHeaderTextColor });
        x += colWidth;
    });
    currentY -= headerLineHeight;

    currentPage.drawLine({
        start: { x: effectiveMargin, y: currentY },
        end: { x: pageWidth - effectiveMargin, y: currentY },
        thickness: 0.5, color: effectiveBorderColor
    });


    // Draw Rows
    tableData.forEach((row, rowIndex) => {
        let maxRowHeight = effectiveLineHeight; 
        row.forEach((cell, colIndex) => {
            const cellText = cell === undefined || cell === null ? '' : String(cell);
            const lines = splitTextToFit(cellText, columnWidths[colIndex] - 2 * cellPadding, effectiveFont, effectiveFontSize);
            maxRowHeight = Math.max(maxRowHeight, lines.length * effectiveLineHeight);
        });
        
        if (currentY - maxRowHeight < effectivePageBottomMargin) {
            currentPage = pdfDoc.addPage();
            currentY = pageHeight - effectiveMargin; 
            x = effectiveMargin;
            if (effectiveHeaderFillColor) {
                currentPage.drawRectangle({ x: effectiveMargin, y: currentY - headerLineHeight, width: pageWidth - 2*effectiveMargin, height: headerLineHeight, color: effectiveHeaderFillColor });
            }
            tableHeaders.forEach((header, i) => {
                const colWidth = columnWidths[i];
                // const textWidth = effectiveHeaderFont.widthOfTextAtSize(header, effectiveHeaderFontSize); // Not needed for left align
                currentPage.drawText(header, { x: x + cellPadding, y: currentY - headerLineHeight + cellPadding + 2, font: effectiveHeaderFont, size: effectiveHeaderFontSize, color: effectiveHeaderTextColor });
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
        
        row.forEach((cell, colIndex) => {
            const colWidth = columnWidths[colIndex];
            const cellText = cell === undefined || cell === null ? '' : String(cell);
            const textLinesCell = splitTextToFit(String(cellText), colWidth - 2 * cellPadding, effectiveFont, effectiveFontSize);
            
            let lineYOffset = currentY - effectiveFontSize - cellPadding / 2; 
            
            textLinesCell.forEach(line => {
                currentPage.drawText(line, {
                    x: cellX + cellPadding,
                    y: lineYOffset,
                    font: effectiveFont,
                    size: effectiveFontSize,
                    color: rgb(0,0,0) 
                });
                lineYOffset -= effectiveLineHeight;
            });
            cellX += colWidth;
        });
        currentY -= maxRowHeight; 
        
        currentPage.drawLine({ start: { x: effectiveMargin, y: currentY }, end: { x: pageWidth - effectiveMargin, y: currentY }, thickness: 0.5, color: effectiveBorderColor });
    });

    yPos.y = currentY; 
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
        pdfDoc.registerFontkit(fontkit);
        let page = pdfDoc.addPage();
        const { height } = page.getSize();
        const margin = 40;
        const yPos = { y: height - margin };

        const fontBytes = await fetch('/fonts/static/NotoSans-Regular.ttf').then(res => res.arrayBuffer());
        const boldFontBytes = await fetch('/fonts/static/NotoSans-Bold.ttf').then(res => res.arrayBuffer());
        const customFont = await pdfDoc.embedFont(fontBytes);
        const customBoldFont = await pdfDoc.embedFont(boldFontBytes);

        await addPdfHeader(pdfDoc, page, yPos, customFont, customBoldFont);
        yPos.y -= 10;

        const tableHeaders = ["Date", "Customer", "Invoice#", "Product", "Qty", "Price", "Discount", "Total"];
        const columnWidths = [60, 85, 70, 100, 30, 50, 60, 60]; // Adjusted widths
        
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

        page = await drawPdfTable(pdfDoc, page, yPos, tableHeaders, tableData, columnWidths, { margin, font: customFont, boldFont: customBoldFont });

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
        console.log(`[exportInventoryToPDF] Received ${inventoryReportData.length} items from getAllInventoryForReport.`);
        
        console.log(`[exportInventoryToPDF] Checking length before alert: ${inventoryReportData.length}`); // Log right before the check
        if (inventoryReportData.length === 0) {
            alert("No inventory data available for PDF report with selected filters.");
            return;
        }

        const pdfDoc = await PDFDocument.create();
        pdfDoc.registerFontkit(fontkit);
        let page = pdfDoc.addPage();
        const { height } = page.getSize();
        const margin = 40;
        const yPos = { y: height - margin };

        const fontBytes = await fetch('/fonts/static/NotoSans-Regular.ttf').then(res => res.arrayBuffer());
        const boldFontBytes = await fetch('/fonts/static/NotoSans-Bold.ttf').then(res => res.arrayBuffer());
        const customFont = await pdfDoc.embedFont(fontBytes);
        const customBoldFont = await pdfDoc.embedFont(boldFontBytes);

        await addPdfHeader(pdfDoc, page, yPos, customFont, customBoldFont); 
        yPos.y -= 10; // Space after header

        const tableHeaders = ["Item Name", "Type", "Crop", "Batch Code", "Supplier", "Qty", "Unit", "Notes"];
        const columnWidths = [100, 60, 70, 70, 80, 40, 50, 100];
        
        const tableData = inventoryReportData.map(item => [
            item.itemName,
            item.itemType,
            item.cropName || '',
            item.batchCode || '',
            item.supplier || '',
            item.currentQuantity ?? '',
            item.quantityUnit || '',
            item.notes || ''
        ]);

        page = await drawPdfTable(pdfDoc, page, yPos, tableHeaders, tableData, columnWidths, { margin, font: customFont, boldFont: customBoldFont });

        const pdfBytes = await pdfDoc.save();
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        const now = new Date();
        const dateStamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        saveAs(blob, `Hurvesthub_Inventory_Report_${dateStamp}.pdf`);

    } catch (error) {
        console.error("Failed to generate inventory PDF:", error);
        alert(`Error generating inventory PDF: ${error instanceof Error ? error.message : String(error)}`);
    }
}

export async function exportHarvestLogsToPDF(filters?: DateRangeFilters): Promise<void> {
    try {
        const harvestReportData = await getAllHarvestLogsForReport(filters);
        if (harvestReportData.length === 0) {
            alert("No harvest log data available for PDF report with selected filters.");
            return;
        }
        const pdfDoc = await PDFDocument.create();
        pdfDoc.registerFontkit(fontkit);
        let page = pdfDoc.addPage();
        const { height } = page.getSize();
        const margin = 40;
        const yPos = { y: height - margin };

        const fontBytes = await fetch('/fonts/static/NotoSans-Regular.ttf').then(res => res.arrayBuffer());
        const boldFontBytes = await fetch('/fonts/static/NotoSans-Bold.ttf').then(res => res.arrayBuffer());
        const customFont = await pdfDoc.embedFont(fontBytes);
        const customBoldFont = await pdfDoc.embedFont(boldFontBytes);

        await addPdfHeader(pdfDoc, page, yPos, customFont, customBoldFont); 
        yPos.y -= 10;

        const tableHeaders = ["Harvest Date", "Crop", "Variety", "Qty", "Unit", "Quality", "Planting Date", "Location", "Notes"];
        const columnWidths = [60, 80, 70, 40, 40, 60, 60, 80, 80];
        
        const tableData = harvestReportData.map(item => [
            item.harvestDate,
            item.cropName,
            item.cropVariety || '',
            item.quantityHarvested,
            item.quantityUnit,
            item.qualityGrade || '',
            item.plantingDate || '',
            item.location || '',
            item.notes || ''
        ]);

        page = await drawPdfTable(pdfDoc, page, yPos, tableHeaders, tableData, columnWidths, { margin, font: customFont, boldFont: customBoldFont });

        const pdfBytes = await pdfDoc.save();
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        const now = new Date();
        const dateStamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        saveAs(blob, `Hurvesthub_Harvest_Logs_Report_${dateStamp}.pdf`);

    } catch (error) {
        console.error("Failed to generate harvest logs PDF:", error);
        alert(`Error generating harvest logs PDF: ${error instanceof Error ? error.message : String(error)}`);
    }
}


export interface SeedlingLifecycleReportItem {
    seedBatchId: string;
    seedBatchCode: string;
    cropName?: string;
    sowingDate: string;
    quantitySownDisplay: string; // e.g., "100 seeds" or "5 grams"
    seedlingsProduced: number;
    seedlingsTransplanted: number;
    totalHarvestedFromSeedlings: number;
    totalSoldFromSeedlings: number;
    currentSeedlingsAvailable: number; // From SeedlingProductionLog
    notes?: string; // SeedlingProductionLog notes
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

    const seedBatchIds = seedlingLogs.map(sl => sl.seed_batch_id);
    const cropIds = seedlingLogs.map(sl => sl.crop_id);
    const seedlingLogIds = seedlingLogs.map(sl => sl.id);

    const [seedBatches, crops, plantingLogs, harvestLogs, saleItems] = await Promise.all([
        db.seedBatches.where('id').anyOf(seedBatchIds).toArray(),
        db.crops.where('id').anyOf(cropIds).toArray(),
        db.plantingLogs.where('seedling_production_log_id').anyOf(seedlingLogIds).and(pl => pl.is_deleted !== 1).toArray(),
        db.harvestLogs.filter(hl => hl.is_deleted !== 1).toArray(), // Fetched broadly, then filtered
        db.saleItems.filter(si => si.is_deleted !== 1).toArray() // Fetched broadly, then filtered
    ]);

    const cropMap = new Map(crops.map(c => [c.id, c]));
    const seedBatchMap = new Map(seedBatches.map(sb => [sb.id, sb]));

    const reportItems: SeedlingLifecycleReportItem[] = [];

    for (const sl of seedlingLogs) {
        const seedBatch = seedBatchMap.get(sl.seed_batch_id);
        const crop = cropMap.get(sl.crop_id);
        const plantingsFromThisSeedlingLog = plantingLogs.filter(pl => pl.seedling_production_log_id === sl.id);
        const seedlingsTransplanted = plantingsFromThisSeedlingLog.reduce((sum, pl) => sum + (pl.quantity_planted || 0), 0);
        
        const harvestLogIdsFromThesePlantings = plantingsFromThisSeedlingLog.flatMap(pl => 
            harvestLogs.filter(hl => hl.planting_log_id === pl.id).map(hl => hl.id)
        );
        const totalHarvestedFromSeedlings = harvestLogs
            .filter(hl => harvestLogIdsFromThesePlantings.includes(hl.id))
            .reduce((sum, hl) => sum + (hl.quantity_harvested || 0), 0);

        const saleItemsForTheseHarvests = saleItems.filter(si => si.harvest_log_id && harvestLogIdsFromThesePlantings.includes(si.harvest_log_id));
        const totalSoldFromSeedlings = saleItemsForTheseHarvests.reduce((sum, si) => sum + (si.quantity_sold || 0), 0);

        reportItems.push({
            seedBatchId: sl.seed_batch_id,
            seedBatchCode: seedBatch?.batch_code || 'N/A',
            cropName: crop?.name || 'N/A',
            sowingDate: new Date(sl.sowing_date).toLocaleDateString(),
            quantitySownDisplay: `${sl.quantity_sown_value} ${sl.sowing_unit_from_batch || 'units'}`,
            seedlingsProduced: sl.actual_seedlings_produced,
            seedlingsTransplanted,
            totalHarvestedFromSeedlings,
            totalSoldFromSeedlings,
            currentSeedlingsAvailable: sl.current_seedlings_available,
            notes: sl.notes
        });
    }
    return reportItems.sort((a,b) => new Date(b.sowingDate).getTime() - new Date(a.sowingDate).getTime());
}

export async function exportSeedlingLifecycleToPDF(filters?: DateRangeFilters): Promise<void> {
    try {
        const reportData = await getSeedlingLifecycleReportData(filters);
        if (reportData.length === 0) {
            alert("No seedling lifecycle data available for PDF report with selected filters.");
            return;
        }
        const pdfDoc = await PDFDocument.create();
        pdfDoc.registerFontkit(fontkit);
        let page = pdfDoc.addPage();
        const { height } = page.getSize();
        const margin = 40;
        const yPos = { y: height - margin };

        const fontBytes = await fetch('/fonts/static/NotoSans-Regular.ttf').then(res => res.arrayBuffer());
        const boldFontBytes = await fetch('/fonts/static/NotoSans-Bold.ttf').then(res => res.arrayBuffer());
        const customFont = await pdfDoc.embedFont(fontBytes);
        const customBoldFont = await pdfDoc.embedFont(boldFontBytes);

        await addPdfHeader(pdfDoc, page, yPos, customFont, customBoldFont); 
        yPos.y -= 10;

        const tableHeaders = ["Crop", "Batch", "Sown", "Sown Qty", "Produced", "Transplanted", "Harvested", "Sold", "Remaining Seedlings"];
        const columnWidths = [70, 70, 60, 50, 50, 60, 60, 50, 70];

        const tableData = reportData.map(item => [
            item.cropName,
            item.seedBatchCode,
            item.sowingDate,
            `${item.quantitySownDisplay}`,
            item.seedlingsProduced,
            item.seedlingsTransplanted,
            item.totalHarvestedFromSeedlings,
            item.totalSoldFromSeedlings,
            item.currentSeedlingsAvailable
        ]);

        page = await drawPdfTable(pdfDoc, page, yPos, tableHeaders, tableData, columnWidths, { margin, font: customFont, boldFont: customBoldFont });

        const pdfBytes = await pdfDoc.save();
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        const now = new Date();
        const dateStamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        saveAs(blob, `Hurvesthub_Seedling_Lifecycle_Report_${dateStamp}.pdf`);
    } catch (error) {
        console.error("Failed to generate seedling lifecycle PDF:", error);
        alert(`Error generating seedling lifecycle PDF: ${error instanceof Error ? error.message : String(error)}`);
    }
}

function convertSeedlingLifecycleToCSV(data: SeedlingLifecycleReportItem[]): string {
    const headers = ["Crop Name", "Seed Batch Code", "Sowing Date", "Quantity Sown", "Seedlings Produced", "Seedlings Transplanted", "Total Harvested", "Total Sold", "Current Seedlings Available", "Notes"];
    const csvRows = [headers.join(',')];
    data.forEach(item => {
        const row = [
            `"${item.cropName || ''}"`, `"${item.seedBatchCode}"`, `"${item.sowingDate}"`,
            `"${item.quantitySownDisplay}"`, item.seedlingsProduced, item.seedlingsTransplanted,
            item.totalHarvestedFromSeedlings, item.totalSoldFromSeedlings, item.currentSeedlingsAvailable,
            `"${(item.notes || '').replace(/"/g, '""')}"`
        ];
        csvRows.push(row.join(','));
    });
    return csvRows.join('\n');
}

export async function exportSeedlingLifecycleToCSV(filters?: DateRangeFilters): Promise<void> {
    try {
        const reportData = await getSeedlingLifecycleReportData(filters);
        if (reportData.length === 0) { alert("No data for Seedling Lifecycle CSV."); return; }
        const csvData = convertSeedlingLifecycleToCSV(reportData);
        const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
        saveAs(blob, `Hurvesthub_Seedling_Lifecycle_${new Date().toISOString().split('T')[0]}.csv`);
    } catch (e) { console.error(e); alert(`Error: ${e instanceof Error ? e.message : String(e)}`); }
}


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
    const supplierIds = seedBatches.map(sb => sb.supplier_id).filter(id => id) as string[];
    
    const [crops, suppliers] = await Promise.all([
        db.crops.where('id').anyOf(cropIds).toArray(),
        db.suppliers.where('id').anyOf(supplierIds).toArray()
    ]);
    const cropMap = new Map(crops.map(c => [c.id, c]));
    const supplierMap = new Map(suppliers.map(s => [s.id, s.name]));

    return seedBatches.map(sb => ({
        seedBatchId: sb.id,
        batchCode: sb.batch_code,
        cropName: cropMap.get(sb.crop_id)?.name,
        supplier: sb.supplier_id ? supplierMap.get(sb.supplier_id) : undefined,
        purchaseDate: sb.purchase_date ? new Date(sb.purchase_date).toLocaleDateString() : undefined,
        organicStatus: sb.organic_status,
        notes: sb.notes
    })).sort((a,b) => (a.cropName || '').localeCompare(b.cropName || '') || a.batchCode.localeCompare(b.batchCode));
}

function convertOrganicComplianceToCSV(data: OrganicComplianceReportItem[]): string {
    const headers = ["Crop Name", "Batch Code", "Supplier", "Purchase Date", "Organic Status", "Notes"];
    const csvRows = [headers.join(',')];
    data.forEach(item => {
        const row = [
            `"${item.cropName || ''}"`, `"${item.batchCode}"`, `"${item.supplier || ''}"`,
            `"${item.purchaseDate || ''}"`, `"${item.organicStatus || ''}"`, `"${(item.notes || '').replace(/"/g, '""')}"`
        ];
        csvRows.push(row.join(','));
    });
    return csvRows.join('\n');
}
export async function exportOrganicComplianceToCSV(filters?: DateRangeFilters): Promise<void> {
    try {
        const reportData = await getOrganicComplianceReportData(filters);
        if (reportData.length === 0) { alert("No data for Organic Compliance CSV."); return; }
        const csvData = convertOrganicComplianceToCSV(reportData);
        const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
        saveAs(blob, `Hurvesthub_Organic_Compliance_${new Date().toISOString().split('T')[0]}.csv`);
    } catch (e) { console.error(e); alert(`Error: ${e instanceof Error ? e.message : String(e)}`); }
}

export async function exportOrganicComplianceToPDF(filters?: DateRangeFilters): Promise<void> {
    try {
        const reportData = await getOrganicComplianceReportData(filters);
        if (reportData.length === 0) {
            alert("No organic compliance data available for PDF report with selected filters.");
            return;
        }
        const pdfDoc = await PDFDocument.create();
        pdfDoc.registerFontkit(fontkit);
        let page = pdfDoc.addPage();
        const { height } = page.getSize();
        const margin = 40;
        const yPos = { y: height - margin };

        const fontBytes = await fetch('/fonts/static/NotoSans-Regular.ttf').then(res => res.arrayBuffer());
        const boldFontBytes = await fetch('/fonts/static/NotoSans-Bold.ttf').then(res => res.arrayBuffer());
        const customFont = await pdfDoc.embedFont(fontBytes);
        const customBoldFont = await pdfDoc.embedFont(boldFontBytes);

        await addPdfHeader(pdfDoc, page, yPos, customFont, customBoldFont);
        yPos.y -= 10;

        const tableHeaders = ["Crop", "Batch Code", "Supplier", "Purchase Date", "Organic Status", "Notes"];
        const columnWidths = [100, 100, 100, 80, 100, 100]; 
        
        const tableData = reportData.map(item => [
            item.cropName || '',
            item.batchCode,
            item.supplier || '',
            item.purchaseDate || '',
            item.organicStatus || '',
            item.notes || ''
        ]);

        page = await drawPdfTable(pdfDoc, page, yPos, tableHeaders, tableData, columnWidths, { margin, font: customFont, boldFont: customBoldFont });

        const pdfBytes = await pdfDoc.save();
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        const now = new Date();
        const dateStamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        saveAs(blob, `Hurvesthub_Organic_Compliance_Report_${dateStamp}.pdf`);
    } catch (error) {
        console.error("Failed to generate organic compliance PDF:", error);
        alert(`Error generating organic compliance PDF: ${error instanceof Error ? error.message : String(error)}`);
    }
}


export interface CultivationUsageDetail {
    activityDate: string;
    activityType: string;
    cropName?: string;
    plotAffected?: string;
    quantityUsed: number;
    quantityUnit?: string;
}
export interface InputItemUsageLedgerDataItem {
    itemId: string;
    itemName: string;
    itemType?: string;
    initialQuantity?: number;
    currentQuantity?: number;
    quantityUnit?: string;
    usageDetails: CultivationUsageDetail[];
}

export async function getInputItemUsageLedgerData(filters?: { itemId?: string }): Promise<InputItemUsageLedgerDataItem[]> {
    if (!filters?.itemId) return [];

    const inputItem = await db.inputInventory.get(filters.itemId);
    if (!inputItem || inputItem.is_deleted === 1) return [];

    const cultivationLogs = await db.cultivationLogs
        .where('input_inventory_id').equals(filters.itemId)
        .and(log => log.is_deleted !== 1)
        .sortBy('activity_date');

    const plantingLogIds = cultivationLogs.map(cl => cl.planting_log_id).filter(id => id) as string[];
    const uniquePlantingLogIds = [...new Set(plantingLogIds)];
    
    const plantingLogs = await db.plantingLogs.where('id').anyOf(uniquePlantingLogIds).toArray();
    const seedBatchIds = plantingLogs.map(pl => pl.seed_batch_id).filter(id => id) as string[];
    const uniqueSeedBatchIds = [...new Set(seedBatchIds)];

    const seedBatches = await db.seedBatches.where('id').anyOf(uniqueSeedBatchIds).toArray();
    const cropIdsFromSeedBatches = seedBatches.map(sb => sb.crop_id).filter(id => id) as string[];
    
    // If cultivation logs can link directly to crops (not currently in schema but for future proofing)
    // const cropIdsFromCultivation = cultivationLogs.map(cl => cl.crop_id).filter(id => id) as string[];
    // const allCropIds = [...new Set([...cropIdsFromSeedBatches, ...cropIdsFromCultivation])];
    const allCropIds = [...new Set(cropIdsFromSeedBatches)];


    const crops = await db.crops.where('id').anyOf(allCropIds).toArray();
    
    const cropMap = new Map(crops.map(c => [c.id, c]));
    const plantingLogMap = new Map(plantingLogs.map(pl => [pl.id, pl]));
    const seedBatchMap = new Map(seedBatches.map(sb => [sb.id, sb]));

    const usageDetails: CultivationUsageDetail[] = cultivationLogs.map(cl => {
        const pLog = cl.planting_log_id ? plantingLogMap.get(cl.planting_log_id) : undefined;
        const sBatch = pLog?.seed_batch_id ? seedBatchMap.get(pLog.seed_batch_id) : undefined;
        const crop = sBatch?.crop_id ? cropMap.get(sBatch.crop_id) : undefined;
        // If direct crop_id on cultivation log: const crop = cl.crop_id ? cropMap.get(cl.crop_id) : undefined;

        return {
            activityDate: new Date(cl.activity_date).toLocaleDateString(),
            activityType: cl.activity_type,
            cropName: crop?.name,
            plotAffected: cl.plot_affected || pLog?.plot_affected,
            quantityUsed: cl.input_quantity_used || 0,
            quantityUnit: cl.input_quantity_unit
        };
    });

    return [{
        itemId: inputItem.id,
        itemName: inputItem.name,
        itemType: inputItem.type,
        initialQuantity: inputItem.initial_quantity,
        currentQuantity: inputItem.current_quantity,
        quantityUnit: inputItem.quantity_unit,
        usageDetails
    }];
}


export async function exportInputItemUsageLedgerToPDF(filters?: { itemId?: string }): Promise<void> {
    if (!filters?.itemId) { alert("No item selected for ledger."); return; }
    const ledgerData = await getInputItemUsageLedgerData(filters);
    if (ledgerData.length === 0) { alert("No usage data found for the selected item."); return; }

    const item = ledgerData[0];
    const pdfDoc = await PDFDocument.create();
    let page = pdfDoc.addPage();
    const { width: pageWidth, height: pageHeight } = page.getSize();
    const margin = 30;
    let yPos = pageHeight - margin;

    const fontBytes = await fetch('/fonts/static/NotoSans-Regular.ttf').then(res => res.arrayBuffer());
    const boldFontBytes = await fetch('/fonts/static/NotoSans-Bold.ttf').then(res => res.arrayBuffer());
    const mainFont = await pdfDoc.embedFont(fontBytes);
    const boldFont = await pdfDoc.embedFont(boldFontBytes);

    const drawTextLine = (text: string, currentY: number, size: number, font: PDFFont = mainFont, xOffset: number = 0) => {
        page.drawText(text, { x: margin + xOffset, y: currentY, font, size, color: rgb(0,0,0) });
        return currentY - size - 4; // Return new Y
    };
    
    yPos = drawTextLine(`Usage Ledger for: ${item.itemName} (${item.itemId})`, yPos, 14, boldFont);
    yPos = drawTextLine(`Type: ${item.itemType || 'N/A'}`, yPos, 10);
    yPos = drawTextLine(`Initial Quantity: ${item.initialQuantity || 0} ${item.quantityUnit || ''}`, yPos, 10);
    yPos = drawTextLine(`Current Quantity: ${item.currentQuantity || 0} ${item.quantityUnit || ''}`, yPos, 10);
    yPos -= 10; // Extra space

    const useHeaders = ["Date", "Activity", "Crop", "Plot", "Qty Used"];
    const useColWidths = [80, 120, 100, 100, 80]; // Adjusted for typical content

    // Draw headers for usage details
    let currentX = margin;
    useHeaders.forEach((header, idx) => {
        page.drawText(header, { x: currentX, y: yPos, font: boldFont, size: 9, color: rgb(0,0,0) });
        currentX += useColWidths[idx];
    });
    yPos -= 12;
    page.drawLine({start: {x: margin, y: yPos}, end: {x: pageWidth - margin, y: yPos}, thickness: 0.5});
    yPos -= 2;


    for (const detail of item.usageDetails) {
        if (yPos < margin + 40) { // Check for new page
            page = pdfDoc.addPage();
            yPos = pageHeight - margin;
            currentX = margin;
            useHeaders.forEach((header, idx) => { // Redraw headers on new page
                page.drawText(header, { x: currentX, y: yPos, font: boldFont, size: 9 });
                currentX += useColWidths[idx];
            });
            yPos -= 12;
            page.drawLine({start: {x: margin, y: yPos}, end: {x: pageWidth - margin, y: yPos}, thickness: 0.5});
            yPos -= 2;
        }

        const detailRow = [
            detail.activityDate,
            detail.activityType,
            detail.cropName || '-',
            detail.plotAffected || '-',
            `${detail.quantityUsed} ${detail.quantityUnit || ''}`
        ];
        currentX = margin;
        let maxLinesInRow = 1;
        const linesPerRowCell: string[][] = [];

        detailRow.forEach((cell, idx) => {
            const lines = splitTextToFit(cell, useColWidths[idx] - 4, mainFont, 8);
            linesPerRowCell.push(lines);
            maxLinesInRow = Math.max(maxLinesInRow, lines.length);
        });
        
        const rowHeight = maxLinesInRow * 10;
        if (yPos - rowHeight < margin) { /* re-check for new page with actual row height */ }


        for (let lineIdx = 0; lineIdx < maxLinesInRow; lineIdx++) {
            currentX = margin;
            detailRow.forEach((_cell, cellIdx) => {
                if (linesPerRowCell[cellIdx][lineIdx]) {
                    page.drawText(linesPerRowCell[cellIdx][lineIdx], { x: currentX + 2, y: yPos - (lineIdx * 10), font: mainFont, size: 8 });
                }
                currentX += useColWidths[cellIdx];
            });
        }
        yPos -= rowHeight;
        page.drawLine({start: {x: margin, y: yPos}, end: {x: pageWidth - margin, y: yPos}, thickness: 0.2, color: rgb(0.8,0.8,0.8)});
        yPos -=2;
    }

    const pdfBytes = await pdfDoc.save();
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    saveAs(blob, `Hurvesthub_UsageLedger_${item.itemName.replace(/\s/g, '_')}.pdf`);
}


export interface GroupedInventoryItemReportData {
    itemName: string;
    itemType: string;
    totalCurrentQuantity: number;
    quantityUnit?: string; // Assume common unit or handle variations
    totalValue: number; // Sum of (currentQuantity * costPerUnit)
}

export async function getGroupedInventorySummaryData(): Promise<GroupedInventoryItemReportData[]> {
    const [allInputs, allSeedBatches, suppliers] = await Promise.all([
        db.inputInventory.filter(i => i.is_deleted !== 1).toArray(),
        db.seedBatches.filter(sb => sb.is_deleted !== 1).toArray(),
        db.suppliers.filter(s => s.is_deleted !== 1).toArray()
    ]);
    const supplierMap = new Map(suppliers.map(s => [s.id, s.name]));

    const groupedMap = new Map<string, GroupedInventoryItemReportData>();

    allInputs.forEach(item => {
        const key = `${item.name}_${item.type || 'General Input'}`;
        let entry = groupedMap.get(key);
        if (!entry) {
            entry = { itemName: item.name, itemType: item.type || 'General Input', totalCurrentQuantity: 0, quantityUnit: item.quantity_unit, totalValue: 0 };
            groupedMap.set(key, entry);
        }
        entry.totalCurrentQuantity += item.current_quantity || 0;
        // Assuming total_purchase_cost is for initial_quantity. Need cost per unit.
        const costPerUnit = (item.initial_quantity && item.total_purchase_cost && item.initial_quantity > 0) 
                            ? item.total_purchase_cost / item.initial_quantity 
                            : 0;
        entry.totalValue += (item.current_quantity || 0) * costPerUnit;
        if (!entry.quantityUnit && item.quantity_unit) entry.quantityUnit = item.quantity_unit; // Take first unit found
    });

    allSeedBatches.forEach(batch => {
        const key = `${batch.batch_code}_Seed Batch`; // Assuming batch_code is unique enough for grouping seeds
        let entry = groupedMap.get(key);
        if (!entry) {
            entry = { itemName: batch.batch_code, itemType: 'Seed Batch', totalCurrentQuantity: 0, quantityUnit: batch.quantity_unit, totalValue: 0 };
            groupedMap.set(key, entry);
        }
        entry.totalCurrentQuantity += batch.current_quantity || 0;
        const costPerUnit = (batch.initial_quantity && batch.total_purchase_cost && batch.initial_quantity > 0)
                            ? batch.total_purchase_cost / batch.initial_quantity
                            : 0;
        entry.totalValue += (batch.current_quantity || 0) * costPerUnit;
        if (!entry.quantityUnit && batch.quantity_unit) entry.quantityUnit = batch.quantity_unit;
    });

    return Array.from(groupedMap.values()).sort((a,b) => a.itemName.localeCompare(b.itemName));
}


export async function exportGroupedInventorySummaryToPDF(): Promise<void> {
    try {
        const reportData = await getGroupedInventorySummaryData();
        if (reportData.length === 0) {
            alert("No grouped inventory data available for PDF report.");
            return;
        }
        const pdfDoc = await PDFDocument.create();
        let page = pdfDoc.addPage();
        const { height } = page.getSize();
        const margin = 40;
        const yPos = { y: height - margin };

        const fontBytes = await fetch('/fonts/static/NotoSans-Regular.ttf').then(res => res.arrayBuffer());
        const boldFontBytes = await fetch('/fonts/static/NotoSans-Bold.ttf').then(res => res.arrayBuffer());
        const customFont = await pdfDoc.embedFont(fontBytes);
        const customBoldFont = await pdfDoc.embedFont(boldFontBytes);

        await addPdfHeader(pdfDoc, page, yPos, customFont, customBoldFont); 
        yPos.y -= 10;

        const tableHeaders = ["Item Name", "Type", "Total Current Qty", "Unit", "Total Value (€)"];
        const columnWidths = [150, 80, 80, 60, 100];
        
        const tableData = reportData.map(item => [
            item.itemName,
            item.itemType,
            item.totalCurrentQuantity,
            item.quantityUnit || '',
            `€${item.totalValue.toFixed(2)}`
        ]);

        page = await drawPdfTable(pdfDoc, page, yPos, tableHeaders, tableData, columnWidths, { margin, font: customFont, boldFont: customBoldFont });

        const pdfBytes = await pdfDoc.save();
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        const now = new Date();
        const dateStamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        saveAs(blob, `Hurvesthub_Grouped_Inventory_Summary_${dateStamp}.pdf`);
    } catch (error) {
        console.error("Failed to generate grouped inventory summary PDF:", error);
        alert(`Error generating PDF: ${error instanceof Error ? error.message : String(error)}`);
    }
}


export interface DetailedInputUsageReportItem {
    activityDate: string;
    inputName: string;
    activityType: string;
    cropName?: string;
    plotAffected?: string;
    quantityUsed: number;
    quantityUnit?: string;
    notes?: string; // from cultivation log
}

export async function getDetailedInputUsageData(filters?: DateRangeFilters): Promise<DetailedInputUsageReportItem[]> {
    let cultivationLogsQuery = db.cultivationLogs.filter(cl => cl.is_deleted !== 1 && cl.input_inventory_id != null);

    if (filters?.startDate) {
        cultivationLogsQuery = cultivationLogsQuery.and(cl => cl.activity_date >= filters.startDate!);
    }
    if (filters?.endDate) {
        cultivationLogsQuery = cultivationLogsQuery.and(cl => cl.activity_date <= filters.endDate!);
    }
    const cultivationLogs = await cultivationLogsQuery.sortBy('activity_date');

    const inputInventoryIds = [...new Set(cultivationLogs.map(cl => cl.input_inventory_id).filter(id => id) as string[])];
    const plantingLogIds = [...new Set(cultivationLogs.map(cl => cl.planting_log_id).filter(id => id) as string[])];
    
    const [inputInventoryItems, plantingLogs] = await Promise.all([
        db.inputInventory.where('id').anyOf(inputInventoryIds).toArray(),
        db.plantingLogs.where('id').anyOf(plantingLogIds).toArray()
    ]);
    
    const seedBatchIds = [...new Set(plantingLogs.map(pl => pl.seed_batch_id).filter(id => id) as string[])];
    const seedBatches = await db.seedBatches.where('id').anyOf(seedBatchIds).toArray();
    const cropIds = [...new Set(seedBatches.map(sb => sb.crop_id).filter(id => id) as string[])];
    const crops = await db.crops.where('id').anyOf(cropIds).toArray();

    const inputMap = new Map(inputInventoryItems.map(i => [i.id, i]));
    const plantingLogMap = new Map(plantingLogs.map(pl => [pl.id, pl]));
    const seedBatchMap = new Map(seedBatches.map(sb => [sb.id, sb]));
    const cropMap = new Map(crops.map(c => [c.id, c]));

    return cultivationLogs.map(cl => {
        const inputItem = cl.input_inventory_id ? inputMap.get(cl.input_inventory_id) : undefined;
        const pLog = cl.planting_log_id ? plantingLogMap.get(cl.planting_log_id) : undefined;
        const sBatch = pLog?.seed_batch_id ? seedBatchMap.get(pLog.seed_batch_id) : undefined;
        const crop = sBatch?.crop_id ? cropMap.get(sBatch.crop_id) : undefined;

        return {
            activityDate: new Date(cl.activity_date).toLocaleDateString(),
            inputName: inputItem?.name || 'Unknown Input',
            activityType: cl.activity_type,
            cropName: crop?.name,
            plotAffected: cl.plot_affected || pLog?.plot_affected,
            quantityUsed: cl.input_quantity_used || 0,
            quantityUnit: cl.input_quantity_unit || inputItem?.quantity_unit,
            notes: cl.notes
        };
    }).sort((a,b) => new Date(b.activityDate).getTime() - new Date(a.activityDate).getTime());
}

function convertDetailedInputUsageToCSV(data: DetailedInputUsageReportItem[]): string {
  const headers = ["Activity Date", "Input Name", "Activity Type", "Crop Name", "Plot Affected", "Quantity Used", "Unit", "Notes"];
  const csvRows = [headers.join(',')];
  data.forEach(item => {
    const row = [
      `"${item.activityDate}"`, `"${item.inputName}"`, `"${item.activityType}"`,
      `"${item.cropName || ''}"`, `"${item.plotAffected || ''}"`, item.quantityUsed,
      `"${item.quantityUnit || ''}"`, `"${(item.notes || '').replace(/"/g, '""')}"`
    ];
    csvRows.push(row.join(','));
  });
  return csvRows.join('\n');
}

export async function exportDetailedInputUsageToCSV(filters?: DateRangeFilters): Promise<void> {
    try {
        const reportData = await getDetailedInputUsageData(filters);
        if (reportData.length === 0) { alert("No data for Detailed Input Usage CSV."); return; }
        const csvData = convertDetailedInputUsageToCSV(reportData);
        const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
        saveAs(blob, `Hurvesthub_Detailed_Input_Usage_${new Date().toISOString().split('T')[0]}.csv`);
    } catch (e) { console.error(e); alert(`Error: ${e instanceof Error ? e.message : String(e)}`); }
}
export async function exportDetailedInputUsageToPDF(filters?: DateRangeFilters): Promise<void> {
    try {
        const reportData = await getDetailedInputUsageData(filters);
        if (reportData.length === 0) {
            alert("No detailed input usage data available for PDF report with selected filters.");
            return;
        }
        const pdfDoc = await PDFDocument.create();
        let page = pdfDoc.addPage();
        const { height } = page.getSize();
        const margin = 40;
        const yPos = { y: height - margin };

        const fontBytes = await fetch('/fonts/static/NotoSans-Regular.ttf').then(res => res.arrayBuffer());
        const boldFontBytes = await fetch('/fonts/static/NotoSans-Bold.ttf').then(res => res.arrayBuffer());
        const customFont = await pdfDoc.embedFont(fontBytes);
        const customBoldFont = await pdfDoc.embedFont(boldFontBytes);

        await addPdfHeader(pdfDoc, page, yPos, customFont, customBoldFont); 
        yPos.y -= 10;

        const tableHeaders = ["Date", "Input Item", "Activity", "Crop", "Plot", "Qty Used", "Unit"];
        const columnWidths = [70, 100, 80, 80, 70, 50, 50];
        
        const tableData = reportData.map(item => [
            item.activityDate,
            item.inputName,
            item.activityType,
            item.cropName || '',
            item.plotAffected || '',
            item.quantityUsed,
            item.quantityUnit
        ]);

        page = await drawPdfTable(pdfDoc, page, yPos, tableHeaders, tableData, columnWidths, { margin, font: customFont, boldFont: customBoldFont });

        const pdfBytes = await pdfDoc.save();
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        const now = new Date();
        const dateStamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        saveAs(blob, `Hurvesthub_Detailed_Input_Usage_Report_${dateStamp}.pdf`);
    } catch (error) {
        console.error("Failed to generate detailed input usage PDF:", error);
        alert(`Error generating PDF: ${error instanceof Error ? error.message : String(error)}`);
    }
}


export interface SeedSourceDeclarationReportItem {
    cropName: string;
    variety?: string;
    seedBatchCode: string;
    supplier?: string;
    purchaseDate?: string;
    organicStatus?: string; 
    lotNumber?: string; 
    originCountry?: string; 
    conformityDeclarationAvailable: boolean; 
    notes?: string; 
}

export async function getSeedSourceDeclarationData(filters?: DateRangeFilters): Promise<SeedSourceDeclarationReportItem[]> {
    let seedBatchesQuery = db.seedBatches.filter(sb => sb.is_deleted !== 1);
    if (filters?.startDate) {
        seedBatchesQuery = seedBatchesQuery.and(sb => !!sb.purchase_date && sb.purchase_date >= filters.startDate!);
    }
    if (filters?.endDate) {
        seedBatchesQuery = seedBatchesQuery.and(sb => !!sb.purchase_date && sb.purchase_date <= filters.endDate!);
    }
    const seedBatches = await seedBatchesQuery.toArray();
    const cropIds = seedBatches.map(sb => sb.crop_id).filter(id => id) as string[];
    const supplierIds = seedBatches.map(sb => sb.supplier_id).filter(id => id) as string[];

    const [crops, suppliers] = await Promise.all([
        db.crops.where('id').anyOf(cropIds).toArray(),
        db.suppliers.where('id').anyOf(supplierIds).toArray()
    ]);
    const cropMap = new Map(crops.map(c => [c.id, c]));
    const supplierMap = new Map(suppliers.map(s => [s.id, s.name]));

    return seedBatches.map(sb => {
        const crop = cropMap.get(sb.crop_id);
        return {
            cropName: crop?.name || 'Unknown Crop',
            variety: crop?.variety,
            seedBatchCode: sb.batch_code,
            supplier: sb.supplier_id ? supplierMap.get(sb.supplier_id) : undefined,
            purchaseDate: sb.purchase_date ? new Date(sb.purchase_date).toLocaleDateString() : undefined,
            organicStatus: sb.organic_status,
            conformityDeclarationAvailable: false, // Placeholder
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

        const fontBytes = await fetch('/fonts/static/NotoSans-Regular.ttf').then(res => res.arrayBuffer());
        const boldFontBytes = await fetch('/fonts/static/NotoSans-Bold.ttf').then(res => res.arrayBuffer());
        const customFont = await pdfDoc.embedFont(fontBytes);
        const customBoldFont = await pdfDoc.embedFont(boldFontBytes);

        await addPdfHeader(pdfDoc, page, yPos, customFont, customBoldFont);
        yPos.y -= 5;
        page.drawText("Seed Source Declaration Report", { x: margin, y: yPos.y, font: customBoldFont, size: 14});
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

        page = await drawPdfTable(pdfDoc, page, yPos, tableHeaders, tableData, columnWidths, { margin, font: customFont, boldFont: customBoldFont, fontSize: 7, headerFontSize: 8, lineHeight: 10 });
        
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

// --- Poultry Feed Efficiency Report Logic ---

export interface PoultryFeedEfficiencyReportData {
  flockId: string;
  flockName: string;
  flockType: 'egg_layer' | 'broiler';
  totalFeedConsumedKg: number;
  totalFeedCost: number;
  totalOtherCosts: number;
  totalRevenue: number; // New: for sales
  profitOrLoss: number; // New: calculated
  totalEggsProduced?: number;
  totalWeightGainKg?: number;
  feedCostPerDozenEggs?: number;
  feedCostPerKgMeat?: number;
}

export async function getPoultryFeedEfficiencyData(flockId: string): Promise<PoultryFeedEfficiencyReportData | null> {
  const flock = await db.flocks.get(flockId);
  if (!flock || flock.is_deleted === 1) return null;

  const feedLogs = await db.feed_logs.where('flock_id').equals(flockId).and(log => log.is_deleted !== 1).toArray();
  const flockRecords = await db.flock_records.where('flock_id').equals(flockId).and(rec => rec.is_deleted !== 1).toArray();

  const totalFeedConsumedKg = feedLogs.reduce((sum, log) => sum + (log.quantity_fed_kg || 0), 0);
  const totalFeedCost = feedLogs.reduce((sum, log) => sum + (log.feed_cost || 0), 0);
  const totalOtherCosts = flockRecords.reduce((sum, record) => sum + (record.cost || 0), 0);
  const totalRevenue = flockRecords
    .filter(r => r.record_type === 'cull_sale' || r.record_type === 'egg_sale')
    .reduce((sum, record) => sum + (record.revenue || 0), 0);
  
  const profitOrLoss = totalRevenue - (totalFeedCost + totalOtherCosts);

  let reportData: PoultryFeedEfficiencyReportData = {
    flockId: flock.id,
    flockName: flock.name,
    flockType: flock.flock_type,
    totalFeedConsumedKg,
    totalFeedCost,
    totalOtherCosts,
    totalRevenue,
    profitOrLoss,
  };

  if (flock.flock_type === 'egg_layer') {
    const totalEggsProduced = flockRecords
      .filter(r => r.record_type === 'egg_collection')
      .reduce((sum, r) => sum + (r.quantity || 0), 0);
    reportData.totalEggsProduced = totalEggsProduced;
    if (totalEggsProduced > 0) {
      reportData.feedCostPerDozenEggs = (totalFeedCost / (totalEggsProduced / 12));
    }
  } else if (flock.flock_type === 'broiler') {
    // Sum total weight from 'cull_sale' records using the new 'weight_kg_total' field.
    // Assumes 'weight_kg_total' stores the actual weight of meat produced/sold in that transaction.
    const totalWeightProducedKg = flockRecords
      .filter(r => r.record_type === 'cull_sale' && typeof r.weight_kg_total === 'number')
      .reduce((sum, r) => sum + (r.weight_kg_total || 0), 0);
    
    reportData.totalWeightGainKg = totalWeightProducedKg;
    if (totalWeightProducedKg > 0) {
      reportData.feedCostPerKgMeat = totalFeedCost / totalWeightProducedKg;
    } else {
      reportData.feedCostPerKgMeat = undefined; // Or 0, if preferred when no weight is recorded
    }
  }
  return reportData;
}