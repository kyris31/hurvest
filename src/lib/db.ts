import Dexie, { Table, UpdateSpec } from 'dexie';

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

export type HurvesthubTableName =
  | 'crops'
  | 'seedBatches'
  | 'inputInventory'
  | 'plantingLogs'
  | 'cultivationLogs'
  | 'harvestLogs'
  | 'customers'
  | 'sales'
  | 'saleItems'
  | 'invoices'
  | 'syncMeta'
  | 'trees'
  | 'reminders'
  | 'seedlingProductionLogs';

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
    }).upgrade(async tx => {
      console.log("Upgrading HurvesthubDB from v1 to v2: Adding and defaulting is_deleted fields.");
      const tablesToUpgradeV2 = [
        "crops", "seedBatches", "inputInventory", "plantingLogs",
        "cultivationLogs", "harvestLogs", "customers", "sales",
        "saleItems", "invoices"
      ];
      for (const tableName of tablesToUpgradeV2) {
        const table = tx.table(tableName as HurvesthubTableName);
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
    }).upgrade(async tx => {
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
    }).upgrade(async _tx => { // _tx because it's not used in this specific upgrade
      console.log("Upgrading HurvesthubDB to version 4: Adding plot_affected fields.");
      // plot_affected is a new optional field. Existing records will have it as undefined, which is fine.
      console.log("Finished upgrading HurvesthubDB to version 4.");
    });

    // Version 5: Added Trees table, InputInventory cost change, SaleItem discount fields
    this.version(5).stores({
      trees: 'id, identifier, species, variety, planting_date, plot_affected, _last_modified, _synced, is_deleted', // New table
      saleItems: 'id, sale_id, harvest_log_id, discount_type, discount_value, _last_modified, _synced, is_deleted' // Schema string changed (added discount_type, discount_value)
      // inputInventory's schema string ('id, name, type, total_purchase_cost, ...') was defined in v4.
    }).upgrade(async tx => {
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
    }).upgrade(async tx => {
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
      trees: 'id, identifier, species, variety, planting_date, plot_affected, _last_modified, _synced, is_deleted', // Ensure trees is declared if not carried over
      plantingLogs: 'id, seed_batch_id, planting_date, plot_affected, _last_modified, _synced, is_deleted', // Ensure carried over
      cultivationLogs: 'id, planting_log_id, activity_date, plot_affected, _last_modified, _synced, is_deleted', // Ensure carried over
    }).upgrade(async tx => {
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
    }).upgrade(async tx => {
      console.log("Upgrading HurvesthubDB to version 8: Removing 'variety' field from seedBatches table.");
      await tx.table('seedBatches').toCollection().modify(sb => {
        delete sb.variety;
      });
      console.log("Finished upgrading HurvesthubDB to version 8.");
    });
    
    // Version 9: Added current_quantity to SeedBatch table
    this.version(9).stores({
      seedBatches: 'id, crop_id, batch_code, initial_quantity, current_quantity, _last_modified, _synced, is_deleted', // Schema string changed
      inputInventory: 'id, name, type, total_purchase_cost, current_quantity, _last_modified, _synced, is_deleted' // Schema string changed
    }).upgrade(async tx => {
      console.log("Upgrading HurvesthubDB to version 9: Adding 'current_quantity' to seedBatches and inputInventory tables.");
      await tx.table('seedBatches').toCollection().modify(sb => {
        if (sb.current_quantity === undefined) {
          sb.current_quantity = sb.initial_quantity; 
        }
      });
      await tx.table('inputInventory').toCollection().modify(ii => {
        if (ii.current_quantity === undefined) {
          ii.current_quantity = ii.initial_quantity;
        }
      });
      console.log("Finished upgrading HurvesthubDB to version 9.");
    });

    // Version 10: Added Reminders table
    this.version(10).stores({
      reminders: 'id, planting_log_id, reminder_date, activity_type, is_completed, _last_modified, _synced, is_deleted',
    }).upgrade(async _tx => { // _tx because it's not used
        console.log("Upgrading HurvesthubDB to version 10: Adding Reminders table.");
        console.log("Finished upgrading HurvesthubDB to version 10.");
    });

    // Version 11: Added qr_code_data to SeedBatch and InputInventory
    this.version(11).stores({
      seedBatches: 'id, crop_id, batch_code, initial_quantity, current_quantity, qr_code_data, _last_modified, _synced, is_deleted', 
      inputInventory: 'id, name, type, total_purchase_cost, current_quantity, qr_code_data, _last_modified, _synced, is_deleted' 
    }).upgrade(async tx => {
        console.log("Upgrading HurvesthubDB to version 11: Adding 'qr_code_data' to seedBatches and inputInventory tables.");
        await tx.table('seedBatches').toCollection().modify(sb => {
            if (sb.qr_code_data === undefined) {
              sb.qr_code_data = null; 
            }
        });
        await tx.table('inputInventory').toCollection().modify(ii => {
            if (ii.qr_code_data === undefined) {
              ii.qr_code_data = null; 
            }
        });
        console.log("Finished upgrading HurvesthubDB to version 11.");
    });

    // Version 12: Added SeedlingProductionLog table and modified PlantingLog table
    this.version(12).stores({
      seedlingProductionLogs: 'id, seed_batch_id, crop_id, sowing_date, _last_modified, _synced, is_deleted',
      plantingLogs: 'id, seedling_production_log_id, seed_batch_id, planting_date, plot_affected, _last_modified, _synced, is_deleted'
    }).upgrade(async tx => { 
      console.log("Upgrading HurvesthubDB to version 12: Adding SeedlingProductionLog table and modifying PlantingLog table.");
      await tx.table('plantingLogs').toCollection().modify(pl => {
        if (pl.seedling_production_log_id === undefined) {
          pl.seedling_production_log_id = null;
        }
        if (pl.quantity_planted === undefined) { // Ensure quantity_planted exists
            pl.quantity_planted = 0; 
        }
        if (pl.quantity_unit === undefined) { // Ensure quantity_unit exists
            pl.quantity_unit = 'items';
        }
      });
      console.log("Finished upgrading HurvesthubDB to version 12.");
    });

    // Version 13: Added supplier_invoice_number to InputInventory
    this.version(13).stores({
        inputInventory: 'id, name, type, supplier_invoice_number, total_purchase_cost, current_quantity, qr_code_data, _last_modified, _synced, is_deleted'
    }).upgrade(async tx => {
        console.log("Upgrading HurvesthubDB to version 13: Adding 'supplier_invoice_number' to inputInventory.");
        await tx.table('inputInventory').toCollection().modify(ii => {
            if (ii.supplier_invoice_number === undefined) {
                ii.supplier_invoice_number = null;
            }
        });
        console.log("Finished upgrading HurvesthubDB to version 13.");
    });
    
    // Version 14: Added estimated_seeds_per_sowing_unit to SeedBatch
    // and various fields to SeedlingProductionLog
    this.version(14).stores({
        seedBatches: 'id, crop_id, batch_code, initial_quantity, current_quantity, qr_code_data, estimated_seeds_per_sowing_unit, _last_modified, _synced, is_deleted',
        seedlingProductionLogs: 'id, seed_batch_id, crop_id, sowing_date, quantity_sown_value, sowing_unit_from_batch, estimated_total_individual_seeds_sown, current_seedlings_available, _last_modified, _synced, is_deleted'
    }).upgrade(async tx => {
        console.log("Upgrading HurvesthubDB to version 14.");
        await tx.table('seedBatches').toCollection().modify(sb => {
            if (sb.estimated_seeds_per_sowing_unit === undefined) {
                sb.estimated_seeds_per_sowing_unit = null;
            }
        });
        await tx.table('seedlingProductionLogs').toCollection().modify(async spl => {
            if (spl.quantity_sown_value === undefined) spl.quantity_sown_value = 0;
            if (spl.sowing_unit_from_batch === undefined) spl.sowing_unit_from_batch = null;
            if (spl.estimated_total_individual_seeds_sown === undefined) spl.estimated_total_individual_seeds_sown = null;
            if (spl.current_seedlings_available === undefined && spl.actual_seedlings_produced !== undefined) {
                spl.current_seedlings_available = spl.actual_seedlings_produced;
            } else if (spl.current_seedlings_available === undefined) {
                spl.current_seedlings_available = 0;
            }
        });
        console.log("Finished upgrading HurvesthubDB to version 14.");
    });

    // Version 15: Added organic_status to SeedBatch
    this.version(15).stores({
        seedBatches: 'id, crop_id, batch_code, initial_quantity, current_quantity, qr_code_data, estimated_seeds_per_sowing_unit, organic_status, _last_modified, _synced, is_deleted'
    }).upgrade(async tx => {
        console.log("Upgrading HurvesthubDB to version 15: Adding 'organic_status' to seedBatches.");
        await tx.table('seedBatches').toCollection().modify(sb => {
            if (sb.organic_status === undefined) {
                sb.organic_status = null;
            }
        });
        console.log("Finished upgrading HurvesthubDB to version 15.");
    });

    // Version 16: Added total_purchase_cost to InputInventory (if missed or for consistency)
    // This might be redundant if already correctly defined in v4/v9, but ensures schema string matches interface
    this.version(16).stores({
        inputInventory: 'id, name, type, supplier_invoice_number, purchase_date, initial_quantity, current_quantity, quantity_unit, total_purchase_cost, notes, qr_code_data, _last_modified, _synced, is_deleted'
    }).upgrade(async tx => {
        console.log("Upgrading HurvesthubDB to version 16: Ensuring all InputInventory fields are in schema string.");
        // No data migration typically needed if fields were already present in interface and just missing from schema string.
        // If total_purchase_cost was truly new here, migration from cost_per_unit would be needed.
        // However, that migration was in v5. This is more about schema string completeness.
        await tx.table('inputInventory').toCollection().modify(ii => {
            // Example: ensure notes is not undefined if it should be null
            if (ii.notes === undefined) ii.notes = null;
        });
        console.log("Finished upgrading HurvesthubDB to version 16.");
    });

    // Finalize table definitions
    this.crops = this.table('crops');
    this.seedBatches = this.table('seedBatches');
    this.inputInventory = this.table('inputInventory');
    this.plantingLogs = this.table('plantingLogs');
    this.cultivationLogs = this.table('cultivationLogs');
    this.harvestLogs = this.table('harvestLogs');
    this.customers = this.table('customers');
    this.sales = this.table('sales');
    this.saleItems = this.table('saleItems');
    this.invoices = this.table('invoices');
    this.syncMeta = this.table('syncMeta');
    this.trees = this.table('trees');
    this.reminders = this.table('reminders');
    this.seedlingProductionLogs = this.table('seedlingProductionLogs');
  }

  async markForSync<T extends { id: string; _last_modified?: number; _synced?: number; is_deleted?: number; deleted_at?: string; }>(
    tableName: HurvesthubTableName,
    itemId: string,
    itemChanges: Partial<T>, // Renamed for clarity
    isDeleteOperation = false
  ): Promise<number> {
    const dataToUpdate: Partial<T> = {
      ...itemChanges,
      _last_modified: Date.now(),
      _synced: 0,
    };

    if (isDeleteOperation) {
      dataToUpdate.is_deleted = 1;
      dataToUpdate.deleted_at = new Date().toISOString();
    }
    // Cast to UpdateSpec<T> to satisfy Dexie's update method signature
    return (this[tableName] as Table<T, string>).update(itemId, dataToUpdate as UpdateSpec<T>);
  }

  async addCropAndMark(crop: Omit<Crop, 'id' | '_synced' | '_last_modified' | 'created_at' | 'updated_at' | 'is_deleted' | 'deleted_at'>): Promise<string> {
    const newId = crypto.randomUUID();
    const now = new Date().toISOString();
    const fullCrop: Crop = {
      ...crop,
      id: newId,
      created_at: now,
      updated_at: now,
      _last_modified: Date.now(),
      _synced: 0,
      is_deleted: 0,
    };
    await this.crops.add(fullCrop);
    // No need to call markForSync here as we've set _synced to 0 already
    return newId;
  }
}

export const db = new HurvesthubDB();

// Utility function to get sync status for all tables
export async function getSyncStatus(): Promise<Record<string, { unsynced: number, total: number }>> {
  const status: Record<string, { unsynced: number, total: number }> = {};
  const tableNames: HurvesthubTableName[] = [
    'crops', 'seedBatches', 'inputInventory', 'plantingLogs', 
    'cultivationLogs', 'harvestLogs', 'customers', 'sales', 
    'saleItems', 'invoices', 'trees', 'reminders', 'seedlingProductionLogs'
  ];

  for (const tableName of tableNames) {
    const table = db.table(tableName as HurvesthubTableName);
    const unsyncedCount = await table.where('_synced').equals(0).count();
    const totalCount = await table.count();
    status[tableName] = { unsynced: unsyncedCount, total: totalCount };
  }
  return status;
}