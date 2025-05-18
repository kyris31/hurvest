import Dexie, { Table } from 'dexie';

// Define interfaces for our data structures, mirroring Supabase tables
// These should ideally be generated from your Supabase schema or shared types

export interface Crop {
  id: string; // UUID
  name: string;
  variety?: string;
  type?: string; // Category like Fruit, Vegetable
  notes?: string; // Added notes for Crop
  created_at?: string; // ISOString
  updated_at?: string; // ISOString
  _synced?: number; // 0 for false, 1 for true
  _last_modified?: number; // Timestamp for local changes
  is_deleted?: number; // 0 for false, 1 for true
  deleted_at?: string; // ISOString
}

export interface SeedBatch {
  id: string; // UUID
  crop_id: string; // Foreign key to Crop
  batch_code: string;
  // variety?: string; // Removed: Variety is now part of the Crop entity
  supplier?: string;
  purchase_date?: string; // ISOString (Date)
  initial_quantity?: number;
  current_quantity?: number; // Added to track available quantity
  quantity_unit?: string; // e.g., 'seeds', 'grams', 'kg'
  estimated_seeds_per_sowing_unit?: number; // e.g., if unit is 'grams', this is seeds/gram. Optional.
  total_purchase_cost?: number; // Cost for the initial quantity of the seed batch
  organic_status?: string; // e.g., "Certified Organic", "Untreated", "Conventional"
  notes?: string;
  qr_code_data?: string; // For storing QR code content/identifier
  created_at?: string; // ISOString
  updated_at?: string; // ISOString
  _synced?: number; // 0 for false, 1 for true
  _last_modified?: number;
  is_deleted?: number;
  deleted_at?: string;
}

export interface InputInventory {
  id: string; // UUID
  name: string;
  type?: string;
  supplier?: string;
  supplier_invoice_number?: string; // New field
  purchase_date?: string; // ISOString (Date)
  initial_quantity?: number;
  current_quantity?: number;
  quantity_unit?: string;
  total_purchase_cost?: number; // Renamed from cost_per_unit
  notes?: string;
  qr_code_data?: string; // For storing QR code content/identifier
  created_at?: string; // ISOString
  updated_at?: string; // ISOString
  _synced?: number; // 0 for false, 1 for true
  _last_modified?: number;
  is_deleted?: number;
  deleted_at?: string;
}

export interface PlantingLog { // This will now represent Field Planting
  id: string; // UUID
  seedling_production_log_id?: string; // FK to SeedlingProductionLog (for transplanted seedlings)
  seed_batch_id?: string; // FK to SeedBatch (for direct field sowing)
  planting_date: string; // ISOString (Date) - Date of planting into the field
  location_description?: string; // General field location
  plot_affected?: string; // Specific field plot
  quantity_planted: number; // Number of seedlings transplanted or seeds sown
  quantity_unit?: string; // e.g., 'seedlings', 'seeds'
  expected_harvest_date?: string; // ISOString (Date)
  notes?: string;
  created_at?: string; // ISOString
  updated_at?: string; // ISOString
  _synced?: number; // 0 for false, 1 for true
  _last_modified?: number;
  is_deleted?: number;
  deleted_at?: string;
}

export interface CultivationLog {
  id: string; // UUID
  planting_log_id: string; // Foreign key to PlantingLog
  activity_date: string; // ISOString (Date)
  activity_type: string; // Consider making this a predefined list/enum
  plot_affected?: string; // New field for specific plot
  // crop_id?: string; // If linking directly to crop, new field
  input_inventory_id?: string; // Foreign key to InputInventory
  input_quantity_used?: number;
  input_quantity_unit?: string;
  notes?: string;
  created_at?: string; // ISOString
  updated_at?: string; // ISOString
  _synced?: number; // 0 for false, 1 for true
  _last_modified?: number;
  is_deleted?: number;
  deleted_at?: string;
}

export interface HarvestLog {
  id: string; // UUID
  planting_log_id: string; // Foreign key to PlantingLog
  harvest_date: string; // ISOString (Date)
  quantity_harvested: number;
  quantity_unit: string;
  quality_grade?: string;
  notes?: string;
  created_at?: string; // ISOString
  updated_at?: string; // ISOString
  _synced?: number; // 0 for false, 1 for true
  _last_modified?: number;
  is_deleted?: number;
  deleted_at?: string;
}

export interface Customer {
  id: string; // UUID
  name: string;
  customer_type?: 'Individual' | 'Commercial'; // New field for customer type
  contact_info?: string;
  address?: string;
  created_at?: string; // ISOString
  updated_at?: string; // ISOString
  _synced?: number; // 0 for false, 1 for true
  _last_modified?: number;
  is_deleted?: number;
  deleted_at?: string;
}

export interface Sale {
  id: string; // UUID
  customer_id?: string; // Foreign key to Customer
  sale_date: string; // ISOString (Date)
  total_amount?: number; // This will be calculated
  notes?: string;
  created_at?: string; // ISOString
  updated_at?: string; // ISOString
  _synced?: number; // 0 for false, 1 for true
  _last_modified?: number;
  is_deleted?: number;
  deleted_at?: string;
}

export interface SaleItem {
  id: string; // UUID
  sale_id: string; // Foreign key to Sale
  harvest_log_id?: string; // Foreign key to HarvestLog
  quantity_sold: number;
  price_per_unit: number; // Price before discount
  discount_type?: 'Amount' | 'Percentage' | null;
  discount_value?: number | null;
  notes?: string;
  created_at?: string; // ISOString
  updated_at?: string; // ISOString
  _synced?: number; // 0 for false, 1 for true
  _last_modified?: number;
  is_deleted?: number;
  deleted_at?: string;
}

export interface Invoice {
  id: string; // UUID
  sale_id: string; // Foreign key to Sale (UNIQUE)
  invoice_number: string;
  invoice_date: string; // ISOString (Date)
  pdf_url?: string; // URL to PDF in Supabase Storage or path to local blob
  status?: string;
  notes?: string;
  created_at?: string; // ISOString
  updated_at?: string; // ISOString
  _synced?: number; // 0 for false, 1 for true
  _last_modified?: number;
  is_deleted?: number;
  deleted_at?: string;
}

export interface SyncMeta {
  id: string; // e.g., 'lastSyncTimestamp_crops'
  value: number | string | null | undefined; // More specific type for sync metadata
}

export interface Tree { // New Tree interface
  id: string; // UUID
  identifier?: string; // e.g., T-001, or a name
  species?: string; // e.g., Olive, Lemon, Apple
  variety?: string;
  planting_date?: string; // ISOString (Date)
  location_description?: string; // General location
  plot_affected?: string; // Specific plot/coordinates
  notes?: string;
  created_at?: string; // ISOString
  updated_at?: string; // ISOString
  _synced?: number;
  _last_modified?: number;
  is_deleted?: number;
  deleted_at?: string;
}

export interface Reminder {
  id: string; // UUID
  planting_log_id?: string; // Optional: Link to a specific planting
  activity_type: string; // e.g., "Watering", "Pest Control", "Fertilize", "Pruning", "Scouting", "Custom Task"
  reminder_date: string; // ISOString (Date or DateTime for specific time)
  notes?: string;
  is_completed: number; // 0 for false, 1 for true
  completed_at?: string; // ISOString, when it was marked complete
  created_at?: string; // ISOString
  updated_at?: string; // ISOString
  _synced?: number;
  _last_modified?: number;
  is_deleted?: number;
  deleted_at?: string;
}

export interface SeedlingProductionLog {
  id: string; // UUID
  seed_batch_id: string; // FK to SeedBatch (seeds used for sowing)
  crop_id: string; // FK to Crop (denormalized for convenience)
  sowing_date: string; // ISOString (Date)
  quantity_sown_value: number; // The numeric value of what was sown (e.g., 1 if 1 gram, 100 if 100 seeds)
  sowing_unit_from_batch?: string; // The unit from the SeedBatch (e.g., 'grams', 'kg', 'seeds')
  estimated_total_individual_seeds_sown?: number; // For germination calculation if sown by weight
  nursery_location?: string;
  expected_seedlings?: number;
  actual_seedlings_produced: number; // Total produced from this sowing
  current_seedlings_available: number; // Remaining available for transplant
  ready_for_transplant_date?: string; // ISOString (Date)
  notes?: string;
  created_at?: string; // ISOString
  updated_at?: string; // ISOString
  _synced?: number;
  _last_modified?: number;
  is_deleted?: number;
  deleted_at?: string;
}

class HurvesthubDB extends Dexie {
  crops!: Table<Crop, string>;
  seedBatches!: Table<SeedBatch, string>;
  inputInventory!: Table<InputInventory, string>;
  plantingLogs!: Table<PlantingLog, string>;
  cultivationLogs!: Table<CultivationLog, string>;
  harvestLogs!: Table<HarvestLog, string>;
  customers!: Table<Customer, string>;
  sales!: Table<Sale, string>;
  saleItems!: Table<SaleItem, string>;
  invoices!: Table<Invoice, string>;
  syncMeta!: Table<SyncMeta, string>;
  trees!: Table<Tree, string>;
  reminders!: Table<Reminder, string>;
  seedlingProductionLogs!: Table<SeedlingProductionLog, string>; // New table for seedling production

  constructor() {
    super('HurvesthubDB');
    
    // Schema definition for version 1 (Original)
    this.version(1).stores({
      crops: 'id, name, type, _last_modified, _synced',
      seedBatches: 'id, crop_id, batch_code, _last_modified, _synced',
      inputInventory: 'id, name, type, _last_modified, _synced',
      plantingLogs: 'id, seed_batch_id, planting_date, _last_modified, _synced',
      cultivationLogs: 'id, planting_log_id, activity_date, _last_modified, _synced',
      harvestLogs: 'id, planting_log_id, harvest_date, _last_modified, _synced',
      customers: 'id, name, _last_modified, _synced',
      sales: 'id, customer_id, sale_date, _last_modified, _synced',
      saleItems: 'id, sale_id, harvest_log_id, _last_modified, _synced',
      invoices: 'id, sale_id, invoice_number, _last_modified, _synced',
      syncMeta: 'id',
      // reminders not in v1
    });

    // Schema definition for version 2 (Added is_deleted)
    this.version(2).stores({
      crops: 'id, name, type, _last_modified, _synced, is_deleted',
      seedBatches: 'id, crop_id, batch_code, _last_modified, _synced, is_deleted',
      inputInventory: 'id, name, type, _last_modified, _synced, is_deleted',
      plantingLogs: 'id, seed_batch_id, planting_date, _last_modified, _synced, is_deleted',
      cultivationLogs: 'id, planting_log_id, activity_date, _last_modified, _synced, is_deleted',
      harvestLogs: 'id, planting_log_id, harvest_date, _last_modified, _synced, is_deleted',
      customers: 'id, name, customer_type, _last_modified, _synced, is_deleted', // Added customer_type
      sales: 'id, customer_id, sale_date, _last_modified, _synced, is_deleted',
      saleItems: 'id, sale_id, harvest_log_id, _last_modified, _synced, is_deleted',
      invoices: 'id, sale_id, invoice_number, _last_modified, _synced, is_deleted',
      syncMeta: 'id',
      // reminders not in v2
    }).upgrade(async tx => { // eslint-disable-line @typescript-eslint/no-unused-vars
      console.log("Upgrading HurvesthubDB from v1 to v2: Adding and defaulting is_deleted fields.");
      const tablesToUpgradeV2 = [
        "crops", "seedBatches", "inputInventory", "plantingLogs",
        "cultivationLogs", "harvestLogs", "customers", "sales",
        "saleItems", "invoices"
      ];
      for (const tableName of tablesToUpgradeV2) {
        const table = tx.table(tableName);
        await table.toCollection().modify(record => {
          if (record.is_deleted === undefined) {
            record.is_deleted = 0;
          }
        });
      }
      console.log("Finished upgrading HurvesthubDB to version 2.");
    });

    // Version 3: Added customer_type to customers and variety to seedBatches
    this.version(3).stores({
      customers: 'id, name, customer_type, _last_modified, _synced, is_deleted', // customer_type added as index
      seedBatches: 'id, crop_id, batch_code, variety, _last_modified, _synced, is_deleted', // variety added as index
      // Other tables remain the same as v2 unless they also change in v3
      crops: 'id, name, type, _last_modified, _synced, is_deleted',
      inputInventory: 'id, name, type, _last_modified, _synced, is_deleted',
      plantingLogs: 'id, seed_batch_id, planting_date, plot_affected, _last_modified, _synced, is_deleted', // Added plot_affected
      cultivationLogs: 'id, planting_log_id, activity_date, plot_affected, _last_modified, _synced, is_deleted', // Added plot_affected
      harvestLogs: 'id, planting_log_id, harvest_date, _last_modified, _synced, is_deleted',
      sales: 'id, customer_id, sale_date, _last_modified, _synced, is_deleted',
      saleItems: 'id, sale_id, harvest_log_id, _last_modified, _synced, is_deleted',
      invoices: 'id, sale_id, invoice_number, _last_modified, _synced, is_deleted',
      syncMeta: 'id',
      // reminders not in v3
    }).upgrade(async tx => { // eslint-disable-line @typescript-eslint/no-unused-vars
      console.log("Upgrading HurvesthubDB to version 3: Adding customer_type and variety fields.");
      // For customer_type, default existing customers to 'Individual' or leave undefined
      await tx.table("customers").toCollection().modify(customer => {
        if (customer.customer_type === undefined) {
          customer.customer_type = 'Individual';
        }
      });
      // For variety, it's a new optional field, so existing seedBatches will have it as undefined.
      // For plot_affected, new optional field, existing logs will have it as undefined.
      console.log("Finished upgrading HurvesthubDB to version 3 (customer_type, variety).");
    });

    // Version 4: Added plot_affected to plantingLogs and cultivationLogs
    this.version(4).stores({
      plantingLogs: 'id, seed_batch_id, planting_date, plot_affected, _last_modified, _synced, is_deleted', // plot_affected added as index
      cultivationLogs: 'id, planting_log_id, activity_date, plot_affected, _last_modified, _synced, is_deleted', // plot_affected added as index
      // Other tables remain the same as v3, except inputInventory if its schema string changes
      customers: 'id, name, customer_type, _last_modified, _synced, is_deleted',
      seedBatches: 'id, crop_id, batch_code, variety, _last_modified, _synced, is_deleted',
      crops: 'id, name, type, _last_modified, _synced, is_deleted',
      inputInventory: 'id, name, type, total_purchase_cost, _last_modified, _synced, is_deleted', // Updated field
      harvestLogs: 'id, planting_log_id, harvest_date, _last_modified, _synced, is_deleted',
      sales: 'id, customer_id, sale_date, _last_modified, _synced, is_deleted',
      saleItems: 'id, sale_id, harvest_log_id, _last_modified, _synced, is_deleted',
      invoices: 'id, sale_id, invoice_number, _last_modified, _synced, is_deleted',
      syncMeta: 'id',
      // reminders not in v4
    }).upgrade(async tx => { // eslint-disable-line @typescript-eslint/no-unused-vars
      console.log("Upgrading HurvesthubDB to version 4: Adding plot_affected fields.");
      // plot_affected is a new optional field. Existing records will have it as undefined, which is fine.
      // No explicit data modification needed unless a default is desired for old records.
      // Example if you wanted to default:
      // await tx.table("plantingLogs").toCollection().modify(log => {
      //   if (log.plot_affected === undefined) log.plot_affected = 'N/A';
      // });
      // await tx.table("cultivationLogs").toCollection().modify(log => {
      //   if (log.plot_affected === undefined) log.plot_affected = 'N/A';
      // });
      console.log("Finished upgrading HurvesthubDB to version 4.");
    });

    // Version 5: Added Trees table, InputInventory cost change, SaleItem discount fields
    this.version(5).stores({
      trees: 'id, identifier, species, variety, planting_date, plot_affected, _last_modified, _synced, is_deleted', // New table
      saleItems: 'id, sale_id, harvest_log_id, discount_type, discount_value, _last_modified, _synced, is_deleted' // Schema string changed (added discount_type, discount_value)
      // inputInventory's schema string ('id, name, type, total_purchase_cost, ...') was defined in v4.
      // Other tables (plantingLogs, cultivationLogs, customers, seedBatches, crops, harvestLogs, sales, invoices, syncMeta)
      // are carried forward from v4 as their schema strings do not change in v5.
      // reminders not in v5
    }).upgrade(async tx => { // eslint-disable-line @typescript-eslint/no-unused-vars
      console.log("Upgrading HurvesthubDB to version 5: Adding Trees table, modifying InputInventory (data migration), and adding discount fields to SaleItems.");
      await tx.table('inputInventory').toCollection().modify(item => {
        if (item.cost_per_unit !== undefined && item.initial_quantity !== undefined && item.initial_quantity > 0) {
          item.total_purchase_cost = item.cost_per_unit * item.initial_quantity;
        } else if (item.cost_per_unit !== undefined && (item.initial_quantity === undefined || item.initial_quantity === 0) ) {
            item.total_purchase_cost = item.cost_per_unit;
        }
        delete item.cost_per_unit;
      });
      console.log("Finished upgrading HurvesthubDB to version 5.");
    });

    // Version 6: Added 'variety' to Crop table
    this.version(6).stores({
      crops: 'id, name, variety, type, _last_modified, _synced, is_deleted'
      // All other tables (trees, plantingLogs, cultivationLogs, customers, seedBatches, inputInventory,
      // harvestLogs, sales, saleItems, invoices, syncMeta) are carried forward from version 5
      // as their schema strings do not change in version 6.
      // The duplicate 'trees' was the main issue.
      // reminders not in v6
    }).upgrade(async tx => { // eslint-disable-line @typescript-eslint/no-unused-vars
      console.log("Upgrading HurvesthubDB to version 6: Adding 'variety' field to crops table.");
      await tx.table('crops').toCollection().modify(crop => {
        if (crop.variety === undefined) {
          crop.variety = null;
        }
      });
      console.log("Finished upgrading HurvesthubDB to version 6.");
    });

    // Version 7: Added 'notes' to Crop table
    this.version(7).stores({
      crops: 'id, name, variety, type, notes, _last_modified, _synced, is_deleted',
      trees: 'id, identifier, species, variety, planting_date, plot_affected, _last_modified, _synced, is_deleted',
      plantingLogs: 'id, seed_batch_id, planting_date, plot_affected, _last_modified, _synced, is_deleted',
      cultivationLogs: 'id, planting_log_id, activity_date, plot_affected, _last_modified, _synced, is_deleted',
      // Only 'crops' schema string changes in v7. Other tables are carried forward.
      // reminders not in v7
    }).upgrade(async tx => { // eslint-disable-line @typescript-eslint/no-unused-vars
      console.log("Upgrading HurvesthubDB to version 7: Adding 'notes' field to crops table.");
      await tx.table('crops').toCollection().modify(crop => {
        if (crop.notes === undefined) {
          crop.notes = null;
        }
      });
      console.log("Finished upgrading HurvesthubDB to version 7.");
    });

    // Version 8: Removed 'variety' from SeedBatch table
    this.version(8).stores({
      seedBatches: 'id, crop_id, batch_code, _last_modified, _synced, is_deleted' // 'variety' REMOVED
      // All other tables are carried forward as their schema strings do not change in version 8.
      // reminders not in v8
    }).upgrade(async tx => { // eslint-disable-line @typescript-eslint/no-unused-vars
      console.log("Upgrading HurvesthubDB to version 8: Removing 'variety' field from seedBatches table.");
      // Data migration: 'variety' field will be removed from existing seed batch records.
      // This data is now on the Crop record.
      await tx.table('seedBatches').toCollection().modify(sb => {
        delete sb.variety;
      });
      console.log("Finished upgrading HurvesthubDB to version 8.");
    });
    
    // Version 9: Added current_quantity to SeedBatch table
    this.version(9).stores({
      seedBatches: 'id, crop_id, batch_code, initial_quantity, current_quantity, _last_modified, _synced, is_deleted', // Schema string changed
      inputInventory: 'id, name, type, total_purchase_cost, current_quantity, _last_modified, _synced, is_deleted' // Schema string changed
      // All other tables are carried forward as their schema strings do not change in version 9.
      // reminders not in v9
    }).upgrade(async tx => { // eslint-disable-line @typescript-eslint/no-unused-vars
      console.log("Upgrading HurvesthubDB to version 9: Adding 'current_quantity' to seedBatches and inputInventory tables.");
      await tx.table('seedBatches').toCollection().modify(sb => {
        if (sb.current_quantity === undefined) {
          sb.current_quantity = sb.initial_quantity; // Initialize with initial_quantity
        }
      });
      // Also ensure inputInventory has current_quantity if it was missed in an earlier schema string for a version
      // This is more of a safeguard if schema strings were not perfectly aligned across versions.
      // However, InputInventory already has current_quantity from its own interface.
      // The main focus here is seedBatches.
      console.log("Finished upgrading HurvesthubDB to version 9.");
    });

    // Version 10: Added Reminders table
    this.version(10).stores({
      reminders: 'id, planting_log_id, reminder_date, activity_type, is_completed, _last_modified, _synced, is_deleted',
      // Re-declare all other tables from v9
      // Only 'reminders' is new in v10. Other tables are carried forward.
    }).upgrade(async tx => { // eslint-disable-line @typescript-eslint/no-unused-vars
        console.log("Upgrading HurvesthubDB to version 10: Adding Reminders table.");
        // New table, no data migration needed for existing tables for this specific change.
        // Initialize reminders with default values if necessary upon creation through app logic.
        console.log("Finished upgrading HurvesthubDB to version 10.");
    });

    // Version 11: Added qr_code_data to SeedBatch and InputInventory
    this.version(11).stores({
      seedBatches: 'id, crop_id, batch_code, initial_quantity, current_quantity, qr_code_data, _last_modified, _synced, is_deleted', // Added qr_code_data
      inputInventory: 'id, name, type, total_purchase_cost, current_quantity, qr_code_data, _last_modified, _synced, is_deleted' // Added qr_code_data
      // All other tables are carried forward.
    }).upgrade(async tx => { // eslint-disable-line @typescript-eslint/no-unused-vars
        console.log("Upgrading HurvesthubDB to version 11: Adding 'qr_code_data' to seedBatches and inputInventory tables.");
        // New optional field, no data migration needed for existing records.
        // qr_code_data will be undefined for old records.
        await tx.table('seedBatches').toCollection().modify(sb => {
            if (sb.qr_code_data === undefined) {
              sb.qr_code_data = null; // Or keep as undefined if preferred
            }
        });
        await tx.table('inputInventory').toCollection().modify(ii => {
            if (ii.qr_code_data === undefined) {
              ii.qr_code_data = null; // Or keep as undefined
            }
        });
        console.log("Finished upgrading HurvesthubDB to version 11.");
    });

    // Version 12: Added SeedlingProductionLog table and modified PlantingLog table
    this.version(12).stores({
      seedlingProductionLogs: 'id, seed_batch_id, crop_id, sowing_date, _last_modified, _synced, is_deleted',
      plantingLogs: 'id, seedling_production_log_id, seed_batch_id, planting_date, plot_affected, _last_modified, _synced, is_deleted'
    }).upgrade(async tx => { // eslint-disable-line @typescript-eslint/no-unused-vars
      console.log("Upgrading HurvesthubDB to version 12: Adding SeedlingProductionLog table and modifying PlantingLog table.");
      await tx.table('plantingLogs').toCollection().modify(pl => {
        if (pl.seedling_production_log_id === undefined) {
          pl.seedling_production_log_id = null;
        }
        if (pl.quantity_planted === undefined) {
            pl.quantity_planted = 0; // Default if missing
        }
      });
      console.log("Finished upgrading HurvesthubDB to version 12.");
    });

    // Version 13: Enhanced SeedBatch and SeedlingProductionLog for better germination tracking
    this.version(13).stores({
      seedBatches: 'id, crop_id, batch_code, initial_quantity, current_quantity, qr_code_data, estimated_seeds_per_sowing_unit, _last_modified, _synced, is_deleted', // Added estimated_seeds_per_sowing_unit
      seedlingProductionLogs: 'id, seed_batch_id, crop_id, sowing_date, quantity_sown_value, sowing_unit_from_batch, estimated_total_individual_seeds_sown, _last_modified, _synced, is_deleted' // Updated fields
      // PlantingLogs schema string does not change from v12 for indexing purposes here.
    }).upgrade(async tx => { // eslint-disable-line @typescript-eslint/no-unused-vars
      console.log("Upgrading HurvesthubDB to version 13: Enhancing SeedBatch and SeedlingProductionLog.");
      // For SeedBatch, new field estimated_seeds_per_sowing_unit will be undefined for old records.
      await tx.table('seedBatches').toCollection().modify(sb => {
        if (sb.estimated_seeds_per_sowing_unit === undefined) {
          sb.estimated_seeds_per_sowing_unit = null;
        }
      });
      // For SeedlingProductionLog, migrate old fields
      await tx.table('seedlingProductionLogs').toCollection().modify(async spl => { // Made function async
        if (spl.crop_id === undefined && spl.seed_batch_id) {
            const batch = await tx.table('seedBatches').get(spl.seed_batch_id);
            if (batch) spl.crop_id = batch.crop_id;
        }
        if (spl.quantity_seeds_sown !== undefined) {
          spl.quantity_sown_value = spl.quantity_seeds_sown;
          delete spl.quantity_seeds_sown;
        } else if (spl.quantity_sown_value === undefined) {
            spl.quantity_sown_value = 0; // Default if somehow missing
        }

        if (spl.seed_quantity_unit !== undefined) {
          spl.sowing_unit_from_batch = spl.seed_quantity_unit;
          delete spl.seed_quantity_unit;
        }
        
        if (spl.estimated_total_individual_seeds_sown === undefined) {
            // If old unit was 'seeds', then estimated_total_individual_seeds_sown is quantity_sown_value
            if (spl.sowing_unit_from_batch && spl.sowing_unit_from_batch.toLowerCase().includes('seed')) {
                spl.estimated_total_individual_seeds_sown = spl.quantity_sown_value;
            } else {
                spl.estimated_total_individual_seeds_sown = null; // Needs to be estimated/entered by user later
            }
        }
      });
      console.log("Finished upgrading HurvesthubDB to version 13.");
    });
    
    // Version 14: Added total_purchase_cost to SeedBatch
    this.version(14).stores({
      seedBatches: 'id, crop_id, batch_code, initial_quantity, current_quantity, qr_code_data, estimated_seeds_per_sowing_unit, total_purchase_cost, _last_modified, _synced, is_deleted' // Added total_purchase_cost
      // Other tables carried forward.
    }).upgrade(async tx => { // eslint-disable-line @typescript-eslint/no-unused-vars
      console.log("Upgrading HurvesthubDB to version 14: Adding 'total_purchase_cost' to seedBatches table.");
      await tx.table('seedBatches').toCollection().modify(sb => {
        if (sb.total_purchase_cost === undefined) {
          sb.total_purchase_cost = null; // Initialize as null for existing records
        }
      });
      console.log("Finished upgrading HurvesthubDB to version 14.");
    });

    // Version 15: Added supplier_invoice_number to InputInventory
    this.version(15).stores({
      inputInventory: 'id, name, type, supplier_invoice_number, total_purchase_cost, current_quantity, qr_code_data, _last_modified, _synced, is_deleted'
      // Other tables carried forward.
    }).upgrade(async tx => { // eslint-disable-line @typescript-eslint/no-unused-vars
      console.log("Upgrading HurvesthubDB to version 15: Adding 'supplier_invoice_number' to inputInventory table.");
      await tx.table('inputInventory').toCollection().modify(ii => {
        if (ii.supplier_invoice_number === undefined) {
          ii.supplier_invoice_number = null;
        }
      });
      console.log("Finished upgrading HurvesthubDB to version 15.");
    });

    // Version 16: Added organic_status to SeedBatch
    this.version(16).stores({
      seedBatches: 'id, crop_id, batch_code, supplier, purchase_date, initial_quantity, current_quantity, quantity_unit, total_purchase_cost, organic_status, qr_code_data, _last_modified, _synced, is_deleted' // Added organic_status
      // Other tables carried forward.
    }).upgrade(async tx => { // eslint-disable-line @typescript-eslint/no-unused-vars
      console.log("Upgrading HurvesthubDB to version 16: Adding 'organic_status' to seedBatches table.");
      await tx.table('seedBatches').toCollection().modify(sb => {
        if (sb.organic_status === undefined) {
          sb.organic_status = null; // Or a sensible default like 'Unknown'
        }
      });
      console.log("Finished upgrading HurvesthubDB to version 16.");
    });
    
    } // End of constructor

  async markForSync<T extends { id: string; _last_modified?: number; _synced?: number; is_deleted?: number; deleted_at?: string; }>(
    table: Table<T, string>,
    id: string,
    deleted: boolean = false
  ) {
    if (deleted) {
      return table.update(id, {
        _synced: 0,
        _last_modified: Date.now(),
        is_deleted: 1,
        deleted_at: new Date().toISOString()
      } as any); 
    }
    return table.update(id, { _synced: 0, _last_modified: Date.now() } as any); 
  }

  async addCropAndMark(crop: Omit<Crop, 'id' | '_synced' | '_last_modified' | 'created_at' | 'updated_at' | 'is_deleted' | 'deleted_at'>): Promise<string> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const newCrop: Crop = {
      ...crop,
      id,
      created_at: now,
      updated_at: now,
      _synced: 0,
      _last_modified: Date.now(),
      is_deleted: 0,
    };
    await this.crops.add(newCrop);
    return id;
  }
} // End of HurvesthubDB class

export const db = new HurvesthubDB();

export async function getSyncStatus() {
    const unsyncedCounts = {
        crops: await db.crops.where('_synced').equals(0).and(item => item.is_deleted !== 1).count(),
        seedBatches: await db.seedBatches.where('_synced').equals(0).and(item => item.is_deleted !== 1).count(),
        inputInventory: await db.inputInventory.where('_synced').equals(0).and(item => item.is_deleted !== 1).count(),
        plantingLogs: await db.plantingLogs.where('_synced').equals(0).and(item => item.is_deleted !== 1).count(),
        cultivationLogs: await db.cultivationLogs.where('_synced').equals(0).and(item => item.is_deleted !== 1).count(),
        harvestLogs: await db.harvestLogs.where('_synced').equals(0).and(item => item.is_deleted !== 1).count(),
        customers: await db.customers.where('_synced').equals(0).and(item => item.is_deleted !== 1).count(),
        sales: await db.sales.where('_synced').equals(0).and(item => item.is_deleted !== 1).count(),
        saleItems: await db.saleItems.where('_synced').equals(0).and(item => item.is_deleted !== 1).count(),
        invoices: await db.invoices.where('_synced').equals(0).and(item => item.is_deleted !== 1).count(),
        trees: await db.trees.where('_synced').equals(0).and(item => item.is_deleted !== 1).count(),
        reminders: await db.reminders.where('_synced').equals(0).and(item => item.is_deleted !== 1).count(),
        seedlingProductionLogs: await db.seedlingProductionLogs.where('_synced').equals(0).and(item => item.is_deleted !== 1).count(),
    };
    const totalUnsynced = Object.values(unsyncedCounts).reduce((sum, count) => sum + count, 0);
    return { unsyncedCounts, totalUnsynced };
}