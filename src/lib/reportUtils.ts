import { db, Sale, SaleItem, Customer, HarvestLog, PlantingLog, Crop, SeedBatch, Invoice, InputInventory } from './db';
import { saveAs } from 'file-saver';
import { PDFDocument, StandardFonts, rgb, PDFFont } from 'pdf-lib';

interface DetailedSaleItemReport extends SaleItem {
    productName: string;
    productDetails: string;
    itemTotal: number;
}

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

                let itemSubtotal = item.quantity_sold * item.price_per_unit;
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
    let inputsQuery = db.inputInventory.filter(i => i.is_deleted !== 1);
    let seedBatchesQuery = db.seedBatches.filter(sb => sb.is_deleted !== 1);

    if (filters?.category) {
        if (filters.category === 'Seed Batch') {
            inputsQuery = inputsQuery.and(() => false);
        } else {
            inputsQuery = inputsQuery.and(i => i.type === filters.category);
            seedBatchesQuery = seedBatchesQuery.and(() => false);
        }
    }

    // Apply date filters (e.g., to purchase_date or a relevant activity date)
    // For simplicity, let's assume date filters apply to purchase_date for now.
    // This might need refinement based on how "value at a point in time" is defined.
    if (filters?.startDate) {
        const start = new Date(filters.startDate).toISOString().split('T')[0];
        inputsQuery = inputsQuery.and(i => !!i.purchase_date && i.purchase_date >= start);
        seedBatchesQuery = seedBatchesQuery.and(sb => !!sb.purchase_date && sb.purchase_date >= start);
    }
    if (filters?.endDate) {
        const end = new Date(filters.endDate).toISOString().split('T')[0];
        inputsQuery = inputsQuery.and(i => !!i.purchase_date && i.purchase_date <= end);
        seedBatchesQuery = seedBatchesQuery.and(sb => !!sb.purchase_date && sb.purchase_date <= end);
    }
    
    const [inputs, seedBatches, crops] = await Promise.all([
        inputsQuery.toArray(),
        seedBatchesQuery.toArray(),
        db.crops.filter(c => c.is_deleted !== 1).toArray()
    ]);

    const reportItems: InventoryValueReportDataItem[] = [];

    inputs.forEach(item => {
        const costPerUnit = (item.initial_quantity && item.initial_quantity > 0 && item.total_purchase_cost !== undefined)
            ? (item.total_purchase_cost / item.initial_quantity)
            : 0;
        const currentQty = item.current_quantity || 0;
        const totalValue = currentQty * costPerUnit;

        if (currentQty > 0) { // Only include items with current stock for value report
            reportItems.push({
                itemId: item.id,
                itemName: item.name,
                itemType: item.type || 'General Input',
                supplier: item.supplier,
                purchaseDate: item.purchase_date ? new Date(item.purchase_date).toLocaleDateString() : '',
                initialQuantity: item.initial_quantity,
                currentQuantity: currentQty,
                quantityUnit: item.quantity_unit,
                costPerUnit: costPerUnit,
                totalValue: totalValue,
                notes: item.notes,
                lastModified: item._last_modified ? new Date(item._last_modified).toLocaleString() : (item.updated_at ? new Date(item.updated_at).toLocaleString() : '')
            });
        }
    });

    seedBatches.forEach(batch => {
        const crop = crops.find(c => c.id === batch.crop_id);
        const costPerUnit = (batch.initial_quantity && batch.total_purchase_cost && batch.initial_quantity > 0)
            ? (batch.total_purchase_cost / batch.initial_quantity)
            : 0;
        const currentQty = batch.current_quantity || 0;
        const totalValue = currentQty * costPerUnit;
        
        if (currentQty > 0) { // Only include items with current stock
            reportItems.push({
                itemId: batch.id,
                itemName: `${crop?.name || 'Unknown Crop'} Seeds`,
                itemType: 'Seed Batch',
                cropName: crop?.name,
                batchCode: batch.batch_code,
                supplier: batch.supplier,
                purchaseDate: batch.purchase_date ? new Date(batch.purchase_date).toLocaleDateString() : '',
                initialQuantity: batch.initial_quantity,
                currentQuantity: currentQty,
                quantityUnit: batch.quantity_unit,
                costPerUnit: costPerUnit,
                totalValue: totalValue,
                notes: batch.notes,
                lastModified: batch._last_modified ? new Date(batch._last_modified).toLocaleString() : (batch.updated_at ? new Date(batch.updated_at).toLocaleString() : '')
            });
        }
    });
    
    // Sort the combined list
    reportItems.sort((a, b) => {
        if (a.itemName.toLowerCase() < b.itemName.toLowerCase()) return -1;
        if (a.itemName.toLowerCase() > b.itemName.toLowerCase()) return 1;
        if (a.itemType < b.itemType) return -1; // Group by type if names are same
        if (a.itemType > b.itemType) return 1;
        return 0;
    });

    return reportItems;
}

function convertInventoryValueToCSV(data: InventoryValueReportDataItem[]): string {
    if (data.length === 0) return '';
    const headers = [
        "Item ID", "Name", "Type", "Crop", "Batch Code", "Supplier",
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
            alert("No inventory data available for the selected filters for value report.");
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
            alert("No inventory data available for the selected filters for value report.");
            return;
        }

        const pdfDoc = await PDFDocument.create();
        const page = pdfDoc.addPage([612, 792]);
        const { width, height } = page.getSize();
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
        const margin = 40;
        
        let yPos = { y: height - margin };
        await addPdfHeader(pdfDoc, page, yPos); // Use existing header function
        
        const headers = [
            "Name", "Type", "Crop", "Supplier", "Current Qty", "Unit",
            "Cost/Unit (€)", "Total Value (€)"
        ];
        // Adjusted column widths to give more space to Qty and Cost/Unit headers
        const columnWidths = [90, 60, 60, 70, 55, 35, 65, 55];
        const tableData = reportData.map(item => [
            item.itemName,
            item.itemType,
            item.cropName || '',
            item.supplier || '',
            String(item.currentQuantity ?? ''),
            item.quantityUnit || '',
            item.costPerUnit !== undefined ? item.costPerUnit.toFixed(2) : '',
            item.totalValue.toFixed(2)
        ]);

        let reportTitle = "Inventory Value Report";
        if (filters?.category) {
            reportTitle = `${filters.category} Value Report`;
        }
        if (filters?.startDate && filters?.endDate) {
            reportTitle += ` from ${new Date(filters.startDate).toLocaleDateString()} to ${new Date(filters.endDate).toLocaleDateString()}`;
        } else if (filters?.startDate) {
            reportTitle += ` from ${new Date(filters.startDate).toLocaleDateString()}`;
        } else if (filters?.endDate) {
            reportTitle += ` up to ${new Date(filters.endDate).toLocaleDateString()}`;
        }

        await drawPdfTable(pdfDoc, page, margin, yPos.y, headers, tableData, columnWidths, reportTitle, { font, boldFont, pageBottomMargin: margin, pageTopMargin: margin, cellFontSize: 9, headerFontSize: 10 });

        const pdfBytes = await pdfDoc.save();
        const now = new Date();
        const dateStamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        saveAs(new Blob([pdfBytes], { type: 'application/pdf' }), `Hurvesthub_Inventory_Value_Report_${dateStamp}.pdf`);

    } catch (error) {
        console.error("Failed to export inventory value to PDF:", error);
        alert(`Error exporting inventory value PDF: ${error instanceof Error ? error.message : String(error)}`);
    }
}


// --- PDF Export Utilities ---

const APP_NAME_REPORTS = "HarvestHub Organic Farm Management System";
const COMPANY_INFO_REPORTS = {
    name: "K.K. Biofresh",
    addressLine1: "1st April 300 Xylophagou",
    addressLine2: "7520, Larnaca, Cyprus",
    contact: "Phone: 99611241",
};

async function addPdfHeader(pdfDoc: PDFDocument, page: any /* PDFPage */, yPos: { y: number }) {
    const { width, height } = page.getSize();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const margin = 40;
    let currentY = yPos.y;

    let logoImage;
    try {
        const logoBytes = await fetch('/logo.png').then(res => res.arrayBuffer());
        logoImage = await pdfDoc.embedPng(logoBytes);
    } catch (e) {
        console.warn("logo.png not found for report header:", e);
    }

    if (logoImage) {
        const desiredLogoWidth = 70; // Set desired width for the logo in PDF points for reports
        const scaleFactor = desiredLogoWidth / logoImage.width;
        const logoDims = {
            width: logoImage.width * scaleFactor,
            height: logoImage.height * scaleFactor,
        };
        page.drawImage(logoImage, {
            x: margin,
            y: currentY - logoDims.height + 5, // Adjust Y to align with text
            width: logoDims.width,
            height: logoDims.height,
        });
    }

    const logoWidthForTextStart = logoImage ? 70 : 0; // Use the fixed width used for drawing
    const textStartX = margin + logoWidthForTextStart + (logoImage ? 10 : 0);
    let textY = currentY;
    page.drawText(APP_NAME_REPORTS, { x: textStartX, y: textY, font: boldFont, size: 12 });
    textY -= 14;
    page.drawText(COMPANY_INFO_REPORTS.name, { x: textStartX, y: textY, font: boldFont, size: 9 });
    textY -= 10;
    if (COMPANY_INFO_REPORTS.addressLine1) page.drawText(COMPANY_INFO_REPORTS.addressLine1, { x: textStartX, y: textY, font: font, size: 8 });
    textY -= 9;
    if (COMPANY_INFO_REPORTS.addressLine2) page.drawText(COMPANY_INFO_REPORTS.addressLine2, { x: textStartX, y: textY, font: font, size: 8 });
    textY -= 9;
    if (COMPANY_INFO_REPORTS.contact) page.drawText(COMPANY_INFO_REPORTS.contact, { x: textStartX, y: textY, font: font, size: 8 });
    
    currentY = Math.min(textY, currentY - (logoImage ? (logoImage.height * (70/logoImage.width)) : 0)) - 15; // Adjusted for proportional height
    yPos.y = currentY; // Update Y position for subsequent content
}


// Generic PDF table drawing helper (can be expanded)
async function drawPdfTable(
    pdfDoc: PDFDocument,
    initialPage: any, // PDFPage
    startX: number,
    startY: number, // This will be the y after the header
    tableHeaders: string[],
    tableData: string[][],
    columnWidths: number[],
    reportTitle: string,
    options?: {
        rowHeight?: number,
        headerFontSize?: number,
        cellFontSize?: number,
        font?: PDFFont,
        boldFont?: PDFFont,
        pageBottomMargin?: number,
        pageTopMargin?: number,
    }
) {
    let page = initialPage;
    let y = startY;
    const rowHeight = options?.rowHeight || 20;
    const headerFontSize = options?.headerFontSize || 10;
    const cellFontSize = options?.cellFontSize || 9;
    const font = options?.font || await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = options?.boldFont || await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const bottomMargin = options?.pageBottomMargin || 50;
    // const topMargin = options?.pageTopMargin || 50; // For new pages
    // const pageWidth = options?.pageWidth || page.getWidth();
    // const pageHeight = options?.pageHeight || page.getHeight();

    // Draw the Report Title
    const reportTitleFontSize = headerFontSize + 1; // Slightly larger for the main title
    page.drawText(reportTitle, {
        x: startX,
        y: y, // Draw at the current startY
        font: boldFont,
        size: reportTitleFontSize,
        color: rgb(0, 0, 0),
    });
    y -= (reportTitleFontSize + 10); // Decrement Y for space after title, before headers

    // Draw headers
    let currentX = startX;
    tableHeaders.forEach((header, i) => {
        page.drawText(header, {
            x: currentX + 2, // Small padding
            y: y - 15, // Position relative to new Y
            font: boldFont,
            size: headerFontSize,
            color: rgb(0, 0, 0),
        });
        currentX += columnWidths[i];
    });
    y -= rowHeight; // This Y is now for the line under headers
    page.drawLine({ start: { x: startX, y: y }, end: { x: startX + columnWidths.reduce((a,b)=>a+b,0), y: y }, thickness: 0.5 });
    y -= 5; // Space after header line


    // Draw data rows
    for (const row of tableData) {
        if (y < bottomMargin) {
            page = pdfDoc.addPage(); // Add new page
            y = page.getHeight() - (options?.pageTopMargin || 50); // Reset Y to top margin
            currentX = startX;
            tableHeaders.forEach((header, i) => {
                page.drawText(header, { x: currentX + 2, y: y - 15, font: boldFont, size: headerFontSize });
                currentX += columnWidths[i];
            });
            y -= rowHeight;
            page.drawLine({ start: { x: startX, y: y }, end: { x: startX + columnWidths.reduce((a,b)=>a+b,0), y: y }, thickness: 0.5 });
            y -= 5;
        }

        currentX = startX;
        let maxLinesInRow = 1;

        row.forEach((cell, i) => {
            const initialLines = cell.split('\n');
            let textLinesCell: string[] = [];
            const maxWidth = columnWidths[i] - 4; // Padding

            initialLines.forEach(initialLine => {
                if (font.widthOfTextAtSize(initialLine, cellFontSize) > maxWidth) {
                    // Apply word wrapping for this specific line if it's too long
                    const words = initialLine.split(' ');
                    let currentWrappedLine = '';
                    for (const word of words) {
                        if (font.widthOfTextAtSize(currentWrappedLine + word + ' ', cellFontSize) > maxWidth && currentWrappedLine.length > 0) {
                            textLinesCell.push(currentWrappedLine.trim());
                            currentWrappedLine = word + ' ';
                        } else {
                            currentWrappedLine += word + ' ';
                        }
                    }
                    textLinesCell.push(currentWrappedLine.trim()); // Add the last part of the wrapped line
                } else {
                    // Line fits, add it directly
                    textLinesCell.push(initialLine);
                }
            });
            
            maxLinesInRow = Math.max(maxLinesInRow, textLinesCell.length);

            let lineYOffset = 0;
            // Ensure textLinesCell is not empty before drawing
            if (textLinesCell.length === 0 && cell.trim() === '') { // Handle case of empty or whitespace-only cell
                textLinesCell.push(''); // Draw at least one empty line to maintain cell structure if needed
            }

            textLinesCell.forEach(line => {
                 page.drawText(line, {
                    x: currentX + 2, // Small padding
                    y: y - 13 - lineYOffset, // Adjust y for each line
                    font: font,
                    size: cellFontSize,
                    color: rgb(0.2, 0.2, 0.2),
                });
                lineYOffset += cellFontSize * 1.1; // Standard line height adjustment
            });
            currentX += columnWidths[i];
        });
        
        // Adjust row height based on the maximum number of lines in any cell of this row
        y -= Math.max(rowHeight, maxLinesInRow * cellFontSize * 1.1 + 5); // +5 for padding
        page.drawLine({ start: { x: startX, y: y + 5 }, end: { x: startX + columnWidths.reduce((a,b)=>a+b,0), y: y + 5 }, thickness: 0.2, color: rgb(0.8,0.8,0.8) });
    }
    return y; // Return the Y position after drawing the table
}


export async function exportSalesToPDF(filters?: DateRangeFilters): Promise<void> {
    try {
        console.log("Fetching sales data for PDF export with filters:", filters);
        const salesReportData = await getAllDetailedSalesForReport(filters);
        if (salesReportData.length === 0) {
            alert("No sales data available for the selected filters to export.");
            return;
        }
        console.log(`Fetched ${salesReportData.length} items for PDF report.`);

        const pdfDoc = await PDFDocument.create();
        let page = pdfDoc.addPage();
        const { width, height } = page.getSize();
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
        const margin = 40;
        
        let yPos = { y: height - margin };
        await addPdfHeader(pdfDoc, page, yPos);
        
        const headers = ["Date", "Customer", "Product", "Qty", "Price (€)", "Discount", "Total (€)", "Invoice #"];
        const columnWidths = [60, 80, 100, 30, 50, 60, 60, 60]; // Invoice # width moved to end
        const tableData = salesReportData.map(item => [
            item.saleDate,
            item.customerName,
            item.productName,
            String(item.quantitySold),
            item.pricePerUnit.toFixed(2),
            item.discountDisplay,
            item.itemTotal.toFixed(2),
            item.invoiceNumber
        ]);

        let reportTitle = "Sales Report";
        if (filters?.startDate && filters?.endDate) {
            reportTitle = `Sales Report from ${new Date(filters.startDate).toLocaleDateString()} to ${new Date(filters.endDate).toLocaleDateString()}`;
        } else if (filters?.startDate) {
            reportTitle = `Sales Report from ${new Date(filters.startDate).toLocaleDateString()}`;
        } else if (filters?.endDate) {
            reportTitle = `Sales Report up to ${new Date(filters.endDate).toLocaleDateString()}`;
        }

        await drawPdfTable(pdfDoc, page, margin, yPos.y, headers, tableData, columnWidths, reportTitle, { font, boldFont, pageBottomMargin: margin, pageTopMargin: margin, cellFontSize: 8, headerFontSize: 9 });

        const pdfBytes = await pdfDoc.save();
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        const now = new Date();
        const dateStamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        saveAs(blob, `Hurvesthub_Sales_Report_${dateStamp}.pdf`);
        console.log("Sales PDF export initiated.");

    } catch (error) {
        console.error("Failed to export sales to PDF:", error);
        alert(`Error exporting sales data to PDF: ${error instanceof Error ? error.message : String(error)}`);
    }
}

export async function exportInventoryToPDF(filters?: InventoryReportFilters): Promise<void> {
    try {
        console.log("Fetching inventory data for PDF export with filters:", filters);
        const inventoryReportData = await getAllInventoryForReport(filters);
        if (inventoryReportData.length === 0) {
            alert("No inventory data available for the selected filters to export.");
            return;
        }
        console.log(`Fetched ${inventoryReportData.length} items for PDF report.`);

        const pdfDoc = await PDFDocument.create();
        let page = pdfDoc.addPage();
        const { width, height } = page.getSize();
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
        const margin = 40;
        
        let yPos = { y: height - margin };
        await addPdfHeader(pdfDoc, page, yPos);
        
        const headers = ["Name", "Type", "Crop", "Supplier", "Qty", "Unit", "Cost/Unit (€)"];
        const columnWidths = [90, 70, 60, 70, 35, 45, 120]; // Adjusted last column width
        const tableData = inventoryReportData.map(item => [
            item.itemName,
            item.itemType,
            item.cropName || '',
            item.supplier || '',
            String(item.currentQuantity) ?? '', // Always use currentQuantity for the report
            item.quantityUnit || '',
            item.costPerUnit !== undefined ? item.costPerUnit.toFixed(2) : ''
        ]);
        
        let reportTitle = "Inventory Report";
        if (filters?.category) {
            reportTitle = `${filters.category} Inventory Report`;
        }
        if (filters?.startDate && filters?.endDate) {
            reportTitle += ` from ${new Date(filters.startDate).toLocaleDateString()} to ${new Date(filters.endDate).toLocaleDateString()}`;
        } else if (filters?.startDate) {
            reportTitle += ` from ${new Date(filters.startDate).toLocaleDateString()}`;
        } else if (filters?.endDate) {
            reportTitle += ` up to ${new Date(filters.endDate).toLocaleDateString()}`;
        }


        await drawPdfTable(pdfDoc, page, margin, yPos.y, headers, tableData, columnWidths, reportTitle, { font, boldFont, rowHeight: 18, cellFontSize: 8, headerFontSize: 9, pageBottomMargin: margin, pageTopMargin: margin });

        const pdfBytes = await pdfDoc.save();
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        const now = new Date();
        const dateStamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        saveAs(blob, `Hurvesthub_Inventory_Report_${dateStamp}.pdf`);
        console.log("Inventory PDF export initiated.");

    } catch (error) {
        console.error("Failed to export inventory to PDF:", error);
        alert(`Error exporting inventory data to PDF: ${error instanceof Error ? error.message : String(error)}`);
    }
}


export async function exportHarvestLogsToPDF(filters?: DateRangeFilters): Promise<void> {
    try {
        console.log("Fetching harvest log data for PDF export with filters:", filters);
        const harvestReportData = await getAllHarvestLogsForReport(filters);
        if (harvestReportData.length === 0) {
            alert("No harvest log data available for the selected filters to export.");
            return;
        }
        console.log(`Fetched ${harvestReportData.length} items for PDF report.`);

        const pdfDoc = await PDFDocument.create();
        let page = pdfDoc.addPage();
        const { width, height } = page.getSize();
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
        const margin = 40;

        let yPos = { y: height - margin };
        await addPdfHeader(pdfDoc, page, yPos);
        
        const headers = ["Harvest Date", "Crop Details", "Qty", "Unit", "Quality", "Location"];
        // Adjusted columnWidths: Crop Details wider, Location width increased
        const columnWidths = [70, 180, 40, 40, 70, 180];
        const tableData = harvestReportData.map(item => [
            item.harvestDate,
            `${item.cropName || 'N/A'}\nVariety: ${item.cropVariety || 'N/A'}\nType: ${item.cropType || 'N/A'}`,
            String(item.quantityHarvested),
            item.quantityUnit,
            item.qualityGrade || '',
            item.location || ''
        ]);
        
        let reportTitle = "Harvest Log Report";
        if (filters?.startDate && filters?.endDate) {
            reportTitle = `Harvest Log Report from ${new Date(filters.startDate).toLocaleDateString()} to ${new Date(filters.endDate).toLocaleDateString()}`;
        } else if (filters?.startDate) {
            reportTitle = `Harvest Log Report from ${new Date(filters.startDate).toLocaleDateString()}`;
        } else if (filters?.endDate) {
            reportTitle = `Harvest Log Report up to ${new Date(filters.endDate).toLocaleDateString()}`;
        }

        // Estimate row height based on max lines in crop details, default to 4 lines for crop details + 1 for other data = 5 lines * ~10pts = 50
        // This is a rough estimate; drawPdfTable handles actual wrapping and height.
        // The rowHeight in drawPdfTable options is more of a minimum.
        const dynamicRowHeight = 18 * 2; // Allow more space for multi-line crop details

        await drawPdfTable(pdfDoc, page, margin, yPos.y, headers, tableData, columnWidths, reportTitle, { font, boldFont, rowHeight: dynamicRowHeight, cellFontSize: 8, headerFontSize: 9, pageBottomMargin: margin, pageTopMargin: margin });

        const pdfBytes = await pdfDoc.save();
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        const now = new Date();
        const dateStamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        saveAs(blob, `Hurvesthub_HarvestLogs_Report_${dateStamp}.pdf`);
        console.log("Harvest Logs PDF export initiated.");

    } catch (error) {
        console.error("Failed to export harvest logs to PDF:", error);
        alert(`Error exporting harvest logs to PDF: ${error instanceof Error ? error.message : String(error)}`);
    }
}
// --- Seedling Lifecycle Report ---

export interface SeedlingLifecycleReportItem {
    // seedBatchCode: string; // Removed as per user request
    cropName: string;
    cropVariety?: string;
    plantingDate: string;
    quantityPlanted: number;
    plantingUnit?: string;
    plantingLocation?: string;
    totalQuantityHarvested: number;
    harvestUnit?: string; // Assuming harvest unit might be consistent for a planting
    totalQuantitySold: number;
    totalRevenueFromSales: number;
    // Optional: Add more calculated fields like sellThroughRate, yieldPerSeedling etc.
}

async function getSeedlingLifecycleReportData(filters?: DateRangeFilters): Promise<SeedlingLifecycleReportItem[]> {
    console.log("Fetching data for Seedling Lifecycle Report with filters:", filters);
    const reportItems: SeedlingLifecycleReportItem[] = [];

    // 1. Fetch all relevant data
    //    - planting_logs (can be filtered by date)
    //    - seed_batches
    //    - crops
    //    - harvest_logs
    //    - sale_items
    //    - sales (to get sale_date for filtering sales if needed, though primary filter is on planting_date)

    let plantingLogsQuery = db.plantingLogs.filter(p => p.is_deleted !== 1 && !!p.seed_batch_id); // Only those with seed batches
    if (filters?.startDate) {
        plantingLogsQuery = plantingLogsQuery.and(p => p.planting_date >= new Date(filters.startDate!).toISOString().split('T')[0]);
    }
    if (filters?.endDate) {
        plantingLogsQuery = plantingLogsQuery.and(p => p.planting_date <= new Date(filters.endDate!).toISOString().split('T')[0]);
    }
    const plantingLogs = await plantingLogsQuery.toArray();
    if (plantingLogs.length === 0) return [];

    const seedBatchIds = plantingLogs.map(p => p.seed_batch_id).filter(id => id !== null) as string[];
    const plantingLogIds = plantingLogs.map(p => p.id);

    const [seedBatches, crops, allHarvestLogs, allSaleItems] = await Promise.all([
        db.seedBatches.where('id').anyOf(seedBatchIds).and(sb => sb.is_deleted !== 1).toArray(),
        db.crops.filter(c => c.is_deleted !== 1).toArray(),
        db.harvestLogs.where('planting_log_id').anyOf(plantingLogIds).and(h => h.is_deleted !== 1).toArray(),
        db.saleItems.filter(si => si.is_deleted !== 1 && !!si.harvest_log_id).toArray() // Fetch all sale items linked to any harvest
    ]);
    
    // 2. Process each planting log
    for (const pLog of plantingLogs) {
        const seedBatch = seedBatches.find(sb => sb.id === pLog.seed_batch_id);
        if (!seedBatch) continue; // Should not happen if query is correct

        const crop = crops.find(c => c.id === seedBatch.crop_id);

        // 3. Aggregate harvests for this planting_log_id
        const harvestsForThisPlanting = allHarvestLogs.filter(h => h.planting_log_id === pLog.id);
        let totalQuantityHarvested = 0;
        let harvestUnit: string | undefined = undefined;
        const harvestLogIdsForThisPlanting = harvestsForThisPlanting.map(h => h.id);

        harvestsForThisPlanting.forEach(h => {
            totalQuantityHarvested += h.quantity_harvested;
            if (!harvestUnit && h.quantity_unit) { // Take first harvest unit as representative
                harvestUnit = h.quantity_unit;
            }
        });

        // 4. Aggregate sales for these harvests
        const saleItemsForTheseHarvests = allSaleItems.filter(si => harvestLogIdsForThisPlanting.includes(si.harvest_log_id!));
        let totalQuantitySold = 0;
        let totalRevenueFromSales = 0;

        saleItemsForTheseHarvests.forEach(si => {
            totalQuantitySold += si.quantity_sold;
            let itemRevenue = si.quantity_sold * si.price_per_unit;
            if (si.discount_type && si.discount_value != null) {
                if (si.discount_type === 'Amount') {
                    itemRevenue -= si.discount_value;
                } else if (si.discount_type === 'Percentage') {
                    itemRevenue -= itemRevenue * (si.discount_value / 100);
                }
            }
            totalRevenueFromSales += Math.max(0, itemRevenue);
        });
        
        reportItems.push({
            // seedBatchCode: seedBatch.batch_code, // Removed
            cropName: crop?.name || 'N/A',
            cropVariety: crop?.variety,
            plantingDate: new Date(pLog.planting_date).toLocaleDateString(),
            quantityPlanted: pLog.quantity_planted ?? 0, // Default to 0 if undefined
            plantingUnit: pLog.quantity_unit,
            plantingLocation: pLog.location_description,
            totalQuantityHarvested,
            harvestUnit: harvestUnit || pLog.quantity_unit, // Fallback to planting unit if no harvest unit
            totalQuantitySold,
            totalRevenueFromSales,
        });
    }

    // Optional: Sort reportItems, e.g., by plantingDate or cropName
    reportItems.sort((a, b) => new Date(a.plantingDate).getTime() - new Date(b.plantingDate).getTime());

    console.log(`Processed ${reportItems.length} items for Seedling Lifecycle Report.`);
    return reportItems;
}

// PDF export function
export async function exportSeedlingLifecycleToPDF(filters?: DateRangeFilters): Promise<void> {
    try {
        console.log("Fetching data for Seedling Lifecycle PDF export with filters:", filters);
        const reportData = await getSeedlingLifecycleReportData(filters);

        if (reportData.length === 0) {
            alert("No data available for the Seedling Lifecycle report with the selected filters.");
            return;
        }
        console.log(`Fetched ${reportData.length} items for Seedling Lifecycle PDF.`);

        const pdfDoc = await PDFDocument.create();
        let page = pdfDoc.addPage(); // Default page size
        const { width, height } = page.getSize();
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
        const margin = 40;

        let yPos = { y: height - margin };
        await addPdfHeader(pdfDoc, page, yPos);

        const headers = [
            // "Seed Batch", // Removed
            "Crop (Name/Variety)",
            "Planted (Date/Qty/Unit/Loc)",
            "Harvested (Qty/Unit)",
            "Sold (Qty/Revenue €)"
        ];
        // Adjust column widths: Redistribute width from removed "Seed Batch" column
        const columnWidths = [150, 170, 100, 112]; // Example: increased crop and planted, adjusted others

        const tableData = reportData.map(item => [
            // item.seedBatchCode, // Removed
            `${item.cropName}${item.cropVariety ? ` (${item.cropVariety})` : ''}`,
            `${item.plantingDate}\nQty: ${item.quantityPlanted} ${item.plantingUnit || ''}\nLoc: ${item.plantingLocation || 'N/A'}`,
            `${item.totalQuantityHarvested} ${item.harvestUnit || ''}`,
            `${item.totalQuantitySold}\nRevenue: ${item.totalRevenueFromSales.toFixed(2)} €`
        ]);
        
        let reportTitle = "Seedling Lifecycle Report";
        if (filters?.startDate && filters?.endDate) {
            reportTitle = `Seedling Lifecycle Report from ${new Date(filters.startDate).toLocaleDateString()} to ${new Date(filters.endDate).toLocaleDateString()}`;
        } else if (filters?.startDate) {
            reportTitle = `Seedling Lifecycle Report from ${new Date(filters.startDate).toLocaleDateString()}`;
        } else if (filters?.endDate) {
            reportTitle = `Seedling Lifecycle Report up to ${new Date(filters.endDate).toLocaleDateString()}`;
        }
        
        // Consider dynamic row height based on content, especially for multi-line cells
        const estRowHeight = 18 * 3; // Estimate for 3 lines

        await drawPdfTable(
            pdfDoc, page, margin, yPos.y, headers, tableData, columnWidths, reportTitle,
            { font, boldFont, rowHeight: estRowHeight, cellFontSize: 8, headerFontSize: 9, pageBottomMargin: margin, pageTopMargin: margin }
        );

        const pdfBytes = await pdfDoc.save();
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        const now = new Date();
        const dateStamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        saveAs(blob, `Hurvesthub_SeedlingLifecycle_Report_${dateStamp}.pdf`);
        console.log("Seedling Lifecycle PDF export initiated.");

    } catch (error) {
        console.error("Failed to export Seedling Lifecycle to PDF:", error);
        alert(`Error exporting Seedling Lifecycle data to PDF: ${error instanceof Error ? error.message : String(error)}`);
    }
}

// CSV export function
function convertSeedlingLifecycleToCSV(data: SeedlingLifecycleReportItem[]): string {
    if (!data.length) return "";
    const headers = ["Crop Name", "Crop Variety", "Planting Date", "Qty Planted", "Planting Unit", "Planting Location", "Total Qty Harvested", "Harvest Unit", "Total Qty Sold", "Total Revenue (€)"];
    const csvRows = [headers.join(',')];
    data.forEach(item => {
        const row = [
            // `"${item.seedBatchCode}"`, // Removed
            `"${item.cropName.replace(/"/g, '""')}"`,
            `"${(item.cropVariety || '').replace(/"/g, '""')}"`,
            `"${item.plantingDate}"`,
            item.quantityPlanted,
            `"${(item.plantingUnit || '').replace(/"/g, '""')}"`,
            `"${(item.plantingLocation || '').replace(/"/g, '""')}"`,
            item.totalQuantityHarvested,
            `"${(item.harvestUnit || '').replace(/"/g, '""')}"`,
            item.totalQuantitySold,
            item.totalRevenueFromSales.toFixed(2)
        ];
        csvRows.push(row.join(','));
    });
    return csvRows.join('\n');
}

export async function exportSeedlingLifecycleToCSV(filters?: DateRangeFilters): Promise<void> {
    try {
        console.log("Fetching data for Seedling Lifecycle CSV export with filters:", filters);
        const reportData = await getSeedlingLifecycleReportData(filters);
        if (reportData.length === 0) {
            alert("No data available for the Seedling Lifecycle report with the selected filters.");
            return;
        }
        console.log(`Fetched ${reportData.length} items for Seedling Lifecycle CSV.`);
        
        const csvData = convertSeedlingLifecycleToCSV(reportData);
        const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
        
        const now = new Date();
        const dateStamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        saveAs(blob, `Hurvesthub_SeedlingLifecycle_Report_${dateStamp}.csv`);
        console.log("Seedling Lifecycle CSV export initiated.");

    } catch (error) {
        console.error("Failed to export Seedling Lifecycle to CSV:", error);
        alert(`Error exporting Seedling Lifecycle data to CSV: ${error instanceof Error ? error.message : String(error)}`);
    }
}
// --- Organic Compliance Report Placeholders ---

export interface OrganicComplianceReportItem {
    // Define fields based on actual compliance requirements
    // Example fields:
    activityDate: string;
    activityType: string;
    plotAffected?: string;
    cropName?: string;
    inputName?: string;
    inputQuantityUsed?: number;
    inputUnit?: string;
    notes?: string;
    // ... other relevant fields for traceability
}

async function getOrganicComplianceReportData(filters?: DateRangeFilters): Promise<OrganicComplianceReportItem[]> {
    console.log("Fetching data for Organic Compliance Report with filters:", filters);
    // TODO: Implement actual data fetching and processing logic based on compliance needs.
    // This would involve fetching from cultivation_logs, input_inventory, planting_logs, crops, seed_batches etc.
    // and correlating them as per specific organic certification rules.
    
    // Placeholder data:
    const placeholderItem: OrganicComplianceReportItem = {
        activityDate: new Date().toLocaleDateString(),
        activityType: "Placeholder Activity",
        plotAffected: "Field X",
        cropName: "Placeholder Crop",
        inputName: "Placeholder Input",
        inputQuantityUsed: 10,
        inputUnit: "kg",
        notes: "This is a placeholder for organic compliance data."
    };
    // Simulate filtering if filters are provided
    if (filters?.startDate && new Date(placeholderItem.activityDate) < new Date(filters.startDate)) {
        return [];
    }
    if (filters?.endDate && new Date(placeholderItem.activityDate) > new Date(filters.endDate)) {
        return [];
    }
    return [placeholderItem];
}

function convertOrganicComplianceToCSV(data: OrganicComplianceReportItem[]): string {
    if (!data.length) return "";
    // TODO: Define actual headers based on compliance requirements
    const headers = ["Activity Date", "Activity Type", "Plot", "Crop", "Input Used", "Qty", "Unit", "Notes"];
    const csvRows = [headers.join(',')];
    data.forEach(item => {
        const row = [
            `"${item.activityDate}"`,
            `"${item.activityType.replace(/"/g, '""')}"`,
            `"${(item.plotAffected || '').replace(/"/g, '""')}"`,
            `"${(item.cropName || '').replace(/"/g, '""')}"`,
            `"${(item.inputName || '').replace(/"/g, '""')}"`,
            item.inputQuantityUsed ?? '',
            `"${(item.inputUnit || '').replace(/"/g, '""')}"`,
            `"${(item.notes || '').replace(/"/g, '""')}"`
        ];
        csvRows.push(row.join(','));
    });
    return csvRows.join('\n');
}

export async function exportOrganicComplianceToCSV(filters?: DateRangeFilters): Promise<void> {
    try {
        console.log("Fetching data for Organic Compliance CSV export with filters:", filters);
        const reportData = await getOrganicComplianceReportData(filters);
        if (reportData.length === 0) {
            alert("No data available for the Organic Compliance report with the selected filters.");
            return;
        }
        const csvData = convertOrganicComplianceToCSV(reportData);
        const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
        const now = new Date();
        const dateStamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        saveAs(blob, `Hurvesthub_OrganicCompliance_Report_${dateStamp}.csv`);
        console.log("Organic Compliance CSV export initiated (placeholder data).");
    } catch (error) {
        console.error("Failed to export Organic Compliance to CSV:", error);
        alert(`Error exporting Organic Compliance data to CSV: ${error instanceof Error ? error.message : String(error)}`);
    }
}

export async function exportOrganicComplianceToPDF(filters?: DateRangeFilters): Promise<void> {
    try {
        console.log("Fetching data for Organic Compliance PDF export with filters:", filters);
        const reportData = await getOrganicComplianceReportData(filters);
        if (reportData.length === 0) {
            alert("No data available for the Organic Compliance report with the selected filters.");
            return;
        }

        const pdfDoc = await PDFDocument.create();
        let page = pdfDoc.addPage();
        const { width, height } = page.getSize();
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
        const margin = 40;
        let yPos = { y: height - margin };
        await addPdfHeader(pdfDoc, page, yPos);

        // TODO: Define actual headers and column widths based on compliance requirements
        const headers = ["Activity Date", "Activity Type", "Plot", "Crop", "Input Used", "Qty", "Unit", "Notes"];
        const columnWidths = [70, 100, 70, 80, 80, 40, 40, 100]; 

        const tableData = reportData.map(item => [
            item.activityDate,
            item.activityType,
            item.plotAffected || '',
            item.cropName || '',
            item.inputName || '',
            String(item.inputQuantityUsed ?? ''),
            item.inputUnit || '',
            item.notes || ''
        ]);
        
        let reportTitle = "Organic Compliance Report";
        if (filters?.startDate && filters?.endDate) {
            reportTitle = `Organic Compliance Report from ${new Date(filters.startDate).toLocaleDateString()} to ${new Date(filters.endDate).toLocaleDateString()}`;
        } else if (filters?.startDate) {
            reportTitle = `Organic Compliance Report from ${new Date(filters.startDate).toLocaleDateString()}`;
        } else if (filters?.endDate) {
            reportTitle = `Organic Compliance Report up to ${new Date(filters.endDate).toLocaleDateString()}`;
        }
        
        await drawPdfTable(pdfDoc, page, margin, yPos.y, headers, tableData, columnWidths, reportTitle, 
            { font, boldFont, rowHeight: 18, cellFontSize: 8, headerFontSize: 9, pageBottomMargin: margin, pageTopMargin: margin });

        const pdfBytes = await pdfDoc.save();
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        const now = new Date();
        const dateStamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        saveAs(blob, `Hurvesthub_OrganicCompliance_Report_${dateStamp}.pdf`);
        console.log("Organic Compliance PDF export initiated (placeholder data).");

    } catch (error) {
        console.error("Failed to export Organic Compliance to PDF:", error);
        alert(`Error exporting Organic Compliance data to PDF: ${error instanceof Error ? error.message : String(error)}`);
    }
}
// --- Input Item Usage Ledger Report ---

export interface CultivationUsageDetail {
  cultivationLogId: string;
  activityDate: string;
  activityType: string;
  quantityUsed?: number;
  quantityUnit?: string;
  targetDescription?: string; // e.g., "Crop: Tomato (Field A)" or "Tree: Olive T-001"
  notes?: string;
}

export interface InputItemUsageLedgerDataItem {
  itemId: string; // InputInventory ID
  itemName: string;
  itemType?: string;
  supplier?: string;
  supplierInvoiceNumber?: string;
  purchaseDate?: string;
  initialQuantity?: number;
  quantityUnit?: string; // Unit of the purchased item
  currentQuantity?: number; // Current stock of this specific lot
  totalPurchaseCost?: number; // Cost of this specific lot
  uses: CultivationUsageDetail[];
}

export async function getInputItemUsageLedgerData(filters?: { itemId?: string }): Promise<InputItemUsageLedgerDataItem[]> {
  const ledgerItems: InputItemUsageLedgerDataItem[] = [];

  let inputInventoryQuery = db.inputInventory.where('is_deleted').notEqual(1);
  if (filters?.itemId) {
    inputInventoryQuery = inputInventoryQuery.and(item => item.id === filters.itemId);
  }
  const inputLots = await inputInventoryQuery.toArray();

  const allCultivationLogs = await db.cultivationLogs.where('is_deleted').notEqual(1).toArray();
  const allPlantingLogs = await db.plantingLogs.where('is_deleted').notEqual(1).toArray();
  const allCrops = await db.crops.where('is_deleted').notEqual(1).toArray();
  const allSeedBatches = await db.seedBatches.where('is_deleted').notEqual(1).toArray();
  // Add Trees if CultivationLogs can link to them: const allTrees = await db.trees.where('is_deleted').notEqual(1).toArray();


  for (const lot of inputLots) {
    const uses: CultivationUsageDetail[] = [];
    const relatedCultivationLogs = allCultivationLogs.filter(cl => cl.input_inventory_id === lot.id);

    for (const cl of relatedCultivationLogs) {
      let targetDescription = 'N/A';
      if (cl.planting_log_id) {
        const pLog = allPlantingLogs.find(pl => pl.id === cl.planting_log_id);
        if (pLog) {
          let cropName = 'Unknown Crop';
          if (pLog.seed_batch_id) {
            const sBatch = allSeedBatches.find(sb => sb.id === pLog.seed_batch_id);
            if (sBatch) {
              const crop = allCrops.find(c => c.id === sBatch.crop_id);
              cropName = crop?.name || 'Crop Name Missing';
            }
          } else if (pLog.seedling_production_log_id) {
            // Need to trace back seedling_production_log to crop if direct crop_id isn't on planting_log
            // For now, this path might not fully resolve crop name easily without more joins/lookups
             const seedlingProdLog = await db.seedlingProductionLogs.get(pLog.seedling_production_log_id);
             if(seedlingProdLog) {
                const crop = allCrops.find(c => c.id === seedlingProdLog.crop_id);
                cropName = crop?.name || 'Crop Name Missing (from seedling)';
             }
          }
          targetDescription = `${cropName} (Plot: ${pLog.plot_affected || pLog.location_description || 'N/A'})`;
        }
      }
      // TODO: Add logic for other targets like Trees if cultivation logs can target them

      uses.push({
        cultivationLogId: cl.id,
        activityDate: new Date(cl.activity_date).toLocaleDateString(),
        activityType: cl.activity_type,
        quantityUsed: cl.input_quantity_used,
        quantityUnit: cl.input_quantity_unit,
        targetDescription: targetDescription,
        notes: cl.notes,
      });
    } // This was closing the inner for-loop (for cl of relatedCultivationLogs)

    uses.sort((a,b) => new Date(b.activityDate).getTime() - new Date(a.activityDate).getTime());

    ledgerItems.push({
      itemId: lot.id,
      itemName: lot.name,
      itemType: lot.type,
      supplier: lot.supplier,
      supplierInvoiceNumber: lot.supplier_invoice_number,
      purchaseDate: lot.purchase_date ? new Date(lot.purchase_date).toLocaleDateString() : undefined,
      initialQuantity: lot.initial_quantity,
      quantityUnit: lot.quantity_unit,
      currentQuantity: lot.current_quantity,
      totalPurchaseCost: lot.total_purchase_cost,
      uses: uses,
    });
  } // This closes the outer for-loop (for lot of inputLots)
  
  ledgerItems.sort((a,b) => a.itemName.localeCompare(b.itemName) || (a.purchaseDate || '').localeCompare(b.purchaseDate || ''));

  return ledgerItems;
} // This closes the getInputItemUsageLedgerData function

// PDF export function for this ledger will be complex due to nested structure.
export async function exportInputItemUsageLedgerToPDF(filters?: { itemId?: string }): Promise<void> {
  try {
    const ledgerData = await getInputItemUsageLedgerData(filters);
    if (ledgerData.length === 0) {
      alert("No input item usage data available for the selected filters.");
      return;
    }

    const pdfDoc = await PDFDocument.create();
    let page = pdfDoc.addPage([612, 792]); // Standard Letter size
    const { width, height } = page.getSize();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const margin = 40;
    let yPos = { y: height - margin };

    await addPdfHeader(pdfDoc, page, yPos);
    yPos.y -= 10;

    page.drawText("Input Item Usage Ledger", {
      x: margin,
      y: yPos.y,
      font: boldFont,
      size: 14,
      color: rgb(0, 0, 0),
    });
    yPos.y -= 20;

    const titleFontSize = 11;
    const detailFontSize = 9;
    const usageFontSize = 8;
    const lineHeight = 13;
    const sectionSpacing = 15;

    for (const itemLot of ledgerData) {
      // Check for new page before starting a new item lot section
      if (yPos.y < margin + 100) { // Estimate space needed for a lot + some uses
        page = pdfDoc.addPage([612, 792]);
        yPos.y = height - margin;
        await addPdfHeader(pdfDoc, page, yPos);
        page.drawText("Input Item Usage Ledger (Continued)", {
            x: margin, y: yPos.y, font: boldFont, size: 14, color: rgb(0,0,0)
        });
        yPos.y -= 20;
      }

      // Lot Details
      page.drawText(`${itemLot.itemName} (${itemLot.itemType || 'N/A'})`, { x: margin, y: yPos.y, font: boldFont, size: titleFontSize });
      yPos.y -= lineHeight;
      
      page.drawText(`Supplier: ${itemLot.supplier || 'N/A'}`, { x: margin + 5, y: yPos.y, font: font, size: detailFontSize });
      yPos.y -= lineHeight * 0.9;
      page.drawText(`Invoice: ${itemLot.supplierInvoiceNumber || 'N/A'}`, { x: margin + 5, y: yPos.y, font: font, size: detailFontSize });
      yPos.y -= lineHeight * 0.9;
      page.drawText(`Purchased: ${itemLot.purchaseDate || 'N/A'} - Initial Qty: ${itemLot.initialQuantity?.toLocaleString() || 'N/A'} ${itemLot.quantityUnit || ''}`, { x: margin + 5, y: yPos.y, font: font, size: detailFontSize });
      yPos.y -= lineHeight * 0.9;
      page.drawText(`Current Stock (this lot): ${itemLot.currentQuantity?.toLocaleString() || '0'} ${itemLot.quantityUnit || ''}`, { x: margin + 5, y: yPos.y, font: font, size: detailFontSize });
      yPos.y -= lineHeight * 1.2; // More space before uses table

      // Uses Table for this lot
      if (itemLot.uses.length > 0) {
        page.drawText("Usage History:", { x: margin + 5, y: yPos.y, font: boldFont, size: detailFontSize });
        yPos.y -= lineHeight;

        const useHeaders = ["Date Used", "Qty Used", "Unit", "Target", "Activity", "Notes"];
        const useColWidths = [60, 50, 40, 150, 80, 100]; // Approx widths, sum to ~480
        
        // Draw headers for uses (simplified, no complex table draw function here for brevity)
        let currentX = margin + 10;
        useHeaders.forEach((header, idx) => {
            page.drawText(header, {x: currentX, y: yPos.y, font: boldFont, size: usageFontSize -1, color: rgb(0.2,0.2,0.2)});
            currentX += useColWidths[idx] + 5;
        });
        // yPos.y is currently at the baseline of the header text.
        // Move y down slightly for the line.
        yPos.y -= 2; // Adjust this value for precise line placement
        page.drawLine({start: {x: margin +10, y: yPos.y}, end: {x: width - margin -10, y: yPos.y}, thickness: 0.5, color: rgb(0.7,0.7,0.7)});
        yPos.y -= (lineHeight * 0.8 - 2); // Adjust for the rest of the intended space after headers


        for (const use of itemLot.uses) {
          if (yPos.y < margin + 30) { // New page check for use rows
            page = pdfDoc.addPage([612, 792]);
            yPos.y = height - margin;
            // No full header, just continue table or indicate continuation
             page.drawText(`Usage History for ${itemLot.itemName} (Continued)`, {
                x: margin, y: yPos.y, font: boldFont, size: titleFontSize, color: rgb(0,0,0)
            });
            yPos.y -= 20;
            currentX = margin + 10;
            useHeaders.forEach((header, idx) => { // Redraw headers on new page
                page.drawText(header, {x: currentX, y: yPos.y, font: boldFont, size: usageFontSize -1, color: rgb(0.2,0.2,0.2)});
                currentX += useColWidths[idx] + 5;
            });
            yPos.y -= 2; // Adjust for line
            page.drawLine({start: {x: margin +10, y: yPos.y}, end: {x: width - margin -10, y: yPos.y}, thickness: 0.5, color: rgb(0.7,0.7,0.7)});
            yPos.y -= (lineHeight * 0.8 - 2); // Adjust for remaining space
          }

          currentX = margin + 10;
          const useRow = [
            use.activityDate,
            use.quantityUsed?.toLocaleString() || 'N/A',
            use.quantityUnit || '',
            use.targetDescription || 'N/A',
            use.activityType,
            use.notes || ''
          ];
          useRow.forEach((cell, idx) => {
            page.drawText(String(cell).substring(0, useColWidths[idx] < 70 ? 15: 30), { // Basic truncation
                x: currentX, 
                y: yPos.y, 
                font: font, 
                size: usageFontSize, 
                maxWidth: useColWidths[idx]
            });
            currentX += useColWidths[idx] + 5;
          });
          yPos.y -= lineHeight;
        }
      } else {
        page.drawText("No usage recorded for this lot.", { x: margin + 10, y: yPos.y, font: font, size: usageFontSize, color: rgb(0.5,0.5,0.5) });
        yPos.y -= lineHeight;
      }
      yPos.y -= sectionSpacing; // Space between item lots
    }

    const pdfBytes = await pdfDoc.save();
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    const now = new Date();
    const dateStamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    saveAs(blob, `Hurvesthub_Input_Item_Usage_Ledger_${dateStamp}.pdf`);

  } catch (error) {
    console.error("Failed to export input item usage ledger to PDF:", error);
    alert(`Error exporting input item usage ledger: ${error instanceof Error ? error.message : String(error)}`);
  }
}
// --- Grouped Inventory Summary Report ---

export interface GroupedInventoryItemReportData {
  name: string;
  unit: string;
  totalCurrentQuantity: number;
  sources: Array<{ supplier?: string; quantity?: number }>;
}

export async function getGroupedInventorySummaryData(): Promise<GroupedInventoryItemReportData[]> {
  try {
    const allInputs = await db.inputInventory
      .where('is_deleted')
      .notEqual(1)
      .and(item => (item.current_quantity || 0) > 0)
      .toArray();

    const groupedByNameAndUnit: Record<string, GroupedInventoryItemReportData> = {};

    allInputs.forEach(item => {
      const groupKey = `${item.name}_${item.quantity_unit || 'N/A'}`;
      if (!groupedByNameAndUnit[groupKey]) {
        groupedByNameAndUnit[groupKey] = {
          name: item.name,
          unit: item.quantity_unit || 'N/A',
          totalCurrentQuantity: 0,
          sources: [],
        };
      }
      groupedByNameAndUnit[groupKey].totalCurrentQuantity += item.current_quantity || 0;
      groupedByNameAndUnit[groupKey].sources.push({
        supplier: item.supplier,
        quantity: item.current_quantity,
      });
    });
    
    return Object.values(groupedByNameAndUnit).sort((a, b) => a.name.localeCompare(b.name));
  } catch (err) {
    console.error("Failed to fetch or group inventory for summary report:", err);
    throw new Error("Failed to generate grouped inventory summary data.");
  }
}

export async function exportGroupedInventorySummaryToPDF(): Promise<void> {
  try {
    const reportData = await getGroupedInventorySummaryData();
    if (reportData.length === 0) {
      alert("No inventory items with current stock to summarize.");
      return;
    }

    const pdfDoc = await PDFDocument.create();
    let page = pdfDoc.addPage([612, 792]); // Standard Letter size
    const { width, height } = page.getSize();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const margin = 40;
    let yPos = { y: height - margin };

    await addPdfHeader(pdfDoc, page, yPos);
    yPos.y -= 10; // Space after header

    page.drawText("Inventory Stock Summary", {
      x: margin,
      y: yPos.y,
      font: boldFont,
      size: 14,
      color: rgb(0, 0, 0),
    });
    yPos.y -= 20;

    const itemFontSize = 10;
    const sourceFontSize = 9;
    const lineHeight = 14;
    const sourceIndent = margin + 15;

    for (const group of reportData) {
      if (yPos.y < margin + 50) { // Check for new page
        page = pdfDoc.addPage([612, 792]);
        yPos.y = height - margin;
        await addPdfHeader(pdfDoc, page, yPos);
         page.drawText("Inventory Stock Summary (Continued)", {
            x: margin,
            y: yPos.y,
            font: boldFont,
            size: 14,
            color: rgb(0, 0, 0),
        });
        yPos.y -= 20;
      }

      const groupTitle = `${group.name} - ${group.totalCurrentQuantity.toLocaleString()} ${group.unit} (Total)`;
      page.drawText(groupTitle, {
        x: margin,
        y: yPos.y,
        font: boldFont,
        size: itemFontSize + 1,
        color: rgb(0.1, 0.1, 0.1),
      });
      yPos.y -= lineHeight;

      if (group.sources.length > 0) {
        for (const source of group.sources) {
          if (yPos.y < margin + 20) { // Check for new page for sources
            page = pdfDoc.addPage([612, 792]);
            yPos.y = height - margin;
             page.drawText("Inventory Stock Summary (Continued)", { // No main header on continued page for sources
                x: margin,
                y: yPos.y,
                font: boldFont,
                size: 14,
                color: rgb(0, 0, 0),
            });
            yPos.y -= 20;
          }
          const sourceText = `  • From ${source.supplier || 'Unknown Supplier'}: ${source.quantity?.toLocaleString()} ${group.unit}`;
          page.drawText(sourceText, {
            x: sourceIndent,
            y: yPos.y,
            font: font,
            size: sourceFontSize,
            color: rgb(0.3, 0.3, 0.3),
          });
          yPos.y -= lineHeight * 0.9;
        }
      }
      yPos.y -= lineHeight * 0.5; // Extra space between groups
    }

    const pdfBytes = await pdfDoc.save();
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    const now = new Date();
    const dateStamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    saveAs(blob, `Hurvesthub_Inventory_Stock_Summary_${dateStamp}.pdf`);

  } catch (error) {
    console.error("Failed to export grouped inventory summary to PDF:", error);
    alert(`Error exporting grouped inventory summary: ${error instanceof Error ? error.message : String(error)}`);
  }
}
// --- Organic Compliance: Detailed Input Usage Report ---

export interface DetailedInputUsageReportItem {
  applicationDate: string;
  inputProductName: string;
  inputProductType?: string;
  quantityUsed?: number;
  quantityUnit?: string;
  cropAppliedTo?: string;
  cropVariety?: string;
  plotLocation?: string;
  cultivationActivityType: string;
  cultivationNotes?: string;
}

export async function getDetailedInputUsageData(filters?: DateRangeFilters): Promise<DetailedInputUsageReportItem[]> {
  let cultivationLogsQuery = db.cultivationLogs
    .where('is_deleted').notEqual(1)
    .and(cl => !!cl.input_inventory_id); // Only logs where an input was used

  if (filters?.startDate) {
    const start = new Date(filters.startDate).toISOString().split('T')[0];
    cultivationLogsQuery = cultivationLogsQuery.and(cl => cl.activity_date >= start);
  }
  if (filters?.endDate) {
    const end = new Date(filters.endDate).toISOString().split('T')[0];
    cultivationLogsQuery = cultivationLogsQuery.and(cl => cl.activity_date <= end);
  }

  const relevantCultivationLogs = await cultivationLogsQuery.toArray();
  if (relevantCultivationLogs.length === 0) return [];

  const inputInventoryIds = Array.from(new Set(relevantCultivationLogs.map(cl => cl.input_inventory_id).filter(Boolean) as string[]));
  const plantingLogIds = Array.from(new Set(relevantCultivationLogs.map(cl => cl.planting_log_id).filter(Boolean) as string[]));

  const [inputs, plantingLogs, seedBatches, crops, seedlingLogs] = await Promise.all([
    db.inputInventory.where('id').anyOf(inputInventoryIds).toArray(),
    db.plantingLogs.where('id').anyOf(plantingLogIds).toArray(),
    db.seedBatches.filter(sb => sb.is_deleted !== 1).toArray(), // Fetch all for linking
    db.crops.filter(c => c.is_deleted !== 1).toArray(),         // Fetch all for linking
    db.seedlingProductionLogs.filter(sl => sl.is_deleted !== 1).toArray() // Fetch all for linking
  ]);

  const reportItems: DetailedInputUsageReportItem[] = [];

  for (const cl of relevantCultivationLogs) {
    const input = inputs.find(i => i.id === cl.input_inventory_id);
    let cropName: string | undefined = undefined;
    let cropVariety: string | undefined = undefined;
    let plotLocation: string | undefined = cl.plot_affected; // Default to cultivation log's plot

    if (cl.planting_log_id) {
      const pLog = plantingLogs.find(pl => pl.id === cl.planting_log_id);
      if (pLog) {
        if (!plotLocation) plotLocation = pLog.plot_affected || pLog.location_description; // Use planting log's plot if more specific
        let c: Crop | undefined;
        if (pLog.seed_batch_id) {
          const sBatch = seedBatches.find(sb => sb.id === pLog.seed_batch_id);
          if (sBatch) c = crops.find(cr => cr.id === sBatch.crop_id);
        } else if (pLog.seedling_production_log_id) {
          const sl = seedlingLogs.find(s => s.id === pLog.seedling_production_log_id);
          if (sl) c = crops.find(cr => cr.id === sl.crop_id);
        }
        cropName = c?.name;
        cropVariety = c?.variety;
      }
    }

    reportItems.push({
      applicationDate: new Date(cl.activity_date).toLocaleDateString(),
      inputProductName: input?.name || 'Unknown Input',
      inputProductType: input?.type,
      quantityUsed: cl.input_quantity_used,
      quantityUnit: cl.input_quantity_unit,
      cropAppliedTo: cropName,
      cropVariety: cropVariety,
      plotLocation: plotLocation,
      cultivationActivityType: cl.activity_type,
      cultivationNotes: cl.notes,
    });
  }
  
  reportItems.sort((a,b) => new Date(b.applicationDate).getTime() - new Date(a.applicationDate).getTime());
  return reportItems;
}

function convertDetailedInputUsageToCSV(data: DetailedInputUsageReportItem[]): string {
  if (data.length === 0) return '';
  const headers = [
    "Application Date", "Input Product Name", "Input Product Type", "Quantity Used", "Unit",
    "Crop Applied To", "Crop Variety", "Plot/Location", "Cultivation Activity", "Notes"
  ];
  const csvRows = [headers.join(',')];
  data.forEach(item => {
    const row = [
      `"${item.applicationDate}"`,
      `"${item.inputProductName.replace(/"/g, '""')}"`,
      `"${(item.inputProductType || '').replace(/"/g, '""')}"`,
      item.quantityUsed ?? '',
      `"${(item.quantityUnit || '').replace(/"/g, '""')}"`,
      `"${(item.cropAppliedTo || '').replace(/"/g, '""')}"`,
      `"${(item.cropVariety || '').replace(/"/g, '""')}"`,
      `"${(item.plotLocation || '').replace(/"/g, '""')}"`,
      `"${item.cultivationActivityType.replace(/"/g, '""')}"`,
      `"${(item.cultivationNotes || '').replace(/"/g, '""')}"`
    ];
    csvRows.push(row.join(','));
  });
  return csvRows.join('\n');
}

export async function exportDetailedInputUsageToCSV(filters?: DateRangeFilters): Promise<void> {
  try {
    const reportData = await getDetailedInputUsageData(filters);
    if (reportData.length === 0) {
      alert("No input usage data available for the selected filters.");
      return;
    }
    const csvData = convertDetailedInputUsageToCSV(reportData);
    const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
    const now = new Date();
    const dateStamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    saveAs(blob, `Hurvesthub_Detailed_Input_Usage_Report_${dateStamp}.csv`);
  } catch (error) {
    console.error("Failed to export detailed input usage to CSV:", error);
    alert(`Error exporting detailed input usage data: ${error instanceof Error ? error.message : String(error)}`);
  }
}
export async function exportDetailedInputUsageToPDF(filters?: DateRangeFilters): Promise<void> {
  try {
    const reportData = await getDetailedInputUsageData(filters);
    if (reportData.length === 0) {
      alert("No input usage data available for the selected filters for PDF export.");
      return;
    }

    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([612, 792]); // Standard Letter size, adjust if needed
    const { width, height } = page.getSize();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const margin = 40;
    let yPos = { y: height - margin };

    await addPdfHeader(pdfDoc, page, yPos); // Use existing header function
    
    const reportTitle = "Detailed Input Usage Report";
    const headers = [
      "Date", "Product Name", "Type", "Qty Used", "Unit",
      "Crop", "Variety", "Plot/Location", "Activity", "Notes"
    ];
    // Adjust column widths as needed, these are estimates
    const columnWidths = [55, 80, 60, 40, 35, 60, 50, 70, 60, 70]; 

    const tableData = reportData.map(item => [
      item.applicationDate,
      item.inputProductName,
      item.inputProductType || '',
      item.quantityUsed?.toString() || '',
      item.quantityUnit || '',
      item.cropAppliedTo || '',
      item.cropVariety || '',
      item.plotLocation || '',
      item.cultivationActivityType,
      item.cultivationNotes || ''
    ]);

    await drawPdfTable(pdfDoc, page, margin, yPos.y, headers, tableData, columnWidths, reportTitle, { font, boldFont, pageBottomMargin: margin, pageTopMargin: margin, cellFontSize: 8, headerFontSize: 9 });

    const pdfBytes = await pdfDoc.save();
    const now = new Date();
    const dateStamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    saveAs(new Blob([pdfBytes], { type: 'application/pdf' }), `Hurvesthub_Detailed_Input_Usage_${dateStamp}.pdf`);

  } catch (error) {
    console.error("Failed to export detailed input usage to PDF:", error);
    alert(`Error exporting detailed input usage PDF: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// PDF for DetailedInputUsageReportItem would be similar, using drawPdfTable
// For brevity, PDF export function for this specific report is omitted here but would follow established patterns.
// --- Organic Compliance: Seed Source Declaration Report ---

export interface SeedSourceDeclarationReportItem {
  plantingDate: string;
  cropName?: string;
  cropVariety?: string;
  seedSupplier?: string;
  seedPurchaseDate?: string;
  organicStatus?: string;
  quantitySown?: number;
  quantityUnit?: string;
  plotLocation?: string;
}

export async function getSeedSourceDeclarationData(filters?: DateRangeFilters): Promise<SeedSourceDeclarationReportItem[]> {
  let plantingLogsQuery = db.plantingLogs
    .where('is_deleted').notEqual(1)
    .and(pl => !!pl.seed_batch_id); // Only plantings directly from seed batches

  if (filters?.startDate) {
    const start = new Date(filters.startDate).toISOString().split('T')[0];
    plantingLogsQuery = plantingLogsQuery.and(pl => pl.planting_date >= start);
  }
  if (filters?.endDate) {
    const end = new Date(filters.endDate).toISOString().split('T')[0];
    plantingLogsQuery = plantingLogsQuery.and(pl => pl.planting_date <= end);
  }

  const relevantPlantingLogs = await plantingLogsQuery.toArray();
  if (relevantPlantingLogs.length === 0) return [];

  const seedBatchIds = Array.from(new Set(relevantPlantingLogs.map(pl => pl.seed_batch_id).filter(Boolean) as string[]));
  
  const [seedBatches, crops] = await Promise.all([
    db.seedBatches.where('id').anyOf(seedBatchIds).toArray(),
    db.crops.filter(c => c.is_deleted !== 1).toArray(), // Fetch all for linking
  ]);

  const reportItems: SeedSourceDeclarationReportItem[] = [];

  for (const pLog of relevantPlantingLogs) {
    const sBatch = seedBatches.find(sb => sb.id === pLog.seed_batch_id);
    if (!sBatch) continue; // Should not happen if query is correct

    const crop = crops.find(c => c.id === sBatch.crop_id);

    reportItems.push({
      plantingDate: new Date(pLog.planting_date).toLocaleDateString(),
      cropName: crop?.name,
      cropVariety: crop?.variety,
      seedSupplier: sBatch.supplier,
      seedPurchaseDate: sBatch.purchase_date ? new Date(sBatch.purchase_date).toLocaleDateString() : undefined,
      organicStatus: sBatch.organic_status,
      quantitySown: pLog.quantity_planted,
      quantityUnit: pLog.quantity_unit,
      plotLocation: pLog.plot_affected || pLog.location_description,
    });
  }

  reportItems.sort((a,b) => new Date(b.plantingDate).getTime() - new Date(a.plantingDate).getTime());
  return reportItems;
}

export async function exportSeedSourceDeclarationToPDF(filters?: DateRangeFilters): Promise<void> {
  try {
    const reportData = await getSeedSourceDeclarationData(filters);
    if (reportData.length === 0) {
      alert("No seed source data available for the selected filters for PDF export.");
      return;
    }

    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([612, 792]); // Standard Letter size
    const { width, height } = page.getSize();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const margin = 40;
    let yPos = { y: height - margin };

    await addPdfHeader(pdfDoc, page, yPos);
    
    const reportTitle = "Seed Source Declaration Report";
    const headers = [
      "Planting Date", "Crop", "Variety", "Supplier",
      "Purchase Date", "Organic Status", "Qty Sown", "Unit", "Plot/Location"
    ];
    // Adjust column widths as needed
    const columnWidths = [60, 70, 60, 70, 60, 70, 40, 35, 70];

    const tableData = reportData.map(item => [
      item.plantingDate,
      item.cropName || '',
      item.cropVariety || '',
      item.seedSupplier || '',
      item.seedPurchaseDate || '',
      item.organicStatus || '',
      item.quantitySown?.toString() || '',
      item.quantityUnit || '',
      item.plotLocation || ''
    ]);

    await drawPdfTable(pdfDoc, page, margin, yPos.y, headers, tableData, columnWidths, reportTitle, { font, boldFont, pageBottomMargin: margin, pageTopMargin: margin, cellFontSize: 8, headerFontSize: 9 });

    const pdfBytes = await pdfDoc.save();
    const now = new Date();
    const dateStamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    saveAs(new Blob([pdfBytes], { type: 'application/pdf' }), `Hurvesthub_Seed_Source_Declaration_${dateStamp}.pdf`);

  } catch (error) {
    console.error("Failed to export seed source declaration to PDF:", error);
    alert(`Error exporting seed source declaration PDF: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function convertSeedSourceDeclarationToCSV(data: SeedSourceDeclarationReportItem[]): string {
  if (data.length === 0) return '';
  const headers = [
    "Planting Date", "Crop Name", "Crop Variety", "Seed Supplier",
    "Seed Purchase Date", "Organic Status", "Quantity Sown", "Unit", "Plot/Location"
  ];
  const csvRows = [headers.join(',')];
  data.forEach(item => {
    const row = [
      `"${item.plantingDate}"`,
      `"${(item.cropName || '').replace(/"/g, '""')}"`,
      `"${(item.cropVariety || '').replace(/"/g, '""')}"`,
      `"${(item.seedSupplier || '').replace(/"/g, '""')}"`,
      `"${item.seedPurchaseDate || ''}"`,
      `"${(item.organicStatus || '').replace(/"/g, '""')}"`,
      item.quantitySown ?? '',
      `"${(item.quantityUnit || '').replace(/"/g, '""')}"`,
      `"${(item.plotLocation || '').replace(/"/g, '""')}"`
    ];
    csvRows.push(row.join(','));
  });
  return csvRows.join('\n');
}

export async function exportSeedSourceDeclarationToCSV(filters?: DateRangeFilters): Promise<void> {
  try {
    const reportData = await getSeedSourceDeclarationData(filters);
    if (reportData.length === 0) {
      alert("No seed source data available for the selected filters.");
      return;
    }
    const csvData = convertSeedSourceDeclarationToCSV(reportData);
    const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
    const now = new Date();
    const dateStamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    saveAs(blob, `Hurvesthub_Seed_Source_Declaration_${dateStamp}.csv`);
  } catch (error) {
    console.error("Failed to export seed source declaration to CSV:", error);
    alert(`Error exporting seed source data: ${error instanceof Error ? error.message : String(error)}`);
  }
}