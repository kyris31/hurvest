import { db } from './db';
import type { Sale, SaleItem, Customer, HarvestLog, PlantingLog, Crop, SeedBatch, Invoice, InputInventory, Supplier, Flock, FeedLog, FlockRecord, PurchasedSeedling, SeedlingProductionLog, CultivationActivityPlantingLink, CultivationActivityUsedInput, Tree, GeneralExpense } from './db'; // Added Flock, FeedLog, FlockRecord, PurchasedSeedling, SeedlingProductionLog, CultivationActivityPlantingLink, CultivationActivityUsedInput, Tree, GeneralExpense
import { formatDateToDDMMYYYY } from './dateUtils'; // Import the date formatting utility
import { saveAs } from 'file-saver';
import { PDFDocument, StandardFonts, rgb, PDFFont, PDFPage, RGB } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
// Helper function to check for valid date string
function isValidDateString(dateString: string | null | undefined): boolean {
  if (!dateString || typeof dateString !== 'string' || dateString.trim().length === 0) {
    return false;
  }
  // Check if the string is in YYYY-MM-DD format, as this is typically what's stored
  // and what Dexie would expect for string-based date comparisons.
  // A simple new Date() can be too lenient with various formats.
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    // console.warn(`[isValidDateString] Date string "${dateString}" is not in YYYY-MM-DD format.`);
    return false; // Stricter check: only YYYY-MM-DD is acceptable
  }
  const date = new Date(dateString);
  // Check if the date is valid and the year is reasonable (e.g., not 1970 from an empty or bad string)
  const isValid = !isNaN(date.getTime());
  if (isValid && date.getFullYear() < 1990 && dateString !== new Date(0).toISOString().split('T')[0]) { // Avoid epoch date unless it's explicitly that
      // console.warn(`[isValidDateString] Date string "${dateString}" resulted in an unlikely year: ${date.getFullYear()}`);
      // return false; // Stricter check for unlikely years
  }
  return isValid;
}

// Extend the Window interface to include showSaveFilePicker for TypeScript
declare global {
  interface Window {
    showSaveFilePicker?: (options?: {
      suggestedName?: string;
      types?: Array<{
        description?: string;
        accept?: Record<string, string | string[]>;
      }>;
      // TypeScript might also expect an ID for the picker, common in some definitions
      // id?: string;
      // startIn?: 'desktop' | 'documents' | 'downloads' | 'music' | 'pictures' | 'videos' | FileSystemHandle;
    }) => Promise<FileSystemFileHandle>; // Assuming FileSystemFileHandle is globally known by TS
  }
  // We assume FileSystemFileHandle and FileSystemWritableFileStream are already globally defined
  // by the TypeScript DOM library (lib.dom.d.ts or similar).
  // If errors persist about these types not being found, then more specific global type
  // definitions might be missing from the project's tsconfig or a newer TS lib version is needed.
}

// --- Dashboard Metrics Calculation ---
export interface DashboardMetrics {
  totalRevenue: number;
  numberOfSales: number;
  avgSaleValue: number;
  topCustomer?: { name: string; totalValue: number }; // Optional
  totalCOGS: number;
  grossProfit: number;
  // Potentially add more metrics like total expenses from supplier invoices (not just COGS)
  // totalInputExpenses?: number;
}

export async function calculateDashboardMetrics(filters?: DateRangeFilters): Promise<DashboardMetrics> {
  console.log('[DashboardMetrics] Calculating metrics with filters:', JSON.stringify(filters));
  let salesQuery = db.sales.filter(s => s.is_deleted !== 1);
  if (filters?.startDate) {
    const start = new Date(filters.startDate).toISOString().split('T')[0];
    salesQuery = salesQuery.and(s => s.sale_date >= start);
  }
  if (filters?.endDate) {
    const end = new Date(filters.endDate).toISOString().split('T')[0];
    salesQuery = salesQuery.and(s => s.sale_date <= end);
  }
  const sales = await salesQuery.toArray();
  const saleIds = sales.map(s => s.id);

  const saleItems = await db.saleItems.where('sale_id').anyOf(saleIds).and(si => si.is_deleted !== 1).toArray();
  console.log(`[DashboardMetrics] Fetched ${sales.length} sales and ${saleItems.length} sale items.`);
  if (saleItems.length > 0) {
    console.log('[DashboardMetrics] First sale item details:', JSON.stringify(saleItems[0]));
  }
  
  // Fetch all potentially relevant data for COGS calculations
  const inputInventoryIdsFromSaleItems = saleItems.map(si => si.input_inventory_id).filter(id => !!id) as string[];
  const harvestLogIdsFromSaleItems = saleItems.map(si => si.harvest_log_id).filter(id => !!id) as string[];

  const relevantInputInventoryPromise = inputInventoryIdsFromSaleItems.length > 0
    ? db.inputInventory.where('id').anyOf(inputInventoryIdsFromSaleItems).toArray()
    : Promise.resolve([]);
  
  const relevantHarvestLogsPromise = harvestLogIdsFromSaleItems.length > 0
    ? db.harvestLogs.where('id').anyOf(harvestLogIdsFromSaleItems).toArray()
    : Promise.resolve([]);

  // Fetch all planting logs that could be related to the fetched harvest logs
  // And then fetch all harvest logs related to THOSE planting logs for accurate total harvest quantity.
  const tempRelevantHarvestLogs = await relevantHarvestLogsPromise; // Await here to get IDs
  console.log('[DashboardMetrics] tempRelevantHarvestLogs (from sale items):', JSON.stringify(tempRelevantHarvestLogs.map(hl => ({id: hl.id, pId: hl.planting_log_id}))));

  const plantingLogIdsFromRelevantHarvests = [...new Set(tempRelevantHarvestLogs.map(hl => hl.planting_log_id).filter(id => !!id) as string[])];
  console.log('[DashboardMetrics] plantingLogIdsFromRelevantHarvests:', JSON.stringify(plantingLogIdsFromRelevantHarvests));

  const relevantPlantingLogsPromise = plantingLogIdsFromRelevantHarvests.length > 0
    ? db.plantingLogs.where('id').anyOf(plantingLogIdsFromRelevantHarvests).and(p => p.is_deleted !== 1).toArray() // Added is_deleted filter
    : Promise.resolve([]);

  // Fetch all harvest logs associated with the relevant planting logs
  const allHarvestsForRelevantPlantingsPromise = plantingLogIdsFromRelevantHarvests.length > 0
    ? db.harvestLogs.where('planting_log_id').anyOf(plantingLogIdsFromRelevantHarvests).and(h => h.is_deleted !== 1).toArray()
    : Promise.resolve([]);
  
  const allCultivationLogsPromise = db.cultivationLogs.filter(cl => cl.is_deleted !== 1).toArray();
  const allInputInventoryPromise = db.inputInventory.filter(ii => ii.is_deleted !== 1).toArray(); // For all cost lookups
  const customersPromise = db.customers.filter(c => c.is_deleted !== 1).toArray();
  const allSeedBatchesPromise = db.seedBatches.filter(sb => sb.is_deleted !== 1).toArray();
  const allSeedlingProductionLogsPromise = db.seedlingProductionLogs.filter(sl => sl.is_deleted !== 1).toArray();
  const allCultivationActivityPlantingLinksPromise = db.cultivationActivityPlantingLinks.filter(capl => capl.is_deleted !== 1).toArray();
  const allCultivationActivityUsedInputsPromise = db.cultivationActivityUsedInputs.filter(caui => caui.is_deleted !== 1).toArray();

  const [
    relevantInputInventory, // Directly linked to sale items
    relevantHarvestLogs,    // Directly linked to sale items
    relevantPlantingLogs,
    allHarvestsForRelevantPlantings, // These are for calculating total yield per planting
    allCultivationLogs,
    allInputInventory, // Comprehensive list for all cost lookups
    customers,
    allSeedBatches,
    allSeedlingProductionLogs,
    allCultivationActivityPlantingLinks,
    allCultivationActivityUsedInputs
  ] = await Promise.all([
    relevantInputInventoryPromise,
    Promise.resolve(tempRelevantHarvestLogs), // Use the already awaited version
    relevantPlantingLogsPromise,
    allHarvestsForRelevantPlantingsPromise,
    allCultivationLogsPromise,
    allInputInventoryPromise,
    customersPromise,
    allSeedBatchesPromise,
    allSeedlingProductionLogsPromise,
    allCultivationActivityPlantingLinksPromise,
    allCultivationActivityUsedInputsPromise
  ]);
    
  // ---- START DEBUG BLOCK ----
  if (plantingLogIdsFromRelevantHarvests.length > 0) {
    const idToTest = plantingLogIdsFromRelevantHarvests[0]; // Assuming "cef3b0f9-989e-48d0-b36a-002a87355abf"
    console.log(`[DashboardMetrics DEBUG] Testing PlantingLog ID: "${idToTest}" (Type: ${typeof idToTest}, Length: ${idToTest.length})`);
    
    // Log the exact ID from the HarvestLog that generated this idToTest
    const sourceHarvestLog = tempRelevantHarvestLogs.find(hl => hl.planting_log_id === idToTest);
    if (sourceHarvestLog) {
      console.log(`[DashboardMetrics DEBUG] ID "${idToTest}" came from HarvestLog.planting_log_id: "${sourceHarvestLog.planting_log_id}" (HL ID: ${sourceHarvestLog.id})`);
    }

    const directCheckPlantingLog = await db.plantingLogs.get(idToTest);
    console.log(`[DashboardMetrics DEBUG] Result of db.plantingLogs.get("${idToTest}"):`, JSON.stringify(directCheckPlantingLog));
    
    const allNonDeletedPlantingLogs = await db.plantingLogs.filter(p => p.is_deleted !== 1).toArray();
    console.log(`[DashboardMetrics DEBUG] Total non-deleted PlantingLogs in DB: ${allNonDeletedPlantingLogs.length}`);
    const foundInAll = allNonDeletedPlantingLogs.find(p => p.id === idToTest);
    console.log(`[DashboardMetrics DEBUG] PlantingLog "${idToTest}" found in allNonDeletedPlantingLogs:`, JSON.stringify(foundInAll));

    const checkQueryEquals = db.plantingLogs.where('id').equals(idToTest).and(p => p.is_deleted !== 1);
    const countEquals = await checkQueryEquals.count();
    console.log(`[DashboardMetrics DEBUG] Count for .equals("${idToTest}"): ${countEquals}`);
    
    const checkQueryEqualsIgnoreCase = db.plantingLogs.where('id').equalsIgnoreCase(idToTest).and(p => p.is_deleted !== 1);
    const countEqualsIgnoreCase = await checkQueryEqualsIgnoreCase.count();
    console.log(`[DashboardMetrics DEBUG] Count for .equalsIgnoreCase("${idToTest}"): ${countEqualsIgnoreCase}`);

    const itemsFromQueryEqualsIgnoreCase = await checkQueryEqualsIgnoreCase.toArray();
    console.log(`[DashboardMetrics DEBUG] Items from .equalsIgnoreCase("${idToTest}"):`, JSON.stringify(itemsFromQueryEqualsIgnoreCase));
  }
  // ---- END DEBUG BLOCK ----

  console.log('[DashboardMetrics] Resolved relevantPlantingLogs count:', relevantPlantingLogs.length);
  console.log('[DashboardMetrics] Resolved allHarvestsForRelevantPlantings count:', allHarvestsForRelevantPlantings.length);
  console.log('[DashboardMetrics] Resolved allCultivationLogs count:', allCultivationLogs.length);
  console.log('[DashboardMetrics] Resolved allInputInventory count (for costs):', allInputInventory.length);
  console.log('[DashboardMetrics] Resolved allSeedBatches count:', allSeedBatches.length);
  console.log('[DashboardMetrics] Resolved allSeedlingProductionLogs count:', allSeedlingProductionLogs.length);

  const inventoryMap = new Map(allInputInventory.map(ii => [ii.id, ii]));
  const customerMap = new Map(customers.map(c => [c.id, c.name]));
  const plantingLogMap = new Map(relevantPlantingLogs.map(pl => [pl.id, pl]));
  console.log('[DashboardMetrics] relevantPlantingLogs count for map:', relevantPlantingLogs.length, 'plantingLogMap size:', plantingLogMap.size);
  
  const seedBatchMap = new Map(allSeedBatches.map(sb => [sb.id, sb]));
  const seedlingLogMap = new Map(allSeedlingProductionLogs.map(sl => [sl.id, sl]));

  // Create a map for total harvested quantity per planting log for efficiency
  const totalHarvestedPerPlantingLog = new Map<string, number>();
  allHarvestsForRelevantPlantings.forEach(hl => {
    totalHarvestedPerPlantingLog.set(
      hl.planting_log_id,
      (totalHarvestedPerPlantingLog.get(hl.planting_log_id) || 0) + hl.quantity_harvested
    );
  });
  console.log('[DashboardMetrics] totalHarvestedPerPlantingLog map:', JSON.stringify(Array.from(totalHarvestedPerPlantingLog.entries())));


  let totalRevenue = 0;
  let totalCOGS = 0;
  const customerSales: Record<string, number> = {};

  for (const sale of sales) {
    if (sale.customer_id && customerMap.has(sale.customer_id)) {
        const custName = customerMap.get(sale.customer_id)!;
        customerSales[custName] = (customerSales[custName] || 0) + (sale.total_amount || 0);
    }
  }
  
  for (const item of saleItems) {
    const quantity = Number(item.quantity_sold);
    const price = Number(item.price_per_unit);
    let itemRevenue = 0;
    if (!isNaN(quantity) && !isNaN(price)) {
      itemRevenue = quantity * price;
      if (item.discount_type && (item.discount_value !== null && item.discount_value !== undefined)) {
        const discountValue = Number(item.discount_value);
        if (item.discount_type === 'Amount') {
          itemRevenue -= discountValue;
        } else if (item.discount_type === 'Percentage') {
          itemRevenue -= itemRevenue * (discountValue / 100);
        }
      }
    }
    totalRevenue += Math.max(0, itemRevenue);

    // Calculate COGS for this item
    if (item.input_inventory_id) {
      const inventoryBatch = inventoryMap.get(item.input_inventory_id);
      if (inventoryBatch && inventoryBatch.initial_quantity && inventoryBatch.initial_quantity > 0 && inventoryBatch.total_purchase_cost !== undefined) {
        const costPerUnit = inventoryBatch.total_purchase_cost / inventoryBatch.initial_quantity;
        totalCOGS += costPerUnit * quantity;
      } else if (inventoryBatch && inventoryBatch.total_purchase_cost !== undefined) {
        // Fallback if initial_quantity is not set or 0, assume total_purchase_cost is for the quantity sold (less accurate)
        // This might happen if an item is sold as a whole batch and initial_quantity wasn't a focus.
        // For accurate COGS, initial_quantity and total_purchase_cost for that initial_quantity are essential.
        // If selling a portion of a batch where initial_quantity was 1, this logic is fine.
        if (inventoryBatch.initial_quantity === 1 || !inventoryBatch.initial_quantity) {
             totalCOGS += inventoryBatch.total_purchase_cost * quantity; // Assuming cost is per unit if initial_quantity is 1 or not set
        } else {
            console.warn(`COGS calculation issue for SaleItem ${item.id}: InputInventory ${inventoryBatch.id} has initial_quantity ${inventoryBatch.initial_quantity} but sold ${quantity}. Total cost ${inventoryBatch.total_purchase_cost}`);
        }
      }
    } else if (item.harvest_log_id) {
      const harvestLog = relevantHarvestLogs.find(hl => hl.id === item.harvest_log_id);
      if (harvestLog) {
        const plantingLog = plantingLogMap.get(harvestLog.planting_log_id);
        if (plantingLog) {
          // Calculate total cost for this plantingLog
          let totalCostForPlanting = 0;
          let seedCostForPlanting = 0;

          // 1. Cost of seeds/seedlings
          if (plantingLog.input_inventory_id) { // Direct link from PlantingLog to purchased seeds/seedlings
            const seedInvItem = inventoryMap.get(plantingLog.input_inventory_id);
            if (seedInvItem && seedInvItem.total_purchase_cost !== undefined) {
              seedCostForPlanting = seedInvItem.total_purchase_cost; // Assumes this inventory item was entirely for this planting
              console.log(`[COGS Harvest] Seed cost from PlantingLog.input_inventory_id ${plantingLog.input_inventory_id}: ${seedCostForPlanting}`);
            }
          } else if (plantingLog.seedling_production_log_id) { // Trace via SeedlingProductionLog
            console.log(`[COGS Harvest] Tracing seed cost via SeedlingProductionLog ID: ${plantingLog.seedling_production_log_id}`);
            const seedlingLog = seedlingLogMap.get(plantingLog.seedling_production_log_id);
            if (seedlingLog) {
              console.log(`[COGS Harvest] Found SeedlingLog, its seed_batch_id: ${seedlingLog.seed_batch_id}`);
              if (seedlingLog.seed_batch_id) {
                const seedBatch = seedBatchMap.get(seedlingLog.seed_batch_id);
                if (seedBatch) {
                  console.log(`[COGS Harvest] Found SeedBatch ${seedBatch.id}, cost: ${seedBatch.total_purchase_cost}, initial_qty: ${seedBatch.initial_quantity}`);
                  if (seedBatch.total_purchase_cost !== undefined && seedBatch.initial_quantity !== undefined && seedBatch.initial_quantity > 0) {
                    // Simplification: If a SeedlingProductionLog used a purchased SeedBatch, attribute a portion of that cost.
                    // This needs a robust way to know how many seeds from the batch were used for *this* seedling production.
                    // For now, if `estimated_total_individual_seeds_sown` is on seedlingLog:
                    if (seedlingLog.estimated_total_individual_seeds_sown && seedlingLog.estimated_total_individual_seeds_sown > 0) {
                        const costPerOriginalSeed = seedBatch.total_purchase_cost / seedBatch.initial_quantity;
                        const totalSeedCostForSeedlingLog = costPerOriginalSeed * seedlingLog.estimated_total_individual_seeds_sown;
                        // Apportion this cost to the current plantingLog based on seedlings planted vs produced
                        if (seedlingLog.actual_seedlings_produced && seedlingLog.actual_seedlings_produced > 0 && plantingLog.quantity_planted > 0) {
                            seedCostForPlanting = (plantingLog.quantity_planted / seedlingLog.actual_seedlings_produced) * totalSeedCostForSeedlingLog;
                        } else { // Fallback: use total seed cost for seedling log if apportionment details missing
                            seedCostForPlanting = totalSeedCostForSeedlingLog;
                        }
                        console.log(`[COGS Harvest] Seed cost (apportioned via SeedlingLog) from SeedBatch ${seedBatch.id}: ${seedCostForPlanting}`);
                    } else { // Fallback: use total cost of seed batch if specific seed count not available for seedling log
                        seedCostForPlanting = seedBatch.total_purchase_cost; // This is a rough estimate
                        console.log(`[COGS Harvest] Seed cost (fallback via SeedlingLog using full SeedBatch ${seedBatch.id} cost): ${seedCostForPlanting}`);
                    }
                  } else {
                    console.log(`[COGS Harvest] SeedBatch ${seedBatch.id} has no cost or initial_quantity.`);
                  }
                } else {
                  console.warn(`[COGS Harvest] SeedBatch ${seedlingLog.seed_batch_id} (from SeedlingLog) not found in seedBatchMap.`);
                }
              } else {
                 console.log(`[COGS Harvest] SeedlingLog ${seedlingLog.id} has no seed_batch_id.`);
              }
            } else {
              console.warn(`[COGS Harvest] SeedlingProductionLog ${plantingLog.seedling_production_log_id} not found in seedlingLogMap.`);
            }
          } else if (plantingLog.seed_batch_id) { // Direct link from PlantingLog to SeedBatch
             console.log(`[COGS Harvest] Tracing seed cost via PlantingLog.seed_batch_id: ${plantingLog.seed_batch_id}`);
             const seedBatch = seedBatchMap.get(plantingLog.seed_batch_id);
             if (seedBatch) {
                console.log(`[COGS Harvest] Found SeedBatch ${seedBatch.id}, cost: ${seedBatch.total_purchase_cost}`);
                if (seedBatch.total_purchase_cost !== undefined) {
                  // This assumes the entire seed batch was used for this planting, which might not be true.
                  // Apportionment would be needed for accuracy if a seed batch serves multiple plantings.
                  seedCostForPlanting = seedBatch.total_purchase_cost;
                  console.log(`[COGS Harvest] Seed cost directly from SeedBatch ${seedBatch.id}: ${seedCostForPlanting}`);
                } else {
                  console.log(`[COGS Harvest] SeedBatch ${seedBatch.id} has no total_purchase_cost.`);
                }
             } else {
                console.warn(`[COGS Harvest] SeedBatch ${plantingLog.seed_batch_id} (from PlantingLog) not found in seedBatchMap.`);
             }
          }
          totalCostForPlanting += seedCostForPlanting;

          // 2. Cost of cultivation inputs for this planting log
          // Find all cultivation log IDs linked to this plantingLog.id
          const relevantCultivationLogIds = allCultivationActivityPlantingLinks
            .filter(link => link.planting_log_id === plantingLog.id)
            .map(link => link.cultivation_log_id);

          // Find all used inputs for these cultivation logs
          for (const cultLogId of relevantCultivationLogIds) {
            const usedInputsForThisCultLog = allCultivationActivityUsedInputs
              .filter(usedInput => usedInput.cultivation_log_id === cultLogId);

            for (const usedInputEntry of usedInputsForThisCultLog) {
              // Ensure input_inventory_id and quantity_used are present on usedInputEntry
              if (usedInputEntry.input_inventory_id && usedInputEntry.quantity_used) {
                const inputItemDetails = inventoryMap.get(usedInputEntry.input_inventory_id);
                if (inputItemDetails && inputItemDetails.initial_quantity && inputItemDetails.initial_quantity > 0 && inputItemDetails.total_purchase_cost !== undefined) {
                  const costPerUnitInput = inputItemDetails.total_purchase_cost / inputItemDetails.initial_quantity;
                  totalCostForPlanting += costPerUnitInput * usedInputEntry.quantity_used;
                } else if (inputItemDetails && inputItemDetails.cost_per_unit !== undefined) {
                  // Fallback to using pre-calculated cost_per_unit if available
                  totalCostForPlanting += inputItemDetails.cost_per_unit * usedInputEntry.quantity_used;
                } else {
                  console.warn(`[COGS Cultivation] Could not determine cost for input ${usedInputEntry.input_inventory_id} used in cultivation log ${cultLogId}. Initial quantity/total cost or cost_per_unit missing.`);
                }
              }
            }
          }

          // Get total quantity harvested from this specific planting log
          // This requires fetching ALL harvest logs for this planting_log_id, not just the one linked to the sale item.
          const allHarvestsForThisPlanting = await db.harvestLogs.where('planting_log_id').equals(plantingLog.id).and(h => h.is_deleted !== 1).toArray();
          const totalQuantityHarvestedForPlanting = allHarvestsForThisPlanting.reduce((sum, h) => sum + h.quantity_harvested, 0);

          if (totalQuantityHarvestedForPlanting > 0) {
            const costPerUnitHarvested = totalCostForPlanting / totalQuantityHarvestedForPlanting;
            totalCOGS += costPerUnitHarvested * quantity; // quantity is item.quantity_sold
          } else {
            console.warn(`COGS for harvested item ${item.id} from planting ${plantingLog.id}: Total harvested quantity is 0. Cannot calculate COGS.`);
          }
        }
      }
    }
  }

  const numberOfSales = sales.length;
  const avgSaleValue = numberOfSales > 0 ? totalRevenue / numberOfSales : 0;
  
  let topCustomerData: { name: string; totalValue: number } | undefined = undefined;
    if (Object.keys(customerSales).length > 0) {
        const sortedCustomers = Object.entries(customerSales).sort(([,a],[,b]) => b-a);
        topCustomerData = { name: sortedCustomers[0][0], totalValue: sortedCustomers[0][1] };
    }

  return {
    totalRevenue,
    numberOfSales,
    avgSaleValue,
    topCustomer: topCustomerData,
    totalCOGS,
    grossProfit: totalRevenue - totalCOGS,
  };
}
// --- End of Dashboard Metrics Calculation ---


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

export interface DateRangeFilters {
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

    const salesData = await salesQuery.toArray();
    // Sort sales by date ascending
    const sales = salesData.sort((a, b) => new Date(a.sale_date).getTime() - new Date(b.sale_date).getTime());
    const saleIds = sales.map(s => s.id);

    // Fetch related data only for the filtered sales
    const [
        saleItems, customers, harvestLogs, plantingLogs, seedBatches, crops, invoices,
        inputInventory, purchasedSeedlings, trees, seedlingProductionLogs // Added new tables
    ] = await Promise.all([
        db.saleItems.where('sale_id').anyOf(saleIds).and(si => si.is_deleted !== 1).toArray(),
        db.customers.filter(c => c.is_deleted !== 1).toArray(),
        db.harvestLogs.filter(h => h.is_deleted !== 1).toArray(),
        db.plantingLogs.filter(p => p.is_deleted !== 1).toArray(),
        db.seedBatches.filter(sb => sb.is_deleted !== 1).toArray(),
        db.crops.filter(c => c.is_deleted !== 1).toArray(),
        db.invoices.where('sale_id').anyOf(saleIds).and(i => i.is_deleted !== 1).toArray(),
        db.inputInventory.filter(ii => ii.is_deleted !== 1).toArray(), // Added
        db.purchasedSeedlings.filter(ps => ps.is_deleted !== 1).toArray(), // Added
        db.trees.filter(t => t.is_deleted !== 1).toArray(), // Added
        db.seedlingProductionLogs.filter(sl => sl.is_deleted !== 1).toArray() // Added
    ]);

    const reportItems: SaleReportItem[] = [];

    // Create maps for efficient lookup
    const customerMap = new Map(customers.map(c => [c.id, c]));
    const harvestLogMap = new Map(harvestLogs.map(h => [h.id, h]));
    const plantingLogMap = new Map(plantingLogs.map(pl => [pl.id, pl]));
    const seedBatchMap = new Map(seedBatches.map(sb => [sb.id, sb]));
    const cropMap = new Map(crops.map(c => [c.id, c]));
    const invoiceMap = new Map(invoices.map(i => [i.sale_id, i])); // Keyed by sale_id for easier lookup per sale
    const inputInventoryMap = new Map(inputInventory.map(ii => [ii.id, ii]));
    const purchasedSeedlingMap = new Map(purchasedSeedlings.map(ps => [ps.id, ps]));
    const treeMap = new Map(trees.map(t => [t.id, t]));
    const seedlingProductionLogMap = new Map(seedlingProductionLogs.map(sl => [sl.id, sl]));


    for (const sale of sales) {
        const customer = customers.find(c => c.id === sale.customer_id);
        const invoice = invoices.find(i => i.sale_id === sale.id);
        const itemsForThisSale = saleItems.filter(si => si.sale_id === sale.id);

        if (itemsForThisSale.length === 0) { // Include sales even if they have no items (though unlikely)
            reportItems.push({
                saleId: sale.id,
                saleDate: formatDateToDDMMYYYY(sale.sale_date),
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
                let productName = 'Unknown Product'; // Default
                let productDetails = '';

                if (item.harvest_log_id) {
                    const harvestLog = harvestLogMap.get(item.harvest_log_id);
                    if (harvestLog) {
                        productDetails = `(Harvested: ${formatDateToDDMMYYYY(harvestLog.harvest_date)})`;
                        let crop: Crop | undefined;
                        let potentialProductNameFromInv: string | undefined;
                        let potentialProductNameFromPS: string | undefined;

                        if (harvestLog.tree_id) {
                            const tree = treeMap.get(harvestLog.tree_id);
                            if (tree) {
                                let treeNameParts = [];
                                if (tree.identifier && tree.identifier.trim() !== '') treeNameParts.push(tree.identifier);
                                if (tree.species && tree.species.trim() !== '') treeNameParts.push(tree.species);
                                if (tree.variety && tree.variety.trim() !== '') treeNameParts.push(`(${tree.variety})`);
                                productName = treeNameParts.length > 0 ? treeNameParts.join(' ') : 'Unnamed Tree Product';
                            }
                        } else if (harvestLog.planting_log_id) {
                            const plantingLog = plantingLogMap.get(harvestLog.planting_log_id);
                            if (plantingLog) {
                                if (plantingLog.input_inventory_id) {
                                    const invItem = inputInventoryMap.get(plantingLog.input_inventory_id);
                                    if (invItem) {
                                        if (invItem.crop_id) crop = cropMap.get(invItem.crop_id);
                                        if (invItem.name && invItem.name.trim() !== '') potentialProductNameFromInv = invItem.name;
                                    }
                                }
                                if (!crop && plantingLog.purchased_seedling_id) {
                                    const psItem = purchasedSeedlingMap.get(plantingLog.purchased_seedling_id);
                                    if (psItem) {
                                        if (psItem.crop_id) crop = cropMap.get(psItem.crop_id);
                                        if (psItem.name && psItem.name.trim() !== '') potentialProductNameFromPS = psItem.name;
                                    }
                                }
                                if (!crop && plantingLog.seedling_production_log_id) {
                                    const seedlingLog = seedlingProductionLogMap.get(plantingLog.seedling_production_log_id);
                                    if (seedlingLog) {
                                        if (seedlingLog.crop_id) crop = cropMap.get(seedlingLog.crop_id);
                                        if (!crop && seedlingLog.seed_batch_id) {
                                            const seedBatch = seedBatchMap.get(seedlingLog.seed_batch_id);
                                            if (seedBatch && seedBatch.crop_id) crop = cropMap.get(seedBatch.crop_id);
                                        }
                                    }
                                }
                                if (!crop && plantingLog.seed_batch_id) {
                                    const seedBatch = seedBatchMap.get(plantingLog.seed_batch_id);
                                    if (seedBatch && seedBatch.crop_id) crop = cropMap.get(seedBatch.crop_id);
                                }

                                if (crop) {
                                    productName = (crop.name && crop.name.trim() !== '') ? crop.name : 'Unnamed Crop';
                                } else if (potentialProductNameFromPS) {
                                    productName = potentialProductNameFromPS;
                                } else if (potentialProductNameFromInv) {
                                    productName = potentialProductNameFromInv;
                                }
                            }
                        }
                        if (productName === 'Unknown Product' && harvestLog) { // If still unknown after all checks for a harvest log
                            productName = 'General Harvested Item';
                        }
                    } else {
                         productName = 'Product (Harvest Log Missing)';
                    }
                } else if (item.input_inventory_id) {
                    const inventoryItem = inputInventoryMap.get(item.input_inventory_id);
                    if (inventoryItem) {
                        productName = (inventoryItem.name && inventoryItem.name.trim() !== '') ? inventoryItem.name : 'Unnamed Inventory Item';
                        productDetails = `(Stock ID: ${inventoryItem.id.substring(0,8)}...)`;
                    } else {
                        productName = 'Product (Inventory Link Missing)';
                    }
                } else {
                    productName = 'Product (Source Link Missing)'; // General fallback if neither harvest nor inventory ID
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
        const suggestedName = `reports/Hurvesthub_Sales_Report_${dateStamp}.csv`;
        
        if (typeof window.showSaveFilePicker === 'function') {
            try {
                const handle = await window.showSaveFilePicker({
                    suggestedName: suggestedName,
                    types: [{ description: 'CSV Files', accept: { 'text/csv': ['.csv'] } }],
                });
                const writable = await handle.createWritable();
                await writable.write(blob);
                await writable.close();
                console.log(`[exportSalesToCSV] File saved successfully via showSaveFilePicker: ${suggestedName}`);
            } catch (err: any) {
                if (err.name !== 'AbortError') {
                    console.error(`[exportSalesToCSV] Error saving file with File System Access API (${suggestedName}):`, err);
                    alert(`Error saving file: ${err.message}. File will be downloaded conventionally.`);
                    saveAs(blob, suggestedName);
                } else {
                    console.log(`[exportSalesToCSV] File save cancelled by user: ${suggestedName}`);
                }
            }
        } else {
            console.warn(`[exportSalesToCSV] File System Access API not supported. Using default download for: ${suggestedName}`);
            saveAs(blob, suggestedName);
        }
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
        const suggestedName = `reports/Hurvesthub_Inventory_Summary_Report_${dateStamp}.csv`;
        
        if (typeof window.showSaveFilePicker === 'function') {
            try {
                const handle = await window.showSaveFilePicker({
                    suggestedName: suggestedName,
                    types: [{ description: 'CSV Files', accept: { 'text/csv': ['.csv'] } }],
                });
                const writable = await handle.createWritable();
                await writable.write(blob);
                await writable.close();
                console.log(`[exportInventoryToCSV] File saved successfully via showSaveFilePicker: ${suggestedName}`);
            } catch (err: any) {
                if (err.name !== 'AbortError') {
                    console.error(`[exportInventoryToCSV] Error saving file with File System Access API (${suggestedName}):`, err);
                    alert(`Error saving file: ${err.message}. File will be downloaded conventionally.`);
                    saveAs(blob, suggestedName);
                } else {
                    console.log(`[exportInventoryToCSV] File save cancelled by user: ${suggestedName}`);
                }
            }
        } else {
            console.warn(`[exportInventoryToCSV] File System Access API not supported. Using default download for: ${suggestedName}`);
            saveAs(blob, suggestedName);
        }
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

async function getAllHarvestLogsForReport(filters: DateRangeFilters): Promise<HarvestReportItem[]> {
  console.log('Fetching harvest log data for report with filters (Full JS filtering strategy):', JSON.stringify(filters));
  
  // Step 1: Fetch ALL logs from Dexie, then filter in JS
  const allLogsFromDB = await db.harvestLogs.toArray();
  console.log(`[getAllHarvestLogsForReport] Fetched ${allLogsFromDB.length} total harvest logs from DB.`);

  // Step 2: Filter for non-deleted and valid date strings in JavaScript
  let filteredHarvestLogs = allLogsFromDB.filter(h =>
    h.is_deleted !== 1 &&
    isValidDateString(h.harvest_date) // isValidDateString strictly checks YYYY-MM-DD
  );
  console.log(`[getAllHarvestLogsForReport] ${filteredHarvestLogs.length} logs remaining after is_deleted and isValidDateString JS filters.`);

  // Step 3: Apply date range filters in JavaScript
  if (filters.startDate) {
    try {
      const startFilterDate = new Date(filters.startDate).toISOString().split('T')[0];
      if (/^\d{4}-\d{2}-\d{2}$/.test(startFilterDate)) {
        filteredHarvestLogs = filteredHarvestLogs.filter(h => h.harvest_date >= startFilterDate);
      } else {
        console.warn(`[getAllHarvestLogsForReport] Invalid start date string for JS filter: ${startFilterDate} from input ${filters.startDate}`);
      }
    } catch (e) {
      console.warn(`[getAllHarvestLogsForReport] Error processing start date for JS filter ${filters.startDate}:`, e);
    }
  }
  if (filters.endDate) {
    try {
      const endFilterDate = new Date(filters.endDate).toISOString().split('T')[0];
      if (/^\d{4}-\d{2}-\d{2}$/.test(endFilterDate)) {
        filteredHarvestLogs = filteredHarvestLogs.filter(h => h.harvest_date <= endFilterDate);
      } else {
        console.warn(`[getAllHarvestLogsForReport] Invalid end date string for JS filter: ${endFilterDate} from input ${filters.endDate}`);
      }
    } catch (e) {
      console.warn(`[getAllHarvestLogsForReport] Error processing end date for JS filter ${filters.endDate}:`, e);
    }
  }
  console.log(`[getAllHarvestLogsForReport] ${filteredHarvestLogs.length} logs remaining after all JS filters.`);
  
  // Assign to harvestLogs to match subsequent code
  const harvestLogs = filteredHarvestLogs;
  const plantingLogIds = harvestLogs.map(h => h.planting_log_id).filter(id => id != null) as string[]; // Filter out null/undefined and cast
  const treeIds = harvestLogs.map(h => h.tree_id).filter(id => id != null) as string[]; // Collect tree IDs
  console.log('[getAllHarvestLogsForReport] Collected treeIds:', JSON.stringify(treeIds));
    
  const [
    plantingLogs,
    seedBatches,
    cropsData,
    treesData,
    seedlingProductionLogs,
    inputInventory,
    purchasedSeedlings
  ] = await Promise.all([
      plantingLogIds.length > 0 ? db.plantingLogs.where('id').anyOf(plantingLogIds).and(p => p.is_deleted !== 1).toArray() : Promise.resolve([]),
      db.seedBatches.filter(sb => sb.is_deleted !== 1).toArray(),
      db.crops.filter(c => c.is_deleted !== 1).toArray(),
      treeIds.length > 0 ? db.trees.where('id').anyOf(treeIds).and(t => t.is_deleted !== 1).toArray() : Promise.resolve([]),
      db.seedlingProductionLogs.filter(sl => sl.is_deleted !== 1).toArray(),
      db.inputInventory.filter(ii => ii.is_deleted !== 1).toArray(),
      db.purchasedSeedlings.filter(ps => ps.is_deleted !== 1).toArray()
    ]);
  console.log('[getAllHarvestLogsForReport] Fetched treesData:', JSON.stringify(treesData));
  console.log('[getAllHarvestLogsForReport] Fetched seedlingProductionLogs:', seedlingProductionLogs.length);
  console.log('[getAllHarvestLogsForReport] Fetched inputInventory:', inputInventory.length);
  console.log('[getAllHarvestLogsForReport] Fetched purchasedSeedlings:', purchasedSeedlings.length);

    const cropsMap = new Map(cropsData.map(crop => [crop.id, crop]));
    const seedBatchesMap = new Map(seedBatches.map(batch => [batch.id, batch]));
    const plantingLogsMap = new Map(plantingLogs.map(pl => [pl.id, pl]));
    const treesMap = new Map(treesData.map(t => [t.id, t]));
    const seedlingLogsMap = new Map(seedlingProductionLogs.map(sl => [sl.id, sl]));
    const inputInventoryMap = new Map(inputInventory.map(ii => [ii.id, ii]));
    const purchasedSeedlingsMap = new Map(purchasedSeedlings.map(ps => [ps.id, ps]));
    
    const reportItems: HarvestReportItem[] = [];

    for (const hLog of harvestLogs) {
        let pLog: PlantingLog | undefined;
        let crop: Crop | undefined; // Will be determined by the new logic
        let tree: Tree | undefined;
        let location: string | undefined = 'N/A';
        let plantingDate: string | undefined;
        let cropName: string | undefined; // Initialize as undefined
        let cropVariety: string | undefined;
        let cropType: string | undefined;
        let cropNotes: string | undefined;

        if (hLog.tree_id) {
            tree = treesMap.get(hLog.tree_id);
            if (tree) {
                cropName = tree.identifier || tree.species || 'Unknown Tree';
                cropVariety = tree.variety || '';
                location = tree.location_description || 'N/A';
                plantingDate = tree.planting_date ? formatDateToDDMMYYYY(tree.planting_date) : undefined;
                // cropType and cropNotes might not be directly applicable for trees here
            }
            // No 'else' here for tree not found, as cropName would remain undefined or its previous value.
        } else if (hLog.planting_log_id) {
            pLog = plantingLogsMap.get(hLog.planting_log_id);
            if (pLog) {
                location = pLog.location_description || 'N/A';
                plantingDate = formatDateToDDMMYYYY(pLog.planting_date);

                if (pLog.purchased_seedling_id) {
                    const purchasedSeedling = purchasedSeedlingsMap.get(pLog.purchased_seedling_id);
                    if (purchasedSeedling) {
                        cropName = purchasedSeedling.name || `Purchased Seedling (ID: ${pLog.purchased_seedling_id.substring(0,4)})`;
                        if (purchasedSeedling.crop_id) {
                            crop = cropsMap.get(purchasedSeedling.crop_id);
                            if (crop) {
                                cropVariety = crop.variety || '';
                                cropType = crop.type;
                                cropNotes = crop.notes;
                            }
                        }
                    } else {
                        cropName = `Purchased Seedling (ID: ${pLog.purchased_seedling_id.substring(0,4)})`;
                    }
                } else if (pLog.seedling_production_log_id) {
                    const sl = seedlingLogsMap.get(pLog.seedling_production_log_id);
                    if (sl) {
                        crop = sl.crop_id ? cropsMap.get(sl.crop_id) : undefined;
                        if (crop) {
                            cropName = crop.name;
                            cropVariety = crop.variety || '';
                            cropType = crop.type;
                            cropNotes = crop.notes;
                        } else {
                            cropName = `Self-Prod. (Log: ${sl.id.substring(0,4)})`;
                        }
                    }
                } else if (pLog.seed_batch_id) {
                    const sb = seedBatchesMap.get(pLog.seed_batch_id);
                    if (sb) {
                        crop = sb.crop_id ? cropsMap.get(sb.crop_id) : undefined;
                        if (crop) {
                            cropName = crop.name;
                            cropVariety = crop.variety || '';
                            cropType = crop.type;
                            cropNotes = crop.notes;
                        } else {
                             cropName = `Seed Batch (Code: ${sb.batch_code})`;
                        }
                    }
                } else if (pLog.input_inventory_id) {
                    const invItem = inputInventoryMap.get(pLog.input_inventory_id);
                    if (invItem) {
                        crop = invItem.crop_id ? cropsMap.get(invItem.crop_id) : undefined;
                        if (crop) {
                            cropName = crop.name;
                            cropVariety = crop.variety || '';
                            cropType = crop.type;
                            cropNotes = crop.notes;
                        } else {
                            cropName = invItem.name; // Use item name if no specific crop link
                        }
                    }
                }
            }
        }
        // Removed the 'else' block that set cropName to DIAGNOSTIC_NO_IDS_FOR_HL_...
        // Removed specific diagnostic for empty string or undefined,
        // as the PDF generation handles undefined cropName with 'N/A'.
        // The core issue is data-related if cropName isn't determined.

        reportItems.push({
            harvestId: hLog.id,
            harvestDate: formatDateToDDMMYYYY(hLog.harvest_date),
            plantingLogId: hLog.planting_log_id,
            plantingDate: plantingDate, // Already formatted or undefined
            cropName: cropName,
            cropVariety: cropVariety,
            cropType: cropType,
            cropNotes: cropNotes,
            location: location,
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
        const harvestReportData = await getAllHarvestLogsForReport(filters || {});
        if (harvestReportData.length === 0) {
            alert("No harvest log data available for the selected filters.");
            return;
        }
        console.log(`Fetched ${harvestReportData.length} harvest logs for CSV report.`);
        
        const csvData = convertHarvestLogsToCSV(harvestReportData);
        const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
        
        const now = new Date();
        const dateStamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        const suggestedName = `reports/Hurvesthub_HarvestLogs_Report_${dateStamp}.csv`;
        
        if (typeof window.showSaveFilePicker === 'function') {
            try {
                const handle = await window.showSaveFilePicker({
                    suggestedName: suggestedName,
                    types: [{ description: 'CSV Files', accept: { 'text/csv': ['.csv'] } }],
                });
                const writable = await handle.createWritable();
                await writable.write(blob);
                await writable.close();
                console.log(`[exportHarvestLogsToCSV] File saved successfully via showSaveFilePicker: ${suggestedName}`);
            } catch (err: any) {
                if (err.name !== 'AbortError') {
                    console.error(`[exportHarvestLogsToCSV] Error saving file with File System Access API (${suggestedName}):`, err);
                    alert(`Error saving file: ${err.message}. File will be downloaded conventionally.`);
                    saveAs(blob, suggestedName);
                } else {
                    console.log(`[exportHarvestLogsToCSV] File save cancelled by user: ${suggestedName}`);
                }
            }
        } else {
            console.warn(`[exportHarvestLogsToCSV] File System Access API not supported. Using default download for: ${suggestedName}`);
            saveAs(blob, suggestedName);
        }
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
        const suggestedName = `reports/Hurvesthub_Inventory_Value_Report_${dateStamp}.csv`;

        if (typeof window.showSaveFilePicker === 'function') {
            try {
                const handle = await window.showSaveFilePicker({
                    suggestedName: suggestedName,
                    types: [{ description: 'CSV Files', accept: { 'text/csv': ['.csv'] } }],
                });
                const writable = await handle.createWritable();
                await writable.write(blob);
                await writable.close();
                console.log(`[exportInventoryValueToCSV] File saved successfully via showSaveFilePicker: ${suggestedName}`);
            } catch (err: any) {
                if (err.name !== 'AbortError') {
                    console.error(`[exportInventoryValueToCSV] Error saving file with File System Access API (${suggestedName}):`, err);
                    alert(`Error saving file: ${err.message}. File will be downloaded conventionally.`);
                    saveAs(blob, suggestedName);
                } else {
                    console.log(`[exportInventoryValueToCSV] File save cancelled by user: ${suggestedName}`);
                }
            }
        } else {
            console.warn(`[exportInventoryValueToCSV] File System Access API not supported. Using default download for: ${suggestedName}`);
            saveAs(blob, suggestedName);
        }
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
        await pdfDoc.registerFontkit(fontkit); // Moved up

        const fetchFont = async (url: string) => {
          const response = await fetch(url);
          if (!response.ok) {
            throw new Error(`Failed to fetch font: ${response.status} ${response.statusText} for ${url}`);
          }
          return response.arrayBuffer();
        };

        const fontBytes = await fetchFont('/fonts/static/NotoSans-Regular.ttf');
        const boldFontBytes = await fetchFont('/fonts/static/NotoSans-Bold.ttf');
        const customFont = await pdfDoc.embedFont(fontBytes);
        const customBoldFont = await pdfDoc.embedFont(boldFontBytes);
        
        let page = pdfDoc.addPage();
        const { height } = page.getSize();
        const margin = 40;
        const yPos = { y: height - margin };

        await addPdfHeader(pdfDoc, page, yPos, customFont, customBoldFont);
        
        // Add Report Title
        page.drawText("Inventory Value Report", {
            x: margin,
            y: yPos.y,
            font: customBoldFont,
            size: 18,
            color: rgb(0,0,0)
        });
        yPos.y -= (18 * 1.2 + 15); // Adjust yPos after title

        const tableHeaders = ["Item Name", "Type", "Crop", "Supplier", "Qty", "Cost/Unit", "Total Value"];
        const columnWidths = [115, 65, 65, 100, 40, 50, 70]; // Sum: 505, fits < 515
        
        const tableData = reportData.map(item => [
            item.itemName,
            item.itemType,
            item.cropName || '',
            // item.batchCode || '', // Removed Batch
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
        const suggestedName = `reports/Hurvesthub_Inventory_Value_Report_${dateStamp}.pdf`;

        if (typeof window.showSaveFilePicker === 'function') {
            try {
                const handle = await window.showSaveFilePicker({
                    suggestedName: suggestedName,
                    types: [{ description: 'PDF Files', accept: { 'application/pdf': ['.pdf'] } }],
                });
                const writable = await handle.createWritable();
                await writable.write(blob);
                await writable.close();
                console.log(`[exportInventoryValueToPDF] File saved successfully via showSaveFilePicker: ${suggestedName}`);
            } catch (err: any) {
                if (err.name !== 'AbortError') {
                    console.error(`[exportInventoryValueToPDF] Error saving file with File System Access API (${suggestedName}):`, err);
                    alert(`Error saving file: ${err.message}. File will be downloaded conventionally.`);
                    saveAs(blob, suggestedName);
                } else {
                    console.log(`[exportInventoryValueToPDF] File save cancelled by user: ${suggestedName}`);
                }
            }
        } else {
            console.warn(`[exportInventoryValueToPDF] File System Access API not supported. Using default download for: ${suggestedName}`);
            saveAs(blob, suggestedName);
        }
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
    const dateText = `Generated: ${formatDateToDDMMYYYY(new Date())}`;
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
        await pdfDoc.registerFontkit(fontkit); // Moved up

        const fetchFont = async (url: string) => {
          const response = await fetch(url);
          if (!response.ok) {
            throw new Error(`Failed to fetch font: ${response.status} ${response.statusText} for ${url}`);
          }
          return response.arrayBuffer();
        };

        const fontBytes = await fetchFont('/fonts/static/NotoSans-Regular.ttf');
        const boldFontBytes = await fetchFont('/fonts/static/NotoSans-Bold.ttf');
        const customFont = await pdfDoc.embedFont(fontBytes);
        const customBoldFont = await pdfDoc.embedFont(boldFontBytes);

        let page = pdfDoc.addPage();
        const { height } = page.getSize();
        const margin = 40;
        const yPos = { y: height - margin };

        await addPdfHeader(pdfDoc, page, yPos, customFont, customBoldFont);
        
        // Add Report Title
        page.drawText("Sales Report", {
            x: margin,
            y: yPos.y,
            font: customBoldFont,
            size: 18,
            color: rgb(0,0,0)
        });
        yPos.y -= (18 * 1.2 + 15); // Adjust yPos after title

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
        const suggestedName = `reports/Hurvesthub_Sales_Report_${dateStamp}.pdf`;
        console.log(`[exportSalesToPDF] Attempting to save file. Suggested name: ${suggestedName}`);

        if (typeof window.showSaveFilePicker === 'function') {
            console.log("[exportSalesToPDF] showSaveFilePicker is available. Trying to use it.");
            try {
                const handle = await window.showSaveFilePicker({
                    suggestedName: suggestedName,
                    types: [{
                        description: 'PDF Files',
                        accept: { 'application/pdf': ['.pdf'] },
                    }],
                });
                console.log("[exportSalesToPDF] File handle obtained:", handle);
                const writable = await handle.createWritable();
                console.log("[exportSalesToPDF] Writable stream created.");
                await writable.write(blob);
                console.log("[exportSalesToPDF] Blob written to stream.");
                await writable.close();
                console.log("[exportSalesToPDF] File saved successfully via showSaveFilePicker.");
            } catch (err: any) {
                console.error("[exportSalesToPDF] Error using showSaveFilePicker:", err);
                if (err.name !== 'AbortError') {
                    alert(`Error saving file with new method: ${err.message}. Falling back to default download.`);
                    console.log("[exportSalesToPDF] Fallback: Calling saveAs.");
                    saveAs(blob, suggestedName);
                } else {
                    console.log("[exportSalesToPDF] File save cancelled by user.");
                }
            }
        } else {
            console.warn("[exportSalesToPDF] File System Access API (showSaveFilePicker) not supported. Using default saveAs download.");
            saveAs(blob, suggestedName);
        }

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
        await pdfDoc.registerFontkit(fontkit); // Moved up

        const fetchFont = async (url: string) => {
          const response = await fetch(url);
          if (!response.ok) {
            throw new Error(`Failed to fetch font: ${response.status} ${response.statusText} for ${url}`);
          }
          return response.arrayBuffer();
        };

        const fontBytes = await fetchFont('/fonts/static/NotoSans-Regular.ttf');
        const boldFontBytes = await fetchFont('/fonts/static/NotoSans-Bold.ttf');
        const customFont = await pdfDoc.embedFont(fontBytes);
        const customBoldFont = await pdfDoc.embedFont(boldFontBytes);
        
        let page = pdfDoc.addPage();
        const { height } = page.getSize();
        const margin = 40;
        const yPos = { y: height - margin };

        await addPdfHeader(pdfDoc, page, yPos, customFont, customBoldFont);
        
        // Add Report Title
        page.drawText("Inventory Report", {
            x: margin,
            y: yPos.y, // yPos is already adjusted by addPdfHeader if it draws something at the very top
            font: customBoldFont,
            size: 18,
            color: rgb(0,0,0)
        });
        yPos.y -= (18 * 1.2 + 15); // Adjust yPos after title

        const tableHeaders = ["Item Name", "Type", "Crop", "Supplier", "Qty", "Unit", "Notes"];
        // Original: [100, 60, 70, 70, 80, 40, 50, 100] (Total 570 without Batch Code: 500)
        // New: Distribute the removed 70 width. Let's give more to Item Name and Notes.
        const columnWidths = [100, 60, 70, 90, 40, 50, 105]; // Sum: 515
        
        const tableData = inventoryReportData.map(item => [
            item.itemName,
            item.itemType,
            item.cropName || '',
            // item.batchCode || '', // Removed Batch Code
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
        const suggestedName = `reports/Hurvesthub_Inventory_Report_${dateStamp}.pdf`;

        if (typeof window.showSaveFilePicker === 'function') {
            try {
                const handle = await window.showSaveFilePicker({
                    suggestedName: suggestedName,
                    types: [{ description: 'PDF Files', accept: { 'application/pdf': ['.pdf'] } }],
                });
                const writable = await handle.createWritable();
                await writable.write(blob);
                await writable.close();
                console.log(`[exportInventoryToPDF] File saved successfully via showSaveFilePicker: ${suggestedName}`);
            } catch (err: any) {
                if (err.name !== 'AbortError') {
                    console.error(`[exportInventoryToPDF] Error saving file with File System Access API (${suggestedName}):`, err);
                    alert(`Error saving file: ${err.message}. File will be downloaded conventionally.`);
                    saveAs(blob, suggestedName);
                } else {
                    console.log(`[exportInventoryToPDF] File save cancelled by user: ${suggestedName}`);
                }
            }
        } else {
            console.warn(`[exportInventoryToPDF] File System Access API not supported. Using default download for: ${suggestedName}`);
            saveAs(blob, suggestedName);
        }
    } catch (error) {
        console.error("Failed to generate inventory PDF:", error);
        alert(`Error generating inventory PDF: ${error instanceof Error ? error.message : String(error)}`);
    }
}

export async function exportHarvestLogsToPDF(filters?: DateRangeFilters): Promise<void> {
    try {
        const harvestReportData = await getAllHarvestLogsForReport(filters || {});
        if (harvestReportData.length === 0) {
            alert("No harvest log data available for PDF report with selected filters.");
            return;
        }
        const pdfDoc = await PDFDocument.create();
        await pdfDoc.registerFontkit(fontkit); // Moved up

        const fetchFont = async (url: string) => {
          const response = await fetch(url);
          if (!response.ok) {
            throw new Error(`Failed to fetch font: ${response.status} ${response.statusText} for ${url}`);
          }
          return response.arrayBuffer();
        };

        const fontBytes = await fetchFont('/fonts/static/NotoSans-Regular.ttf');
        const boldFontBytes = await fetchFont('/fonts/static/NotoSans-Bold.ttf');
        const customFont = await pdfDoc.embedFont(fontBytes);
        const customBoldFont = await pdfDoc.embedFont(boldFontBytes);

        let page = pdfDoc.addPage();
        const { height } = page.getSize();
        const margin = 40;
        const yPos = { y: height - margin };

        await addPdfHeader(pdfDoc, page, yPos, customFont, customBoldFont);
        
        // Add Report Title
        page.drawText("Harvest Log Report", {
            x: margin,
            y: yPos.y,
            font: customBoldFont,
            size: 18,
            color: rgb(0,0,0)
        });
        yPos.y -= (18 * 1.2 + 15); // Adjust yPos after title

        const tableHeaders = ["Harvest Date", "Crop", "Variety", "Qty", "Unit", "Quality", "Planting Date", "Location", "Notes"];
        const columnWidths = [60, 60, 60, 40, 40, 60, 60, 60, 65]; // Sum: 505
        
        const tableData = harvestReportData.map(item => [
            item.harvestDate,
            item.cropName || 'Default if Undefined', // Diagnostic fallback
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
        const suggestedName = `reports/Hurvesthub_Harvest_Logs_Report_${dateStamp}.pdf`;

        if (typeof window.showSaveFilePicker === 'function') {
            try {
                const handle = await window.showSaveFilePicker({
                    suggestedName: suggestedName,
                    types: [{ description: 'PDF Files', accept: { 'application/pdf': ['.pdf'] } }],
                });
                const writable = await handle.createWritable();
                await writable.write(blob);
                await writable.close();
                console.log(`[exportHarvestLogsToPDF] File saved successfully via showSaveFilePicker: ${suggestedName}`);
            } catch (err: any) {
                if (err.name !== 'AbortError') {
                    console.error(`[exportHarvestLogsToPDF] Error saving file with File System Access API (${suggestedName}):`, err);
                    alert(`Error saving file: ${err.message}. File will be downloaded conventionally.`);
                    saveAs(blob, suggestedName);
                } else {
                    console.log(`[exportHarvestLogsToPDF] File save cancelled by user: ${suggestedName}`);
                }
            }
        } else {
            console.warn(`[exportHarvestLogsToPDF] File System Access API not supported. Using default download for: ${suggestedName}`);
            saveAs(blob, suggestedName);
        }
    } catch (error) {
        console.error("Failed to generate harvest logs PDF:", error);
        alert(`Error generating harvest logs PDF: ${error instanceof Error ? error.message : String(error)}`);
    }
}


export interface SeedlingLifecycleReportItem {
    // seedBatchId: string; // Kept if other logic might use it, but not for PDF display
    // seedBatchCode: string; // Removed for PDF display
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

    // Fetch all potentially relevant crops first
    const allCrops = await db.crops.filter(c => c.is_deleted !== 1).toArray();
    const cropMap = new Map(allCrops.map(c => [c.id, c]));

    // Fetch all non-deleted planting logs, harvest logs, and sale items
    const [allPlantingLogs, allHarvestLogs, allSaleItems] = await Promise.all([
        db.plantingLogs.filter(pl => pl.is_deleted !== 1).toArray(),
        db.harvestLogs.filter(hl => hl.is_deleted !== 1).toArray(),
        db.saleItems.filter(si => si.is_deleted !== 1).toArray()
    ]);

    const reportItems: SeedlingLifecycleReportItem[] = [];

    // 1. Process self-produced seedlings (from seedlingProductionLogs)
    for (const sl of seedlingLogs) { // seedlingLogs is already fetched and filtered by date
        const crop = sl.crop_id ? cropMap.get(sl.crop_id) : undefined;
        const plantingsFromThisSeedlingLog = allPlantingLogs.filter(pl => pl.seedling_production_log_id === sl.id);
        const seedlingsTransplanted = plantingsFromThisSeedlingLog.reduce((sum, pl) => sum + (pl.quantity_planted || 0), 0);
        
        const harvestLogIdsFromThesePlantings = plantingsFromThisSeedlingLog.flatMap(pl =>
            allHarvestLogs.filter(hl => hl.planting_log_id === pl.id).map(hl => hl.id)
        );
        const totalHarvestedFromSeedlings = allHarvestLogs
            .filter(hl => harvestLogIdsFromThesePlantings.includes(hl.id))
            .reduce((sum, hl) => sum + (hl.quantity_harvested || 0), 0);

        const saleItemsForTheseHarvests = allSaleItems.filter(si => si.harvest_log_id && harvestLogIdsFromThesePlantings.includes(si.harvest_log_id));
        const totalSoldFromSeedlings = saleItemsForTheseHarvests.reduce((sum, si) => sum + (si.quantity_sold || 0), 0);

        reportItems.push({
            cropName: crop?.name || 'N/A',
            sowingDate: formatDateToDDMMYYYY(sl.sowing_date),
            quantitySownDisplay: `${sl.quantity_sown_value} ${sl.sowing_unit_from_batch || 'units'}`,
            seedlingsProduced: sl.actual_seedlings_produced,
            seedlingsTransplanted,
            totalHarvestedFromSeedlings,
            totalSoldFromSeedlings,
            currentSeedlingsAvailable: sl.current_seedlings_available,
            notes: sl.notes
        });
    }

    // 2. Process purchased seedlings (from purchasedSeedlings table)
    let purchasedSeedlingsQuery = db.purchasedSeedlings.filter(ps => ps.is_deleted !== 1);
    if (filters?.startDate) {
        purchasedSeedlingsQuery = purchasedSeedlingsQuery.and(ps => !!ps.purchase_date && ps.purchase_date >= filters.startDate!);
    }
    if (filters?.endDate) {
        purchasedSeedlingsQuery = purchasedSeedlingsQuery.and(ps => !!ps.purchase_date && ps.purchase_date <= filters.endDate!);
    }
    const purchasedSeedlingsData = await purchasedSeedlingsQuery.toArray();

    for (const ps of purchasedSeedlingsData) {
        const crop = ps.crop_id ? cropMap.get(ps.crop_id) : undefined;
        
        const plantingsFromThisPurchasedBatch = allPlantingLogs.filter(pl => pl.purchased_seedling_id === ps.id);
        const seedlingsTransplanted = plantingsFromThisPurchasedBatch.reduce((sum, pl) => sum + (pl.quantity_planted || 0), 0);
        
        const harvestLogIdsFromThesePlantings = plantingsFromThisPurchasedBatch.flatMap(pl =>
            allHarvestLogs.filter(hl => hl.planting_log_id === pl.id).map(hl => hl.id)
        );
        const totalHarvestedFromSeedlings = allHarvestLogs
            .filter(hl => harvestLogIdsFromThesePlantings.includes(hl.id))
            .reduce((sum, hl) => sum + (hl.quantity_harvested || 0), 0);

        const saleItemsForTheseHarvests = allSaleItems.filter(si => si.harvest_log_id && harvestLogIdsFromThesePlantings.includes(si.harvest_log_id));
        const totalSoldFromSeedlings = saleItemsForTheseHarvests.reduce((sum, si) => sum + (si.quantity_sold || 0), 0);

        reportItems.push({
            cropName: crop?.name || ps.name,
            sowingDate: ps.purchase_date ? new Date(ps.purchase_date).toLocaleDateString() : 'N/A',
            quantitySownDisplay: 'Purchased',
            seedlingsProduced: ps.initial_quantity || 0,
            seedlingsTransplanted,
            totalHarvestedFromSeedlings,
            totalSoldFromSeedlings,
            currentSeedlingsAvailable: ps.current_quantity || 0,
            notes: ps.notes || ''
        });
    }

    return reportItems.sort((a, b) => {
        const dateA = a.sowingDate !== 'N/A' ? new Date(a.sowingDate).getTime() : 0;
        const dateB = b.sowingDate !== 'N/A' ? new Date(b.sowingDate).getTime() : 0;
        if (dateB !== dateA) {
            return dateB - dateA;
        }
        // Fallback sort by crop name if dates are the same or N/A
        return (a.cropName || '').localeCompare(b.cropName || '');
    });
}

export async function exportSeedlingLifecycleToPDF(filters?: DateRangeFilters): Promise<void> {
    try {
        const reportData = await getSeedlingLifecycleReportData(filters);
        if (reportData.length === 0) {
            alert("No seedling lifecycle data available for PDF report with selected filters.");
            return;
        }
        const pdfDoc = await PDFDocument.create();
        await pdfDoc.registerFontkit(fontkit); // Moved up

        const fetchFont = async (url: string) => {
          const response = await fetch(url);
          if (!response.ok) {
            throw new Error(`Failed to fetch font: ${response.status} ${response.statusText} for ${url}`);
          }
          return response.arrayBuffer();
        };

        const fontBytes = await fetchFont('/fonts/static/NotoSans-Regular.ttf');
        const boldFontBytes = await fetchFont('/fonts/static/NotoSans-Bold.ttf');
        const customFont = await pdfDoc.embedFont(fontBytes);
        const customBoldFont = await pdfDoc.embedFont(boldFontBytes);
        
        let page = pdfDoc.addPage();
        const { height } = page.getSize();
        const margin = 40;
        const yPos = { y: height - margin };

        // Call the common header function first
        await addPdfHeader(pdfDoc, page, yPos, customFont, customBoldFont);
        // yPos is now updated by addPdfHeader to be below the common header elements.

        // Draw the specific report title below the common header
        page.drawText("Seedling Lifecycle Report", {
            x: margin,
            y: yPos.y, // Use the yPos updated by addPdfHeader
            font: customBoldFont,
            size: 18,
            color: rgb(0,0,0)
        });
        yPos.y -= (18 * 1.2 + 15); // Adjust yPos further for space after this specific title

        const tableHeaders = ["Crop", "Sown", "Sown Qty", "Produced", "Transplanted", "Harvested", "Sold", "Remaining Seedlings"];
        const columnWidths = [80, 50, 50, 50, 70, 50, 50, 75]; // Adjusted for Transplanted header
        
        const tableData = reportData.map(item => [
            item.cropName,
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
const suggestedName = `reports/Hurvesthub_Seedling_Lifecycle_Report_${dateStamp}.pdf`;

        if (typeof window.showSaveFilePicker === 'function') {
            try {
                const handle = await window.showSaveFilePicker({
                    suggestedName: suggestedName,
                    types: [{ description: 'PDF Files', accept: { 'application/pdf': ['.pdf'] } }],
                });
                const writable = await handle.createWritable();
                await writable.write(blob);
                await writable.close();
                console.log(`[exportSeedlingLifecycleToPDF] File saved successfully via showSaveFilePicker: ${suggestedName}`);
                return; // Exit after successful save
            } catch (err: any) {
                if (err.name !== 'AbortError') {
                    console.error(`[exportSeedlingLifecycleToPDF] Error saving file with File System Access API (${suggestedName}):`, err);
                    alert(`Error saving file: ${err.message}. File will be downloaded conventionally.`);
                    // Fallback to original saveAs is below
                } else {
                    console.log(`[exportSeedlingLifecycleToPDF] File save cancelled by user: ${suggestedName}`);
                    return; // Exit if user cancelled
                }
            }
        } else {
            console.warn(`[exportSeedlingLifecycleToPDF] File System Access API not supported. Using default download for: ${suggestedName}`);
            // Fallback to original saveAs is below, ensure suggestedName is used
        }
        // saveAs(blob, `Hurvesthub_Seedling_Lifecycle_Report_${dateStamp}.pdf`); // Original line commented out
    } catch (error) {
        console.error("Failed to generate seedling lifecycle PDF:", error);
        alert(`Error generating seedling lifecycle PDF: ${error instanceof Error ? error.message : String(error)}`);
    }
}

function convertSeedlingLifecycleToCSV(data: SeedlingLifecycleReportItem[]): string {
    const headers = [
        "Crop Name",
        "Sowing Date",
        "Quantity Sown",
        "Seedlings Produced",
        "Seedlings Transplanted",
        "Total Harvested from Seedlings",
        "Total Sold from Seedlings",
        "Current Seedlings Available",
        "Notes"
    ];
    const csvRows = [headers.join(',')];
    data.forEach(item => {
        const row = [
            `"${(item.cropName || 'N/A').replace(/"/g, '""')}"`,
            `"${item.sowingDate}"`,
            `"${item.quantitySownDisplay.replace(/"/g, '""')}"`,
            item.seedlingsProduced,
            item.seedlingsTransplanted,
            item.totalHarvestedFromSeedlings,
            item.totalSoldFromSeedlings,
            item.currentSeedlingsAvailable,
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
const dateStamp = new Date().toISOString().split('T')[0];
        const suggestedName = `reports/Hurvesthub_Seedling_Lifecycle_${dateStamp}.csv`;

        if (typeof window.showSaveFilePicker === 'function') {
            try {
                const handle = await window.showSaveFilePicker({
                    suggestedName: suggestedName,
                    types: [{ description: 'CSV Files', accept: { 'text/csv': ['.csv'] } }],
                });
                const writable = await handle.createWritable();
                await writable.write(blob);
                await writable.close();
                console.log(`[exportSeedlingLifecycleToCSV] File saved successfully via showSaveFilePicker: ${suggestedName}`);
                return; // Exit after successful save with picker
            } catch (err: any) {
                if (err.name !== 'AbortError') {
                    console.error(`[exportSeedlingLifecycleToCSV] Error saving file with File System Access API (${suggestedName}):`, err);
                    alert(`Error saving file: ${err.message}. File will be downloaded conventionally.`);
                    // Fallback to original saveAs is below
                } else {
                    console.log(`[exportSeedlingLifecycleToCSV] File save cancelled by user: ${suggestedName}`);
                    return; // Exit if user cancelled
                }
            }
        } else {
            console.warn(`[exportSeedlingLifecycleToCSV] File System Access API not supported. Using default download for: ${suggestedName}`);
            // Fallback to original saveAs is below, ensure suggestedName is used
        }
        // saveAs(blob, `Hurvesthub_Seedling_Lifecycle_${new Date().toISOString().split('T')[0]}.csv`); // Original line commented out, new logic uses suggestedName
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
        const dateStamp = new Date().toISOString().split('T')[0];
        const suggestedName = `reports/Hurvesthub_Organic_Compliance_${dateStamp}.csv`;

        if (typeof window.showSaveFilePicker === 'function') {
            try {
                const handle = await window.showSaveFilePicker({
                    suggestedName: suggestedName,
                    types: [{ description: 'CSV Files', accept: { 'text/csv': ['.csv'] } }],
                });
                const writable = await handle.createWritable();
                await writable.write(blob);
                await writable.close();
                console.log(`[exportOrganicComplianceToCSV] File saved successfully via showSaveFilePicker: ${suggestedName}`);
            } catch (err: any) {
                if (err.name !== 'AbortError') {
                    console.error(`[exportOrganicComplianceToCSV] Error saving file with File System Access API (${suggestedName}):`, err);
                    alert(`Error saving file: ${err.message}. File will be downloaded conventionally.`);
                    saveAs(blob, suggestedName);
                } else {
                    console.log(`[exportOrganicComplianceToCSV] File save cancelled by user: ${suggestedName}`);
                }
            }
        } else {
            console.warn(`[exportOrganicComplianceToCSV] File System Access API not supported. Using default download for: ${suggestedName}`);
            saveAs(blob, suggestedName);
        }
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
        await pdfDoc.registerFontkit(fontkit); // Moved up

        const fetchFont = async (url: string) => {
          const response = await fetch(url);
          if (!response.ok) {
            throw new Error(`Failed to fetch font: ${response.status} ${response.statusText} for ${url}`);
          }
          return response.arrayBuffer();
        };

        const fontBytes = await fetchFont('/fonts/static/NotoSans-Regular.ttf');
        const boldFontBytes = await fetchFont('/fonts/static/NotoSans-Bold.ttf');
        const customFont = await pdfDoc.embedFont(fontBytes);
        const customBoldFont = await pdfDoc.embedFont(boldFontBytes);

        let page = pdfDoc.addPage();
        const { height } = page.getSize();
        const margin = 40;
        const yPos = { y: height - margin };

        await addPdfHeader(pdfDoc, page, yPos, customFont, customBoldFont);
        
        // Add Report Title
        page.drawText("Organic Compliance Report", {
            x: margin,
            y: yPos.y,
            font: customBoldFont,
            size: 18,
            color: rgb(0,0,0)
        });
        yPos.y -= (18 * 1.2 + 15); // Adjust yPos after title

        const tableHeaders = ["Crop", "Supplier", "Purchase Date", "Organic Status", "Notes"];
        const columnWidths = [100, 100, 70, 100, 110]; // Sum: 480
        
        const tableData = reportData.map(item => [
            item.cropName || '',
            // item.batchCode, // Removed Batch Code
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
        const suggestedName = `reports/Hurvesthub_Organic_Compliance_Report_${dateStamp}.pdf`;

        if (typeof window.showSaveFilePicker === 'function') {
            try {
                const handle = await window.showSaveFilePicker({
                    suggestedName: suggestedName,
                    types: [{ description: 'PDF Files', accept: { 'application/pdf': ['.pdf'] } }],
                });
                const writable = await handle.createWritable();
                await writable.write(blob);
                await writable.close();
                console.log(`[exportOrganicComplianceToPDF] File saved successfully via showSaveFilePicker: ${suggestedName}`);
            } catch (err: any) {
                if (err.name !== 'AbortError') {
                    console.error(`[exportOrganicComplianceToPDF] Error saving file with File System Access API (${suggestedName}):`, err);
                    alert(`Error saving file: ${err.message}. File will be downloaded conventionally.`);
                    saveAs(blob, suggestedName);
                } else {
                    console.log(`[exportOrganicComplianceToPDF] File save cancelled by user: ${suggestedName}`);
                }
            }
        } else {
            console.warn(`[exportOrganicComplianceToPDF] File System Access API not supported. Using default download for: ${suggestedName}`);
            saveAs(blob, suggestedName);
        }
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

    // 1. Find all CultivationActivityUsedInput records for the given itemId
    const usedInputEntries = await db.cultivationActivityUsedInputs
        .where('input_inventory_id').equals(filters.itemId)
        .and(entry => entry.is_deleted !== 1)
        .toArray();

    if (usedInputEntries.length === 0) return [{
        itemId: inputItem.id,
        itemName: inputItem.name,
        itemType: inputItem.type,
        initialQuantity: inputItem.initial_quantity,
        currentQuantity: inputItem.current_quantity,
        quantityUnit: inputItem.quantity_unit,
        usageDetails: []
    }];

    const cultivationLogIdsFromUsedInputs = [...new Set(usedInputEntries.map(entry => entry.cultivation_log_id))];

    // 2. Fetch the actual CultivationLog records
    const cultivationLogs = await db.cultivationLogs
        .where('id').anyOf(cultivationLogIdsFromUsedInputs)
        .and(log => log.is_deleted !== 1)
        // .sortBy('activity_date'); // Sorting later after merging with usedInputEntry
        .toArray();
    
    const cultivationLogMap = new Map(cultivationLogs.map(cl => [cl.id, cl]));

    // 3. Fetch all CultivationActivityPlantingLinks for these cultivation logs
    const plantingLinks = await db.cultivationActivityPlantingLinks
        .where('cultivation_log_id').anyOf(cultivationLogIdsFromUsedInputs)
        .and(link => link.is_deleted !== 1)
        .toArray();
    
    const plantingLogIdsFromLinks = [...new Set(plantingLinks.map(link => link.planting_log_id))];
    
    // 4. Fetch related PlantingLogs, SeedBatches, and Crops
    const plantingLogs = await db.plantingLogs.where('id').anyOf(plantingLogIdsFromLinks).and(pl => pl.is_deleted !== 1).toArray();
    const plantingLogMap = new Map(plantingLogs.map(pl => [pl.id, pl]));

    const seedBatchIds = [...new Set(plantingLogs.map(pl => pl.seed_batch_id).filter(id => !!id) as string[])];
    const seedBatches = await db.seedBatches.where('id').anyOf(seedBatchIds).and(sb => sb.is_deleted !== 1).toArray();
    const seedBatchMap = new Map(seedBatches.map(sb => [sb.id, sb]));

    const cropIds = [...new Set(seedBatches.map(sb => sb.crop_id).filter(id => !!id) as string[])];
    const crops = await db.crops.where('id').anyOf(cropIds).and(c => c.is_deleted !== 1).toArray();
    const cropMap = new Map(crops.map(c => [c.id, c]));

    // 5. Construct usageDetails by iterating over usedInputEntries
    const usageDetails: CultivationUsageDetail[] = usedInputEntries.map(usedInputEntry => {
        const cl = cultivationLogMap.get(usedInputEntry.cultivation_log_id);
        if (!cl) return null; // Should not happen if data is consistent

        // Find the planting_log_id associated with this cultivation_log_id
        const relevantPlantingLink = plantingLinks.find(link => link.cultivation_log_id === cl.id);
        const pLog = relevantPlantingLink ? plantingLogMap.get(relevantPlantingLink.planting_log_id) : undefined;
        
        const sBatch = pLog?.seed_batch_id ? seedBatchMap.get(pLog.seed_batch_id) : undefined;
        const crop = sBatch?.crop_id ? cropMap.get(sBatch.crop_id) : undefined;

        return {
            activityDate: new Date(cl.activity_date).toLocaleDateString(),
            activityType: cl.activity_type,
            cropName: crop?.name,
            plotAffected: cl.plot_affected || pLog?.plot_affected, // Prefer direct plot on CL, fallback to PL
            quantityUsed: usedInputEntry.quantity_used || 0,
            quantityUnit: usedInputEntry.quantity_unit
        };
    }).filter(detail => detail !== null) as CultivationUsageDetail[];

    // Sort usageDetails by activityDate
    usageDetails.sort((a, b) => new Date(a.activityDate).getTime() - new Date(b.activityDate).getTime());

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
    // Register fontkit before fetching/embedding fonts
    await pdfDoc.registerFontkit(fontkit);

    const fetchFont = async (url: string) => {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch font: ${response.status} ${response.statusText} for ${url}`);
      }
      return response.arrayBuffer();
    };

    const fontBytes = await fetchFont('/fonts/static/NotoSans-Regular.ttf');
    const boldFontBytes = await fetchFont('/fonts/static/NotoSans-Bold.ttf');
    const mainFont = await pdfDoc.embedFont(fontBytes);
    const boldFont = await pdfDoc.embedFont(boldFontBytes);
    
    let page = pdfDoc.addPage();
    const { width: pageWidth, height: pageHeight } = page.getSize();
    const margin = 30;
    let yPos = pageHeight - margin;

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
    const suggestedName = `reports/Hurvesthub_UsageLedger_${item.itemName.replace(/\s/g, '_')}.pdf`;

    if (typeof window.showSaveFilePicker === 'function') {
        try {
            const handle = await window.showSaveFilePicker({
                suggestedName: suggestedName,
                types: [{ description: 'PDF Files', accept: { 'application/pdf': ['.pdf'] } }],
            });
            const writable = await handle.createWritable();
            await writable.write(blob);
            await writable.close();
            console.log(`[exportInputItemUsageLedgerToPDF] File saved successfully via showSaveFilePicker: ${suggestedName}`);
        } catch (err: any) {
            if (err.name !== 'AbortError') {
                console.error(`[exportInputItemUsageLedgerToPDF] Error saving file with File System Access API (${suggestedName}):`, err);
                alert(`Error saving file: ${err.message}. File will be downloaded conventionally.`);
                saveAs(blob, suggestedName);
            } else {
                console.log(`[exportInputItemUsageLedgerToPDF] File save cancelled by user: ${suggestedName}`);
            }
        }
    } else {
        console.warn(`[exportInputItemUsageLedgerToPDF] File System Access API not supported. Using default download for: ${suggestedName}`);
        saveAs(blob, suggestedName);
    }
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
        await pdfDoc.registerFontkit(fontkit);

        const fetchFont = async (url: string) => {
          const response = await fetch(url);
          if (!response.ok) {
            throw new Error(`Failed to fetch font: ${response.status} ${response.statusText} for ${url}`);
          }
          return response.arrayBuffer();
        };

        const fontBytes = await fetchFont('/fonts/static/NotoSans-Regular.ttf');
        const boldFontBytes = await fetchFont('/fonts/static/NotoSans-Bold.ttf');
        const customFont = await pdfDoc.embedFont(fontBytes);
        const customBoldFont = await pdfDoc.embedFont(boldFontBytes);

        let page = pdfDoc.addPage();
        const { height } = page.getSize();
        const margin = 40;
        const yPos = { y: height - margin };

        await addPdfHeader(pdfDoc, page, yPos, customFont, customBoldFont);
        
        // Add Report Title
        page.drawText("Grouped Inventory Summary Report", {
            x: margin,
            y: yPos.y,
            font: customBoldFont,
            size: 18,
            color: rgb(0,0,0)
        });
        yPos.y -= (18 * 1.2 + 15); // Adjust yPos after title

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
        const suggestedName = `reports/Hurvesthub_Grouped_Inventory_Summary_${dateStamp}.pdf`;

        if (typeof window.showSaveFilePicker === 'function') {
            try {
                const handle = await window.showSaveFilePicker({
                    suggestedName: suggestedName,
                    types: [{ description: 'PDF Files', accept: { 'application/pdf': ['.pdf'] } }],
                });
                const writable = await handle.createWritable();
                await writable.write(blob);
                await writable.close();
                console.log(`[exportGroupedInventorySummaryToPDF] File saved successfully via showSaveFilePicker: ${suggestedName}`);
            } catch (err: any) {
                if (err.name !== 'AbortError') {
                    console.error(`[exportGroupedInventorySummaryToPDF] Error saving file with File System Access API (${suggestedName}):`, err);
                    alert(`Error saving file: ${err.message}. File will be downloaded conventionally.`);
                    saveAs(blob, suggestedName);
                } else {
                    console.log(`[exportGroupedInventorySummaryToPDF] File save cancelled by user: ${suggestedName}`);
                }
            }
        } else {
            console.warn(`[exportGroupedInventorySummaryToPDF] File System Access API not supported. Using default download for: ${suggestedName}`);
            saveAs(blob, suggestedName);
        }
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
    // 1. Fetch all CultivationActivityUsedInput records that are not deleted.
    const allUsedInputEntries = await db.cultivationActivityUsedInputs
        .filter(caui => caui.is_deleted !== 1)
        .toArray();

    if (allUsedInputEntries.length === 0) return [];

    const cultivationLogIdsFromUsedInputs = [...new Set(allUsedInputEntries.map(entry => entry.cultivation_log_id))];
    
    // 2. Fetch relevant CultivationLogs and apply date filters.
    let cultivationLogsQuery = db.cultivationLogs
        .where('id').anyOf(cultivationLogIdsFromUsedInputs)
        .and(cl => cl.is_deleted !== 1);

    if (filters?.startDate) {
        cultivationLogsQuery = cultivationLogsQuery.and(cl => cl.activity_date >= filters.startDate!);
    }
    if (filters?.endDate) {
        cultivationLogsQuery = cultivationLogsQuery.and(cl => cl.activity_date <= filters.endDate!);
    }
    const cultivationLogs = await cultivationLogsQuery.toArray();

    // Filter allUsedInputEntries to only include those whose cultivationLog is in the date-filtered cultivationLogs
    const cultivationLogIdSet = new Set(cultivationLogs.map(cl => cl.id));
    const filteredUsedInputEntries = allUsedInputEntries.filter(entry => cultivationLogIdSet.has(entry.cultivation_log_id));

    if (filteredUsedInputEntries.length === 0) return [];

    // Get the final set of CultivationLog IDs that are actually part of the report
    const finalCultivationLogIds = [...new Set(filteredUsedInputEntries.map(entry => entry.cultivation_log_id))];
    // Ensure cultivationLogs only contains logs that are part of filteredUsedInputEntries
    const finalCultivationLogs = cultivationLogs.filter(cl => finalCultivationLogIds.includes(cl.id));
    const cultivationLogMap = new Map(finalCultivationLogs.map(cl => [cl.id, cl]));

    // 3. Fetch all CultivationActivityPlantingLinks for these cultivation logs
    const plantingLinks = await db.cultivationActivityPlantingLinks
        .where('cultivation_log_id').anyOf(finalCultivationLogIds)
        .and(link => link.is_deleted !== 1)
        .toArray();
    
    const plantingLogIdsFromLinks = [...new Set(plantingLinks.map(link => link.planting_log_id).filter(id => !!id))];

    // 4. Fetch related InputInventoryItems, PlantingLogs, SeedBatches, and Crops
    const inputInventoryIds = [...new Set(filteredUsedInputEntries.map(entry => entry.input_inventory_id).filter(id => !!id))];
    
    const [inputInventoryItems, plantingLogsData, seedBatchesData, cropsData] = await Promise.all([
        db.inputInventory.where('id').anyOf(inputInventoryIds).and(ii => ii.is_deleted !== 1).toArray(),
        db.plantingLogs.where('id').anyOf(plantingLogIdsFromLinks).and(pl => pl.is_deleted !== 1).toArray(),
        db.seedBatches.where('id').anyOf( // Fetch based on IDs from plantingLogsData
            [...new Set( (await db.plantingLogs.where('id').anyOf(plantingLogIdsFromLinks).and(pl => pl.is_deleted !== 1).toArray()).map(pl => pl.seed_batch_id).filter(id => !!id) as string[])]
        ).and(sb => sb.is_deleted !== 1).toArray(),
        db.crops.where('id').anyOf( // Fetch based on IDs from seedBatchesData (which itself is based on plantingLogsData)
             [...new Set( (await db.seedBatches.where('id').anyOf([...new Set( (await db.plantingLogs.where('id').anyOf(plantingLogIdsFromLinks).and(pl => pl.is_deleted !== 1).toArray()).map(pl => pl.seed_batch_id).filter(id => !!id) as string[])]).and(sb => sb.is_deleted !== 1).toArray()).map(sb => sb.crop_id).filter(id => !!id) as string[])]
        ).and(c => c.is_deleted !== 1).toArray()
    ]);
    
    const inputMap = new Map(inputInventoryItems.map(ii => [ii.id, ii]));
    const plantingLogMap = new Map(plantingLogsData.map(pl => [pl.id, pl]));
    const seedBatchMap = new Map(seedBatchesData.map(sb => [sb.id, sb]));
    const cropMap = new Map(cropsData.map(c => [c.id, c]));

    // 5. Construct report items by iterating over filteredUsedInputEntries
    let reportItems = filteredUsedInputEntries.map(usedInputEntry => {
        const cl = cultivationLogMap.get(usedInputEntry.cultivation_log_id);
        if (!cl) return null;

        const inputItem = inputMap.get(usedInputEntry.input_inventory_id);
        if (!inputItem) return null;

        const relevantPlantingLink = plantingLinks.find(link => link.cultivation_log_id === cl.id);
        const pLog = relevantPlantingLink ? plantingLogMap.get(relevantPlantingLink.planting_log_id) : undefined;
        
        const sBatch = pLog?.seed_batch_id ? seedBatchMap.get(pLog.seed_batch_id) : undefined;
        const crop = sBatch?.crop_id ? cropMap.get(sBatch.crop_id) : undefined;

        return {
            activityDate: cl.activity_date, // Keep as string for sorting
            inputName: inputItem.name,
            activityType: cl.activity_type,
            cropName: crop?.name,
            plotAffected: cl.plot_affected || pLog?.plot_affected,
            quantityUsed: usedInputEntry.quantity_used || 0,
            quantityUnit: usedInputEntry.quantity_unit || inputItem.quantity_unit,
            notes: cl.notes
        };
    }).filter(item => item !== null) as DetailedInputUsageReportItem[];

    // Sort by activity_date (as string YYYY-MM-DD) and then format the date for display
    reportItems.sort((a, b) => a.activityDate.localeCompare(b.activityDate));
    
    return reportItems.map(item => ({
        ...item,
        activityDate: new Date(item.activityDate).toLocaleDateString()
    }));
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
        await pdfDoc.registerFontkit(fontkit);

        const fetchFont = async (url: string) => {
          const response = await fetch(url);
          if (!response.ok) {
            throw new Error(`Failed to fetch font: ${response.status} ${response.statusText} for ${url}`);
          }
          return response.arrayBuffer();
        };

        const fontBytes = await fetchFont('/fonts/static/NotoSans-Regular.ttf');
        const boldFontBytes = await fetchFont('/fonts/static/NotoSans-Bold.ttf');
        const customFont = await pdfDoc.embedFont(fontBytes);
        const customBoldFont = await pdfDoc.embedFont(boldFontBytes);
        
        let page = pdfDoc.addPage();
        const { height } = page.getSize();
        const margin = 40;
        const yPos = { y: height - margin };

        await addPdfHeader(pdfDoc, page, yPos, customFont, customBoldFont);
        
        // Add Report Title
        page.drawText("Detailed Input Usage Report", {
            x: margin,
            y: yPos.y,
            font: customBoldFont,
            size: 18,
            color: rgb(0,0,0)
        });
        yPos.y -= (18 * 1.2 + 15); // Adjust yPos after title

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
        const suggestedName = `reports/Hurvesthub_Detailed_Input_Usage_Report_${dateStamp}.pdf`;

        if (typeof window.showSaveFilePicker === 'function') {
            try {
                const handle = await window.showSaveFilePicker({
                    suggestedName: suggestedName,
                    types: [{ description: 'PDF Files', accept: { 'application/pdf': ['.pdf'] } }],
                });
                const writable = await handle.createWritable();
                await writable.write(blob);
                await writable.close();
                console.log(`[exportDetailedInputUsageToPDF] File saved successfully via showSaveFilePicker: ${suggestedName}`);
            } catch (err: any) {
                if (err.name !== 'AbortError') {
                    console.error(`[exportDetailedInputUsageToPDF] Error saving file with File System Access API (${suggestedName}):`, err);
                    alert(`Error saving file: ${err.message}. File will be downloaded conventionally.`);
                    saveAs(blob, suggestedName);
                } else {
                    console.log(`[exportDetailedInputUsageToPDF] File save cancelled by user: ${suggestedName}`);
                }
            }
        } else {
            console.warn(`[exportDetailedInputUsageToPDF] File System Access API not supported. Using default download for: ${suggestedName}`);
            saveAs(blob, suggestedName);
        }
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
        await pdfDoc.registerFontkit(fontkit);

        const fetchFont = async (url: string) => {
          const response = await fetch(url);
          if (!response.ok) {
            throw new Error(`Failed to fetch font: ${response.status} ${response.statusText} for ${url}`);
          }
          return response.arrayBuffer();
        };

        const fontBytes = await fetchFont('/fonts/static/NotoSans-Regular.ttf');
        const boldFontBytes = await fetchFont('/fonts/static/NotoSans-Bold.ttf');
        const customFont = await pdfDoc.embedFont(fontBytes);
        const customBoldFont = await pdfDoc.embedFont(boldFontBytes);

        let page = pdfDoc.addPage();
        const { height } = page.getSize();
        const margin = 30;
        const yPos = { y: height - margin };

        await addPdfHeader(pdfDoc, page, yPos, customFont, customBoldFont);
        yPos.y -= 5;
        page.drawText("Seed Source Declaration Report", { x: margin, y: yPos.y, font: customBoldFont, size: 14});
        yPos.y -= 20;

        const tableHeaders = ["Crop", "Variety", "Supplier", "Purchase Date", "Organic Status", "Declaration"];
        const columnWidths = [100, 100, 100, 70, 90, 50]; // Sum: 510
        
        const tableData = reportData.map(item => [
            item.cropName,
            item.variety || '-',
            // item.seedBatchCode, // Removed Batch Code
            item.supplier || '-',
            item.purchaseDate || '-',
            item.organicStatus || '-',
            item.conformityDeclarationAvailable ? 'Yes' : 'No'
        ]);

        page = await drawPdfTable(pdfDoc, page, yPos, tableHeaders, tableData, columnWidths, { margin, font: customFont, boldFont: customBoldFont, fontSize: 7, headerFontSize: 8, lineHeight: 10 });
        
        const pdfBytes = await pdfDoc.save();
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        const dateStamp = new Date().toISOString().split('T')[0];
        const suggestedName = `reports/Hurvesthub_Seed_Source_Declaration_${dateStamp}.pdf`;

        if (typeof window.showSaveFilePicker === 'function') {
            try {
                const handle = await window.showSaveFilePicker({
                    suggestedName: suggestedName,
                    types: [{ description: 'PDF Files', accept: { 'application/pdf': ['.pdf'] } }],
                });
                const writable = await handle.createWritable();
                await writable.write(blob);
                await writable.close();
                console.log(`[exportSeedSourceDeclarationToPDF] File saved successfully via showSaveFilePicker: ${suggestedName}`);
            } catch (err: any) {
                if (err.name !== 'AbortError') {
                    console.error(`[exportSeedSourceDeclarationToPDF] Error saving file with File System Access API (${suggestedName}):`, err);
                    alert(`Error saving file: ${err.message}. File will be downloaded conventionally.`);
                    saveAs(blob, suggestedName);
                } else {
                    console.log(`[exportSeedSourceDeclarationToPDF] File save cancelled by user: ${suggestedName}`);
                }
            }
        } else {
            console.warn(`[exportSeedSourceDeclarationToPDF] File System Access API not supported. Using default download for: ${suggestedName}`);
            saveAs(blob, suggestedName);
        }
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
        const dateStamp = new Date().toISOString().split('T')[0];
        const suggestedName = `reports/Hurvesthub_Seed_Source_Declaration_${dateStamp}.csv`;

        if (typeof window.showSaveFilePicker === 'function') {
            try {
                const handle = await window.showSaveFilePicker({
                    suggestedName: suggestedName,
                    types: [{ description: 'CSV Files', accept: { 'text/csv': ['.csv'] } }],
                });
                const writable = await handle.createWritable();
                await writable.write(blob);
                await writable.close();
                console.log(`[exportSeedSourceDeclarationToCSV] File saved successfully via showSaveFilePicker: ${suggestedName}`);
            } catch (err: any) {
                if (err.name !== 'AbortError') {
                    console.error(`[exportSeedSourceDeclarationToCSV] Error saving file with File System Access API (${suggestedName}):`, err);
                    alert(`Error saving file: ${err.message}. File will be downloaded conventionally.`);
                    saveAs(blob, suggestedName);
                } else {
                    console.log(`[exportSeedSourceDeclarationToCSV] File save cancelled by user: ${suggestedName}`);
                }
            }
        } else {
            console.warn(`[exportSeedSourceDeclarationToCSV] File System Access API not supported. Using default download for: ${suggestedName}`);
            saveAs(blob, suggestedName);
        }
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
// --- Planting Log Reports ---

interface PlantingLogReportItem {
  plantingDate: string;
  cropName: string;
  cropVariety: string;
  sourceType: string; // e.g., "Seed Batch", "Purchased Seedling", "Self-Produced Seedling", "Direct Input"
  // sourceDetails: string; // Removed as per user request
  location: string;
  quantityPlanted: number;
  quantityUnit: string;
  expectedHarvestDate: string;
  status: string;
  notes?: string;
}

async function getCropDetailsForReport(
  log: PlantingLog,
  crops: Crop[],
  seedBatches: SeedBatch[],
  purchasedSeedlings: PurchasedSeedling[],
  seedlingProductionLogs: SeedlingProductionLog[]
): Promise<{ cropName: string; cropVariety: string; sourceType: string }> { // Removed sourceDetails
  const activeCrops = crops.filter(c => c.is_deleted !== 1);

  if (log.purchased_seedling_id) {
    const purchasedSeedling = purchasedSeedlings.find(ps => ps.id === log.purchased_seedling_id && ps.is_deleted !== 1);
    if (purchasedSeedling) {
      const crop = activeCrops.find(c => c.id === purchasedSeedling.crop_id);
      return {
        cropName: crop?.name || purchasedSeedling.name || 'Unknown Purchased Seedling',
        cropVariety: crop?.variety || 'N/A',
        sourceType: 'Purchased Seedling',
        // sourceDetails: purchasedSeedling.name || `ID: ${purchasedSeedling.id.substring(0,8)}`
      };
    }
  } else if (log.seedling_production_log_id) {
    const prodLog = seedlingProductionLogs.find(spl => spl.id === log.seedling_production_log_id && spl.is_deleted !== 1);
    if (prodLog) {
      const crop = activeCrops.find(c => c.id === prodLog.crop_id);
      let finalCropName = crop?.name;
      let finalCropVariety = crop?.variety;

      if (!finalCropName && prodLog.seed_batch_id) {
        const batch = seedBatches.find(b => b.id === prodLog.seed_batch_id && b.is_deleted !== 1);
        if (batch) {
          const batchCrop = activeCrops.find(c => c.id === batch.crop_id);
          finalCropName = batchCrop?.name;
          finalCropVariety = batchCrop?.variety;
        }
      }
      return {
        cropName: finalCropName || 'Unknown Self-Produced',
        cropVariety: finalCropVariety || 'N/A',
        sourceType: 'Self-Produced Seedling',
        // sourceDetails: `Sown: ${new Date(prodLog.sowing_date).toLocaleDateString()}${batchDetails}`
      };
    }
  } else if (log.seed_batch_id) {
    const batch = seedBatches.find(b => b.id === log.seed_batch_id && b.is_deleted !== 1);
    if (batch) {
      const crop = activeCrops.find(c => c.id === batch.crop_id);
      return {
        cropName: crop?.name || 'Unknown from Seed Batch',
        cropVariety: crop?.variety || 'N/A',
        sourceType: 'Seed Batch',
        // sourceDetails: `Batch: ${batch.batch_code}`
      };
    }
  } else if (log.input_inventory_id) { // Older direct input inventory plantings
    const invItem = await db.inputInventory.get(log.input_inventory_id); // Assuming direct fetch is okay here
    if (invItem && invItem.is_deleted !== 1) {
        const crop = invItem.crop_id ? activeCrops.find(c => c.id === invItem.crop_id) : null;
        return {
            cropName: crop?.name || invItem.name,
            cropVariety: crop?.variety || 'N/A',
            sourceType: 'Direct Input',
            // sourceDetails: invItem.name
        };
    }
  }
  return { cropName: 'N/A', cropVariety: 'N/A', sourceType: 'Unknown' }; // Removed sourceDetails
}


async function getAllPlantingLogsForReport(filters?: DateRangeFilters): Promise<PlantingLogReportItem[]> {
  let query = db.plantingLogs.filter(pl => pl.is_deleted !== 1);

  if (filters?.startDate) {
    const start = new Date(filters.startDate).toISOString().split('T')[0];
    query = query.and(pl => pl.planting_date >= start);
  }
  if (filters?.endDate) {
    const end = new Date(filters.endDate).toISOString().split('T')[0];
    query = query.and(pl => pl.planting_date <= end);
  }

  const plantingLogs = await query.sortBy('planting_date');

  const [crops, seedBatches, purchasedSeedlings, seedlingProductionLogs] = await Promise.all([
    db.crops.filter(c => c.is_deleted !== 1).toArray(),
    db.seedBatches.filter(sb => sb.is_deleted !== 1).toArray(),
    db.purchasedSeedlings.filter(ps => ps.is_deleted !== 1).toArray(),
    db.seedlingProductionLogs.filter(spl => spl.is_deleted !== 1).toArray()
  ]);

  const reportItems: PlantingLogReportItem[] = [];

  for (const log of plantingLogs) {
    const cropDetails = await getCropDetailsForReport(log, crops, seedBatches, purchasedSeedlings, seedlingProductionLogs);
    reportItems.push({
      plantingDate: formatDateToDDMMYYYY(log.planting_date),
      cropName: cropDetails.cropName,
      cropVariety: cropDetails.cropVariety,
      sourceType: cropDetails.sourceType,
      // sourceDetails: cropDetails.sourceDetails, // Removed
      location: log.location_description || 'N/A',
      quantityPlanted: log.quantity_planted,
      quantityUnit: log.quantity_unit || 'N/A',
      expectedHarvestDate: formatDateToDDMMYYYY(log.expected_harvest_date),
      status: log.status ? log.status.charAt(0).toUpperCase() + log.status.slice(1) : 'Active',
      notes: log.notes || '',
    });
  }
  return reportItems;
}
// Removing the duplicated exportPlantingLogsToPDF function.
// The original one should exist elsewhere or will be restored.

function convertPlantingLogsToCSV(data: PlantingLogReportItem[]): string {
  if (data.length === 0) return 'No planting log data available for the selected period.';
  const headers = [
    "Planting Date", "Crop Name", "Variety", "Source Type", // "Source Details" removed
    "Location", "Qty Planted", "Unit", "Expected Harvest", "Status", "Notes"
  ];
  const csvRows = [headers.join(',')];
  data.forEach(item => {
    const row = [
      `"${item.plantingDate}"`,
      `"${item.cropName.replace(/"/g, '""')}"`,
      `"${item.cropVariety.replace(/"/g, '""')}"`,
      `"${item.sourceType.replace(/"/g, '""')}"`,
      // `"${item.sourceDetails.replace(/"/g, '""')}"`, // Removed
      `"${item.location.replace(/"/g, '""')}"`,
      item.quantityPlanted,
      `"${item.quantityUnit.replace(/"/g, '""')}"`,
      `"${item.expectedHarvestDate}"`,
      `"${item.status.replace(/"/g, '""')}"`,
      `"${(item.notes || '').replace(/"/g, '""')}"`
    ];
    csvRows.push(row.join(','));
  });
  return csvRows.join('\\n');
}

export async function exportPlantingLogsToCSV(filters?: DateRangeFilters): Promise<void> {
  try {
    const reportData = await getAllPlantingLogsForReport(filters);
    const csvData = convertPlantingLogsToCSV(reportData);
    const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
    const now = new Date().toISOString().split('T')[0];
    saveAs(blob, `Hurvesthub_Planting_Logs_Report_${now}.csv`);
  } catch (error) {
    console.error("Error exporting planting logs to CSV:", error);
    alert("Failed to export planting logs to CSV. See console for details.");
  }
}

export async function exportPlantingLogsToPDF(filters?: DateRangeFilters): Promise<void> {
    try {
        const reportData = await getAllPlantingLogsForReport(filters);

        if (reportData.length === 0) {
            alert("No planting data found for the selected filters.");
            return;
        }

        const pdfDoc = await PDFDocument.create();
        await pdfDoc.registerFontkit(fontkit); // Moved up

        const fetchFont = async (url: string) => {
          const response = await fetch(url);
          if (!response.ok) {
            throw new Error(`Failed to fetch font: ${response.status} ${response.statusText} for ${url}`);
          }
          return response.arrayBuffer();
        };
        
        let mainFont: PDFFont;
        let boldFont: PDFFont;
        try {
            const fontBytes = await fetchFont('/fonts/static/NotoSans-Regular.ttf');
            const boldFontBytes = await fetchFont('/fonts/static/NotoSans-Bold.ttf');
            mainFont = await pdfDoc.embedFont(fontBytes);
            boldFont = await pdfDoc.embedFont(boldFontBytes);
        } catch (e) {
            console.error("Error embedding NotoSans font for Planting Logs PDF, falling back to Helvetica.", e);
            // Fallback to Helvetica if NotoSans fails (as it was doing)
            mainFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
            boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
        }
        
        let page = pdfDoc.addPage([612, 792]); // Standard US Letter
        const { width, height } = page.getSize();
        const marginProperty = 40; // Renamed to avoid conflict
        const yPos = { y: height - marginProperty };

        await addPdfHeader(pdfDoc, page, yPos, mainFont, boldFont);
        
        page.drawText('Planting Logs Report', {
            x: marginProperty,
            y: yPos.y,
            font: boldFont,
            size: 18,
            color: rgb(0.1, 0.1, 0.1)
        });
        yPos.y -= (18 * 1.2 + 15);

        if (filters?.startDate || filters?.endDate) {
            let dateRangeText = 'Date Range: ';
            if (filters.startDate) dateRangeText += `${new Date(filters.startDate).toLocaleDateString()}`;
            dateRangeText += (filters.startDate && filters.endDate) ? ' - ' : '';
            if (filters.endDate) dateRangeText += `${new Date(filters.endDate).toLocaleDateString()}`;
            page.drawText(dateRangeText, { x: marginProperty, y: yPos.y, font: mainFont, size: 10, color: rgb(0.3, 0.3, 0.3) });
            yPos.y -= 20;
        }

        const tableHeaders = ["Date", "Crop", "Variety", "Source", "Location", "Qty", "Unit", "Exp. Harvest", "Status"];
        const columnWidths = [60, 100, 80, 70, 100, 40, 40, 70, 60];
        
        const tableData = reportData.map(item => [
            item.plantingDate,
            item.cropName,
            item.cropVariety,
            item.sourceType,
            item.location,
            item.quantityPlanted.toString(),
            item.quantityUnit,
            item.expectedHarvestDate,
            item.status
        ]);

        await drawPdfTable(pdfDoc, page, yPos, tableHeaders, tableData, columnWidths, {
            font: mainFont,
            boldFont: boldFont,
            fontSize: 8,
            headerFontSize: 9,
            lineHeight: 12,
            margin: marginProperty, // Use renamed variable
            pageBottomMargin: marginProperty + 20
        });
        
        const pdfBytes = await pdfDoc.save();
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        const fileName = `Hurvesthub_Planting_Logs_Report_${new Date().toISOString().split('T')[0]}.pdf`;

        if (typeof window.showSaveFilePicker === 'function') {
            try {
                const handle = await window.showSaveFilePicker({ suggestedName: fileName, types: [{ description: 'PDF Files', accept: { 'application/pdf': ['.pdf'] } }] });
                const writable = await handle.createWritable();
                await writable.write(blob);
                await writable.close();
            } catch (err: any) {
                if (err.name !== 'AbortError') {
                    console.error("Error saving Planting Logs PDF with File System Access API:", err);
                    saveAs(blob, fileName); // Fallback
                }
            }
        } else {
            saveAs(blob, fileName);
        }
    } catch (error) {
        console.error("Error exporting Planting Logs to PDF:", error);
        alert("Failed to export Planting Logs to PDF. See console for details.");
    }
}
// Ensuring everything after the correct exportPlantingLogsToPDF is cleared before Statement of Account insertion.
// --- Statement of Account ---

export interface StatementTransaction {
  date: string;
  type: 'invoice' | 'payment' | 'refund' | 'adjustment';
  description: string;
  notes?: string; // Added for invoice notes
  debit: number;
  credit: number;
  balance: number;
}

export interface StatementOfAccountReportData {
  customer: Customer;
  startDate?: string | null;
  endDate?: string | null;
  openingBalance: number;
  transactions: StatementTransaction[];
  closingBalance: number;
}

export interface StatementOfAccountFilters extends DateRangeFilters {
  customerId: string;
}

async function getStatementOfAccountData(
  filters: StatementOfAccountFilters
): Promise<StatementOfAccountReportData | null> {
  const customer = await db.customers.get(filters.customerId);
  if (!customer) {
    console.error(`Customer with ID ${filters.customerId} not found.`);
    return null;
  }

  let salesQuery = db.sales
    .where('customer_id').equals(filters.customerId)
    .and(s => s.is_deleted !== 1);

  if (filters.startDate) {
    salesQuery = salesQuery.and(s => s.sale_date >= filters.startDate!);
  }
  if (filters.endDate) {
    salesQuery = salesQuery.and(s => s.sale_date <= filters.endDate!);
  }

  const salesForCustomer = await salesQuery.sortBy('sale_date');
  const invoicesForCustomer = await db.invoices
    .where('sale_id').anyOf(salesForCustomer.map(s => s.id))
    .and(inv => inv.is_deleted !== 1)
    .toArray();
  const invoiceMap = new Map(invoicesForCustomer.map(inv => [inv.sale_id, inv]));

  const transactions: StatementTransaction[] = [];
  let runningBalance = 0;

  for (const sale of salesForCustomer) {
    const invoice = invoiceMap.get(sale.id);
    const invoiceNumber = invoice?.invoice_number || `Sale ${sale.id.substring(0, 8)}`;
    const invoiceAmount = sale.total_amount || 0;

    transactions.push({
      date: sale.sale_date,
      type: 'invoice',
      description: `Invoice ${invoiceNumber}`,
      notes: sale.notes || undefined, // Add sale.notes here
      debit: invoiceAmount,
      credit: 0,
      balance: 0,
    });

    let initialPaymentCoveredByHistory = false;
    if (sale.payment_history && sale.payment_history.length > 0) {
        const firstPayment = sale.payment_history[0];
        if (firstPayment.date === sale.sale_date && 
            firstPayment.amount === sale.amount_paid &&
            firstPayment.method === sale.payment_method) {
            initialPaymentCoveredByHistory = true;
        }
    }

    if (sale.amount_paid && sale.amount_paid > 0 && !initialPaymentCoveredByHistory) {
        transactions.push({
            date: sale.sale_date,
            type: 'payment',
            description: `Initial Payment for ${invoiceNumber}`,
            debit: 0,
            credit: sale.amount_paid,
            balance: 0,
        });
    }

    if (sale.payment_history) {
      for (const payment of sale.payment_history) {
        if (initialPaymentCoveredByHistory && 
            payment.date === sale.sale_date && 
            payment.amount === sale.amount_paid &&
            payment.method === sale.payment_method &&
            sale.payment_history.indexOf(payment) === 0) {
            continue; 
        }
        transactions.push({
          date: payment.date,
          type: 'payment',
          description: `Payment (Method: ${payment.method || 'N/A'}${payment.notes ? ` - ${payment.notes}` : ''})`,
          debit: 0,
          credit: payment.amount,
          balance: 0,
        });
      }
    }
  }

  transactions.sort((a, b) => {
    const dateComparison = new Date(a.date).getTime() - new Date(b.date).getTime();
    if (dateComparison !== 0) return dateComparison;
    if (a.type === 'invoice' && b.type !== 'invoice') return -1;
    if (a.type !== 'invoice' && b.type === 'invoice') return 1;
    return 0;
  });

  transactions.forEach(tx => {
    runningBalance += tx.debit;
    runningBalance -= tx.credit;
    tx.balance = runningBalance;
  });

  return {
    customer,
    startDate: filters.startDate,
    endDate: filters.endDate,
    openingBalance: 0, 
    transactions,
    closingBalance: runningBalance,
  };
}

export async function exportStatementOfAccountToPDF(filters: StatementOfAccountFilters): Promise<void> {
  try { // Main try block for the PDF export function
    const reportData = await getStatementOfAccountData(filters);

    if (!reportData) {
      alert("Could not generate statement data. Customer not found or other error.");
      return;
    }

    const pdfDoc = await PDFDocument.create();
    await pdfDoc.registerFontkit(fontkit); // Moved up

    const fetchFont = async (url: string) => {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch font: ${response.status} ${response.statusText} for ${url}`);
      }
      return response.arrayBuffer();
    };

    let mainFont: PDFFont;
    let boldFont: PDFFont;
    try {
        const fontBytes = await fetchFont('/fonts/static/NotoSans-Regular.ttf');
        const boldFontBytes = await fetchFont('/fonts/static/NotoSans-Bold.ttf');
        mainFont = await pdfDoc.embedFont(fontBytes);
        boldFont = await pdfDoc.embedFont(boldFontBytes);
    } catch (e) {
        console.error("Error embedding NotoSans font for Statement, falling back to Helvetica.", e);
        mainFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
        boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    }
    
    let page = pdfDoc.addPage([612, 792]);

    const { width, height } = page.getSize();
    const margin = 40;
    let y = height - margin; 
    const yPos = { y: height - margin }; 

    await addPdfHeader(pdfDoc, page, yPos, mainFont, boldFont);
    y = yPos.y; 

    page.drawText('Statement of Account', {
      x: margin,
      y: y - 14, 
      font: boldFont,
      size: 18,
    });
    y -= (14 * 2);

    page.drawText(`Customer: ${reportData.customer.name}`, { x: margin, y, font: boldFont, size: 12 });
    y -= 14;
    if (reportData.customer.contact_info) {
      page.drawText(`Contact: ${reportData.customer.contact_info}`, { x: margin, y, font: mainFont, size: 10 });
      y -= 12;
    }
    if (reportData.customer.address) {
      reportData.customer.address.split('\\n').forEach(line => {
          page.drawText(line, { x: margin, y, font: mainFont, size: 10 });
          y -= 12;
      });
    }
    y -= 14;
  
    const dateRangeText = `Statement Period: ${reportData.startDate ? formatDateToDDMMYYYY(reportData.startDate) : 'Beginning of records'} - ${reportData.endDate ? formatDateToDDMMYYYY(reportData.endDate) : 'End of records'}`;
    page.drawText(dateRangeText, { x: margin, y, font: mainFont, size: 10 });
    y -= (14 * 1.5);
    
    page.drawText(`Opening Balance: €${reportData.openingBalance.toFixed(2)}`, { x: width - margin - 150, y, font: boldFont, size: 10 });
    y -= (14 * 1.5);

    const tableTopY = y;
    const colWidths = [70, 150, 100, 60, 60, 70]; // Date, Description, Notes, Debit, Credit, Balance - Adjusted widths
    const headers = ['Date', 'Description', 'Notes', 'Debit (€)', 'Credit (€)', 'Balance (€)'];
    let currentX = margin;
    headers.forEach((header, i) => {
      const headerWidth = boldFont.widthOfTextAtSize(header, 9);
      let headerX;
      // Indices: 0:Date, 1:Description, 2:Notes, 3:Debit, 4:Credit, 5:Balance
      if (i === 0 || i === 1) { // Left-align Date, Description
        headerX = currentX + 2;
      } else if (i === 2) { // Center Notes
        headerX = currentX + (colWidths[i] - headerWidth) / 2;
      } else { // Right-align Debit, Credit, Balance headers
        headerX = currentX + colWidths[i] - headerWidth - 2;
      }
      page.drawText(header, { x: headerX, y: tableTopY, font: boldFont, size: 9 });
      currentX += colWidths[i];
    });
    y -= (14 * 1.5);

    for (const tx of reportData.transactions) {
      if (y < margin + 40) { 
          page = pdfDoc.addPage([612, 792]);
          yPos.y = height - margin; 
          await addPdfHeader(pdfDoc, page, yPos, mainFont, boldFont);
          y = yPos.y; 
          currentX = margin;
          headers.forEach((header, i) => {
            const headerWidth = boldFont.widthOfTextAtSize(header, 9);
            let headerX;
            // Indices: 0:Date, 1:Description, 2:Notes, 3:Debit, 4:Credit, 5:Balance
            if (i === 0 || i === 1) { // Left-align Date, Description
              headerX = currentX + 2; // Small left padding
            } else if (i === 2) { // Center Notes header
              headerX = currentX + (colWidths[i] - headerWidth) / 2;
            } else { // Explicitly Right-align Debit, Credit, Balance headers
              headerX = (currentX + colWidths[i]) - headerWidth - 2; // -2 for slight padding from right edge
            }
            page.drawText(header, { x: headerX, y: y, font: boldFont, size: 9 });
            currentX += colWidths[i];
          });
          y -= (14 * 1.5);
      }

      currentX = margin;
      // Truncate notes if they are too long for the column
      const maxNoteLength = 25; // Adjust as needed
      let displayNote = tx.notes || '';
      if (displayNote.length > maxNoteLength) {
        displayNote = displayNote.substring(0, maxNoteLength - 3) + '...';
      }

      const rowData = [
        formatDateToDDMMYYYY(tx.date),
        tx.description,
        displayNote, // Added notes
        tx.debit > 0 ? tx.debit.toFixed(2) : '-',
        tx.credit > 0 ? tx.credit.toFixed(2) : '-',
        tx.balance.toFixed(2),
      ];
      
      rowData.forEach((cell, i) => {
          const textWidth = mainFont.widthOfTextAtSize(cell, 8);
          let cellX;
          // Indices: 0:Date, 1:Description, 2:Notes, 3:Debit, 4:Credit, 5:Balance
          if (i === 0 || i === 1) { // Left-align Date, Description
            cellX = currentX + 2;
          } else if (i === 2) { // Center Notes data
            cellX = currentX + (colWidths[i] - textWidth) / 2;
          } else { // Right-align Debit, Credit, Balance data
            cellX = currentX + colWidths[i] - textWidth - 2;
          }
          page.drawText(cell, { x: cellX, y, font: mainFont, size: 8 });
          currentX += colWidths[i];
      });
      y -= 14;
    }
    
    y -= 12; 
    page.drawLine({start: {x: margin, y:y}, end: {x: width - margin, y:y}, thickness:0.5, color: rgb(0.7,0.7,0.7)});
    y -= 14;
    const closingBalanceText = `Closing Balance: €${reportData.closingBalance.toFixed(2)}`;
    page.drawText(closingBalanceText, { 
      x: width - margin - boldFont.widthOfTextAtSize(closingBalanceText, 12), 
      y, 
      font: boldFont, 
      size: 12 
    });

    const pdfBytes = await pdfDoc.save();
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    const customerNameSafe = reportData.customer.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const fileName = `Statement_${customerNameSafe}_${new Date().toISOString().split('T')[0]}.pdf`;

    if (typeof window.showSaveFilePicker === 'function') {
      try {
        const handle = await window.showSaveFilePicker({ suggestedName: fileName, types: [{ description: 'PDF Files', accept: { 'application/pdf': ['.pdf'] } }] });
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          console.error("Error saving Statement PDF with File System Access API:", err);
          try {
            saveAs(blob, fileName);
          } catch (saveAsErr) {
            console.error('Error during saveAs fallback for Statement PDF:', saveAsErr);
            alert('Failed to save Statement PDF using fallback. Check console.');
          }
        }
      }
    } else {
      try {
        saveAs(blob, fileName);
      } catch (saveAsErr) {
        console.error('Error during saveAs for Statement PDF:', saveAsErr);
        alert('Failed to save Statement PDF. Check console.');
      }
    }
  } catch (error) { // Catch for the main try block
    console.error("Error exporting Statement of Account to PDF:", error);
    alert("Failed to export Statement of Account. See console for details.");
  }
}
// --- General Expenses Report ---

// Interface for the report items
export interface GeneralExpenseReportItem {
  id: string;
  serviceType: string;
  category?: string;
  provider?: string;
  billDate: string; // DD/MM/YYYY
  dueDate: string; // DD/MM/YYYY
  amount: number;
  paymentStatus: string;
  paymentDate?: string; // DD/MM/YYYY
  paymentAmount?: number;
  referenceNumber?: string;
  notes?: string;
  lastModified: string;
}

// Interface for filtering general expense reports
export interface GeneralExpenseReportFilters extends DateRangeFilters {
  serviceType?: 'WATER' | 'ELECTRICITY' | 'TELEPHONE' | 'FIELD_TAXES' | 'INTERNET' | 'VEHICLE_MAINTENANCE' | 'OTHER' | 'ALL';
  category?: string;
  paymentStatus?: 'UNPAID' | 'PAID' | 'PARTIALLY_PAID' | 'ALL';
}

// Function to fetch all general expenses for reporting
export async function getAllGeneralExpensesForReport(
  filters: GeneralExpenseReportFilters
): Promise<GeneralExpenseReportItem[]> {
  console.log('Fetching general expenses for report with filters:', JSON.stringify(filters));
  let query = db.general_expenses.filter(exp => exp.is_deleted !== 1);

  // Date range filtering (using bill_date)
  if (filters.startDate) {
    const start = new Date(filters.startDate).toISOString().split('T')[0];
    query = query.and(exp => exp.bill_date >= start);
  }
  if (filters.endDate) {
    const end = new Date(filters.endDate).toISOString().split('T')[0];
    query = query.and(exp => exp.bill_date <= end);
  }

  // Service Type filtering
  if (filters.serviceType && filters.serviceType !== 'ALL') {
    query = query.and(exp => exp.service_type === filters.serviceType);
  }

  // Category filtering
  if (filters.category && filters.category.trim() !== '') {
    const categoryLower = filters.category.toLowerCase();
    // Ensure exp.category is treated as a string before calling toLowerCase
    query = query.and(exp => !!exp.category && exp.category.toLowerCase().includes(categoryLower));
  }
  
  // Payment Status filtering
  if (filters.paymentStatus && filters.paymentStatus !== 'ALL') {
     query = query.and(exp => exp.payment_status === filters.paymentStatus);
  }

  const expenses = await query.toArray();

  return expenses.map(exp => ({
    id: exp.id,
    serviceType: exp.service_type.replace(/_/g, ' '),
    category: exp.category || 'N/A',
    provider: exp.provider || 'N/A',
    billDate: formatDateToDDMMYYYY(exp.bill_date),
    dueDate: formatDateToDDMMYYYY(exp.due_date),
    amount: exp.amount,
    paymentStatus: exp.payment_status.replace(/_/g, ' '),
    paymentDate: exp.payment_date ? formatDateToDDMMYYYY(exp.payment_date) : 'N/A',
    paymentAmount: exp.payment_amount === undefined || exp.payment_amount === null ? undefined : exp.payment_amount,
    referenceNumber: exp.reference_number || 'N/A',
    notes: exp.notes || '',
    lastModified: exp._last_modified ? new Date(exp._last_modified).toLocaleString() : (exp.updated_at ? new Date(exp.updated_at).toLocaleString() : '')
  })).sort((a, b) => {
    // Convert DD/MM/YYYY to YYYY-MM-DD for correct date sorting
    const dateA = new Date(a.billDate.split('/').reverse().join('-')).getTime();
    const dateB = new Date(b.billDate.split('/').reverse().join('-')).getTime();
    return dateB - dateA; // Sort by bill date descending
  });
}
// Function to convert general expenses data to CSV format
function convertGeneralExpensesToCSV(data: GeneralExpenseReportItem[]): string {
  if (data.length === 0) return '';
  const headers = [
    "ID", "Service Type", "Category", "Provider", "Bill Date", "Due Date", 
    "Amount", "Payment Status", "Payment Date", "Payment Amount", 
    "Reference Number", "Notes", "Last Modified"
  ];
  const csvRows = [headers.join(',')];

  data.forEach(item => {
    const row = [
      `"${item.id}"`,
      `"${item.serviceType}"`,
      `"${item.category || ''}"`,
      `"${item.provider || ''}"`,
      `"${item.billDate}"`,
      `"${item.dueDate}"`,
      item.amount,
      `"${item.paymentStatus}"`,
      `"${item.paymentDate || ''}"`,
      item.paymentAmount === undefined || item.paymentAmount === null ? '' : item.paymentAmount,
      `"${item.referenceNumber || ''}"`,
      `"${(item.notes || '').replace(/"/g, '""')}"`, // Escape double quotes in notes
      `"${item.lastModified}"`
    ];
    csvRows.push(row.join(','));
  });
  return csvRows.join('\\n');
}

// Function to trigger CSV download for general expenses
export async function exportGeneralExpensesToCSV(filters: GeneralExpenseReportFilters): Promise<void> {
  try {
    console.log("Fetching general expense data for CSV export with filters:", filters);
    const reportData = await getAllGeneralExpensesForReport(filters);
    if (reportData.length === 0) {
      alert("No general expense data available for the selected filters.");
      return;
    }
    console.log(`Fetched ${reportData.length} general expenses for CSV report.`);
    
    const csvData = convertGeneralExpensesToCSV(reportData);
    const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
    
    const now = new Date();
    const dateStamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const suggestedName = `reports/Hurvesthub_GeneralExpenses_Report_${dateStamp}.csv`;
    
    if (typeof window.showSaveFilePicker === 'function') {
      try {
        const handle = await window.showSaveFilePicker({
          suggestedName: suggestedName,
          types: [{ description: 'CSV files', accept: { 'text/csv': ['.csv'] } }],
        });
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
        console.log('General expenses CSV file saved successfully using File System Access API.');
      } catch (err: any) {
        if (err.name === 'AbortError') {
          console.log('File save aborted by user.');
        } else {
          console.error('Error saving file with File System Access API, falling back to saveAs:', err);
          saveAs(blob, suggestedName);
        }
      }
    } else {
      saveAs(blob, suggestedName);
      console.log('General expenses CSV file saved using saveAs fallback.');
    }
  } catch (error) {
    console.error('Error exporting general expenses to CSV:', error);
    alert('Failed to export general expenses to CSV. Check console for details.');
  }
}

// Function to trigger PDF download for general expenses
export async function exportGeneralExpensesToPDF(filters: GeneralExpenseReportFilters): Promise<void> {
  try {
    console.log("Fetching general expense data for PDF export with filters:", filters);
    const reportData = await getAllGeneralExpensesForReport(filters);

    if (reportData.length === 0) {
      alert("No general expense data available for the selected filters.");
      return;
    }
    console.log(`Fetched ${reportData.length} general expenses for PDF report.`);

    const pdfDoc = await PDFDocument.create();
    await pdfDoc.registerFontkit(fontkit);

    const fetchFont = async (url: string) => {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch font: ${response.status} ${response.statusText} for ${url}`);
      }
      return response.arrayBuffer();
    };

    const fontBytes = await fetchFont("/fonts/static/NotoSans-Regular.ttf");
    const boldFontBytes = await fetchFont("/fonts/static/NotoSans-Bold.ttf");
    const mainFont = await pdfDoc.embedFont(fontBytes);
    const boldFont = await pdfDoc.embedFont(boldFontBytes);
    
    let page = pdfDoc.addPage();
    let yPos = { y: page.getHeight() - 50 };

    await addPdfHeader(pdfDoc, page, yPos, mainFont, boldFont);
    
    page.drawText('General Expenses Report', {
      x: 50,
      y: yPos.y,
      size: 18,
      font: boldFont,
      color: rgb(0.1, 0.1, 0.1),
    });
    yPos.y -= 25;

    const filterDescriptions = [
      filters.startDate && `From: ${formatDateToDDMMYYYY(filters.startDate)}`,
      filters.endDate && `To: ${formatDateToDDMMYYYY(filters.endDate)}`,
      filters.serviceType && filters.serviceType !== 'ALL' && `Service: ${filters.serviceType.replace(/_/g, ' ')}`,
      filters.category && `Category: ${filters.category}`,
      filters.paymentStatus && filters.paymentStatus !== 'ALL' && `Status: ${filters.paymentStatus.replace(/_/g, ' ')}`,
    ].filter(Boolean).join(' | ');

    if (filterDescriptions) {
        page.drawText(`Filters: ${filterDescriptions}`, {
            x: 50,
            y: yPos.y,
            size: 9,
            font: mainFont,
            color: rgb(0.3, 0.3, 0.3),
        });
        yPos.y -= 15;
    }
    
    const tableHeaders = ["Bill Date", "Service", "Category", "Provider", "Amount (€)", "Due Date", "Status", "Paid Date", "Paid Amt (€)"];
    const columnWidths = [55, 60, 55, 60, 60, 55, 50, 55, 50]; // Adjusted for Amount/Due Date header

    const tableData = reportData.map(item => [
      item.billDate,
      item.serviceType,
      item.category || 'N/A',
      item.provider || 'N/A',
      item.amount.toFixed(2),
      item.dueDate,
      item.paymentStatus,
      item.paymentDate || 'N/A',
      item.paymentAmount === undefined || item.paymentAmount === null ? 'N/A' : item.paymentAmount.toFixed(2)
    ]);

    page = await drawPdfTable(pdfDoc, page, yPos, tableHeaders, tableData, columnWidths, { font: mainFont, boldFont: boldFont, fontSize: 8, headerFontSize: 10 });

    const pdfBytes = await pdfDoc.save();
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });

    const now = new Date();
    const dateStamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const suggestedName = `reports/Hurvesthub_GeneralExpenses_Report_${dateStamp}.pdf`;

    if (typeof window.showSaveFilePicker === 'function') {
      try {
        const handle = await window.showSaveFilePicker({
          suggestedName: suggestedName,
          types: [{ description: 'PDF files', accept: { 'application/pdf': ['.pdf'] } }],
        });
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
        console.log('General expenses PDF file saved successfully using File System Access API.');
      } catch (err: any) {
        if (err.name === 'AbortError') {
          console.log('File save aborted by user.');
        } else {
          console.error('Error saving PDF file with File System Access API, falling back to saveAs:', err);
          try {
            saveAs(blob, suggestedName);
          } catch (saveAsErr) {
            console.error('Error during saveAs fallback for PDF:', saveAsErr);
            alert('Failed to save PDF using fallback. Check console.');
          }
        }
      }
    } else {
      try {
        saveAs(blob, suggestedName);
        console.log('General expenses PDF file saved using saveAs fallback.');
      } catch (saveAsErr) {
        console.error('Error during saveAs for PDF:', saveAsErr);
        alert('Failed to save PDF. Check console.');
      }
    }

  } catch (error) {
    console.error('Error exporting general expenses to PDF:', error);
    alert('Failed to export general expenses to PDF. Check console for details.');
  }
}
// --- Crop Performance Report ---

export interface CropPerformanceReportItem {
  cropId: string;
  cropName: string;
  totalPlanted: number;
  totalProduction: number;
  totalSales: number;
  difference: number;
  // Consider adding a 'unitNotes' field if units are mixed, e.g., "kg / pieces"
}

export interface CropPerformanceReportFilters extends DateRangeFilters {
  // No crop-specific filters for now, but could be added later (e.g., select specific crops)
}

export async function getCropPerformanceReportData(
  filters: CropPerformanceReportFilters
): Promise<CropPerformanceReportItem[]> {
  console.log('Fetching crop performance data with filters:', JSON.stringify(filters));

  const { startDate, endDate } = filters;

  // 1. Fetch Base Data
  const allCrops = await db.crops.filter(c => c.is_deleted !== 1).toArray();
  
  let plantingLogsQuery = db.plantingLogs.filter(pl => pl.is_deleted !== 1);
  if (startDate) plantingLogsQuery = plantingLogsQuery.and(pl => pl.planting_date >= startDate);
  if (endDate) plantingLogsQuery = plantingLogsQuery.and(pl => pl.planting_date <= endDate);
  const relevantPlantingLogs = await plantingLogsQuery.toArray();

  let harvestLogsQuery = db.harvestLogs.filter(hl => hl.is_deleted !== 1);
  if (startDate) harvestLogsQuery = harvestLogsQuery.and(hl => hl.harvest_date >= startDate);
  if (endDate) harvestLogsQuery = harvestLogsQuery.and(hl => hl.harvest_date <= endDate);
  const relevantHarvestLogs = await harvestLogsQuery.toArray();

  let salesQuery = db.sales.filter(s => s.is_deleted !== 1);
  if (startDate) salesQuery = salesQuery.and(s => s.sale_date >= startDate);
  if (endDate) salesQuery = salesQuery.and(s => s.sale_date <= endDate);
  const relevantSales = await salesQuery.toArray();
  const relevantSaleIds = relevantSales.map(s => s.id);

  const relevantSaleItems = await db.saleItems
    .where('sale_id').anyOf(relevantSaleIds)
    .and(si => si.is_deleted !== 1)
    .toArray();

  // Supporting tables for linking (fetch all non-deleted for simplicity in linking)
  const seedBatches = await db.seedBatches.filter(sb => sb.is_deleted !== 1).toArray();
  const seedlingProductionLogs = await db.seedlingProductionLogs.filter(sl => sl.is_deleted !== 1).toArray();
  const purchasedSeedlings = await db.purchasedSeedlings.filter(ps => ps.is_deleted !== 1).toArray();
  const inputInventoryItems = await db.inputInventory.filter(ii => ii.is_deleted !== 1).toArray(); // Renamed to avoid conflict
  const trees = await db.trees.filter(t => t.is_deleted !== 1).toArray();

  // 2. Create Maps
  const seedBatchesMap = new Map(seedBatches.map(sb => [sb.id, sb]));
  const seedlingLogsMap = new Map(seedlingProductionLogs.map(sl => [sl.id, sl]));
  const purchasedSeedlingsMap = new Map(purchasedSeedlings.map(ps => [ps.id, ps]));
  const inputInventoryMap = new Map(inputInventoryItems.map(ii => [ii.id, ii]));
  const treesMap = new Map(trees.map(t => [t.id, t]));
  const cropsMap = new Map(allCrops.map(c => [c.id, c]));

  const reportItems: CropPerformanceReportItem[] = [];

  // Helper to get crop_id from a plantingLog
  const getCropIdForPlantingLog = (pl: PlantingLog): string | undefined => {
    if (pl.seed_batch_id) return seedBatchesMap.get(pl.seed_batch_id)?.crop_id;
    if (pl.seedling_production_log_id) return seedlingLogsMap.get(pl.seedling_production_log_id)?.crop_id;
    if (pl.purchased_seedling_id) {
      const purchasedSeedling = purchasedSeedlingsMap.get(pl.purchased_seedling_id);
      return purchasedSeedling?.crop_id;
    }
    if (pl.input_inventory_id) return inputInventoryMap.get(pl.input_inventory_id)?.crop_id;
    return undefined;
  };
  
  // Group planting logs by crop_id
  const plantingLogsByCrop = new Map<string, PlantingLog[]>();
  for (const pl of relevantPlantingLogs) {
    const cropId = getCropIdForPlantingLog(pl);
    if (cropId) {
      if (!plantingLogsByCrop.has(cropId)) {
        plantingLogsByCrop.set(cropId, []);
      }
      plantingLogsByCrop.get(cropId)!.push(pl);
    }
  }

  // Group harvest logs by crop_id (more complex due to tree_id or planting_log_id)
  const harvestLogsByCrop = new Map<string, HarvestLog[]>();
  for (const hl of relevantHarvestLogs) {
    let cropId: string | undefined;
    if (hl.tree_id) {
      const tree = treesMap.get(hl.tree_id);
      // For trees, we might use the tree.id itself as a proxy for a "crop" if no direct crop_id link exists
      // Or, if trees are meant to be linked to a Crop entry (e.g. "Olive Tree" crop), that link needs to be established.
      // For this report, let's assume tree.identifier or species can map to a crop name.
      // We'll handle tree-based crops separately after iterating through standard crops.
    } else if (hl.planting_log_id) {
      const pl = await db.plantingLogs.get(hl.planting_log_id); // Fetch to ensure we have the full PL
      if (pl) cropId = getCropIdForPlantingLog(pl);
    }
    if (cropId) {
      if (!harvestLogsByCrop.has(cropId)) harvestLogsByCrop.set(cropId, []);
      harvestLogsByCrop.get(cropId)!.push(hl);
    }
  }
  
  // Group sale items by crop_id (via harvest_log -> planting_log -> crop associations)
  const saleItemsByCrop = new Map<string, SaleItem[]>();
  for (const si of relevantSaleItems) {
    if (si.harvest_log_id) {
      const hl = await db.harvestLogs.get(si.harvest_log_id); // Fetch full HL
      if (hl && hl.is_deleted !== 1) {
        let cropId: string | undefined;
        if (hl.planting_log_id) {
          const pl = await db.plantingLogs.get(hl.planting_log_id);
          if (pl) cropId = getCropIdForPlantingLog(pl);
        }
        // Tree-based sale item linking to crop would be more complex here
        // if not directly linked via a planting log that has a crop_id.
        if (cropId) {
          if (!saleItemsByCrop.has(cropId)) saleItemsByCrop.set(cropId, []);
          saleItemsByCrop.get(cropId)!.push(si);
        }
      }
    }
    // Note: Sales of items directly from input_inventory or purchased_seedlings not linked to a harvest_log
    // are not directly attributed to a "crop's production" in this report's context.
  }

  // 3. Iterate Through Crops
  for (const crop of allCrops) {
    const cropPlantingLogs = plantingLogsByCrop.get(crop.id) || [];

    const totalPlanted = cropPlantingLogs.reduce((sum, pl) => {
      return sum + pl.quantity_planted;
    }, 0);

    const cropHarvestLogs = harvestLogsByCrop.get(crop.id) || [];
    const totalProduction = cropHarvestLogs.reduce((sum, hl) => sum + hl.quantity_harvested, 0);
    
    const cropSaleItems = saleItemsByCrop.get(crop.id) || [];
    const totalSales = cropSaleItems.reduce((sum, si) => sum + si.quantity_sold, 0);

    reportItems.push({
      cropId: crop.id,
      cropName: crop.name + (crop.variety ? ` (${crop.variety})` : ''),
      totalPlanted,
      totalProduction,
      totalSales,
      difference: totalProduction - totalSales,
    });
  }
  
  // Handle Tree "Crops" - this is a simplification.
  // A more robust system might have a "Crop" entry for each tree type (e.g., "Olive Tree")
  // and HarvestLogs from trees would link to that Crop ID.
  // For now, we list trees as separate "crops" based on their identifier/species.
  const treeHarvestsMap = new Map<string, {production: number, sales: number, plantingLogs: PlantingLog[]}>();

  for (const hl of relevantHarvestLogs) {
    if (hl.tree_id) {
      const tree = treesMap.get(hl.tree_id);
      if (tree) {
        const treeCropName = tree.identifier || tree.species || `Tree ID: ${tree.id.substring(0,6)}`;
        if (!treeHarvestsMap.has(treeCropName)) {
          treeHarvestsMap.set(treeCropName, { production: 0, sales: 0, plantingLogs: [] });
        }
        treeHarvestsMap.get(treeCropName)!.production += hl.quantity_harvested;

        // Find sales for this tree harvest log
        const salesForThisTreeHarvest = relevantSaleItems.filter(si => si.harvest_log_id === hl.id);
        treeHarvestsMap.get(treeCropName)!.sales += salesForThisTreeHarvest.reduce((sum, si) => sum + si.quantity_sold, 0);
        // Note: "Total Planted" for trees is not directly applicable from PlantingLogs in the same way.
        // We could count trees if that's desired, or use their planting_date. For now, totalPlanted will be 0 for trees.
      }
    }
  }

  treeHarvestsMap.forEach((data, treeCropName) => {
    reportItems.push({
      cropId: `tree-${treeCropName}`, // Create a pseudo ID
      cropName: treeCropName,
      totalPlanted: 0, // Or count of trees, or some other metric
      totalProduction: data.production,
      totalSales: data.sales,
      difference: data.production - data.sales,
    });
  });


  return reportItems.sort((a,b) => a.cropName.localeCompare(b.cropName));
}

// CSV and PDF export functions for Crop Performance will be added here later.
// Function to convert crop performance data to CSV format
function convertCropPerformanceToCSV(data: CropPerformanceReportItem[]): string {
  if (data.length === 0) return '';
  const headers = [
    "Crop ID", "Crop Name", "Total Planted", "Total Production", 
    "Total Sales", "Difference (Prod - Sales)"
  ];
  const csvRows = [headers.join(',')];

  data.forEach(item => {
    const row = [
      `"${item.cropId}"`,
      `"${item.cropName.replace(/"/g, '""')}"`, // Escape double quotes in name
      item.totalPlanted,
      item.totalProduction,
      item.totalSales,
      item.difference
    ];
    csvRows.push(row.join(','));
  });
  return csvRows.join('\\n');
}

// Function to trigger CSV download for crop performance report
export async function exportCropPerformanceReportToCSV(filters: CropPerformanceReportFilters): Promise<void> {
  try {
    const reportData = await getCropPerformanceReportData(filters);
    if (reportData.length === 0) {
      alert("No data available for the selected filters.");
      return;
    }
    const csvData = convertCropPerformanceToCSV(reportData);
    const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
    const now = new Date();
    const dateStamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const suggestedName = `reports/Hurvesthub_CropPerformance_Report_${dateStamp}.csv`;

    if (typeof window.showSaveFilePicker === 'function') {
      try {
        const handle = await window.showSaveFilePicker({ suggestedName, types: [{ description: 'CSV files', accept: { 'text/csv': ['.csv'] } }] });
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          console.error('Error saving CSV with File System Access API, falling back:', err);
          try {
            saveAs(blob, suggestedName);
          } catch (saveAsErr) {
            console.error('Error during saveAs fallback for CSV:', saveAsErr);
            alert('Failed to save CSV using fallback. Check console.');
          }
        } else {
          console.log('CSV save aborted by user.');
        }
      }
    } else {
      try {
        saveAs(blob, suggestedName);
      } catch (saveAsErr) {
        console.error('Error during saveAs for CSV:', saveAsErr);
        alert('Failed to save CSV. Check console.');
      }
    }
  } catch (error) {
    console.error('Error exporting crop performance to CSV:', error);
    alert('Failed to export crop performance to CSV. Check console.');
  }
}

// Function to trigger PDF download for crop performance report
export async function exportCropPerformanceReportToPDF(filters: CropPerformanceReportFilters): Promise<void> {
  try {
    const reportData = await getCropPerformanceReportData(filters);
    if (reportData.length === 0) {
      alert("No data available for the selected filters.");
      return;
    }

    const pdfDoc = await PDFDocument.create();
    await pdfDoc.registerFontkit(fontkit);

    const fetchFont = async (url: string) => {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch font: ${response.status} ${response.statusText} for ${url}`);
      }
      return response.arrayBuffer();
    };

    const fontBytes = await fetchFont("/fonts/static/NotoSans-Regular.ttf");
    const boldFontBytes = await fetchFont("/fonts/static/NotoSans-Bold.ttf");
    const mainFont = await pdfDoc.embedFont(fontBytes);
    const boldFont = await pdfDoc.embedFont(boldFontBytes);
    
    let page = pdfDoc.addPage();
    let yPos = { y: page.getHeight() - 50 };

    await addPdfHeader(pdfDoc, page, yPos, mainFont, boldFont);
    
    page.drawText('Crop Performance Report', { x: 50, y: yPos.y, size: 18, font: boldFont, color: rgb(0.1, 0.1, 0.1) });
    yPos.y -= 25;

    const filterDescriptions = [
      filters.startDate && `From: ${formatDateToDDMMYYYY(filters.startDate)}`,
      filters.endDate && `To: ${formatDateToDDMMYYYY(filters.endDate)}`,
    ].filter(Boolean).join(' | ');

    if (filterDescriptions) {
        page.drawText(`Filters: ${filterDescriptions}`, { x: 50, y: yPos.y, size: 9, font: mainFont, color: rgb(0.3, 0.3, 0.3) });
        yPos.y -= 15;
    }
    
    const tableHeaders = ["Crop Name", "Total Planted", "Total Production", "Total Sales", "Difference"];
    // Approximate widths, adjust as needed. Total should be around 500-515 for A4 portrait with margins.
    const columnWidths = [150, 80, 90, 80, 80]; 

    const tableData = reportData.map(item => [
      item.cropName,
      item.totalPlanted.toString(),
      item.totalProduction.toString(),
      item.totalSales.toString(),
      item.difference.toString()
    ]);

    page = await drawPdfTable(pdfDoc, page, yPos, tableHeaders, tableData, columnWidths, { font: mainFont, boldFont: boldFont, fontSize: 8, headerFontSize: 10 });

    const pdfBytes = await pdfDoc.save();
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    const now = new Date();
    const dateStamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const suggestedName = `reports/Hurvesthub_CropPerformance_Report_${dateStamp}.pdf`;

    if (typeof window.showSaveFilePicker === 'function') {
      try {
        const handle = await window.showSaveFilePicker({ suggestedName, types: [{ description: 'PDF files', accept: { 'application/pdf': ['.pdf'] } }] });
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          console.error('Error saving PDF with File System Access API, falling back:', err);
          try {
            saveAs(blob, suggestedName);
          } catch (saveAsErr) {
            console.error('Error during saveAs fallback for PDF:', saveAsErr);
            alert('Failed to save PDF using fallback. Check console.');
          }
        } else {
          console.log('PDF save aborted by user.');
        }
      }
    } else {
      try {
        saveAs(blob, suggestedName);
      } catch (saveAsErr) {
        console.error('Error during saveAs for PDF:', saveAsErr);
        alert('Failed to save PDF. Check console.');
      }
    }
  } catch (error) {
    console.error('Error exporting crop performance to PDF:', error);
    alert('Failed to export crop performance to PDF. Check console.');
  }
}