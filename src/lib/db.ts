import Dexie, { Table, UpdateSpec } from 'dexie';
import type { IndexableType } from 'dexie';

// Define interfaces for our data structures, mirroring Supabase tables

export interface Crop {
  id: string; // UUID
  name: string;
  variety?: string;
  type?: string; // Category like Fruit, Vegetable
  notes?: string; 
  created_at?: string; 
  updated_at?: string; 
  _synced?: number; 
  _last_modified?: number; 
  is_deleted?: number; 
  deleted_at?: string; 
}

export interface SeedBatch {
  id: string; // UUID
  crop_id: string; 
  batch_code: string;
  source_type?: 'purchased' | 'self_produced'; 
  supplier_id?: string; 
  purchase_date?: string; 
  date_added_to_inventory?: string; 
  initial_quantity?: number;
  current_quantity?: number; 
  quantity_unit?: string; 
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
  crop_id?: string; 
  supplier_id?: string; 
  supplier_invoice_number?: string; 
  purchase_date?: string; 
  initial_quantity?: number;
  current_quantity?: number;
  quantity_unit?: string;
  total_purchase_cost?: number;
  cost_per_unit?: number; // Added for explicit cost tracking
  minimum_stock_level?: number;
  notes?: string;
  qr_code_data?: string;
  created_at?: string;
  updated_at?: string; 
  _synced?: number; 
  _last_modified?: number;
  is_deleted?: number;
  deleted_at?: string;
}
export interface Plot {
  id: string; // UUID
  name: string;
  description?: string;
  length_m?: number;
  width_m?: number;
  area_sqm?: number;
  status?: string; // e.g., 'active', 'fallow', 'in_use', 'needs_prep'
  created_at?: string;
  updated_at?: string;
  is_deleted?: number;
  deleted_at?: string;
  _last_modified?: number;
  _synced?: number;
}
export interface PlannedStageResource {
  id: string; // UUID
  crop_plan_stage_id: string; 
  resource_type: 'LABOR' | 'INPUT_ITEM' | 'EQUIPMENT' | 'OTHER';
  description: string;
  input_inventory_id?: string; 
  planned_quantity?: number;
  quantity_unit?: string;
  estimated_cost?: number;
  notes?: string;
  created_at?: string;
  updated_at?: string;
  is_deleted?: number;
  deleted_at?: string;
  _last_modified?: number;
  _synced?: number;
}

export interface PlantingLog { 
  id: string; // UUID
  seedling_production_log_id?: string; 
  seed_batch_id?: string; 
  input_inventory_id?: string; 
  purchased_seedling_id?: string; // Added for linking to purchased_seedlings table
  planting_date: string; 
  location_description?: string; 
  plot_affected?: string; 
  quantity_planted: number; 
  quantity_unit?: string; 
  expected_harvest_date?: string; 
  notes?: string;
  status?: string; // 'active', 'completed', 'terminated'
  actual_end_date?: string; // YYYY-MM-DD
  created_at?: string;
  updated_at?: string;
  _synced?: number;
  _last_modified?: number;
  is_deleted?: number;
  deleted_at?: string;
  crop_plan_id?: string; // Link to CropPlan
}

export interface CropPlan {
  id: string; // UUID
  plan_name: string;
  crop_id: string;
  plot_id?: string;
  crop_season_id: string;
  planting_type: 'DIRECT_SEED' | 'TRANSPLANT_NURSERY' | 'TRANSPLANT_PURCHASED';
  planned_sowing_date?: string; // YYYY-MM-DD
  planned_transplant_date?: string; // YYYY-MM-DD
  planned_first_harvest_date?: string; // YYYY-MM-DD
  planned_last_harvest_date?: string; // YYYY-MM-DD
  estimated_days_to_maturity?: number;
  target_quantity_plants?: number;
  target_quantity_area_sqm?: number;
  target_yield_estimate_kg?: number;
  target_yield_unit?: string;
  status?: 'DRAFT' | 'PLANNED' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
  notes?: string;
  created_at?: string;
  updated_at?: string;
  is_deleted?: number;
  deleted_at?: string;
  _last_modified?: number;
  _synced?: number;
}

export interface CropPlanStage {
  id: string; // UUID
  crop_plan_id: string;
  stage_name: string;
  stage_type: 'NURSERY_SOWING' | 'NURSERY_POTTING_ON' | 'DIRECT_SEEDING' | 'SOIL_PREPARATION' | 'TRANSPLANTING' | 'FIELD_MAINTENANCE' | 'PEST_DISEASE_CONTROL' | 'HARVEST_WINDOW';
  planned_start_date: string; // YYYY-MM-DD
  planned_duration_days: number;
  actual_start_date?: string; // YYYY-MM-DD
  actual_end_date?: string; // YYYY-MM-DD
  status?: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'SKIPPED';
  notes?: string;

  nursery_total_days?: number;
  nursery_seeding_tray_type?: string;
  nursery_seeds_per_cell?: number;
  nursery_soil_mix_details?: string;
  nursery_seeding_technique?: string;
  nursery_days_before_repotting?: number;
  nursery_repotting_container_type?: string;

  direct_seed_rows_per_bed?: number;
  direct_seed_seeder_type?: string;
  direct_seed_spacing_in_row_cm?: number;
  direct_seed_spacing_between_rows_cm?: number;
  direct_seed_depth_cm?: number;
  direct_seed_calibration?: string;

  transplant_rows_per_bed?: number;
  transplant_spacing_in_row_cm?: number;
  transplant_spacing_between_rows_cm?: number;
  transplant_source_container_type?: string;
  transplant_row_marking_method?: string;
  transplant_irrigation_details?: string;

  generic_field_task_details?: string;
  additional_details_json?: string; // Store as string, parse/stringify in app

  created_at?: string;
  updated_at?: string;
  is_deleted?: number;
  deleted_at?: string;
  _last_modified?: number;
  _synced?: number;
}

export interface CropPlanTask {
  id: string; // UUID
  crop_plan_stage_id: string;
  task_description: string;
  planned_due_date: string; // YYYY-MM-DD
  actual_completion_date?: string; // YYYY-MM-DD
  status?: 'TODO' | 'IN_PROGRESS' | 'DONE' | 'BLOCKED' | 'CANCELLED';
  assigned_to_user_id?: string; // Assuming user IDs are strings (UUIDs)
  notes?: string;
  created_at?: string;
  updated_at?: string;
  is_deleted?: number;
  deleted_at?: string;
  _last_modified?: number;
  _synced?: number;
}

export interface CropSeason {
  id: string; // UUID
  name: string;
  start_date: string; // YYYY-MM-DD
  end_date: string; // YYYY-MM-DD
  description?: string;
  created_at?: string;
  updated_at?: string;
  is_deleted?: number;
  deleted_at?: string;
  _last_modified?: number;
  _synced?: number;
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
  planting_log_id?: string; // Made optional
  tree_id?: string; // Added for harvests from trees
  harvest_date: string;
  quantity_harvested: number;
  current_quantity_available?: number; // Added to track remaining stock from this harvest
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
  total_amount?: number; 
  payment_method?: 'cash' | 'card' | 'bank_transfer' | 'on_account' | 'other';
  payment_status?: 'paid' | 'unpaid' | 'partially_paid';
  amount_paid?: number; 
  payment_history?: { date: string; amount: number; method: Sale['payment_method']; notes?: string }[]; 
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
  harvest_log_id?: string; // For items sold from own harvest
  input_inventory_id?: string; // For items sold directly from purchased inventory
  purchased_seedling_id?: string; // Added for items sold from purchased seedlings
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
  species?: 'chicken' | 'turkey' | 'duck' | 'quail' | 'other'; 
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
  target_species?: 'chicken' | 'turkey' | 'duck' | 'quail' | 'other' | 'all_poultry'; 
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

export interface SupplierInvoice {
  id: string; // UUID
  supplier_id: string; // FK to Suppliers
  invoice_number: string; // Supplier's invoice number
  invoice_date: string; // ISOString Date
  due_date?: string; // ISOString Date
  total_amount_gross?: number; // Sum of line items before overall discount/VAT
  discount_amount?: number;
  discount_percentage?: number;
  shipping_cost?: number;
  other_charges?: number;
  subtotal_after_adjustments?: number; // Gross - Discount + Shipping + Other
  total_vat_amount?: number;
  total_amount_net: number; // The final amount payable for the invoice
  currency?: string; // e.g., EUR
  status: 'draft' | 'pending_processing' | 'processed' | 'partially_paid' | 'paid' | 'cancelled';
  notes?: string;
  file_attachment_url?: string; // URL to a scanned copy
  created_at?: string;
  updated_at?: string;
  _synced?: number;
  _last_modified?: number;
  is_deleted?: number;
  deleted_at?: string;
}

export interface PurchasedSeedling {
  id: string; // UUID
  name: string;
  crop_id?: string; // FK to crops.id
  supplier_id?: string; // FK to suppliers.id
  purchase_date?: string; // YYYY-MM-DD
  initial_quantity: number;
  current_quantity: number;
  quantity_unit?: string;
  cost_per_unit?: number;
  total_purchase_cost?: number;
  notes?: string;
  user_id?: string; // Should match auth.uid()
  created_at?: string;
  updated_at?: string;
  _synced?: number;
  _last_modified?: number;
  is_deleted?: number;
  deleted_at?: string;
}

export interface SupplierInvoiceItem {
  id: string; // UUID
  supplier_invoice_id: string; // FK to SupplierInvoices
  input_inventory_id?: string; // FK to InputInventory (once matched/created)
  description_from_invoice: string;
  
  package_quantity: number; // Number of packages/containers purchased
  package_unit_of_measure?: string; // e.g., "bottle", "bag", "case"

  item_quantity_per_package?: number; // e.g., 20 (if package_unit_of_measure is 'bottle' and item_unit_of_measure is 'L')
  item_unit_of_measure?: string; // e.g., "L", "kg", "ml" - the unit of the actual item content

  price_per_package_gross: number; // Price for one package/container
  
  line_total_gross?: number; // package_quantity * price_per_package_gross
  
  // Item-specific discount fields
  item_discount_type?: 'Percentage' | 'Amount' | ''; // Type of discount applied at the item level
  item_discount_value?: number; // Value of the item-level discount

  subtotal_before_item_vat?: number;     // Cost of item after item-specific discount, but BEFORE item-specific VAT
  // Cost after item-specific discount and item-specific VAT
  cost_after_item_adjustments?: number;  // This should be subtotal_before_item_vat + item_vat_amount

  // Apportioned invoice-level costs
  apportioned_discount_amount?: number; // Apportioned from overall invoice discount
  apportioned_shipping_cost?: number;   // Apportioned from overall invoice shipping
  apportioned_other_charges?: number; // Apportioned from overall invoice other charges
  
  // Subtotal after item-specific costs AND invoice-level apportionments (excluding invoice-level VAT)
  line_subtotal_after_apportionment?: number;
  
  // Item-specific VAT
  item_vat_percentage?: number; // VAT percentage applied specifically to this item
  item_vat_amount?: number; // VAT amount calculated specifically for this item (based on subtotal_before_item_vat)
  
  // Note: The overall invoice VAT will be apportioned and added to line_subtotal_after_apportionment
  // to get the final line_total_net.
  // The `vat_percentage` and `vat_amount_on_line` fields from the original schema are now
  // `item_vat_percentage` and `item_vat_amount` respectively.

  line_total_net: number; // Final cost for this line item, basis for InputInventory.total_purchase_cost
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
  | 'flock_records' // Corrected from flockRecords if Supabase table is snake_case
  | 'feed_logs'   // Corrected from feedLogs
  | 'preventive_measure_schedules' // Corrected
  | 'supplierInvoices'
  | 'supplierInvoiceItems'
  | 'purchasedSeedlings' // Added new table name
  | 'plots'
  | 'cropSeasons'
  | 'cropPlans'
  | 'cropPlanStages'
  | 'cropPlanTasks' // Added new planning tables
  | 'plannedStageResources'; // Added new table for stage resources

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
  flock_records!: Table<FlockRecord, string>; // Dexie table name (property name)
  feed_logs!: Table<FeedLog, string>;         // Dexie table name (property name)
  preventive_measure_schedules!: Table<PreventiveMeasureSchedule, string>; // Dexie table name
  supplierInvoices!: Table<SupplierInvoice, string>;
  supplierInvoiceItems!: Table<SupplierInvoiceItem, string>;
  purchasedSeedlings!: Table<PurchasedSeedling, string>;
  plots!: Table<Plot, string>;
  cropSeasons!: Table<CropSeason, string>;
  cropPlans!: Table<CropPlan, string>;
  cropPlanStages!: Table<CropPlanStage, string>;
  cropPlanTasks!: Table<CropPlanTask, string>;
  plannedStageResources!: Table<PlannedStageResource, string>;

  constructor() {
    super('HurvesthubDB');
    
    // Version 1 (Original minimal schema)
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
    // Version 2: Added is_deleted and customer_type
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
      const tablesToUpgradeV2 = ["crops", "seedBatches", "inputInventory", "plantingLogs", "cultivationLogs", "harvestLogs", "customers", "sales", "saleItems", "invoices"];
      for (const tableName of tablesToUpgradeV2) {
        await tx.table(tableName as HurvesthubTableName).toCollection().modify(record => { if (record.is_deleted === undefined) record.is_deleted = 0; });
      }
    });
    // Version 3: Added variety to seedBatches, plot_affected to planting/cultivation
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
      await tx.table("customers").toCollection().modify(customer => { if (customer.customer_type === undefined) customer.customer_type = 'Individual';});
    });
    // Version 4: Added total_purchase_cost to inputInventory
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
    });
    // Version 5: Added trees table, discount fields to saleItems
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
      await tx.table('inputInventory').toCollection().modify((item: any) => { 
        if (item.cost_per_unit !== undefined && item.initial_quantity !== undefined && item.initial_quantity > 0) {
          item.total_purchase_cost = item.cost_per_unit * item.initial_quantity;
        } else if (item.cost_per_unit !== undefined && (item.initial_quantity === undefined || item.initial_quantity === 0) ) {
            item.total_purchase_cost = item.cost_per_unit;
        }
        // delete item.cost_per_unit; // This was part of a previous schema version, ensure it's handled if this upgrade runs on such DBs
      });
    });
    // Version 6: Added variety to crops
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
      await tx.table('crops').toCollection().modify(crop => { if (crop.variety === undefined) crop.variety = null; });
    });
    // Version 7: Added notes to crops
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
      await tx.table('crops').toCollection().modify(crop => { if (crop.notes === undefined) crop.notes = null; });
    });
    // Version 8: Removed variety from seedBatches
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
      await tx.table('seedBatches').toCollection().modify((sb: any) => { delete sb.variety; });
    });
    // Version 9: Added initial_quantity, current_quantity to seedBatches & inputInventory
    this.version(9).stores({
      seedBatches: 'id, crop_id, batch_code, initial_quantity, current_quantity, _last_modified, _synced, is_deleted', 
      inputInventory: 'id, name, type, total_purchase_cost, current_quantity, initial_quantity, _last_modified, _synced, is_deleted',
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
      await tx.table('seedBatches').toCollection().modify(sb => { if (sb.current_quantity === undefined) sb.current_quantity = sb.initial_quantity; });
      await tx.table('inputInventory').toCollection().modify(ii => { if (ii.current_quantity === undefined) ii.current_quantity = ii.initial_quantity; });
    });
    // Version 10: Added reminders table
    this.version(10).stores({
      reminders: 'id, planting_log_id, reminder_date, activity_type, is_completed, _last_modified, _synced, is_deleted',
      seedBatches: 'id, crop_id, batch_code, initial_quantity, current_quantity, _last_modified, _synced, is_deleted', 
      inputInventory: 'id, name, type, total_purchase_cost, current_quantity, initial_quantity, _last_modified, _synced, is_deleted',
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
    });
    // Version 11: Added qr_code_data to seedBatches and inputInventory
    this.version(11).stores({
      seedBatches: 'id, crop_id, batch_code, initial_quantity, current_quantity, qr_code_data, _last_modified, _synced, is_deleted', 
      inputInventory: 'id, name, type, total_purchase_cost, current_quantity, initial_quantity, qr_code_data, _last_modified, _synced, is_deleted',
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
        await tx.table('seedBatches').toCollection().modify(sb => { if (sb.qr_code_data === undefined) sb.qr_code_data = null; });
        await tx.table('inputInventory').toCollection().modify(ii => { if (ii.qr_code_data === undefined) ii.qr_code_data = null; });
    });
    // Version 12: Added seedlingProductionLogs table, seedling_production_log_id to plantingLogs
    this.version(12).stores({
      seedlingProductionLogs: 'id, seed_batch_id, crop_id, sowing_date, _last_modified, _synced, is_deleted',
      plantingLogs: 'id, seedling_production_log_id, seed_batch_id, planting_date, plot_affected, _last_modified, _synced, is_deleted',
      seedBatches: 'id, crop_id, batch_code, initial_quantity, current_quantity, qr_code_data, _last_modified, _synced, is_deleted', 
      inputInventory: 'id, name, type, total_purchase_cost, current_quantity, initial_quantity, qr_code_data, _last_modified, _synced, is_deleted',
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
      await tx.table('plantingLogs').toCollection().modify(pl => {
        if (pl.seedling_production_log_id === undefined) pl.seedling_production_log_id = null;
      });
    });
    // Version 13: Added supplier_id to seedBatches and inputInventory
    this.version(13).stores({
      seedBatches: 'id, crop_id, batch_code, initial_quantity, current_quantity, qr_code_data, supplier_id, _last_modified, _synced, is_deleted', 
      inputInventory: 'id, name, type, total_purchase_cost, current_quantity, initial_quantity, qr_code_data, supplier_id, _last_modified, _synced, is_deleted', 
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
        await tx.table('seedBatches').toCollection().modify((sb: any) => {
            if (sb.supplier) delete sb.supplier; 
            if (sb.supplier_id === undefined) sb.supplier_id = null; 
        });
        await tx.table('inputInventory').toCollection().modify((ii: any) => {
            if (ii.supplier) delete ii.supplier; 
            if (ii.supplier_id === undefined) ii.supplier_id = null; 
        });
    });
    // Version 14: Added suppliers table
    this.version(14).stores({
      suppliers: 'id, name, _last_modified, _synced, is_deleted',
      seedBatches: 'id, crop_id, batch_code, initial_quantity, current_quantity, qr_code_data, supplier_id, _last_modified, _synced, is_deleted', 
      inputInventory: 'id, name, type, total_purchase_cost, current_quantity, initial_quantity, qr_code_data, supplier_id, _last_modified, _synced, is_deleted', 
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
    });
    // Version 15: Added input_inventory_id to cultivationLogs
    this.version(15).stores({
      cultivationLogs: 'id, planting_log_id, activity_date, plot_affected, input_inventory_id, _last_modified, _synced, is_deleted',
      suppliers: 'id, name, _last_modified, _synced, is_deleted',
      seedBatches: 'id, crop_id, batch_code, initial_quantity, current_quantity, qr_code_data, supplier_id, _last_modified, _synced, is_deleted', 
      inputInventory: 'id, name, type, total_purchase_cost, current_quantity, initial_quantity, qr_code_data, supplier_id, _last_modified, _synced, is_deleted', 
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
      await tx.table('cultivationLogs').toCollection().modify(cl => { if (cl.input_inventory_id === undefined) cl.input_inventory_id = null; });
    });
    // Version 16: Added supplier_invoice_number to inputInventory
    this.version(16).stores({
      inputInventory: 'id, name, type, supplier_id, supplier_invoice_number, total_purchase_cost, current_quantity, initial_quantity, qr_code_data, _last_modified, _synced, is_deleted', 
      cultivationLogs: 'id, planting_log_id, activity_date, plot_affected, input_inventory_id, _last_modified, _synced, is_deleted',
      suppliers: 'id, name, _last_modified, _synced, is_deleted',
      seedBatches: 'id, crop_id, batch_code, initial_quantity, current_quantity, qr_code_data, supplier_id, _last_modified, _synced, is_deleted', 
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
      await tx.table('inputInventory').toCollection().modify(ii => { if (ii.supplier_invoice_number === undefined) ii.supplier_invoice_number = null; });
    });
    // Version 17: Added flocks, flock_records, feed_logs tables
    this.version(17).stores({
      flocks: 'id, name, flock_type, hatch_date, _last_modified, _synced, is_deleted', 
      flock_records: 'id, flock_id, record_type, record_date, _last_modified, _synced, is_deleted',
      feed_logs: 'id, flock_id, feed_date, feed_type_id, _last_modified, _synced, is_deleted',
      inputInventory: 'id, name, type, supplier_id, supplier_invoice_number, total_purchase_cost, current_quantity, initial_quantity, qr_code_data, _last_modified, _synced, is_deleted',
      cultivationLogs: 'id, planting_log_id, activity_date, plot_affected, input_inventory_id, _last_modified, _synced, is_deleted',
      suppliers: 'id, name, _last_modified, _synced, is_deleted',
      seedBatches: 'id, crop_id, batch_code, initial_quantity, current_quantity, qr_code_data, supplier_id, _last_modified, _synced, is_deleted', 
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
    });
    // Version 18: Added minimum_stock_level to inputInventory, feed_cost to feed_logs
    this.version(18).stores({
      inputInventory: 'id, name, type, supplier_id, supplier_invoice_number, total_purchase_cost, current_quantity, initial_quantity, minimum_stock_level, qr_code_data, _last_modified, _synced, is_deleted',
      feed_logs: 'id, flock_id, feed_date, feed_type_id, feed_cost, _last_modified, _synced, is_deleted', 
      flocks: 'id, name, flock_type, hatch_date, _last_modified, _synced, is_deleted', 
      flock_records: 'id, flock_id, record_type, record_date, _last_modified, _synced, is_deleted', 
      cultivationLogs: 'id, planting_log_id, activity_date, plot_affected, input_inventory_id, _last_modified, _synced, is_deleted',
      suppliers: 'id, name, _last_modified, _synced, is_deleted',
      seedBatches: 'id, crop_id, batch_code, initial_quantity, current_quantity, qr_code_data, supplier_id, _last_modified, _synced, is_deleted',
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
      seedlingProductionLogs: 'id, seed_batch_id, crop_id, sowing_date, _last_modified, _synced, is_deleted'
    }).upgrade(async tx => {
      await tx.table('inputInventory').toCollection().modify(item => { if (item.minimum_stock_level === undefined) item.minimum_stock_level = null; });
      await tx.table('feed_logs').toCollection().modify(log => { if (log.feed_cost === undefined) log.feed_cost = null; });
    });
    // Version 19: Added weight_kg_total to flock_records
    this.version(19).stores({
      flock_records: 'id, flock_id, record_type, record_date, weight_kg_total, _last_modified, _synced, is_deleted', 
      inputInventory: 'id, name, type, supplier_id, supplier_invoice_number, total_purchase_cost, current_quantity, initial_quantity, minimum_stock_level, qr_code_data, _last_modified, _synced, is_deleted',
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
      await tx.table('flock_records').toCollection().modify(record => { if (record.weight_kg_total === undefined) record.weight_kg_total = null; });
    });
    // Version 20: Added cost to flock_records
    this.version(20).stores({
      flock_records: 'id, flock_id, record_type, record_date, weight_kg_total, cost, _last_modified, _synced, is_deleted', 
      inputInventory: 'id, name, type, supplier_id, supplier_invoice_number, total_purchase_cost, current_quantity, initial_quantity, minimum_stock_level, qr_code_data, _last_modified, _synced, is_deleted',
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
      await tx.table('flock_records').toCollection().modify(record => { if (record.cost === undefined) record.cost = null; });
    });
    // Version 21: Added revenue to flock_records, flock_id to reminders
    this.version(21).stores({
      flock_records: 'id, flock_id, record_type, record_date, weight_kg_total, cost, revenue, _last_modified, _synced, is_deleted', 
      reminders: 'id, planting_log_id, flock_id, reminder_date, activity_type, is_completed, _last_modified, _synced, is_deleted', 
      inputInventory: 'id, name, type, supplier_id, supplier_invoice_number, total_purchase_cost, current_quantity, initial_quantity, minimum_stock_level, qr_code_data, _last_modified, _synced, is_deleted',
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
      await tx.table('flock_records').toCollection().modify(record => { if (record.revenue === undefined) record.revenue = null; });
      await tx.table('reminders').toCollection().modify(reminder => { if (reminder.flock_id === undefined) reminder.flock_id = null; });
    });
    // Version 22: Added preventive_measure_schedules table
    this.version(22).stores({
      preventive_measure_schedules: 'id, name, measure_type, target_species, trigger_offset_days, is_recurring, _last_modified, _synced, is_deleted',
      flock_records: 'id, flock_id, record_type, record_date, weight_kg_total, cost, revenue, _last_modified, _synced, is_deleted',
      reminders: 'id, planting_log_id, flock_id, reminder_date, activity_type, is_completed, _last_modified, _synced, is_deleted', 
      inputInventory: 'id, name, type, supplier_id, supplier_invoice_number, total_purchase_cost, current_quantity, initial_quantity, minimum_stock_level, qr_code_data, _last_modified, _synced, is_deleted',
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
    });
    // Version 23: Added species to flocks
    this.version(23).stores({
      flocks: 'id, name, flock_type, species, hatch_date, _last_modified, _synced, is_deleted',
      preventive_measure_schedules: 'id, name, measure_type, target_species, trigger_offset_days, is_recurring, _last_modified, _synced, is_deleted',
      flock_records: 'id, flock_id, record_type, record_date, weight_kg_total, cost, revenue, _last_modified, _synced, is_deleted',
      reminders: 'id, planting_log_id, flock_id, reminder_date, activity_type, is_completed, _last_modified, _synced, is_deleted', 
      inputInventory: 'id, name, type, supplier_id, supplier_invoice_number, total_purchase_cost, current_quantity, initial_quantity, minimum_stock_level, qr_code_data, _last_modified, _synced, is_deleted',
      feed_logs: 'id, flock_id, feed_date, feed_type_id, feed_cost, _last_modified, _synced, is_deleted',
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
      await tx.table('flocks').toCollection().modify((flock: Flock) => { 
        if (flock.species === undefined) flock.species = 'chicken'; 
      });
    });
    // Version 24: Added payment fields to sales
    this.version(24).stores({
      sales: 'id, customer_id, sale_date, payment_method, payment_status, amount_paid, _last_modified, _synced, is_deleted', 
      flocks: 'id, name, flock_type, species, hatch_date, _last_modified, _synced, is_deleted',
      preventive_measure_schedules: 'id, name, measure_type, target_species, trigger_offset_days, is_recurring, _last_modified, _synced, is_deleted',
      flock_records: 'id, flock_id, record_type, record_date, weight_kg_total, cost, revenue, _last_modified, _synced, is_deleted',
      inputInventory: 'id, name, type, supplier_id, supplier_invoice_number, total_purchase_cost, current_quantity, initial_quantity, minimum_stock_level, qr_code_data, _last_modified, _synced, is_deleted',
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
      await tx.table('sales').toCollection().modify((sale: Sale) => { 
        if (sale.payment_method === undefined) sale.payment_method = 'on_account'; 
        if (sale.payment_status === undefined) sale.payment_status = 'unpaid'; 
        if (sale.amount_paid === undefined) sale.amount_paid = 0; 
      });
    });
    // Version 25: Added payment_history to sales
    this.version(25).stores({
      sales: 'id, customer_id, sale_date, payment_method, payment_status, amount_paid, _last_modified, _synced, is_deleted', 
      flocks: 'id, name, flock_type, species, hatch_date, _last_modified, _synced, is_deleted',
      preventive_measure_schedules: 'id, name, measure_type, target_species, trigger_offset_days, is_recurring, _last_modified, _synced, is_deleted',
      flock_records: 'id, flock_id, record_type, record_date, weight_kg_total, cost, revenue, _last_modified, _synced, is_deleted',
      inputInventory: 'id, name, type, supplier_id, supplier_invoice_number, total_purchase_cost, current_quantity, initial_quantity, minimum_stock_level, qr_code_data, _last_modified, _synced, is_deleted',
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
      await tx.table('sales').toCollection().modify((sale: Sale) => {
        if (sale.payment_history === undefined) {
          sale.payment_history = []; 
        }
      });
    });
    // Version 26: Added source_type, date_added_to_inventory to seedBatches
    this.version(26).stores({
      seedBatches: 'id, crop_id, batch_code, source_type, date_added_to_inventory, initial_quantity, current_quantity, qr_code_data, supplier_id, _last_modified, _synced, is_deleted',
      sales: 'id, customer_id, sale_date, payment_method, payment_status, amount_paid, _last_modified, _synced, is_deleted',
      flocks: 'id, name, flock_type, species, hatch_date, _last_modified, _synced, is_deleted',
      preventive_measure_schedules: 'id, name, measure_type, target_species, trigger_offset_days, is_recurring, _last_modified, _synced, is_deleted',
      flock_records: 'id, flock_id, record_type, record_date, weight_kg_total, cost, revenue, _last_modified, _synced, is_deleted',
      inputInventory: 'id, name, type, supplier_id, supplier_invoice_number, total_purchase_cost, current_quantity, initial_quantity, minimum_stock_level, qr_code_data, _last_modified, _synced, is_deleted', 
      feed_logs: 'id, flock_id, feed_date, feed_type_id, feed_cost, _last_modified, _synced, is_deleted',
      suppliers: 'id, name, _last_modified, _synced, is_deleted',
      crops: 'id, name, variety, type, notes, _last_modified, _synced, is_deleted',
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
      console.log("Upgrading HurvesthubDB to version 26: Adding 'source_type' and 'date_added_to_inventory' to seedBatches table.");
      await tx.table('seedBatches').toCollection().modify((batch: SeedBatch) => {
        if (batch.source_type === undefined) {
          batch.source_type = batch.supplier_id ? 'purchased' : 'self_produced'; 
        }
        if (batch.date_added_to_inventory === undefined) {
          batch.date_added_to_inventory = batch.purchase_date || batch.created_at?.split('T')[0];
        }
      });
      console.log("Finished upgrading HurvesthubDB to version 26.");
    });
    // Version 27: Added crop_id to inputInventory, input_inventory_id to plantingLogs (already there but ensuring schema consistency)
    this.version(27).stores({
      inputInventory: 'id, name, type, crop_id, supplier_id, supplier_invoice_number, total_purchase_cost, current_quantity, initial_quantity, minimum_stock_level, qr_code_data, _last_modified, _synced, is_deleted', 
      plantingLogs: 'id, seedling_production_log_id, seed_batch_id, input_inventory_id, planting_date, plot_affected, _last_modified, _synced, is_deleted', 
      seedBatches: 'id, crop_id, batch_code, source_type, date_added_to_inventory, initial_quantity, current_quantity, qr_code_data, supplier_id, _last_modified, _synced, is_deleted',
      sales: 'id, customer_id, sale_date, payment_method, payment_status, amount_paid, _last_modified, _synced, is_deleted',
      flocks: 'id, name, flock_type, species, hatch_date, _last_modified, _synced, is_deleted',
      preventive_measure_schedules: 'id, name, measure_type, target_species, trigger_offset_days, is_recurring, _last_modified, _synced, is_deleted',
      flock_records: 'id, flock_id, record_type, record_date, weight_kg_total, cost, revenue, _last_modified, _synced, is_deleted',
      feed_logs: 'id, flock_id, feed_date, feed_type_id, feed_cost, _last_modified, _synced, is_deleted',
      suppliers: 'id, name, _last_modified, _synced, is_deleted',
      crops: 'id, name, variety, type, notes, _last_modified, _synced, is_deleted',
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
      console.log("Upgrading HurvesthubDB to version 27: Adding 'crop_id' to inputInventory and 'input_inventory_id' to plantingLogs.");
      await tx.table('inputInventory').toCollection().modify((item: InputInventory) => {
          if (item.crop_id === undefined) item.crop_id = undefined; 
      });
      await tx.table('plantingLogs').toCollection().modify((log: PlantingLog) => {
        if (log.input_inventory_id === undefined) log.input_inventory_id = undefined;
      });
      console.log("Finished upgrading HurvesthubDB to version 27.");
    });

    // Version 28: Added SupplierInvoices and SupplierInvoiceItems tables
    // Also added cost_per_unit to inputInventory
    this.version(28).stores({
      supplierInvoices: 'id, supplier_id, invoice_number, invoice_date, status, _last_modified, _synced, is_deleted',
      supplierInvoiceItems: 'id, supplier_invoice_id, input_inventory_id, [supplier_invoice_id+is_deleted], _last_modified, _synced, is_deleted',
      inputInventory: 'id, name, type, crop_id, supplier_id, supplier_invoice_number, total_purchase_cost, cost_per_unit, current_quantity, initial_quantity, minimum_stock_level, qr_code_data, _last_modified, _synced, is_deleted', 
      plantingLogs: 'id, seedling_production_log_id, seed_batch_id, input_inventory_id, planting_date, plot_affected, _last_modified, _synced, is_deleted', 
      seedBatches: 'id, crop_id, batch_code, source_type, date_added_to_inventory, initial_quantity, current_quantity, qr_code_data, supplier_id, _last_modified, _synced, is_deleted',
      sales: 'id, customer_id, sale_date, payment_method, payment_status, amount_paid, _last_modified, _synced, is_deleted',
      flocks: 'id, name, flock_type, species, hatch_date, _last_modified, _synced, is_deleted',
      preventive_measure_schedules: 'id, name, measure_type, target_species, trigger_offset_days, is_recurring, _last_modified, _synced, is_deleted',
      flock_records: 'id, flock_id, record_type, record_date, weight_kg_total, cost, revenue, _last_modified, _synced, is_deleted',
      feed_logs: 'id, flock_id, feed_date, feed_type_id, feed_cost, _last_modified, _synced, is_deleted',
      suppliers: 'id, name, _last_modified, _synced, is_deleted',
      crops: 'id, name, variety, type, notes, _last_modified, _synced, is_deleted',
      cultivationLogs: 'id, planting_log_id, activity_date, plot_affected, input_inventory_id, _last_modified, _synced, is_deleted',
      harvestLogs: 'id, planting_log_id, harvest_date, current_quantity_available, is_deleted, _last_modified, _synced', 
      customers: 'id, name, customer_type, _last_modified, _synced, is_deleted',
      saleItems: 'id, sale_id, harvest_log_id, input_inventory_id, discount_type, discount_value, _last_modified, _synced, is_deleted', 
      invoices: 'id, sale_id, invoice_number, _last_modified, _synced, is_deleted',
      syncMeta: 'id',
      trees: 'id, identifier, species, variety, planting_date, plot_affected, _last_modified, _synced, is_deleted',
      reminders: 'id, planting_log_id, flock_id, reminder_date, activity_type, is_completed, _last_modified, _synced, is_deleted',
      seedlingProductionLogs: 'id, seed_batch_id, crop_id, sowing_date, _last_modified, _synced, is_deleted'
    }).upgrade(async tx => {
        console.log("Upgrading HurvesthubDB to version 28.");
        await tx.table('inputInventory').toCollection().modify((item: InputInventory) => {
            if (item.cost_per_unit === undefined) {
                if (item.total_purchase_cost && item.initial_quantity && item.initial_quantity > 0) {
                    item.cost_per_unit = item.total_purchase_cost / item.initial_quantity;
                } else {
                    item.cost_per_unit = undefined;
                }
            }
            if (item.initial_quantity === undefined) {
                 console.warn(`[DB Upgrade v28] InputInventory item ${item.id} has undefined initial_quantity.`);
            }
        });
        console.log("Finished upgrading HurvesthubDB to version 28.");
        return Promise.resolve(); // Ensure upgrade function returns a promise
    });

    // Version 29: Added purchasedSeedlings table
    this.version(29).stores({
      // Copied from version 28
      supplierInvoices: 'id, supplier_id, invoice_number, invoice_date, status, _last_modified, _synced, is_deleted',
      supplierInvoiceItems: 'id, supplier_invoice_id, input_inventory_id, [supplier_invoice_id+is_deleted], _last_modified, _synced, is_deleted',
      inputInventory: 'id, name, type, crop_id, supplier_id, supplier_invoice_number, total_purchase_cost, cost_per_unit, current_quantity, initial_quantity, minimum_stock_level, qr_code_data, _last_modified, _synced, is_deleted',
      plantingLogs: 'id, seedling_production_log_id, seed_batch_id, input_inventory_id, purchased_seedling_id, planting_date, plot_affected, _last_modified, _synced, is_deleted', // Added purchased_seedling_id
      seedBatches: 'id, crop_id, batch_code, source_type, date_added_to_inventory, initial_quantity, current_quantity, qr_code_data, supplier_id, _last_modified, _synced, is_deleted',
      sales: 'id, customer_id, sale_date, payment_method, payment_status, amount_paid, _last_modified, _synced, is_deleted',
      flocks: 'id, name, flock_type, species, hatch_date, _last_modified, _synced, is_deleted',
      preventive_measure_schedules: 'id, name, measure_type, target_species, trigger_offset_days, is_recurring, _last_modified, _synced, is_deleted',
      flock_records: 'id, flock_id, record_type, record_date, weight_kg_total, cost, revenue, _last_modified, _synced, is_deleted',
      feed_logs: 'id, flock_id, feed_date, feed_type_id, feed_cost, _last_modified, _synced, is_deleted',
      suppliers: 'id, name, is_deleted, _last_modified, _synced',
      crops: 'id, name, variety, type, notes, is_deleted, _last_modified, _synced',
      cultivationLogs: 'id, planting_log_id, activity_date, plot_affected, input_inventory_id, _last_modified, _synced, is_deleted',
      harvestLogs: 'id, planting_log_id, harvest_date, current_quantity_available, is_deleted, _last_modified, _synced',
      customers: 'id, name, customer_type, is_deleted, _last_modified, _synced',
      saleItems: 'id, sale_id, harvest_log_id, input_inventory_id, purchased_seedling_id, quantity_sold, price_per_unit, discount_type, discount_value, is_deleted, _last_modified, _synced', // Added purchased_seedling_id
      invoices: 'id, sale_id, invoice_number, is_deleted, _last_modified, _synced',
      syncMeta: 'id',
      trees: 'id, identifier, species, variety, planting_date, plot_affected, is_deleted, _last_modified, _synced',
      reminders: 'id, planting_log_id, flock_id, reminder_date, activity_type, is_completed, _last_modified, _synced, is_deleted',
      seedlingProductionLogs: 'id, seed_batch_id, crop_id, sowing_date, _last_modified, _synced, is_deleted',
      // New table
      purchasedSeedlings: 'id, name, crop_id, supplier_id, purchase_date, initial_quantity, current_quantity, is_deleted, _last_modified, _synced'
    }).upgrade(tx => {
      console.log("Upgrading HurvesthubDB to version 29. (Schema for purchasedSeedlings added)");
      // Dexie automatically creates the new 'purchasedSeedlings' table.
      return Promise.resolve();
    });
// Version 30: Added status and actual_end_date to plantingLogs
    this.version(30).stores({
      plantingLogs: 'id, seedling_production_log_id, seed_batch_id, input_inventory_id, purchased_seedling_id, status, planting_date, plot_affected, _last_modified, _synced, is_deleted', // Added status
      // Carry over all other tables from version 29
      supplierInvoices: 'id, supplier_id, invoice_number, invoice_date, status, _last_modified, _synced, is_deleted',
      supplierInvoiceItems: 'id, supplier_invoice_id, input_inventory_id, [supplier_invoice_id+is_deleted], _last_modified, _synced, is_deleted',
      inputInventory: 'id, name, type, crop_id, supplier_id, supplier_invoice_number, total_purchase_cost, cost_per_unit, current_quantity, initial_quantity, minimum_stock_level, qr_code_data, _last_modified, _synced, is_deleted',
      seedBatches: 'id, crop_id, batch_code, source_type, date_added_to_inventory, initial_quantity, current_quantity, qr_code_data, supplier_id, _last_modified, _synced, is_deleted',
      sales: 'id, customer_id, sale_date, payment_method, payment_status, amount_paid, _last_modified, _synced, is_deleted',
      flocks: 'id, name, flock_type, species, hatch_date, _last_modified, _synced, is_deleted',
      preventive_measure_schedules: 'id, name, measure_type, target_species, trigger_offset_days, is_recurring, _last_modified, _synced, is_deleted',
      flock_records: 'id, flock_id, record_type, record_date, weight_kg_total, cost, revenue, _last_modified, _synced, is_deleted',
      feed_logs: 'id, flock_id, feed_date, feed_type_id, feed_cost, _last_modified, _synced, is_deleted',
      suppliers: 'id, name, is_deleted, _last_modified, _synced',
      crops: 'id, name, variety, type, notes, is_deleted, _last_modified, _synced',
      cultivationLogs: 'id, planting_log_id, activity_date, plot_affected, input_inventory_id, _last_modified, _synced, is_deleted',
      harvestLogs: 'id, planting_log_id, harvest_date, current_quantity_available, is_deleted, _last_modified, _synced',
      customers: 'id, name, customer_type, is_deleted, _last_modified, _synced',
      saleItems: 'id, sale_id, harvest_log_id, input_inventory_id, purchased_seedling_id, quantity_sold, price_per_unit, discount_type, discount_value, is_deleted, _last_modified, _synced',
      invoices: 'id, sale_id, invoice_number, is_deleted, _last_modified, _synced',
      syncMeta: 'id',
      trees: 'id, identifier, species, variety, planting_date, plot_affected, is_deleted, _last_modified, _synced',
      reminders: 'id, planting_log_id, flock_id, reminder_date, activity_type, is_completed, _last_modified, _synced, is_deleted',
      seedlingProductionLogs: 'id, seed_batch_id, crop_id, sowing_date, _last_modified, _synced, is_deleted',
      purchasedSeedlings: 'id, name, crop_id, supplier_id, purchase_date, initial_quantity, current_quantity, is_deleted, _last_modified, _synced'
    }).upgrade(async tx => {
      // Upgrade path for plantingLogs: ensure status and actual_end_date exist
      console.log("Upgrading HurvesthubDB to version 30: Adding 'status' and 'actual_end_date' to plantingLogs.");
      await tx.table('plantingLogs').toCollection().modify(pl => {
        if (pl.status === undefined) {
          pl.status = 'active'; // Default new plantations to 'active'
        }
        if (pl.actual_end_date === undefined) {
          pl.actual_end_date = null;
        }
      });
      console.log("Finished upgrading HurvesthubDB to version 30.");
    });

    // Version 31: Added Crop Planning tables and crop_plan_id to plantingLogs
    this.version(31).stores({
      plots: 'id, name, status, _last_modified, _synced, is_deleted',
      cropSeasons: 'id, name, start_date, end_date, _last_modified, _synced, is_deleted',
      cropPlans: 'id, crop_id, plot_id, crop_season_id, status, planned_sowing_date, planned_transplant_date, _last_modified, _synced, is_deleted',
      cropPlanStages: 'id, crop_plan_id, stage_type, status, planned_start_date, _last_modified, _synced, is_deleted',
      cropPlanTasks: 'id, crop_plan_stage_id, status, planned_due_date, assigned_to_user_id, _last_modified, _synced, is_deleted',
      
      plantingLogs: 'id, seedling_production_log_id, seed_batch_id, input_inventory_id, purchased_seedling_id, crop_plan_id, status, planting_date, plot_affected, _last_modified, _synced, is_deleted', // Added crop_plan_id

      // Carry over all other tables from version 30
      supplierInvoices: 'id, supplier_id, invoice_number, invoice_date, status, _last_modified, _synced, is_deleted',
      supplierInvoiceItems: 'id, supplier_invoice_id, input_inventory_id, [supplier_invoice_id+is_deleted], _last_modified, _synced, is_deleted',
      inputInventory: 'id, name, type, crop_id, supplier_id, supplier_invoice_number, total_purchase_cost, cost_per_unit, current_quantity, initial_quantity, minimum_stock_level, qr_code_data, _last_modified, _synced, is_deleted',
      seedBatches: 'id, crop_id, batch_code, source_type, date_added_to_inventory, initial_quantity, current_quantity, qr_code_data, supplier_id, _last_modified, _synced, is_deleted',
      sales: 'id, customer_id, sale_date, payment_method, payment_status, amount_paid, _last_modified, _synced, is_deleted',
      flocks: 'id, name, flock_type, species, hatch_date, _last_modified, _synced, is_deleted',
      preventive_measure_schedules: 'id, name, measure_type, target_species, trigger_offset_days, is_recurring, _last_modified, _synced, is_deleted',
      flock_records: 'id, flock_id, record_type, record_date, weight_kg_total, cost, revenue, _last_modified, _synced, is_deleted',
      feed_logs: 'id, flock_id, feed_date, feed_type_id, feed_cost, _last_modified, _synced, is_deleted',
      suppliers: 'id, name, is_deleted, _last_modified, _synced',
      crops: 'id, name, variety, type, notes, is_deleted, _last_modified, _synced',
      cultivationLogs: 'id, planting_log_id, activity_date, plot_affected, input_inventory_id, _last_modified, _synced, is_deleted',
      harvestLogs: 'id, planting_log_id, harvest_date, current_quantity_available, is_deleted, _last_modified, _synced',
      customers: 'id, name, customer_type, is_deleted, _last_modified, _synced',
      saleItems: 'id, sale_id, harvest_log_id, input_inventory_id, purchased_seedling_id, quantity_sold, price_per_unit, discount_type, discount_value, is_deleted, _last_modified, _synced',
      invoices: 'id, sale_id, invoice_number, is_deleted, _last_modified, _synced',
      syncMeta: 'id',
      trees: 'id, identifier, species, variety, planting_date, plot_affected, is_deleted, _last_modified, _synced',
      reminders: 'id, planting_log_id, flock_id, reminder_date, activity_type, is_completed, _last_modified, _synced, is_deleted',
      seedlingProductionLogs: 'id, seed_batch_id, crop_id, sowing_date, _last_modified, _synced, is_deleted',
      purchasedSeedlings: 'id, name, crop_id, supplier_id, purchase_date, initial_quantity, current_quantity, is_deleted, _last_modified, _synced'
    }).upgrade(async tx => {
      console.log("Upgrading HurvesthubDB to version 31: Adding Crop Planning tables and crop_plan_id to plantingLogs.");
      // Dexie automatically creates new tables.
      // For plantingLogs, ensure crop_plan_id exists if upgrading from a version where it didn't.
      await tx.table('plantingLogs').toCollection().modify(pl => {
        if (pl.crop_plan_id === undefined) {
          pl.crop_plan_id = null;
        }
      });
      console.log("Finished upgrading HurvesthubDB to version 31.");
    });

    // Version 32: Added plannedStageResources table
    this.version(32).stores({
      plannedStageResources: 'id, crop_plan_stage_id, resource_type, input_inventory_id, _last_modified, _synced, is_deleted',
      
      // Carry over all other tables from version 31
      plots: 'id, name, status, _last_modified, _synced, is_deleted',
      cropSeasons: 'id, name, start_date, end_date, _last_modified, _synced, is_deleted',
      cropPlans: 'id, crop_id, plot_id, crop_season_id, status, planned_sowing_date, planned_transplant_date, _last_modified, _synced, is_deleted',
      cropPlanStages: 'id, crop_plan_id, stage_type, status, planned_start_date, _last_modified, _synced, is_deleted',
      cropPlanTasks: 'id, crop_plan_stage_id, status, planned_due_date, assigned_to_user_id, _last_modified, _synced, is_deleted',
      plantingLogs: 'id, seedling_production_log_id, seed_batch_id, input_inventory_id, purchased_seedling_id, crop_plan_id, status, planting_date, plot_affected, _last_modified, _synced, is_deleted',
      supplierInvoices: 'id, supplier_id, invoice_number, invoice_date, status, _last_modified, _synced, is_deleted',
      supplierInvoiceItems: 'id, supplier_invoice_id, input_inventory_id, [supplier_invoice_id+is_deleted], _last_modified, _synced, is_deleted',
      inputInventory: 'id, name, type, crop_id, supplier_id, supplier_invoice_number, total_purchase_cost, cost_per_unit, current_quantity, initial_quantity, minimum_stock_level, qr_code_data, _last_modified, _synced, is_deleted',
      seedBatches: 'id, crop_id, batch_code, source_type, date_added_to_inventory, initial_quantity, current_quantity, qr_code_data, supplier_id, _last_modified, _synced, is_deleted',
      sales: 'id, customer_id, sale_date, payment_method, payment_status, amount_paid, _last_modified, _synced, is_deleted',
      flocks: 'id, name, flock_type, species, hatch_date, _last_modified, _synced, is_deleted',
      preventive_measure_schedules: 'id, name, measure_type, target_species, trigger_offset_days, is_recurring, _last_modified, _synced, is_deleted',
      flock_records: 'id, flock_id, record_type, record_date, weight_kg_total, cost, revenue, _last_modified, _synced, is_deleted',
      feed_logs: 'id, flock_id, feed_date, feed_type_id, feed_cost, _last_modified, _synced, is_deleted',
      suppliers: 'id, name, is_deleted, _last_modified, _synced',
      crops: 'id, name, variety, type, notes, is_deleted, _last_modified, _synced',
      cultivationLogs: 'id, planting_log_id, activity_date, plot_affected, input_inventory_id, _last_modified, _synced, is_deleted',
      harvestLogs: 'id, planting_log_id, harvest_date, current_quantity_available, is_deleted, _last_modified, _synced',
      customers: 'id, name, customer_type, is_deleted, _last_modified, _synced',
      saleItems: 'id, sale_id, harvest_log_id, input_inventory_id, purchased_seedling_id, quantity_sold, price_per_unit, discount_type, discount_value, is_deleted, _last_modified, _synced',
      invoices: 'id, sale_id, invoice_number, is_deleted, _last_modified, _synced',
      syncMeta: 'id',
      trees: 'id, identifier, species, variety, planting_date, plot_affected, is_deleted, _last_modified, _synced',
      reminders: 'id, planting_log_id, flock_id, reminder_date, activity_type, is_completed, _last_modified, _synced, is_deleted',
      seedlingProductionLogs: 'id, seed_batch_id, crop_id, sowing_date, _last_modified, _synced, is_deleted',
      purchasedSeedlings: 'id, name, crop_id, supplier_id, purchase_date, initial_quantity, current_quantity, is_deleted, _last_modified, _synced'
    }).upgrade(async tx => {
      console.log("Upgrading HurvesthubDB to version 32: Adding plannedStageResources table.");
      // Dexie automatically creates new tables. No data migration needed for existing tables for this version.
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
        'seedlingProductionLogs', 'suppliers', 'supplierInvoices', 'supplierInvoiceItems',
        'flocks', 'flock_records', 'feed_logs',
        'preventive_measure_schedules', 'purchasedSeedlings',
        'plots', 'cropSeasons', 'cropPlans', 'cropPlanStages', 'cropPlanTasks',
        'plannedStageResources' // Added new table
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