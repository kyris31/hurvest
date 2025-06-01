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
  purchased_seedling_id?: string; 
  planting_date: string; 
  location_description?: string; 
  plot_affected?: string; 
  quantity_planted: number; 
  quantity_unit?: string; 
  expected_harvest_date?: string; 
  notes?: string;
  status?: string; 
  actual_end_date?: string; 
  created_at?: string;
  updated_at?: string;
  _synced?: number;
  _last_modified?: number;
  is_deleted?: number;
  deleted_at?: string;
  crop_plan_id?: string; 
}

export interface CropPlan {
  id: string; // UUID
  plan_name: string;
  crop_id: string;
  plot_id?: string;
  crop_season_id: string;
  planting_type: 'DIRECT_SEED' | 'TRANSPLANT_NURSERY' | 'TRANSPLANT_PURCHASED';
  planned_sowing_date?: string; 
  planned_transplant_date?: string; 
  planned_first_harvest_date?: string; 
  planned_last_harvest_date?: string; 
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
  planned_start_date: string; 
  planned_duration_days: number;
  actual_start_date?: string; 
  actual_end_date?: string; 
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
  additional_details_json?: string; 
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
  planned_due_date: string; 
  actual_completion_date?: string; 
  status?: 'TODO' | 'IN_PROGRESS' | 'DONE' | 'BLOCKED' | 'CANCELLED';
  assigned_to_user_id?: string; 
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
  start_date: string; 
  end_date: string; 
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
  user_id?: string; // Added for RLS ownership
  activity_date: string;
  activity_type: string;
  plot_affected?: string;
  notes?: string;
  created_at?: string;
  updated_at?: string; 
  _synced?: number; 
  _last_modified?: number;
  is_deleted?: number;
  deleted_at?: string;
}

export interface CultivationActivityPlantingLink {
  id: string; // UUID
  cultivation_log_id: string; 
  planting_log_id: string;  
  created_at?: string;
  updated_at?: string;
  _synced?: number;
  _last_modified?: number;
  is_deleted?: number;
  deleted_at?: string;
}

export interface CultivationActivityUsedInput {
  id: string; // UUID
  cultivation_log_id: string; 
  input_inventory_id: string; 
  quantity_used: number;
  quantity_unit: string;
  created_at?: string;
  updated_at?: string;
  _synced?: number;
  _last_modified?: number;
  is_deleted?: number;
  deleted_at?: string;
}

export interface HarvestLog {
  id: string; // UUID
  planting_log_id?: string; 
  tree_id?: string; 
  harvest_date: string;
  quantity_harvested: number;
  current_quantity_available?: number; 
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
  harvest_log_id?: string; 
  input_inventory_id?: string; 
  purchased_seedling_id?: string; 
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
  supplier_id: string; 
  invoice_number: string; 
  invoice_date: string; 
  due_date?: string; 
  total_amount_gross?: number; 
  discount_amount?: number;
  discount_percentage?: number;
  shipping_cost?: number;
  other_charges?: number;
  subtotal_after_adjustments?: number; 
  total_vat_amount?: number;
  total_amount_net: number; 
  currency?: string; 
  status: 'draft' | 'pending_processing' | 'processed' | 'partially_paid' | 'paid' | 'cancelled';
  notes?: string;
  file_attachment_url?: string; 
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
  crop_id?: string; 
  supplier_id?: string; 
  purchase_date?: string; 
  initial_quantity: number;
  current_quantity: number;
  quantity_unit?: string;
  cost_per_unit?: number;
  total_purchase_cost?: number;
  notes?: string;
  user_id?: string; 
  created_at?: string;
  updated_at?: string;
  _synced?: number;
  _last_modified?: number;
  is_deleted?: number;
  deleted_at?: string;
}

export interface SupplierInvoiceItem {
  id: string; // UUID
  supplier_invoice_id: string; 
  input_inventory_id?: string; 
  description_from_invoice: string;
  package_quantity: number; 
  package_unit_of_measure?: string; 
  item_quantity_per_package?: number; 
  item_unit_of_measure?: string; 
  price_per_package_gross: number; 
  line_total_gross?: number; 
  item_discount_type?: 'Percentage' | 'Amount' | ''; 
  item_discount_value?: number; 
  subtotal_before_item_vat?: number;     
  cost_after_item_adjustments?: number;  
  apportioned_discount_amount?: number; 
  apportioned_shipping_cost?: number;   
  apportioned_other_charges?: number; 
  line_subtotal_after_apportionment?: number;
  item_vat_percentage?: number; 
  item_vat_amount?: number; 
  line_total_net: number; 
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
  | 'preventive_measure_schedules' 
  | 'supplierInvoices'
  | 'supplierInvoiceItems'
  | 'purchasedSeedlings' 
  | 'plots'
  | 'cropSeasons'
  | 'cropPlans'
  | 'cropPlanStages'
  | 'cropPlanTasks' 
  | 'plannedStageResources'
  | 'cultivationActivityPlantingLinks'
  | 'cultivationActivityUsedInputs';

export class HurvesthubDB extends Dexie {
  crops!: Table<Crop, string>;
  seedBatches!: Table<SeedBatch, string>;
  inputInventory!: Table<InputInventory, string>;
  plantingLogs!: Table<PlantingLog, string>;
  cultivationLogs!: Table<CultivationLog, string>;
  cultivationActivityPlantingLinks!: Table<CultivationActivityPlantingLink, string>;
  cultivationActivityUsedInputs!: Table<CultivationActivityUsedInput, string>; 
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
    console.log('[HurvesthubDB] Constructor: Initialized super("HurvesthubDB").');

    this.on('blocked', () => {
      console.warn('[HurvesthubDB] Database open operation is blocked. Another tab might be holding it open with an older version.');
    });

    console.log('[HurvesthubDB] Constructor: About to define versions.');
    
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
      const tablesToUpgradeV2 = ["crops", "seedBatches", "inputInventory", "plantingLogs", "cultivationLogs", "harvestLogs", "customers", "sales", "saleItems", "invoices"];
      for (const tableName of tablesToUpgradeV2) {
        await tx.table(tableName as HurvesthubTableName).toCollection().modify(record => { if (record.is_deleted === undefined) record.is_deleted = 0; });
      }
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
      await tx.table("customers").toCollection().modify(customer => { if (customer.customer_type === undefined) customer.customer_type = 'Individual';});
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
      await tx.table('inputInventory').toCollection().modify((item: any) => { 
        if (item.cost_per_unit !== undefined && item.initial_quantity !== undefined && item.initial_quantity > 0) {
          item.total_purchase_cost = item.cost_per_unit * item.initial_quantity;
        } else if (item.cost_per_unit !== undefined && (item.initial_quantity === undefined || item.initial_quantity === 0) ) {
            item.total_purchase_cost = item.cost_per_unit;
        }
      });
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
      await tx.table('crops').toCollection().modify(crop => { if (crop.variety === undefined) crop.variety = null; });
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
      await tx.table('crops').toCollection().modify(crop => { if (crop.notes === undefined) crop.notes = null; });
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
      await tx.table('seedBatches').toCollection().modify((sb: any) => { delete sb.variety; });
    });
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
        return Promise.resolve(); 
    });
    this.version(29).stores({
      supplierInvoices: 'id, supplier_id, invoice_number, invoice_date, status, _last_modified, _synced, is_deleted',
      supplierInvoiceItems: 'id, supplier_invoice_id, input_inventory_id, [supplier_invoice_id+is_deleted], _last_modified, _synced, is_deleted',
      inputInventory: 'id, name, type, crop_id, supplier_id, supplier_invoice_number, total_purchase_cost, cost_per_unit, current_quantity, initial_quantity, minimum_stock_level, qr_code_data, _last_modified, _synced, is_deleted',
      plantingLogs: 'id, seedling_production_log_id, seed_batch_id, input_inventory_id, purchased_seedling_id, planting_date, plot_affected, _last_modified, _synced, is_deleted', 
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
    }).upgrade(tx => {
      console.log("Upgrading HurvesthubDB to version 29. (Schema for purchasedSeedlings added)");
      return Promise.resolve();
    });
    this.version(30).stores({
      plantingLogs: 'id, seedling_production_log_id, seed_batch_id, input_inventory_id, purchased_seedling_id, status, planting_date, plot_affected, _last_modified, _synced, is_deleted', 
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
      console.log("Upgrading HurvesthubDB to version 30: Adding 'status' and 'actual_end_date' to plantingLogs.");
      await tx.table('plantingLogs').toCollection().modify(pl => {
        if (pl.status === undefined) {
          pl.status = 'active'; 
        }
        if (pl.actual_end_date === undefined) {
          pl.actual_end_date = null;
        }
      });
      console.log("Finished upgrading HurvesthubDB to version 30.");
    });
    this.version(31).stores({
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
      console.log("Upgrading HurvesthubDB to version 31: Adding Crop Planning tables and crop_plan_id to plantingLogs.");
      await tx.table('plantingLogs').toCollection().modify(pl => {
        if (pl.crop_plan_id === undefined) {
          pl.crop_plan_id = null;
        }
      });
      console.log("Finished upgrading HurvesthubDB to version 31.");
    });
    this.version(32).stores({
      plannedStageResources: 'id, crop_plan_stage_id, resource_type, input_inventory_id, _last_modified, _synced, is_deleted',
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
      cultivationLogs: 'id, planting_log_id, activity_date, activity_type, plot_affected, input_inventory_id, _last_modified, _synced, is_deleted',
      harvestLogs: 'id, planting_log_id, tree_id, harvest_date, current_quantity_available, is_deleted, _last_modified, _synced',
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
    });
    this.version(33).stores({
      plannedStageResources: 'id, crop_plan_stage_id, resource_type, input_inventory_id, _last_modified, _synced, is_deleted',
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
      cultivationLogs: 'id, activity_date, activity_type, plot_affected, _last_modified, _synced, is_deleted', 
      cultivationActivityPlantingLinks: 'id, cultivation_log_id, planting_log_id, _last_modified, _synced, is_deleted, &[cultivation_log_id+planting_log_id]',
      cultivationActivityUsedInputs: 'id, cultivation_log_id, input_inventory_id, quantity_used, quantity_unit, _last_modified, _synced, is_deleted, &[cultivation_log_id+input_inventory_id]',
      harvestLogs: 'id, planting_log_id, tree_id, harvest_date, current_quantity_available, is_deleted, _last_modified, _synced',
      customers: 'id, name, customer_type, is_deleted, _last_modified, _synced',
      saleItems: 'id, sale_id, harvest_log_id, input_inventory_id, purchased_seedling_id, quantity_sold, price_per_unit, discount_type, discount_value, is_deleted, _last_modified, _synced',
      invoices: 'id, sale_id, invoice_number, is_deleted, _last_modified, _synced',
      syncMeta: 'id',
      trees: 'id, identifier, species, variety, planting_date, plot_affected, is_deleted, _last_modified, _synced',
      reminders: 'id, planting_log_id, flock_id, reminder_date, activity_type, is_completed, _last_modified, _synced, is_deleted',
      seedlingProductionLogs: 'id, seed_batch_id, crop_id, sowing_date, _last_modified, _synced, is_deleted',
      purchasedSeedlings: 'id, name, crop_id, supplier_id, purchase_date, initial_quantity, current_quantity, is_deleted, _last_modified, _synced'
    }).upgrade(async tx => {
      console.log("Upgrading HurvesthubDB to version 33: Modifying cultivationLogs and adding link tables.");
    });

    this.version(34).stores({
      plannedStageResources: 'id, crop_plan_stage_id, resource_type, input_inventory_id, _last_modified, _synced, is_deleted',
      plots: 'id, name, status, _last_modified, _synced, is_deleted',
      cropSeasons: 'id, name, start_date, end_date, _last_modified, _synced, is_deleted',
      cropPlans: 'id, crop_id, plot_id, crop_season_id, status, planned_sowing_date, planned_transplant_date, _last_modified, _synced, is_deleted',
      cropPlanStages: 'id, crop_plan_id, stage_type, status, planned_start_date, _last_modified, _synced, is_deleted',
      cropPlanTasks: 'id, crop_plan_stage_id, status, planned_due_date, assigned_to_user_id, _last_modified, _synced, is_deleted',
      plantingLogs: 'id, seedling_production_log_id, seed_batch_id, input_inventory_id, purchased_seedling_id, crop_plan_id, status, planting_date, plot_affected, _last_modified, _synced, is_deleted',
      supplierInvoices: 'id, supplier_id, invoice_number, invoice_date, status, [supplier_id+invoice_number], _last_modified, _synced, is_deleted',
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
      cultivationLogs: 'id, user_id, activity_date, activity_type, plot_affected, _last_modified, _synced, is_deleted', 
      cultivationActivityPlantingLinks: 'id, cultivation_log_id, planting_log_id, _last_modified, _synced, is_deleted, &[cultivation_log_id+planting_log_id]',
      cultivationActivityUsedInputs: 'id, cultivation_log_id, input_inventory_id, quantity_used, quantity_unit, _last_modified, _synced, is_deleted, &[cultivation_log_id+input_inventory_id]',
      harvestLogs: 'id, planting_log_id, tree_id, harvest_date, current_quantity_available, is_deleted, _last_modified, _synced',
      customers: 'id, name, customer_type, is_deleted, _last_modified, _synced',
      saleItems: 'id, sale_id, harvest_log_id, input_inventory_id, purchased_seedling_id, quantity_sold, price_per_unit, discount_type, discount_value, is_deleted, _last_modified, _synced',
      invoices: 'id, sale_id, invoice_number, is_deleted, _last_modified, _synced',
      syncMeta: 'id',
      trees: 'id, identifier, species, variety, planting_date, plot_affected, is_deleted, _last_modified, _synced',
      reminders: 'id, planting_log_id, flock_id, reminder_date, activity_type, is_completed, _last_modified, _synced, is_deleted',
      seedlingProductionLogs: 'id, seed_batch_id, crop_id, sowing_date, _last_modified, _synced, is_deleted',
      purchasedSeedlings: 'id, name, crop_id, supplier_id, purchase_date, initial_quantity, current_quantity, is_deleted, _last_modified, _synced'
    }).upgrade(async tx => {
      console.log("Upgrading HurvesthubDB to version 34: Adding user_id to cultivationLogs schema.");
    });

    console.log('[HurvesthubDB] Constructor: Finished defining all versions.');

    // Add 'ready' event listener
    this.on('ready', () => {
      console.log(`[HurvesthubDB] Database is ready. Actual DB version (db.verno): ${this.verno}`);
      if (this.verno > 0) {
        try {
          const tableNames = this.tables.map(t => t.name);
          console.log('[HurvesthubDB] Tables available after open:', tableNames);
          if (!tableNames.includes('inputInventory')) {
            console.error('[HurvesthubDB] CRITICAL: inputInventory is NOT in the list of available tables after DB open!');
          }
          if (!tableNames.includes('plantingLogs')) {
            console.error('[HurvesthubDB] CRITICAL: plantingLogs is NOT in the list of available tables after DB open!');
          }
          // Add more checks as needed
        } catch (e) {
          console.error('[HurvesthubDB] Error listing tables on ready:', e);
        }
      }
      // Dexie's on('ready') expects a Promise if it's doing async work,
      // but here we are just logging, so void is fine.
      // If you were to do async operations, return a Promise.
    });

    // Initialize table properties
    console.log('[HurvesthubDB] Constructor: Initializing table properties.');
    this.crops = this.table('crops');
    this.seedBatches = this.table('seedBatches');
    this.inputInventory = this.table('inputInventory');
    this.plantingLogs = this.table('plantingLogs');
    this.cultivationLogs = this.table('cultivationLogs');
    this.cultivationActivityPlantingLinks = this.table('cultivationActivityPlantingLinks');
    this.cultivationActivityUsedInputs = this.table('cultivationActivityUsedInputs');
    this.harvestLogs = this.table('harvestLogs');
    this.customers = this.table('customers');
    this.sales = this.table('sales');
    this.saleItems = this.table('saleItems');
    this.invoices = this.table('invoices');
    this.syncMeta = this.table('syncMeta');
    this.trees = this.table('trees');
    this.reminders = this.table('reminders');
    this.seedlingProductionLogs = this.table('seedlingProductionLogs');
    this.suppliers = this.table('suppliers');
    this.flocks = this.table('flocks');
    this.flock_records = this.table('flock_records');
    this.feed_logs = this.table('feed_logs');
    this.preventive_measure_schedules = this.table('preventive_measure_schedules');
    this.supplierInvoices = this.table('supplierInvoices');
    this.supplierInvoiceItems = this.table('supplierInvoiceItems');
    this.purchasedSeedlings = this.table('purchasedSeedlings');
    this.plots = this.table('plots');
    this.cropSeasons = this.table('cropSeasons');
    this.cropPlans = this.table('cropPlans');
    this.cropPlanStages = this.table('cropPlanStages');
    this.cropPlanTasks = this.table('cropPlanTasks');
    this.plannedStageResources = this.table('plannedStageResources');

    // Post-versioning sanity check for table instantiation
    try {
      console.log("[HurvesthubDB] Constructor: Attempting to access table names post-property-initialization.");
      console.log("[HurvesthubDB] Constructor: Accessing crops.name:", this.crops.name);
      if (this.preventive_measure_schedules) {
         console.log("[HurvesthubDB] Constructor: Accessing preventive_measure_schedules.name:", this.preventive_measure_schedules.name);
      } else {
         console.error("[HurvesthubDB] Constructor: this.preventive_measure_schedules is undefined before accessing .name");
      }
      console.log("[HurvesthubDB] Constructor: Table names accessed successfully post-property-initialization.");
    } catch (e) {
      console.error("[HurvesthubDB] Constructor: Error accessing table names post-property-initialization.", e);
    }
    console.log('[HurvesthubDB] Constructor: Finished initializing table properties and sanity checks.');
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
        'plannedStageResources',
        'cultivationActivityPlantingLinks', 
        'cultivationActivityUsedInputs'     
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