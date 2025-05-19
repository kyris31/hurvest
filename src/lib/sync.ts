'use client';

import { useState, useEffect } from 'react';
import Dexie from 'dexie'; // Import Dexie
import { supabase } from './supabaseClient';
import { db } from './db';
import type { Crop, SeedBatch, InputInventory, PlantingLog, CultivationLog, HarvestLog, Sale, SaleItem, Customer, Invoice } from './db';

// Define and export the structured error type for sync operations
export interface SyncError {
  table: string;
  id: string;
  message: string;
  code?: string; // e.g., Supabase error code like '23503'
  details?: string; // e.g., Supabase error details
  hint?: string; // e.g., Supabase error hint
}
// --- End of SyncError type definition ---

// --- Online Status Hook ---
export function useOnlineStatus() {
  // Initial state for SSR and first client render.
  // This value MUST be consistent between server and client's first paint.
  // We default to 'true' as navigator.onLine would be true if navigator was defined and online,
  // and our SSR fallback was 'true'.
  const [isOnline, setIsOnline] = useState(true);
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setHasMounted(true); // Signal that component has mounted on client
    
    // Now set the actual online status from the client's navigator
    const handleStatusChange = () => {
      setIsOnline(navigator.onLine);
    };

    handleStatusChange(); // Set initial client status after mount

    window.addEventListener('online', handleStatusChange);
    window.addEventListener('offline', handleStatusChange);

    return () => {
      window.removeEventListener('online', handleStatusChange);
      window.removeEventListener('offline', handleStatusChange);
    };
  }, []); // Empty dependency array: run once on mount, cleanup on unmount.

  // During SSR and initial client render (before useEffect runs for the first time), `hasMounted` is false.
  // Return the consistent initial value (true).
  // After mount, `hasMounted` is true, return the actual client-side `isOnline` state.
  return hasMounted ? isOnline : true;
}

// --- Synchronization Logic (Placeholders and Initial Structure) ---

const TABLES_TO_SYNC = [
  // Parents / Independent
  { name: 'crops', dbTable: db.crops },
  { name: 'customers', dbTable: db.customers },
  { name: 'trees', dbTable: db.trees },
  { name: 'input_inventory', dbTable: db.inputInventory },

  // Children with dependencies
  { name: 'seed_batches', dbTable: db.seedBatches }, // Depends on crops
  { name: 'seedling_production_logs', dbTable: db.seedlingProductionLogs }, // Depends on seed_batches, crops
  { name: 'planting_logs', dbTable: db.plantingLogs }, // Depends on seed_batches or seedling_production_logs

  // Further dependencies
  { name: 'cultivation_logs', dbTable: db.cultivationLogs }, // Depends on planting_logs, input_inventory
  { name: 'harvest_logs', dbTable: db.harvestLogs }, // Depends on planting_logs
  { name: 'reminders', dbTable: db.reminders }, // Can depend on planting_logs

  // Sales pipeline
  { name: 'sales', dbTable: db.sales }, // Depends on customers
  { name: 'sale_items', dbTable: db.saleItems }, // Depends on sales, harvest_logs
  { name: 'invoices', dbTable: db.invoices }, // Depends on sales
] as const; // Use 'as const' for stricter typing of table names

// type TableName = typeof TABLES_TO_SYNC[number]['name']; // Removed unused type

// Function to get unsynced items from a specific table
async function getUnsyncedItems<T extends { id: string; _synced?: number; _last_modified?: number; is_deleted?: number }>(
  table: Dexie.Table<T, string>
): Promise<T[]> {
  // Fetches all items marked for sync, including those marked for deletion
  return table.where('_synced').equals(0).toArray();
}

// Function to push changes to Supabase
async function pushChangesToSupabase() {
  if (!navigator.onLine) {
    console.log("Offline. Skipping push to Supabase.");
    return { DBNAME_INVALID_OPERATION: "Offline. Cannot push changes." };
  }
  console.log("Attempting to push changes to Supabase...");
  let changesPushed = 0;
  const errors: SyncError[] = [];

  for (const { name, dbTable } of TABLES_TO_SYNC) {
    // Type assertion needed because Dexie.Table<any, any> is not directly assignable
    // Using Dexie.Table<any, string> due to dynamic table iteration. Consider a more specific type if feasible.
    const table = dbTable as Dexie.Table<any, string>;
    const unsynced = await getUnsyncedItems(table);

    if (unsynced.length > 0) {
      console.log(`Found ${unsynced.length} unsynced items in ${name}`);
    }

    for (const item of unsynced) {
      // Explicitly type item to include is_deleted
      const currentItem = item as { id: string; _synced?: number; _last_modified?: number; is_deleted?: number; deleted_at?: string };
      
      try {
        if (currentItem.is_deleted === 1) {
          // Handle soft delete: delete from Supabase, then hard delete locally
          console.log(`Attempting to delete item ${currentItem.id} from ${name} in Supabase.`);
          const { error: deleteError } = await supabase.from(name).delete().eq('id', currentItem.id);
          if (deleteError) {
            // If Supabase delete fails (e.g. RLS, record not found), it might still be an error.
            // However, if it's "not found", we might want to proceed with local deletion.
            // For now, throw to log it.
            // Throw the deleteError so it's caught by the main catch block for consistent error processing
            throw deleteError;
          }
          // If Supabase deletion was successful, hard delete from Dexie
          // This part is problematic if the goal is to keep local data until server confirms.
          // For now, we'll assume if Supabase delete is OK, local delete is OK.
          // However, if the item was already deleted from Supabase (e.g. by another client),
          // this local delete is fine.
          await table.delete(currentItem.id);
          changesPushed++; // Count as a pushed change (a deletion)
          console.log(`Successfully deleted item ${currentItem.id} from ${name} in Supabase and Dexie.`);
        } else {
          // Handle upsert for non-deleted items
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { _synced, _last_modified, is_deleted, deleted_at, ...itemToPushAny } = currentItem;
          // itemToPush needs to be mutable for deletions of properties
          let itemToPush: Record<string, any> = { ...itemToPushAny };

          // Data cleaning specific to tables before pushing
          if (name === 'input_inventory') {
            if ('cost_per_unit' in itemToPush) {
              delete itemToPush.cost_per_unit;
            }
          }
          
          if (name === 'sale_items') {
            const saleItemToPush = itemToPush as Partial<SaleItem>;
            // Normalize potentially erroneous empty string or undefined to null for discount_type
            if ((saleItemToPush.discount_type as unknown as string) === '' || saleItemToPush.discount_type === undefined) {
              saleItemToPush.discount_type = null;
            }
            // If discount_type is null (either originally or after normalization), discount_value should also be null
            if (saleItemToPush.discount_type === null) {
              saleItemToPush.discount_value = null;
            }
          }

          // If syncing the 'sales' table, remove any nested 'items' array before pushing.
          // Nested items are synced separately to the 'sale_items' table.
          if (name === 'sales' && 'items' in itemToPush) {
            console.log(`Removing nested 'items' array from sale object ${itemToPush.id} before pushing to Supabase.`);
            delete itemToPush.items;
          }

          if (name === 'seedling_production_logs') {
            // Remove enriched fields not present in the actual Supabase table
            delete itemToPush.cropName;
            delete itemToPush.cropVariety;
            delete itemToPush.seedBatchCode;
          }

          const { error: upsertError } = await supabase.from(name).upsert(itemToPush, { onConflict: 'id' });
          
          if (upsertError) {
            throw upsertError;
          }
          
          // Mark as synced in Dexie
          await table.update(currentItem.id, { _synced: 1 });
          changesPushed++;
          console.log(`Successfully synced (upserted) item ${currentItem.id} from ${name}`);
        }
      } catch (error: unknown) {
        console.error(`Failed to sync item ${item.id} from ${name}. Raw error object:`, error);
        
        let userMessage = `Failed to sync item ${item.id} in table ${name}.`;
        let errorCode: string | undefined;
        let errorDetails: string | undefined;
        let errorHint: string | undefined;

        // Check if it's a Supabase error structure (often has code, details, message, hint)
        // Supabase errors might be directly the error object or nested in `error.cause`
        const supabaseError = (typeof error === 'object' && error !== null && 'code' in error && 'message' in error)
                              ? error as { code: string, message: string, details?: string, hint?: string }
                              : (error instanceof Error && error.cause && typeof error.cause === 'object' && 'code' in error.cause && 'message' in error.cause)
                                ? error.cause as { code: string, message: string, details?: string, hint?: string }
                                : null;

        if (supabaseError) {
          errorCode = supabaseError.code;
          errorDetails = supabaseError.details;
          errorHint = supabaseError.hint;
          userMessage = supabaseError.message || userMessage; // Prefer Supabase message

          if (errorCode === '23503') { // Foreign key violation
            userMessage = `Cannot sync ${name} item ${item.id}: it references a related record that doesn't exist on the server. Details: ${errorDetails || supabaseError.message}`;
          } else if (errorCode === '23505') { // Unique constraint violation
             userMessage = `Cannot sync ${name} item ${item.id}: A unique value conflict occurred. Details: ${errorDetails || supabaseError.message}`;
          }
          // Add more specific messages for other common error codes if needed
        } else if (error instanceof Error) {
          userMessage = error.message;
        } else if (typeof error === 'string') {
          userMessage = error;
        }

        errors.push({
          table: name,
          id: item.id,
          message: userMessage,
          code: errorCode,
          details: errorDetails,
          hint: errorHint
        });
      }
    }
  }

  if (changesPushed > 0) console.log(`Successfully pushed ${changesPushed} changes to Supabase.`);
  if (errors.length > 0) {
      console.error("Detailed errors occurred during sync push:");
      errors.forEach(err => console.error(`- Table: ${err.table}, ID: ${err.id}, Code: ${err.code || 'N/A'}, Message: ${err.message}, Details: ${err.details || 'N/A'}`));
  }
  return { changesPushed, errors };
}


// Function to fetch changes from Supabase
// This needs a robust strategy, e.g., using last_modified timestamps
// and fetching records updated since the last local sync timestamp.
async function fetchChangesFromSupabase() {
  if (!navigator.onLine) {
    console.log("Offline. Skipping fetch from Supabase.");
    return { DBNAME_INVALID_OPERATION: "Offline. Cannot fetch changes." };
  }
  console.log("Attempting to fetch changes from Supabase...");
  let changesFetched = 0;
  const errors: SyncError[] = []; // Use the exported SyncError interface

  for (const { name, dbTable } of TABLES_TO_SYNC) {
    try {
      // Get the last sync timestamp for this table from local meta table (or default to epoch)
      const lastSyncMeta = await db.syncMeta.get(`lastSyncTimestamp_${name}`);
      const lastSyncTimestamp = lastSyncMeta ? new Date(lastSyncMeta.value).toISOString() : new Date(0).toISOString();
      
      console.log(`Fetching changes for ${name} since ${lastSyncTimestamp}`);

      // Fetch records updated on Supabase after the last sync
      // Assumes Supabase tables have an 'updated_at' column managed by Postgres (e.g. via trigger)
      const { data, error } = await supabase
        .from(name)
        .select('*')
        .gt('updated_at', lastSyncTimestamp) // Greater than last sync time
        // .eq('is_deleted', false) // Optionally, only fetch non-deleted items if server soft deletes
        .order('updated_at', { ascending: true }); // Process in order

      if (error) throw error;

      if (data && data.length > 0) {
        console.log(`Fetched ${data.length} new/updated items from ${name}`);
        // Using Dexie.Table<any, string> due to dynamic table iteration.
        const table = dbTable as Dexie.Table<any, string>;
        
        await db.transaction('rw', table, async () => {
            for (const supabaseItem of data) {
                const remoteItem = supabaseItem as { id: string; updated_at: string; is_deleted?: boolean; deleted_at?: string; [key: string]: unknown };

                if (remoteItem.is_deleted) {
                    // If server indicates item is deleted, delete it locally
                    const localExists = await table.get(remoteItem.id);
                    if (localExists) {
                        await table.delete(remoteItem.id);
                        console.log(`Item ${remoteItem.id} from ${name} deleted locally as per server.`);
                        changesFetched++; // Count as a change
                    }
                } else {
                    // Upsert logic for non-deleted items
                    const localItem = await table.get(remoteItem.id);
                    if (localItem && localItem._last_modified && localItem._last_modified > new Date(remoteItem.updated_at).getTime()) {
                        console.warn(`Local item ${localItem.id} in ${name} is newer. Skipping server update for this item.`);
                        continue;
                    }
                    
                    await table.put({
                        ...remoteItem,
                        _synced: 1,
                        _last_modified: new Date(remoteItem.updated_at).getTime(),
                        is_deleted: 0, // Ensure is_deleted is set to 0 if coming from server as active
                        deleted_at: undefined
                    });
                    changesFetched++;
                }
            }
        });
        
        // Update last sync timestamp for this table to the latest fetched item's updated_at
        // Ensure data is not empty before accessing last element
        if (data.length > 0) {
            const latestTimestamp = data[data.length - 1].updated_at;
            if (latestTimestamp) {
                 await db.syncMeta.put({ id: `lastSyncTimestamp_${name}`, value: new Date(latestTimestamp).getTime() });
                 console.log(`Updated last sync timestamp for ${name} to ${new Date(latestTimestamp).toISOString()}`);
            }
        }
      }
    } catch (error: unknown) {
      console.error(`Failed to fetch changes for table ${name}. Raw error object:`, error);
      let userMessage = `Failed to fetch changes for table ${name}.`;
      let errorCode: string | undefined;
      let errorDetails: string | undefined;
      let errorHint: string | undefined;

      const supabaseError = (typeof error === 'object' && error !== null && 'code' in error && 'message' in error)
                            ? error as { code: string, message: string, details?: string, hint?: string }
                            : (error instanceof Error && error.cause && typeof error.cause === 'object' && 'code' in error.cause && 'message' in error.cause)
                              ? error.cause as { code: string, message: string, details?: string, hint?: string }
                              : null;
      
      if (supabaseError) {
        errorCode = supabaseError.code;
        errorDetails = supabaseError.details;
        errorHint = supabaseError.hint;
        userMessage = supabaseError.message || userMessage;
      } else if (error instanceof Error) {
        userMessage = error.message;
      } else if (typeof error === 'string') {
        userMessage = error;
      }

      errors.push({
        table: name,
        id: 'N/A', // Fetch errors are typically table-wide, not item-specific
        message: userMessage,
        code: errorCode,
        details: errorDetails,
        hint: errorHint
      });
    }
  }
  if (changesFetched > 0) console.log(`Successfully fetched and applied ${changesFetched} changes from Supabase.`);
  if (errors.length > 0) {
    console.error("Detailed errors occurred during sync fetch:");
    errors.forEach(err => console.error(`- Table: ${err.table}, ID: ${err.id}, Code: ${err.code || 'N/A'}, Message: ${err.message}, Details: ${err.details || 'N/A'}`));
  }
  return { changesFetched, errors };
}

// Main sync function
export async function synchronize() {
  console.log("Starting synchronization process...");
  const pushResult = await pushChangesToSupabase();
  const fetchResult = await fetchChangesFromSupabase();
  console.log("Synchronization process finished.");
  return { pushResult, fetchResult };
}

// Auto-sync (example: on interval or when online status changes)
let syncInterval: NodeJS.Timeout | null = null;

export function startAutoSync(intervalMinutes = 5) {
  if (syncInterval) clearInterval(syncInterval);
  
  const performSync = async () => {
    if (navigator.onLine) {
      console.log("Auto-sync triggered...");
      await synchronize();
    } else {
      console.log("Offline, auto-sync skipped.");
    }
  };
  
  // Perform initial sync
  performSync(); 
  
  syncInterval = setInterval(performSync, intervalMinutes * 60 * 1000);
  console.log(`Auto-sync started. Interval: ${intervalMinutes} minutes.`);
}

export function stopAutoSync() {
  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
    console.log("Auto-sync stopped.");
  }
}

// Manual Sync Trigger
export async function triggerManualSync() {
    console.log("Manual sync triggered...");
    return await synchronize();
}

// TODO:
// - Robust error handling and retry mechanisms.
// - Conflict resolution strategies (currently simple server-wins, or local-wins if local is newer).
// - Handling deletions: Soft deletes or a separate log for deletions to propagate.
// - More granular control over what gets synced (e.g., per table, per record).
// - UI feedback during sync process.