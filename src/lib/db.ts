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
  supplier_id?: string; // Foreign key to Suppliers table
  purchase_date?: string; // ISOString (Date)
  initial_quantity?: number;
  current_quantity?: number; // Added to track available quantity
  quantity_unit?: string; // e.g., 'seeds', 'grams', 'kg'
  estimated_seeds_per_sowing_unit?: number; 
  total_purchase_cost?: number; 
  organic_status?: string; 
  notes?: string;
  qr_code_data?: string; 
  created_at?: string; 
  updated_at?: string; 
  _synced?: number; 
  _last_modified?: number;
  is_deleted?: number;
  deleted_at?: string;
}

export interface InputInventory {
  id: string; // UUID
  name: string;
  type?: string;
  supplier_id?: string; // Foreign key to Suppliers table
  supplier_invoice_number?: string; // New field
  purchase_date?: string; // ISOString (Date)
  initial_quantity?: number;
  current_quantity?: number;
  quantity_unit?: string;
  total_purchase_cost?: number; 
  minimum_stock_level?: number; // For restock alerts
  notes?: string;
  qr_code_data?: string;
  created_at?: string;
  updated_at?: string; 
  _synced?: number; 
  _last_modified?: number;
  is_deleted?: number;
  deleted_at?: string;
}

export interface PlantingLog { 
  id: string; // UUID
  seedling_production_log_id?: string; 
  seed_batch_id?: string; 
  planting_date: string; 
  location_description?: string; 
  plot_affected?: string; 
  quantity_planted: number; 
  quantity_unit?: string; 
  expected_harvest_date?: string; 
  notes?: string;
  created_at?: string; 
  updated_at?: string; 
  _synced?: number; 
  _last_modified?: number;
  is_deleted?: number;
  deleted_at?: string;
}

export interface CultivationLog {
  id: string; // UUID
  planting_log_id: string; 
  activity_date: string; 
  activity_type: string; 
  plot_affected?: string; 
  input_inventory_id?: string; 
  input_quantity_used?: number;
  input_quantity_unit?: string;
  notes?: string;
  created_at?: string; 
  updated_at?: string; 
  _synced?: number; 
  _last_modified?: number;
  is_deleted?: number;
  deleted_at?: string;
}

export interface HarvestLog {
  id: string; // UUID
  planting_log_id: string; 
  harvest_date: string; 
  quantity_harvested: number;
  quantity_unit: string;
  quality_grade?: string;
  notes?: string;
  created_at?: string; 
  updated_at?: string; 
  _synced?: number; 
  _last_modified?: number;
  is_deleted?: number;
  deleted_at?: string;
}

export interface Customer {
  id: string; // UUID
  name: string;
  customer_type?: 'Individual' | 'Commercial'; 
  contact_info?: string;
  address?: string;
  created_at?: string; 
  updated_at?: string; 
  _synced?: number; 
  _last_modified?: number;
  is_deleted?: number;
  deleted_at?: string;
}

export interface Sale {
  id: string; // UUID
  customer_id?: string;
  sale_date: string;
  total_amount?: number; // This should be calculated from items
  payment_method?: 'cash' | 'card' | 'bank_transfer' | 'on_account' | 'other';
  payment_status?: 'paid' | 'unpaid' | 'partially_paid';
  amount_paid?: number; // Total amount paid so far for this sale
  payment_history?: { date: string; amount: number; method: Sale['payment_method']; notes?: string }[]; // Array of payment transactions
  notes?: string;
  created_at?: string;
  updated_at?: string;
  _synced?: number;
  _last_modified?: number;
  is_deleted?: number;
  deleted_at?: string;
}

export interface SaleItem {
  id: string; // UUID
  sale_id: string; 
  harvest_log_id?: string; 
  quantity_sold: number;
  price_per_unit: number; 
  discount_type?: 'Amount' | 'Percentage' | null;
  discount_value?: number | null;
  notes?: string;
  created_at?: string; 
  updated_at?: string; 
  _synced?: number; 
  _last_modified?: number;
  is_deleted?: number;
  deleted_at?: string;
}

export interface Invoice {
  id: string; // UUID
  sale_id: string; 
  invoice_number: string;
  invoice_date: string; 
  pdf_url?: string; 
  status?: 'Draft' | 'Sent' | 'Paid' | 'Overdue';
  notes?: string;
  created_at?: string; 
  updated_at?: string; 
  _synced?: number; 
  _last_modified?: number;
  is_deleted?: number;
  deleted_at?: string;
}

export interface SyncMeta {
  id: string; 
  value: number | string | null | undefined; 
}

export interface Tree { 
  id: string; // UUID
  identifier?: string; 
  species?: string; 
  variety?: string;
  planting_date?: string; 
  location_description?: string; 
  plot_affected?: string; 
  notes?: string;
  created_at?: string; 
  updated_at?: string; 
  _synced?: number;
  _last_modified?: number;
  is_deleted?: number;
  deleted_at?: string;
}

export interface Reminder {
  id: string; // UUID
  planting_log_id?: string;
  flock_id?: string;
  preventive_measure_schedule_id?: string; 
  activity_type: string;
  reminder_date: string;
  notes?: string;
  is_completed: number; 
  completed_at?: string; 
  created_at?: string; 
  updated_at?: string; 
  _synced?: number;
  _last_modified?: number;
  is_deleted?: number;
  deleted_at?: string;
}

export interface SeedlingProductionLog {
  id: string; // UUID
  seed_batch_id: string; 
  crop_id: string; 
  sowing_date: string; 
  quantity_sown_value: number; 
  sowing_unit_from_batch?: string; 
  estimated_total_individual_seeds_sown?: number; 
  nursery_location?: string;
  expected_seedlings?: number;
  actual_seedlings_produced: number; 
  current_seedlings_available: number; 
  ready_for_transplant_date?: string; 
  notes?: string;
  created_at?: string; 
  updated_at?: string; 
  _synced?: number;
  _last_modified?: number;
  is_deleted?: number;
  deleted_at?: string;
}

export interface Supplier {
  id: string; // UUID
  name: string;
  contact_person?: string;
  email?: string;
  phone?: string;
  address?: string;
  notes?: string;
  created_at?: string; 
  updated_at?: string; 
  _synced?: number;
  _last_modified?: number;
  is_deleted?: number;
  deleted_at?: string;
}

export interface Flock {
  id: string; // UUID
  name: string;
  flock_type: 'egg_layer' | 'broiler';
  species?: 'chicken' | 'turkey' | 'duck' | 'quail' | 'other'; // New field
  breed?: string;
  hatch_date?: string;
  initial_bird_count?: number;
  current_bird_count?: number;
  notes?: string;
  created_at?: string;
  updated_at?: string;
  _synced?: number;
  _last_modified?: number;
  is_deleted?: number;
  deleted_at?: string;
}

export interface FlockRecord {
  id: string; // UUID
  flock_id: string; 
  record_type: 'vaccination' | 'illness' | 'treatment' | 'mortality' | 'cull_sale' | 'weight_check' | 'egg_collection' | 'egg_sale' | 'other';
  record_date: string; 
  details: string;
  quantity?: number; 
  weight_kg_total?: number; 
  cost?: number; 
  revenue?: number; 
  outcome?: string;
  notes?: string;
  created_at?: string;
  updated_at?: string;
  _synced?: number;
  _last_modified?: number;
  is_deleted?: number;
  deleted_at?: string;
}

export interface FeedLog {
  id: string; // UUID
  flock_id: string; 
  feed_date: string; 
  feed_type_id?: string;
  quantity_fed_kg?: number;
  feed_cost?: number; 
  notes?: string;
  created_at?: string;
  updated_at?: string;
  _synced?: number;
  _last_modified?: number;
  is_deleted?: number;
  deleted_at?: string;
}

export interface PreventiveMeasureSchedule {
  id: string; // UUID
  name: string;
  description?: string;
  target_species?: 'chicken' | 'turkey' | 'duck' | 'quail' | 'other' | 'all_poultry'; // Added quail, other
  measure_type: string;
  trigger_event: 'hatch_date';
  trigger_offset_days: number;
  is_recurring: number; 
  recurrence_interval_days?: number;
  notes?: string;
  created_at?: string;
  updated_at?: string;
  _synced?: number;
  _last_modified?: number;
  is_deleted?: number;
  deleted_at?: string;
}


export type HurvesthubTableName =
  | 'suppliers'
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
  | 'seedlingProductionLogs'
  | 'flocks'
  | 'flock_records'
  | 'feed_logs'
  | 'preventive_measure_schedules';

export class HurvesthubDB extends Dexie {
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
  seedlingProductionLogs!: Table<SeedlingProductionLog, string>;
  suppliers!: Table<Supplier, string>; 
  flocks!: Table<Flock, string>;
  flock_records!: Table<FlockRecord, string>;
  feed_logs!: Table<FeedLog, string>;
  preventive_measure_schedules!: Table<PreventiveMeasureSchedule, string>;

  constructor() {
    super('HurvesthubDB');
    
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
    });

    this.version(2).stores({
      crops: 'id, name, type, _last_modified, _synced, is_deleted',
      seedBatches: 'id, crop_id, batch_code, _last_modified, _synced, is_deleted',
      inputInventory: 'id, name, type, _last_modified, _synced, is_deleted',
      plantingLogs: 'id, seed_batch_id, planting_date, _last_modified, _synced, is_deleted',
      cultivationLogs: 'id, planting_log_id, activity_date, _last_modified, _synced, is_deleted',
      harvestLogs: 'id, planting_log_id, harvest_date, _last_modified, _synced, is_deleted',
      customers: 'id, name, customer_type, _last_modified, _synced, is_deleted', 
      sales: 'id, customer_id, sale_date, _last_modified, _synced, is_deleted',
      saleItems: 'id, sale_id, harvest_log_id, _last_modified, _synced, is_deleted',
      invoices: 'id, sale_id, invoice_number, _last_modified, _synced, is_deleted',
      syncMeta: 'id',
    }).upgrade(async tx => {
      console.log("Upgrading HurvesthubDB from v1 to v2: Adding and defaulting is_deleted fields.");
      const tablesToUpgradeV2 = ["crops", "seedBatches", "inputInventory", "plantingLogs", "cultivationLogs", "harvestLogs", "customers", "sales", "saleItems", "invoices"];
      for (const tableName of tablesToUpgradeV2) {
        await tx.table(tableName as HurvesthubTableName).toCollection().modify(record => { if (record.is_deleted === undefined) record.is_deleted = 0; });
      }
      console.log("Finished upgrading HurvesthubDB to version 2.");
    });

    this.version(3).stores({
      customers: 'id, name, customer_type, _last_modified, _synced, is_deleted', 
      seedBatches: 'id, crop_id, batch_code, variety, _last_modified, _synced, is_deleted', 
      crops: 'id, name, type, _last_modified, _synced, is_deleted',
      inputInventory: 'id, name, type, _last_modified, _synced, is_deleted',
      plantingLogs: 'id, seed_batch_id, planting_date, plot_affected, _last_modified, _synced, is_deleted', 
      cultivationLogs: 'id, planting_log_id, activity_date, plot_affected, _last_modified, _synced, is_deleted', 
      harvestLogs: 'id, planting_log_id, harvest_date, _last_modified, _synced, is_deleted',
      sales: 'id, customer_id, sale_date, _last_modified, _synced, is_deleted',
      saleItems: 'id, sale_id, harvest_log_id, _last_modified, _synced, is_deleted',
      invoices: 'id, sale_id, invoice_number, _last_modified, _synced, is_deleted',
      syncMeta: 'id',
    }).upgrade(async tx => {
      console.log("Upgrading HurvesthubDB to version 3: Adding customer_type and variety fields.");
      await tx.table("customers").toCollection().modify(customer => { if (customer.customer_type === undefined) customer.customer_type = 'Individual';});
      console.log("Finished upgrading HurvesthubDB to version 3 (customer_type, variety).");
    });

    this.version(4).stores({
      plantingLogs: 'id, seed_batch_id, planting_date, plot_affected, _last_modified, _synced, is_deleted', 
      cultivationLogs: 'id, planting_log_id, activity_date, plot_affected, _last_modified, _synced, is_deleted', 
      inputInventory: 'id, name, type, total_purchase_cost, _last_modified, _synced, is_deleted', 
      customers: 'id, name, customer_type, _last_modified, _synced, is_deleted',
      seedBatches: 'id, crop_id, batch_code, variety, _last_modified, _synced, is_deleted',
      crops: 'id, name, type, _last_modified, _synced, is_deleted',
      harvestLogs: 'id, planting_log_id, harvest_date, _last_modified, _synced, is_deleted',
      sales: 'id, customer_id, sale_date, _last_modified, _synced, is_deleted',
      saleItems: 'id, sale_id, harvest_log_id, _last_modified, _synced, is_deleted',
      invoices: 'id, sale_id, invoice_number, _last_modified, _synced, is_deleted',
      syncMeta: 'id',
    }).upgrade(async _tx => { 
      console.log("Upgrading HurvesthubDB to version 4: Adding plot_affected fields and updating inputInventory schema string.");
      console.log("Finished upgrading HurvesthubDB to version 4.");
    });

    this.version(5).stores({
      trees: 'id, identifier, species, variety, planting_date, plot_affected, _last_modified, _synced, is_deleted', 
      saleItems: 'id, sale_id, harvest_log_id, discount_type, discount_value, _last_modified, _synced, is_deleted',
      plantingLogs: 'id, seed_batch_id, planting_date, plot_affected, _last_modified, _synced, is_deleted', 
      cultivationLogs: 'id, planting_log_id, activity_date, plot_affected, _last_modified, _synced, is_deleted', 
      inputInventory: 'id, name, type, total_purchase_cost, _last_modified, _synced, is_deleted', 
      customers: 'id, name, customer_type, _last_modified, _synced, is_deleted',
      seedBatches: 'id, crop_id, batch_code, variety, _last_modified, _synced, is_deleted',
      crops: 'id, name, type, _last_modified, _synced, is_deleted',
      harvestLogs: 'id, planting_log_id, harvest_date, _last_modified, _synced, is_deleted',
      sales: 'id, customer_id, sale_date, _last_modified, _synced, is_deleted',
      invoices: 'id, sale_id, invoice_number, _last_modified, _synced, is_deleted',
      syncMeta: 'id',
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

    this.version(6).stores({
      crops: 'id, name, variety, type, _last_modified, _synced, is_deleted',
      trees: 'id, identifier, species, variety, planting_date, plot_affected, _last_modified, _synced, is_deleted', 
      saleItems: 'id, sale_id, harvest_log_id, discount_type, discount_value, _last_modified, _synced, is_deleted',
      plantingLogs: 'id, seed_batch_id, planting_date, plot_affected, _last_modified, _synced, is_deleted', 
      cultivationLogs: 'id, planting_log_id, activity_date, plot_affected, _last_modified, _synced, is_deleted', 
      inputInventory: 'id, name, type, total_purchase_cost, _last_modified, _synced, is_deleted', 
      customers: 'id, name, customer_type, _last_modified, _synced, is_deleted',
      seedBatches: 'id, crop_id, batch_code, variety, _last_modified, _synced, is_deleted',
      harvestLogs: 'id, planting_log_id, harvest_date, _last_modified, _synced, is_deleted',
      sales: 'id, customer_id, sale_date, _last_modified, _synced, is_deleted',
      invoices: 'id, sale_id, invoice_number, _last_modified, _synced, is_deleted',
      syncMeta: 'id',
    }).upgrade(async tx => {
      console.log("Upgrading HurvesthubDB to version 6: Adding 'variety' field to crops table.");
      await tx.table('crops').toCollection().modify(crop => { if (crop.variety === undefined) crop.variety = null; });
      console.log("Finished upgrading HurvesthubDB to version 6.");
    });

    this.version(7).stores({
      crops: 'id, name, variety, type, notes, _last_modified, _synced, is_deleted',
      trees: 'id, identifier, species, variety, planting_date, plot_affected, _last_modified, _synced, is_deleted', 
      saleItems: 'id, sale_id, harvest_log_id, discount_type, discount_value, _last_modified, _synced, is_deleted',
      plantingLogs: 'id, seed_batch_id, planting_date, plot_affected, _last_modified, _synced, is_deleted', 
      cultivationLogs: 'id, planting_log_id, activity_date, plot_affected, _last_modified, _synced, is_deleted', 
      inputInventory: 'id, name, type, total_purchase_cost, _last_modified, _synced, is_deleted', 
      customers: 'id, name, customer_type, _last_modified, _synced, is_deleted',
      seedBatches: 'id, crop_id, batch_code, variety, _last_modified, _synced, is_deleted',
      harvestLogs: 'id, planting_log_id, harvest_date, _last_modified, _synced, is_deleted',
      sales: 'id, customer_id, sale_date, _last_modified, _synced, is_deleted',
      invoices: 'id, sale_id, invoice_number, _last_modified, _synced, is_deleted',
      syncMeta: 'id',
    }).upgrade(async tx => {
      console.log("Upgrading HurvesthubDB to version 7: Adding 'notes' field to crops table.");
      await tx.table('crops').toCollection().modify(crop => { if (crop.notes === undefined) crop.notes = null; });
      console.log("Finished upgrading HurvesthubDB to version 7.");
    });

    this.version(8).stores({
      seedBatches: 'id, crop_id, batch_code, _last_modified, _synced, is_deleted', 
      crops: 'id, name, variety, type, notes, _last_modified, _synced, is_deleted',
      trees: 'id, identifier, species, variety, planting_date, plot_affected, _last_modified, _synced, is_deleted', 
      saleItems: 'id, sale_id, harvest_log_id, discount_type, discount_value, _last_modified, _synced, is_deleted',
      plantingLogs: 'id, seed_batch_id, planting_date, plot_affected, _last_modified, _synced, is_deleted', 
      cultivationLogs: 'id, planting_log_id, activity_date, plot_affected, _last_modified, _synced, is_deleted', 
      inputInventory: 'id, name, type, total_purchase_cost, _last_modified, _synced, is_deleted', 
      customers: 'id, name, customer_type, _last_modified, _synced, is_deleted',
      harvestLogs: 'id, planting_log_id, harvest_date, _last_modified, _synced, is_deleted',
      sales: 'id, customer_id, sale_date, _last_modified, _synced, is_deleted',
      invoices: 'id, sale_id, invoice_number, _last_modified, _synced, is_deleted',
      syncMeta: 'id',
    }).upgrade(async tx => {
      console.log("Upgrading HurvesthubDB to version 8: Removing 'variety' field from seedBatches table.");
      await tx.table('seedBatches').toCollection().modify(sb => { delete sb.variety; });
      console.log("Finished upgrading HurvesthubDB to version 8.");
    });
    
    this.version(9).stores({
      seedBatches: 'id, crop_id, batch_code, initial_quantity, current_quantity, _last_modified, _synced, is_deleted', 
      inputInventory: 'id, name, type, total_purchase_cost, current_quantity, _last_modified, _synced, is_deleted',
      crops: 'id, name, variety, type, notes, _last_modified, _synced, is_deleted',
      trees: 'id, identifier, species, variety, planting_date, plot_affected, _last_modified, _synced, is_deleted', 
      saleItems: 'id, sale_id, harvest_log_id, discount_type, discount_value, _last_modified, _synced, is_deleted',
      plantingLogs: 'id, seed_batch_id, planting_date, plot_affected, _last_modified, _synced, is_deleted', 
      cultivationLogs: 'id, planting_log_id, activity_date, plot_affected, _last_modified, _synced, is_deleted', 
      customers: 'id, name, customer_type, _last_modified, _synced, is_deleted',
      harvestLogs: 'id, planting_log_id, harvest_date, _last_modified, _synced, is_deleted',
      sales: 'id, customer_id, sale_date, _last_modified, _synced, is_deleted',
      invoices: 'id, sale_id, invoice_number, _last_modified, _synced, is_deleted',
      syncMeta: 'id',
    }).upgrade(async tx => {
      console.log("Upgrading HurvesthubDB to version 9: Adding 'current_quantity' to seedBatches and inputInventory tables.");
      await tx.table('seedBatches').toCollection().modify(sb => { if (sb.current_quantity === undefined) sb.current_quantity = sb.initial_quantity; });
      await tx.table('inputInventory').toCollection().modify(ii => { if (ii.current_quantity === undefined) ii.current_quantity = ii.initial_quantity; });
      console.log("Finished upgrading HurvesthubDB to version 9.");
    });

    this.version(10).stores({
      reminders: 'id, planting_log_id, reminder_date, activity_type, is_completed, _last_modified, _synced, is_deleted',
      seedBatches: 'id, crop_id, batch_code, initial_quantity, current_quantity, _last_modified, _synced, is_deleted', 
      inputInventory: 'id, name, type, total_purchase_cost, current_quantity, _last_modified, _synced, is_deleted',
      crops: 'id, name, variety, type, notes, _last_modified, _synced, is_deleted',
      trees: 'id, identifier, species, variety, planting_date, plot_affected, _last_modified, _synced, is_deleted', 
      saleItems: 'id, sale_id, harvest_log_id, discount_type, discount_value, _last_modified, _synced, is_deleted',
      plantingLogs: 'id, seed_batch_id, planting_date, plot_affected, _last_modified, _synced, is_deleted', 
      cultivationLogs: 'id, planting_log_id, activity_date, plot_affected, _last_modified, _synced, is_deleted', 
      customers: 'id, name, customer_type, _last_modified, _synced, is_deleted',
      harvestLogs: 'id, planting_log_id, harvest_date, _last_modified, _synced, is_deleted',
      sales: 'id, customer_id, sale_date, _last_modified, _synced, is_deleted',
      invoices: 'id, sale_id, invoice_number, _last_modified, _synced, is_deleted',
      syncMeta: 'id',
    }).upgrade(async _tx => { 
        console.log("Upgrading HurvesthubDB to version 10: Adding Reminders table.");
        console.log("Finished upgrading HurvesthubDB to version 10.");
    });

    this.version(11).stores({
      seedBatches: 'id, crop_id, batch_code, initial_quantity, current_quantity, qr_code_data, _last_modified, _synced, is_deleted', 
      inputInventory: 'id, name, type, total_purchase_cost, current_quantity, qr_code_data, _last_modified, _synced, is_deleted',
      reminders: 'id, planting_log_id, reminder_date, activity_type, is_completed, _last_modified, _synced, is_deleted',
      crops: 'id, name, variety, type, notes, _last_modified, _synced, is_deleted',
      trees: 'id, identifier, species, variety, planting_date, plot_affected, _last_modified, _synced, is_deleted', 
      saleItems: 'id, sale_id, harvest_log_id, discount_type, discount_value, _last_modified, _synced, is_deleted',
      plantingLogs: 'id, seed_batch_id, planting_date, plot_affected, _last_modified, _synced, is_deleted', 
      cultivationLogs: 'id, planting_log_id, activity_date, plot_affected, _last_modified, _synced, is_deleted', 
      customers: 'id, name, customer_type, _last_modified, _synced, is_deleted',
      harvestLogs: 'id, planting_log_id, harvest_date, _last_modified, _synced, is_deleted',
      sales: 'id, customer_id, sale_date, _last_modified, _synced, is_deleted',
      invoices: 'id, sale_id, invoice_number, _last_modified, _synced, is_deleted',
      syncMeta: 'id',
    }).upgrade(async tx => {
        console.log("Upgrading HurvesthubDB to version 11: Adding 'qr_code_data' to seedBatches and inputInventory tables.");
        await tx.table('seedBatches').toCollection().modify(sb => { if (sb.qr_code_data === undefined) sb.qr_code_data = null; });
        await tx.table('inputInventory').toCollection().modify(ii => { if (ii.qr_code_data === undefined) ii.qr_code_data = null; });
        console.log("Finished upgrading HurvesthubDB to version 11.");
    });

    this.version(12).stores({
      seedlingProductionLogs: 'id, seed_batch_id, crop_id, sowing_date, _last_modified, _synced, is_deleted',
      plantingLogs: 'id, seedling_production_log_id, seed_batch_id, planting_date, plot_affected, _last_modified, _synced, is_deleted',
      seedBatches: 'id, crop_id, batch_code, initial_quantity, current_quantity, qr_code_data, _last_modified, _synced, is_deleted', 
      inputInventory: 'id, name, type, total_purchase_cost, current_quantity, qr_code_data, _last_modified, _synced, is_deleted',
      reminders: 'id, planting_log_id, reminder_date, activity_type, is_completed, _last_modified, _synced, is_deleted',
      crops: 'id, name, variety, type, notes, _last_modified, _synced, is_deleted',
      trees: 'id, identifier, species, variety, planting_date, plot_affected, _last_modified, _synced, is_deleted', 
      saleItems: 'id, sale_id, harvest_log_id, discount_type, discount_value, _last_modified, _synced, is_deleted',
      cultivationLogs: 'id, planting_log_id, activity_date, plot_affected, _last_modified, _synced, is_deleted', 
      customers: 'id, name, customer_type, _last_modified, _synced, is_deleted',
      harvestLogs: 'id, planting_log_id, harvest_date, _last_modified, _synced, is_deleted',
      sales: 'id, customer_id, sale_date, _last_modified, _synced, is_deleted',
      invoices: 'id, sale_id, invoice_number, _last_modified, _synced, is_deleted',
      syncMeta: 'id',
    }).upgrade(async tx => { 
      console.log("Upgrading HurvesthubDB to version 12: Adding SeedlingProductionLog table and modifying PlantingLog table.");
      await tx.table('plantingLogs').toCollection().modify(pl => {
        if (pl.seedling_production_log_id === undefined) pl.seedling_production_log_id = null;
        if (pl.seed_batch_id === undefined) pl.seed_batch_id = null;
      });
      console.log("Finished upgrading HurvesthubDB to version 12.");
    });

    this.version(13).stores({
      seedBatches: 'id, crop_id, batch_code, initial_quantity, current_quantity, qr_code_data, supplier_id, _last_modified, _synced, is_deleted', 
      inputInventory: 'id, name, type, total_purchase_cost, current_quantity, qr_code_data, supplier_id, _last_modified, _synced, is_deleted', 
      seedlingProductionLogs: 'id, seed_batch_id, crop_id, sowing_date, _last_modified, _synced, is_deleted',
      plantingLogs: 'id, seedling_production_log_id, seed_batch_id, planting_date, plot_affected, _last_modified, _synced, is_deleted',
      reminders: 'id, planting_log_id, reminder_date, activity_type, is_completed, _last_modified, _synced, is_deleted',
      crops: 'id, name, variety, type, notes, _last_modified, _synced, is_deleted',
      trees: 'id, identifier, species, variety, planting_date, plot_affected, _last_modified, _synced, is_deleted', 
      saleItems: 'id, sale_id, harvest_log_id, discount_type, discount_value, _last_modified, _synced, is_deleted',
      cultivationLogs: 'id, planting_log_id, activity_date, plot_affected, _last_modified, _synced, is_deleted', 
      customers: 'id, name, customer_type, _last_modified, _synced, is_deleted',
      harvestLogs: 'id, planting_log_id, harvest_date, _last_modified, _synced, is_deleted',
      sales: 'id, customer_id, sale_date, _last_modified, _synced, is_deleted',
      invoices: 'id, sale_id, invoice_number, _last_modified, _synced, is_deleted',
      syncMeta: 'id',
    }).upgrade(async tx => {
        console.log("Upgrading HurvesthubDB to version 13: Adding supplier_id and removing old supplier string.");
        await tx.table('seedBatches').toCollection().modify(sb => {
            if (sb.supplier) delete sb.supplier; 
            if (sb.supplier_id === undefined) sb.supplier_id = null; 
        });
        await tx.table('inputInventory').toCollection().modify(ii => {
            if (ii.supplier) delete ii.supplier; 
            if (ii.supplier_id === undefined) ii.supplier_id = null; 
        });
        console.log("Finished upgrading HurvesthubDB to version 13.");
    });

    this.version(14).stores({
      suppliers: 'id, name, _last_modified, _synced, is_deleted',
      seedBatches: 'id, crop_id, batch_code, initial_quantity, current_quantity, qr_code_data, supplier_id, _last_modified, _synced, is_deleted', 
      inputInventory: 'id, name, type, total_purchase_cost, current_quantity, qr_code_data, supplier_id, _last_modified, _synced, is_deleted', 
      seedlingProductionLogs: 'id, seed_batch_id, crop_id, sowing_date, _last_modified, _synced, is_deleted',
      plantingLogs: 'id, seedling_production_log_id, seed_batch_id, planting_date, plot_affected, _last_modified, _synced, is_deleted',
      reminders: 'id, planting_log_id, reminder_date, activity_type, is_completed, _last_modified, _synced, is_deleted',
      crops: 'id, name, variety, type, notes, _last_modified, _synced, is_deleted',
      trees: 'id, identifier, species, variety, planting_date, plot_affected, _last_modified, _synced, is_deleted', 
      saleItems: 'id, sale_id, harvest_log_id, discount_type, discount_value, _last_modified, _synced, is_deleted',
      cultivationLogs: 'id, planting_log_id, activity_date, plot_affected, _last_modified, _synced, is_deleted', 
      customers: 'id, name, customer_type, _last_modified, _synced, is_deleted',
      harvestLogs: 'id, planting_log_id, harvest_date, _last_modified, _synced, is_deleted',
      sales: 'id, customer_id, sale_date, _last_modified, _synced, is_deleted',
      invoices: 'id, sale_id, invoice_number, _last_modified, _synced, is_deleted',
      syncMeta: 'id',
    }).upgrade(async _tx => {
      console.log("Upgrading HurvesthubDB to version 14: Adding Suppliers table.");
      console.log("Finished upgrading HurvesthubDB to version 14.");
    });

    this.version(15).stores({
      cultivationLogs: 'id, planting_log_id, activity_date, plot_affected, input_inventory_id, _last_modified, _synced, is_deleted',
      suppliers: 'id, name, _last_modified, _synced, is_deleted',
      seedBatches: 'id, crop_id, batch_code, initial_quantity, current_quantity, qr_code_data, supplier_id, _last_modified, _synced, is_deleted', 
      inputInventory: 'id, name, type, total_purchase_cost, current_quantity, qr_code_data, supplier_id, _last_modified, _synced, is_deleted', 
      seedlingProductionLogs: 'id, seed_batch_id, crop_id, sowing_date, _last_modified, _synced, is_deleted',
      plantingLogs: 'id, seedling_production_log_id, seed_batch_id, planting_date, plot_affected, _last_modified, _synced, is_deleted',
      reminders: 'id, planting_log_id, reminder_date, activity_type, is_completed, _last_modified, _synced, is_deleted',
      crops: 'id, name, variety, type, notes, _last_modified, _synced, is_deleted',
      trees: 'id, identifier, species, variety, planting_date, plot_affected, _last_modified, _synced, is_deleted', 
      saleItems: 'id, sale_id, harvest_log_id, discount_type, discount_value, _last_modified, _synced, is_deleted',
      customers: 'id, name, customer_type, _last_modified, _synced, is_deleted',
      harvestLogs: 'id, planting_log_id, harvest_date, _last_modified, _synced, is_deleted',
      sales: 'id, customer_id, sale_date, _last_modified, _synced, is_deleted',
      invoices: 'id, sale_id, invoice_number, _last_modified, _synced, is_deleted',
      syncMeta: 'id',
    }).upgrade(async tx => {
      console.log("Upgrading HurvesthubDB to version 15: Adding 'input_inventory_id' to cultivationLogs table.");
      await tx.table('cultivationLogs').toCollection().modify(cl => { if (cl.input_inventory_id === undefined) cl.input_inventory_id = null; });
      console.log("Finished upgrading HurvesthubDB to version 15.");
    });

  this.version(16).stores({
    inputInventory: 'id, name, type, supplier_id, supplier_invoice_number, total_purchase_cost, current_quantity, qr_code_data, _last_modified, _synced, is_deleted',
    suppliers: 'id, name, _last_modified, _synced, is_deleted',
    seedBatches: 'id, crop_id, batch_code, initial_quantity, current_quantity, qr_code_data, supplier_id, _last_modified, _synced, is_deleted', 
    seedlingProductionLogs: 'id, seed_batch_id, crop_id, sowing_date, _last_modified, _synced, is_deleted',
    plantingLogs: 'id, seedling_production_log_id, seed_batch_id, planting_date, plot_affected, _last_modified, _synced, is_deleted',
    reminders: 'id, planting_log_id, reminder_date, activity_type, is_completed, _last_modified, _synced, is_deleted',
    crops: 'id, name, variety, type, notes, _last_modified, _synced, is_deleted',
    trees: 'id, identifier, species, variety, planting_date, plot_affected, _last_modified, _synced, is_deleted', 
    cultivationLogs: 'id, planting_log_id, activity_date, plot_affected, input_inventory_id, _last_modified, _synced, is_deleted',
    saleItems: 'id, sale_id, harvest_log_id, discount_type, discount_value, _last_modified, _synced, is_deleted',
    customers: 'id, name, customer_type, _last_modified, _synced, is_deleted',
    harvestLogs: 'id, planting_log_id, harvest_date, _last_modified, _synced, is_deleted',
    sales: 'id, customer_id, sale_date, _last_modified, _synced, is_deleted',
    invoices: 'id, sale_id, invoice_number, _last_modified, _synced, is_deleted',
    syncMeta: 'id',
  }).upgrade(async tx => {
    console.log("Upgrading HurvesthubDB to version 16: Adding 'supplier_invoice_number' to inputInventory table.");
    await tx.table('inputInventory').toCollection().modify(ii => { if (ii.supplier_invoice_number === undefined) ii.supplier_invoice_number = null; });
    console.log("Finished upgrading HurvesthubDB to version 16.");
  });

  this.version(17).stores({
    flocks: 'id, name, flock_type, hatch_date, _last_modified, _synced, is_deleted', 
    flock_records: 'id, flock_id, record_type, record_date, _last_modified, _synced, is_deleted',
    feed_logs: 'id, flock_id, feed_date, feed_type_id, _last_modified, _synced, is_deleted',
    inputInventory: 'id, name, type, supplier_id, supplier_invoice_number, total_purchase_cost, current_quantity, qr_code_data, _last_modified, _synced, is_deleted',
    suppliers: 'id, name, _last_modified, _synced, is_deleted',
    seedBatches: 'id, crop_id, batch_code, initial_quantity, current_quantity, qr_code_data, supplier_id, _last_modified, _synced, is_deleted', 
    seedlingProductionLogs: 'id, seed_batch_id, crop_id, sowing_date, _last_modified, _synced, is_deleted',
    plantingLogs: 'id, seedling_production_log_id, seed_batch_id, planting_date, plot_affected, _last_modified, _synced, is_deleted',
    reminders: 'id, planting_log_id, reminder_date, activity_type, is_completed, _last_modified, _synced, is_deleted',
    crops: 'id, name, variety, type, notes, _last_modified, _synced, is_deleted',
    trees: 'id, identifier, species, variety, planting_date, plot_affected, _last_modified, _synced, is_deleted', 
    cultivationLogs: 'id, planting_log_id, activity_date, plot_affected, input_inventory_id, _last_modified, _synced, is_deleted',
    saleItems: 'id, sale_id, harvest_log_id, discount_type, discount_value, _last_modified, _synced, is_deleted',
    customers: 'id, name, customer_type, _last_modified, _synced, is_deleted',
    harvestLogs: 'id, planting_log_id, harvest_date, _last_modified, _synced, is_deleted',
    sales: 'id, customer_id, sale_date, _last_modified, _synced, is_deleted',
    invoices: 'id, sale_id, invoice_number, _last_modified, _synced, is_deleted',
    syncMeta: 'id',
  }).upgrade(async tx => {
    console.log("Upgrading HurvesthubDB to version 17: Adding Poultry Module tables.");
    console.log("Finished upgrading HurvesthubDB to version 17.");
  });

  this.version(18).stores({
    inputInventory: 'id, name, type, supplier_id, supplier_invoice_number, total_purchase_cost, current_quantity, minimum_stock_level, qr_code_data, _last_modified, _synced, is_deleted',
    feed_logs: 'id, flock_id, feed_date, feed_type_id, feed_cost, _last_modified, _synced, is_deleted', 
    flocks: 'id, name, flock_type, hatch_date, _last_modified, _synced, is_deleted', 
    flock_records: 'id, flock_id, record_type, record_date, _last_modified, _synced, is_deleted', 
    suppliers: 'id, name, _last_modified, _synced, is_deleted',
    crops: 'id, name, variety, type, notes, _last_modified, _synced, is_deleted',
    seedBatches: 'id, crop_id, batch_code, initial_quantity, current_quantity, qr_code_data, supplier_id, _last_modified, _synced, is_deleted',
    plantingLogs: 'id, seedling_production_log_id, seed_batch_id, planting_date, plot_affected, _last_modified, _synced, is_deleted',
    cultivationLogs: 'id, planting_log_id, activity_date, plot_affected, input_inventory_id, _last_modified, _synced, is_deleted',
    harvestLogs: 'id, planting_log_id, harvest_date, _last_modified, _synced, is_deleted',
    customers: 'id, name, customer_type, _last_modified, _synced, is_deleted',
    sales: 'id, customer_id, sale_date, _last_modified, _synced, is_deleted',
    saleItems: 'id, sale_id, harvest_log_id, discount_type, discount_value, _last_modified, _synced, is_deleted',
    invoices: 'id, sale_id, invoice_number, _last_modified, _synced, is_deleted',
    syncMeta: 'id',
    trees: 'id, identifier, species, variety, planting_date, plot_affected, _last_modified, _synced, is_deleted',
    reminders: 'id, planting_log_id, reminder_date, activity_type, is_completed, _last_modified, _synced, is_deleted',
    seedlingProductionLogs: 'id, seed_batch_id, crop_id, sowing_date, _last_modified, _synced, is_deleted'
  }).upgrade(async tx => {
    console.log("Upgrading HurvesthubDB to version 18: Adding minimum_stock_level and feed_cost.");
    await tx.table('inputInventory').toCollection().modify(item => { if (item.minimum_stock_level === undefined) item.minimum_stock_level = null; });
    await tx.table('feed_logs').toCollection().modify(log => { if (log.feed_cost === undefined) log.feed_cost = null; });
    console.log("Finished upgrading HurvesthubDB to version 18.");
  });

  this.version(19).stores({
    flock_records: 'id, flock_id, record_type, record_date, weight_kg_total, _last_modified, _synced, is_deleted', 
    inputInventory: 'id, name, type, supplier_id, supplier_invoice_number, total_purchase_cost, current_quantity, minimum_stock_level, qr_code_data, _last_modified, _synced, is_deleted',
    feed_logs: 'id, flock_id, feed_date, feed_type_id, feed_cost, _last_modified, _synced, is_deleted',
    flocks: 'id, name, flock_type, hatch_date, _last_modified, _synced, is_deleted',
    suppliers: 'id, name, _last_modified, _synced, is_deleted',
    crops: 'id, name, variety, type, notes, _last_modified, _synced, is_deleted',
    seedBatches: 'id, crop_id, batch_code, initial_quantity, current_quantity, qr_code_data, supplier_id, _last_modified, _synced, is_deleted',
    plantingLogs: 'id, seedling_production_log_id, seed_batch_id, planting_date, plot_affected, _last_modified, _synced, is_deleted',
    cultivationLogs: 'id, planting_log_id, activity_date, plot_affected, input_inventory_id, _last_modified, _synced, is_deleted',
    harvestLogs: 'id, planting_log_id, harvest_date, _last_modified, _synced, is_deleted',
    customers: 'id, name, customer_type, _last_modified, _synced, is_deleted',
    sales: 'id, customer_id, sale_date, _last_modified, _synced, is_deleted',
    saleItems: 'id, sale_id, harvest_log_id, discount_type, discount_value, _last_modified, _synced, is_deleted',
    invoices: 'id, sale_id, invoice_number, _last_modified, _synced, is_deleted',
    syncMeta: 'id',
    trees: 'id, identifier, species, variety, planting_date, plot_affected, _last_modified, _synced, is_deleted',
    reminders: 'id, planting_log_id, reminder_date, activity_type, is_completed, _last_modified, _synced, is_deleted',
    seedlingProductionLogs: 'id, seed_batch_id, crop_id, sowing_date, _last_modified, _synced, is_deleted'
  }).upgrade(async tx => {
    console.log("Upgrading HurvesthubDB to version 19: Adding weight_kg_total to FlockRecord.");
    await tx.table('flock_records').toCollection().modify(record => { if (record.weight_kg_total === undefined) record.weight_kg_total = null; });
    console.log("Finished upgrading HurvesthubDB to version 19.");
  });

  // Version 20: Added cost to FlockRecord
  this.version(20).stores({
    flock_records: 'id, flock_id, record_type, record_date, weight_kg_total, cost, _last_modified, _synced, is_deleted', 
    inputInventory: 'id, name, type, supplier_id, supplier_invoice_number, total_purchase_cost, current_quantity, minimum_stock_level, qr_code_data, _last_modified, _synced, is_deleted',
    feed_logs: 'id, flock_id, feed_date, feed_type_id, feed_cost, _last_modified, _synced, is_deleted',
    flocks: 'id, name, flock_type, hatch_date, _last_modified, _synced, is_deleted',
    suppliers: 'id, name, _last_modified, _synced, is_deleted',
    crops: 'id, name, variety, type, notes, _last_modified, _synced, is_deleted',
    seedBatches: 'id, crop_id, batch_code, initial_quantity, current_quantity, qr_code_data, supplier_id, _last_modified, _synced, is_deleted',
    plantingLogs: 'id, seedling_production_log_id, seed_batch_id, planting_date, plot_affected, _last_modified, _synced, is_deleted',
    cultivationLogs: 'id, planting_log_id, activity_date, plot_affected, input_inventory_id, _last_modified, _synced, is_deleted',
    harvestLogs: 'id, planting_log_id, harvest_date, _last_modified, _synced, is_deleted',
    customers: 'id, name, customer_type, _last_modified, _synced, is_deleted',
    sales: 'id, customer_id, sale_date, _last_modified, _synced, is_deleted',
    saleItems: 'id, sale_id, harvest_log_id, discount_type, discount_value, _last_modified, _synced, is_deleted',
    invoices: 'id, sale_id, invoice_number, _last_modified, _synced, is_deleted',
    syncMeta: 'id',
    trees: 'id, identifier, species, variety, planting_date, plot_affected, _last_modified, _synced, is_deleted',
    reminders: 'id, planting_log_id, reminder_date, activity_type, is_completed, _last_modified, _synced, is_deleted',
    seedlingProductionLogs: 'id, seed_batch_id, crop_id, sowing_date, _last_modified, _synced, is_deleted'
  }).upgrade(async tx => {
    console.log("Upgrading HurvesthubDB to version 20: Adding cost to FlockRecord.");
    await tx.table('flock_records').toCollection().modify(record => { if (record.cost === undefined) record.cost = null; });
    console.log("Finished upgrading HurvesthubDB to version 20.");
  });

  // Version 21: Added revenue to FlockRecord and 'egg_sale' type, flock_id to Reminder
  this.version(21).stores({
    flock_records: 'id, flock_id, record_type, record_date, weight_kg_total, cost, revenue, _last_modified, _synced, is_deleted', 
    reminders: 'id, planting_log_id, flock_id, reminder_date, activity_type, is_completed, _last_modified, _synced, is_deleted', 
    inputInventory: 'id, name, type, supplier_id, supplier_invoice_number, total_purchase_cost, current_quantity, minimum_stock_level, qr_code_data, _last_modified, _synced, is_deleted',
    feed_logs: 'id, flock_id, feed_date, feed_type_id, feed_cost, _last_modified, _synced, is_deleted',
    flocks: 'id, name, flock_type, hatch_date, _last_modified, _synced, is_deleted',
    suppliers: 'id, name, _last_modified, _synced, is_deleted',
    crops: 'id, name, variety, type, notes, _last_modified, _synced, is_deleted',
    seedBatches: 'id, crop_id, batch_code, initial_quantity, current_quantity, qr_code_data, supplier_id, _last_modified, _synced, is_deleted',
    plantingLogs: 'id, seedling_production_log_id, seed_batch_id, planting_date, plot_affected, _last_modified, _synced, is_deleted',
    cultivationLogs: 'id, planting_log_id, activity_date, plot_affected, input_inventory_id, _last_modified, _synced, is_deleted',
    harvestLogs: 'id, planting_log_id, harvest_date, _last_modified, _synced, is_deleted',
    customers: 'id, name, customer_type, _last_modified, _synced, is_deleted',
    sales: 'id, customer_id, sale_date, _last_modified, _synced, is_deleted',
    saleItems: 'id, sale_id, harvest_log_id, discount_type, discount_value, _last_modified, _synced, is_deleted',
    invoices: 'id, sale_id, invoice_number, _last_modified, _synced, is_deleted',
    syncMeta: 'id',
    trees: 'id, identifier, species, variety, planting_date, plot_affected, _last_modified, _synced, is_deleted',
    seedlingProductionLogs: 'id, seed_batch_id, crop_id, sowing_date, _last_modified, _synced, is_deleted'
  }).upgrade(async tx => {
    console.log("Upgrading HurvesthubDB to version 21: Adding revenue to FlockRecord and flock_id to Reminder.");
    await tx.table('flock_records').toCollection().modify(record => { if (record.revenue === undefined) record.revenue = null; });
    await tx.table('reminders').toCollection().modify(reminder => { if (reminder.flock_id === undefined) reminder.flock_id = null; });
    console.log("Finished upgrading HurvesthubDB to version 21.");
  });

  // Version 22: Added PreventiveMeasureSchedule table
  this.version(22).stores({
    preventive_measure_schedules: 'id, name, measure_type, target_species, trigger_offset_days, is_recurring, _last_modified, _synced, is_deleted', // Restored full schema
    flock_records: 'id, flock_id, record_type, record_date, weight_kg_total, cost, revenue, _last_modified, _synced, is_deleted',
    inputInventory: 'id, name, type, supplier_id, supplier_invoice_number, total_purchase_cost, current_quantity, minimum_stock_level, qr_code_data, _last_modified, _synced, is_deleted',
    feed_logs: 'id, flock_id, feed_date, feed_type_id, feed_cost, _last_modified, _synced, is_deleted',
    flocks: 'id, name, flock_type, hatch_date, _last_modified, _synced, is_deleted', // Schema before species
    suppliers: 'id, name, _last_modified, _synced, is_deleted',
    crops: 'id, name, variety, type, notes, _last_modified, _synced, is_deleted',
    seedBatches: 'id, crop_id, batch_code, initial_quantity, current_quantity, qr_code_data, supplier_id, _last_modified, _synced, is_deleted',
    plantingLogs: 'id, seedling_production_log_id, seed_batch_id, planting_date, plot_affected, _last_modified, _synced, is_deleted',
    cultivationLogs: 'id, planting_log_id, activity_date, plot_affected, input_inventory_id, _last_modified, _synced, is_deleted',
    harvestLogs: 'id, planting_log_id, harvest_date, _last_modified, _synced, is_deleted',
    customers: 'id, name, customer_type, _last_modified, _synced, is_deleted',
    sales: 'id, customer_id, sale_date, _last_modified, _synced, is_deleted',
    saleItems: 'id, sale_id, harvest_log_id, discount_type, discount_value, _last_modified, _synced, is_deleted',
    invoices: 'id, sale_id, invoice_number, _last_modified, _synced, is_deleted',
    syncMeta: 'id',
    trees: 'id, identifier, species, variety, planting_date, plot_affected, _last_modified, _synced, is_deleted',
    reminders: 'id, planting_log_id, flock_id, reminder_date, activity_type, is_completed, _last_modified, _synced, is_deleted',
    seedlingProductionLogs: 'id, seed_batch_id, crop_id, sowing_date, _last_modified, _synced, is_deleted'
  }).upgrade(async tx => {
    console.log("Upgrading HurvesthubDB to version 22: Adding PreventiveMeasureSchedule table.");
    console.log("Finished upgrading HurvesthubDB to version 22.");
  });

  // Version 23: Added species to Flock table
  this.version(23).stores({
    flocks: 'id, name, flock_type, species, hatch_date, _last_modified, _synced, is_deleted',
    preventive_measure_schedules: 'id, name, measure_type, target_species, trigger_offset_days, is_recurring, _last_modified, _synced, is_deleted',
    flock_records: 'id, flock_id, record_type, record_date, weight_kg_total, cost, revenue, _last_modified, _synced, is_deleted',
    inputInventory: 'id, name, type, supplier_id, supplier_invoice_number, total_purchase_cost, current_quantity, minimum_stock_level, qr_code_data, _last_modified, _synced, is_deleted',
    feed_logs: 'id, flock_id, feed_date, feed_type_id, feed_cost, _last_modified, _synced, is_deleted',
    suppliers: 'id, name, _last_modified, _synced, is_deleted',
    crops: 'id, name, variety, type, notes, _last_modified, _synced, is_deleted',
    seedBatches: 'id, crop_id, batch_code, initial_quantity, current_quantity, qr_code_data, supplier_id, _last_modified, _synced, is_deleted',
    plantingLogs: 'id, seedling_production_log_id, seed_batch_id, planting_date, plot_affected, _last_modified, _synced, is_deleted',
    cultivationLogs: 'id, planting_log_id, activity_date, plot_affected, input_inventory_id, _last_modified, _synced, is_deleted',
    harvestLogs: 'id, planting_log_id, harvest_date, _last_modified, _synced, is_deleted',
    customers: 'id, name, customer_type, _last_modified, _synced, is_deleted',
    sales: 'id, customer_id, sale_date, payment_method, payment_status, amount_paid, _last_modified, _synced, is_deleted', // Added payment fields
    saleItems: 'id, sale_id, harvest_log_id, discount_type, discount_value, _last_modified, _synced, is_deleted',
    invoices: 'id, sale_id, invoice_number, _last_modified, _synced, is_deleted',
    syncMeta: 'id',
    trees: 'id, identifier, species, variety, planting_date, plot_affected, _last_modified, _synced, is_deleted',
    reminders: 'id, planting_log_id, flock_id, reminder_date, activity_type, is_completed, _last_modified, _synced, is_deleted',
    seedlingProductionLogs: 'id, seed_batch_id, crop_id, sowing_date, _last_modified, _synced, is_deleted'
  }).upgrade(async tx => {
    console.log("Upgrading HurvesthubDB to version 23: Adding 'species' field to flocks table.");
    await tx.table('flocks').toCollection().modify((flock: Flock) => { // Added type for flock
      if (flock.species === undefined) {
        flock.species = 'chicken';
      }
    });
    console.log("Finished upgrading HurvesthubDB to version 23.");
  });

  // Version 24: Added payment_method, payment_status, amount_paid to Sales table
  this.version(24).stores({
    sales: 'id, customer_id, sale_date, payment_method, payment_status, amount_paid, _last_modified, _synced, is_deleted', // payment_history is not indexed
    // Re-declare ALL other tables with their LATEST schema strings from version 23
    flocks: 'id, name, flock_type, species, hatch_date, _last_modified, _synced, is_deleted',
    preventive_measure_schedules: 'id, name, measure_type, target_species, trigger_offset_days, is_recurring, _last_modified, _synced, is_deleted',
    flock_records: 'id, flock_id, record_type, record_date, weight_kg_total, cost, revenue, _last_modified, _synced, is_deleted',
    inputInventory: 'id, name, type, supplier_id, supplier_invoice_number, total_purchase_cost, current_quantity, minimum_stock_level, qr_code_data, _last_modified, _synced, is_deleted',
    feed_logs: 'id, flock_id, feed_date, feed_type_id, feed_cost, _last_modified, _synced, is_deleted',
    suppliers: 'id, name, _last_modified, _synced, is_deleted',
    crops: 'id, name, variety, type, notes, _last_modified, _synced, is_deleted',
    seedBatches: 'id, crop_id, batch_code, initial_quantity, current_quantity, qr_code_data, supplier_id, _last_modified, _synced, is_deleted',
    plantingLogs: 'id, seedling_production_log_id, seed_batch_id, planting_date, plot_affected, _last_modified, _synced, is_deleted',
    cultivationLogs: 'id, planting_log_id, activity_date, plot_affected, input_inventory_id, _last_modified, _synced, is_deleted',
    harvestLogs: 'id, planting_log_id, harvest_date, _last_modified, _synced, is_deleted',
    customers: 'id, name, customer_type, _last_modified, _synced, is_deleted',
    saleItems: 'id, sale_id, harvest_log_id, discount_type, discount_value, _last_modified, _synced, is_deleted',
    invoices: 'id, sale_id, invoice_number, _last_modified, _synced, is_deleted',
    syncMeta: 'id',
    trees: 'id, identifier, species, variety, planting_date, plot_affected, _last_modified, _synced, is_deleted',
    reminders: 'id, planting_log_id, flock_id, reminder_date, activity_type, is_completed, _last_modified, _synced, is_deleted',
    seedlingProductionLogs: 'id, seed_batch_id, crop_id, sowing_date, _last_modified, _synced, is_deleted'
  }).upgrade(async tx => {
    console.log("Upgrading HurvesthubDB to version 24: Adding payment fields to sales table.");
    await tx.table('sales').toCollection().modify((sale: Sale) => {
      if (sale.payment_method === undefined) sale.payment_method = 'on_account';
      if (sale.payment_status === undefined) sale.payment_status = 'unpaid';
      if (sale.amount_paid === undefined) sale.amount_paid = 0;
      // payment_history will be undefined for old records, which is fine.
    });
    console.log("Finished upgrading HurvesthubDB to version 24.");
  });

  // Version 25: Added payment_history to Sales table (not indexed)
  this.version(25).stores({
    sales: 'id, customer_id, sale_date, payment_method, payment_status, amount_paid, _last_modified, _synced, is_deleted', // Schema string remains same as payment_history is not indexed
    // Re-declare ALL other tables with their LATEST schema strings from version 24
    flocks: 'id, name, flock_type, species, hatch_date, _last_modified, _synced, is_deleted',
    preventive_measure_schedules: 'id, name, measure_type, target_species, trigger_offset_days, is_recurring, _last_modified, _synced, is_deleted',
    flock_records: 'id, flock_id, record_type, record_date, weight_kg_total, cost, revenue, _last_modified, _synced, is_deleted',
    inputInventory: 'id, name, type, supplier_id, supplier_invoice_number, total_purchase_cost, current_quantity, minimum_stock_level, qr_code_data, _last_modified, _synced, is_deleted',
    feed_logs: 'id, flock_id, feed_date, feed_type_id, feed_cost, _last_modified, _synced, is_deleted',
    suppliers: 'id, name, _last_modified, _synced, is_deleted',
    crops: 'id, name, variety, type, notes, _last_modified, _synced, is_deleted',
    seedBatches: 'id, crop_id, batch_code, initial_quantity, current_quantity, qr_code_data, supplier_id, _last_modified, _synced, is_deleted',
    plantingLogs: 'id, seedling_production_log_id, seed_batch_id, planting_date, plot_affected, _last_modified, _synced, is_deleted',
    cultivationLogs: 'id, planting_log_id, activity_date, plot_affected, input_inventory_id, _last_modified, _synced, is_deleted',
    harvestLogs: 'id, planting_log_id, harvest_date, _last_modified, _synced, is_deleted',
    customers: 'id, name, customer_type, _last_modified, _synced, is_deleted',
    saleItems: 'id, sale_id, harvest_log_id, discount_type, discount_value, _last_modified, _synced, is_deleted',
    invoices: 'id, sale_id, invoice_number, _last_modified, _synced, is_deleted',
    syncMeta: 'id',
    trees: 'id, identifier, species, variety, planting_date, plot_affected, _last_modified, _synced, is_deleted',
    reminders: 'id, planting_log_id, flock_id, reminder_date, activity_type, is_completed, _last_modified, _synced, is_deleted',
    seedlingProductionLogs: 'id, seed_batch_id, crop_id, sowing_date, _last_modified, _synced, is_deleted'
  }).upgrade(async tx => {
    console.log("Upgrading HurvesthubDB to version 25: Adding 'payment_history' field to sales table (data migration: initialize as empty array if undefined).");
    await tx.table('sales').toCollection().modify((sale: Sale) => {
      if (sale.payment_history === undefined) {
        sale.payment_history = [];
      }
    });
    console.log("Finished upgrading HurvesthubDB to version 25.");
  });

    // Post-versioning sanity check for table instantiation
    try {
      console.log("DB Constructor: Attempting to access table names post-versioning.");
      console.log("DB Constructor: Accessing crops.name:", this.crops.name);
      if (this.preventive_measure_schedules) {
         console.log("DB Constructor: Accessing preventive_measure_schedules.name:", this.preventive_measure_schedules.name);
      } else {
         console.error("DB Constructor: this.preventive_measure_schedules is undefined before accessing .name");
      }
      console.log("DB Constructor: Table names accessed successfully (or check attempted).");
    } catch (e) {
      console.error("DB Constructor: Error accessing table names post-versioning. This indicates a table didn't instantiate correctly.", e);
    }
  }

  async markForSync<T extends { id: string; _last_modified?: number; _synced?: number; is_deleted?: number; deleted_at?: string; }>(
    tableName: HurvesthubTableName,
    itemId: string,
    itemChanges: Partial<T>, 
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
    const table = this.table(tableName) as Table<T, string>;
    if (!table) {
      console.error(`[HurvesthubDB.markForSync] Table object not found for tableName: "${tableName}". 'this' context keys:`, Object.keys(this));
      throw new Error(`[HurvesthubDB.markForSync] Table "${tableName}" could not be retrieved from the database instance. Ensure it is a valid, initialized table name.`);
    }
    return table.update(itemId, dataToUpdate as UpdateSpec<T>);
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
}

export const db = new HurvesthubDB();

export async function getSyncStatus(): Promise<Record<string, { unsynced: number, total: number }>> {
    const status: Record<string, { unsynced: number, total: number }> = {};
    const tableNames: HurvesthubTableName[] = [
        'crops', 'seedBatches', 'inputInventory', 'plantingLogs', 
        'cultivationLogs', 'harvestLogs', 'customers', 'sales', 
        'saleItems', 'invoices', 'trees', 'reminders', 
        'seedlingProductionLogs', 'suppliers',
        'flocks', 'flock_records', 'feed_logs',
        'preventive_measure_schedules' 
    ];

    for (const tableName of tableNames) {
        const table = db.table(tableName);
        if (table) {
            const unsyncedCount = await table.where('_synced').equals(0).count();
            const totalCount = await table.count();
            status[tableName] = { unsynced: unsyncedCount, total: totalCount };
        } else {
            console.warn(`[getSyncStatus] Table "${tableName}" not found in db instance.`);
            status[tableName] = { unsynced: 0, total: 0 };
        }
    }
    return status;
}