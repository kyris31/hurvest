'use client';

import React, { useState } from 'react'; // Removed useEffect, useCallback
import { useLiveQuery } from 'dexie-react-hooks';
import { db, PlantingLog, InputInventory, PurchasedSeedling, SeedlingProductionLog, Crop, SeedBatch } from '@/lib/db'; // Added Crop, SeedBatch
import { requestPushChanges } from '@/lib/sync'; // Import requestPushChanges
import PlantingLogList from '@/components/PlantingLogList';
import PlantingLogForm from '@/components/PlantingLogForm';

// syncCounter prop is no longer needed with useLiveQuery
export default function PlantingLogsPage() {
  const [showForm, setShowForm] = useState(false);
  const [editingLog, setEditingLog] = useState<PlantingLog | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [isCompleting, setIsCompleting] = useState<string | null>(null); // New state
  const [error, setError] = useState<string | null>(null); // For form submission errors

  const plantingLogs = useLiveQuery(
    async () => {
      try {
        return await db.plantingLogs
          .orderBy('planting_date')
          .filter(pl =>
            pl.is_deleted !== 1 &&
            (pl.status === 'active' || pl.status === undefined || pl.status === null)
          )
          .reverse()
          .toArray();
      } catch (err) {
        console.error("Failed to fetch planting logs with useLiveQuery:", err);
        setError("Failed to load planting logs. Please try again.");
        return [];
      }
    },
    []
  );

  const seedBatches = useLiveQuery(
    async () => {
      try {
        return await db.seedBatches.orderBy('_last_modified').filter(sb => sb.is_deleted === 0).reverse().toArray();
      } catch (err) {
        console.error("Failed to fetch seed batches for PlantingLogsPage:", err);
        // setError("Failed to load seed batch data."); // Avoid overwriting primary error
        return [];
      }
    },
    []
  );

  const crops = useLiveQuery(
    async () => {
      try {
        return await db.crops.orderBy('name').filter(c => c.is_deleted === 0).toArray();
      } catch (err) {
        console.error("Failed to fetch crops for PlantingLogsPage:", err);
        // setError("Failed to load crop data."); // Avoid overwriting primary error
        return [];
      }
    },
    []
  );

  const inputInventory = useLiveQuery(
    async () => {
      try {
        // Fetch all non-deleted inventory items. Could filter by type 'seedlings' if needed for performance.
        return await db.inputInventory.filter(ii => ii.is_deleted === 0).toArray();
      } catch (err) {
        console.error("Failed to fetch input inventory for PlantingLogsPage:", err);
        return [];
      }
    },
    []
  );

  const purchasedSeedlings = useLiveQuery(
    async () => {
      try {
        return await db.purchasedSeedlings.filter(ps => ps.is_deleted === 0).toArray();
      } catch (err) {
        console.error("Failed to fetch purchased seedlings for PlantingLogsPage:", err);
        return [];
      }
    },
    []
  );

  const seedlingProductionLogs = useLiveQuery(
    async () => {
      try {
        return await db.seedlingProductionLogs.filter(spl => spl.is_deleted === 0).toArray();
      } catch (err) {
        console.error("Failed to fetch seedling production logs for PlantingLogsPage:", err);
        return [];
      }
    },
    []
  );

  const isLoading = plantingLogs === undefined || seedBatches === undefined || crops === undefined || inputInventory === undefined || purchasedSeedlings === undefined || seedlingProductionLogs === undefined;

  // Helper function to get crop details for sorting and enrichment
  // This is adapted from PlantingLogList's getCropDetails
  const getPlantingLogCropInfo = (
    log: PlantingLog,
    allCrops: Crop[],
    allSeedBatches: SeedBatch[],
    allPurchasedSeedlings: PurchasedSeedling[],
    allSeedlingProductionLogs: SeedlingProductionLog[]
  ): { cropNameStr: string; cropVarietyStr: string } => {
    const activeCrops = allCrops.filter(c => c.is_deleted !== 1);

    if (log.purchased_seedling_id) {
      const purchasedSeedling = allPurchasedSeedlings.find(ps => ps.id === log.purchased_seedling_id && ps.is_deleted !== 1);
      if (purchasedSeedling?.crop_id) {
        const crop = activeCrops.find(c => c.id === purchasedSeedling.crop_id);
        if (crop) return { cropNameStr: crop.name, cropVarietyStr: crop.variety || '' };
        return { cropNameStr: "Error: Crop for PS Not Found", cropVarietyStr: '' };
      }
      return { cropNameStr: purchasedSeedling?.name || "Unknown Purchased Seedling", cropVarietyStr: '' };
    } else if (log.seedling_production_log_id) {
      const prodLog = allSeedlingProductionLogs.find(spl => spl.id === log.seedling_production_log_id && spl.is_deleted !== 1);
      if (prodLog?.crop_id) {
        const crop = activeCrops.find(c => c.id === prodLog.crop_id);
        if (crop) return { cropNameStr: crop.name, cropVarietyStr: crop.variety || '' };
      }
      // Fallback to seed batch if crop_id on prodLog is missing or doesn't resolve
      if (prodLog?.seed_batch_id) {
        const batch = allSeedBatches.find(b => b.id === prodLog.seed_batch_id && b.is_deleted !== 1);
        if (batch?.crop_id) {
          const crop = activeCrops.find(c => c.id === batch.crop_id);
          if (crop) return { cropNameStr: crop.name, cropVarietyStr: crop.variety || '' };
        }
      }
      return { cropNameStr: "From Seedling Prod. (Error)", cropVarietyStr: '' };
    } else if (log.seed_batch_id) {
      const batch = allSeedBatches.find(b => b.id === log.seed_batch_id && b.is_deleted !== 1);
      if (batch?.crop_id) {
        const crop = activeCrops.find(c => c.id === batch.crop_id);
        if (crop) return { cropNameStr: crop.name, cropVarietyStr: crop.variety || '' };
        return { cropNameStr: "Error: Crop for SB Not Found", cropVarietyStr: '' };
      }
      return { cropNameStr: "Unknown Seed Batch Source", cropVarietyStr: '' };
    } else if (log.input_inventory_id) {
      // This case would require fetching the specific inputInventory item,
      // or having allInputInventory passed and searching here.
      // For simplicity in this sorting context, we might display its direct name if available or mark as generic.
      // The PlantingLogList component already handles this display logic more robustly.
      // Here, we primarily need a sortable name.
      const invItem = inputInventory?.find(ii => ii.id === log.input_inventory_id && ii.is_deleted !== 1);
       if (invItem?.crop_id && crops) {
         const crop = activeCrops.find(c => c.id === invItem.crop_id);
         if (crop) return { cropNameStr: crop.name, cropVarietyStr: crop.variety || ''};
       }
      return { cropNameStr: invItem?.name || "Direct Input Item", cropVarietyStr: '' };
    }
    return { cropNameStr: "N/A", cropVarietyStr: "N/A" };
  };


  const sortedAndEnrichedPlantingLogs = React.useMemo(() => {
    if (!plantingLogs || !crops || !seedBatches || !purchasedSeedlings || !seedlingProductionLogs || !inputInventory) return [];

    const enriched = plantingLogs.map(log => {
      const { cropNameStr, cropVarietyStr } = getPlantingLogCropInfo(
        log,
        crops,
        seedBatches,
        purchasedSeedlings,
        seedlingProductionLogs
      );
      return {
        ...log,
        cropNameForSort: cropNameStr, // Add new property for sorting
        cropVarietyForSort: cropVarietyStr, // Add new property for display
      };
    });

    return enriched.sort((a, b) => {
      // Primary sort: cropNameForSort, locale-sensitive
      const nameComparison = (a.cropNameForSort || '').localeCompare(b.cropNameForSort || '', undefined, { sensitivity: 'base' });
      if (nameComparison !== 0) {
        return nameComparison;
      }
      // Secondary sort: planting_date (newest first)
      const dateA = new Date(a.planting_date).getTime();
      const dateB = new Date(b.planting_date).getTime();
      return dateB - dateA;
    });
  }, [plantingLogs, crops, seedBatches, purchasedSeedlings, seedlingProductionLogs, inputInventory]);


  const handleFormSubmit = async (data: Omit<PlantingLog, 'id' | '_synced' | '_last_modified' | 'created_at' | 'updated_at'> | PlantingLog) => {
    setIsSubmitting(true);
    setError(null);
    try {
      const now = new Date().toISOString();
      let plantingLogId: string | undefined = undefined;

      if ('id' in data && data.id) { // Editing existing
        // Note: Updating current_quantity for edited logs is complex.
        // If the seed batch or quantity planted changes, we'd need to revert the old deduction
        // and apply the new one. For simplicity, this example doesn't handle that rollback/reapply.
        // This assumes that once a planting log is created, its impact on seed batch quantity is fixed.
        const updatedLog: Partial<PlantingLog> = {
          ...data,
          updated_at: now,
          _synced: 0,
          _last_modified: Date.now(),
        };
        await db.plantingLogs.update(data.id, updatedLog);
        plantingLogId = data.id; // Keep track for potential (though not implemented here) quantity adjustments
      } else { // Adding new
        const newLogData: Omit<PlantingLog, 'id'> = {
          ...(data as Omit<PlantingLog, 'id' | '_synced' | '_last_modified' | 'created_at' | 'updated_at' | 'is_deleted' | 'deleted_at'>),
          created_at: now,
          updated_at: now,
          _synced: 0,
          _last_modified: Date.now(),
          is_deleted: 0,
          deleted_at: undefined,
        };
        plantingLogId = crypto.randomUUID();
        await db.plantingLogs.add({ ...newLogData, id: plantingLogId });

        // Decrement seed batch quantity if a batch was used
        if (data.seed_batch_id && data.quantity_planted && data.quantity_planted > 0) {
          const batch = await db.seedBatches.get(data.seed_batch_id);
          if (batch) {
            const currentQty = batch.current_quantity ?? batch.initial_quantity ?? 0;
            const newQuantity = Math.max(0, currentQty - data.quantity_planted);
            await db.seedBatches.update(data.seed_batch_id, {
              current_quantity: newQuantity,
              _synced: 0, // Mark batch for sync as its quantity changed
              _last_modified: Date.now()
            });
          }
        }
      }
      setShowForm(false);
      setEditingLog(null);
      // After successful local save, request a push to the server
      try {
        console.log("PlantingLogsPage: Push requesting after form submit...");
        const pushResult = await requestPushChanges();
        if (pushResult.success) {
          console.log("PlantingLogsPage: Push requested successfully after form submit.");
        } else {
          console.error("PlantingLogsPage: Push request failed after form submit.", pushResult.errors);
        }
      } catch (syncError) {
        console.error("Error requesting push after planting log save:", syncError);
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Failed to save planting log. Please try again.";
      console.error("Failed to save planting log:", err);
      setError(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (log: PlantingLog) => {
    setEditingLog(log);
    setShowForm(true);
    setError(null);
  };

  const handleDelete = async (id: string) => {
    setError(null); // Clear previous errors

    try {
      // Check for related Cultivation Logs
      const relatedCultivationLogs = await db.cultivationLogs
        .where('planting_log_id')
        .equals(id)
        .filter(log => log.is_deleted !== 1)
        .count();

      if (relatedCultivationLogs > 0) {
        setError(`Cannot delete this planting log: it is referenced by ${relatedCultivationLogs} cultivation log(s). Please delete or reassign them first.`);
        return;
      }

      // Check for related Harvest Logs
      const relatedHarvestLogs = await db.harvestLogs
        .where('planting_log_id')
        .equals(id)
        .filter(log => log.is_deleted !== 1)
        .count();

      if (relatedHarvestLogs > 0) {
        setError(`Cannot delete this planting log: it is referenced by ${relatedHarvestLogs} harvest log(s). Please delete or reassign them first.`);
        return;
      }

      // Check for related Reminders
      const relatedReminders = await db.reminders
        .where('planting_log_id')
        .equals(id)
        .filter(log => log.is_deleted !== 1)
        .count();
      
      if (relatedReminders > 0) {
        setError(`Cannot delete this planting log: it is referenced by ${relatedReminders} reminder(s). Please delete or reassign them first.`);
        return;
      }

    } catch (checkError) {
      console.error("Error checking for related records for planting log:", checkError);
      setError("Could not verify if planting log is in use. Deletion aborted.");
      return;
    }

    if (window.confirm("Are you sure you want to delete this planting log?")) {
      setIsDeleting(id);
      try {
        await db.markForSync('plantingLogs', id, {}, true);
        // UI will update via useLiveQuery
        // After successful local delete marking, request a push to the server
        try {
            console.log("PlantingLogsPage: Push requesting after delete...");
            const pushResult = await requestPushChanges();
            if (pushResult.success) {
                console.log("PlantingLogsPage: Push requested successfully after delete.");
            } else {
                console.error("PlantingLogsPage: Push request failed after delete.", pushResult.errors);
            }
        } catch (syncError) {
            console.error("Error requesting push after planting log delete:", syncError);
        }
      } catch (err) {
        console.error("Failed to mark planting log for deletion:", err);
        setError("Failed to mark planting log for deletion. See console for details.");
      } finally {
        setIsDeleting(null);
      }
    }
  };

  const handleMarkCompleted = async (id: string) => {
    setError(null);
    setIsCompleting(id);
    try {
      const log = await db.plantingLogs.get(id);
      if (!log) {
        throw new Error("Planting log not found to mark as completed.");
      }

      const today = new Date().toISOString().split('T')[0];
      const enteredDate = window.prompt(`Enter the completion date for this plantation (YYYY-MM-DD). Leave blank for today (${today}):`, today);

      if (enteredDate === null) { // User pressed cancel
        setIsCompleting(null);
        return;
      }

      const completionDate = enteredDate.trim() === '' ? today : enteredDate.trim();
      
      // Basic date validation (YYYY-MM-DD)
      if (!/^\d{4}-\d{2}-\d{2}$/.test(completionDate)) {
        setError("Invalid date format. Please use YYYY-MM-DD.");
        setIsCompleting(null);
        return;
      }

      const changes: Partial<PlantingLog> = {
        status: 'completed',
        actual_end_date: completionDate,
      };

      await db.markForSync('plantingLogs', id, changes);
      
      // After successful local update, request a push to the server
      try {
        console.log("PlantingLogsPage: Push requesting after marking completed...");
        const pushResult = await requestPushChanges();
        if (pushResult.success) {
          console.log("PlantingLogsPage: Push requested successfully after marking completed.");
        } else {
          console.error("PlantingLogsPage: Push request failed after marking completed.", pushResult.errors);
          // Optionally, revert local change or notify user more strongly
        }
      } catch (syncError) {
        console.error("Error requesting push after marking planting log completed:", syncError);
      }

    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Failed to mark planting log as completed.";
      console.error(errorMessage, err);
      setError(errorMessage);
    } finally {
      setIsCompleting(null);
    }
  };

  return (
    <div>
      <header className="bg-white shadow mb-6">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 flex justify-between items-center">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Planting Logs</h1>
          <button
            onClick={() => {
              console.log("[PlantingLogsPage] 'Record New Planting' button clicked.");
              setEditingLog(null);
              setShowForm(prev => {
                console.log("[PlantingLogsPage] setShowForm called. Previous value:", prev, "New value: true");
                return true;
              });
              setError(null);
            }}
            className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded shadow-sm transition-colors duration-150"
          >
            Record New Planting
          </button>
        </div>
      </header>

      {showForm && (
        <>
          {console.log("[PlantingLogsPage] 'showForm' is true, attempting to render PlantingLogForm.")}
          <PlantingLogForm
            initialData={editingLog}
            onSubmit={handleFormSubmit}
            onCancel={() => {
              console.log("[PlantingLogsPage] PlantingLogForm onCancel called.");
              setShowForm(false);
              setEditingLog(null);
              setError(null);
            }}
            isSubmitting={isSubmitting}
          />
        </>
      )}

      <div className="mt-4">
        {error && <p className="text-red-500 mb-4 p-3 bg-red-100 rounded-md">{error}</p>}
        {isLoading && <p className="text-center text-gray-500">Loading planting logs...</p>}
        {!isLoading && !error && sortedAndEnrichedPlantingLogs && (
          <PlantingLogList
            plantingLogs={sortedAndEnrichedPlantingLogs} // Pass sorted and enriched logs
            // seedBatches={seedBatches} // No longer needed
            // crops={crops} // No longer needed
            // inputInventory={inputInventory} // No longer needed
            // purchasedSeedlings={purchasedSeedlings} // No longer needed
            // seedlingProductionLogs={seedlingProductionLogs} // No longer needed
            onEdit={handleEdit}
            onDelete={handleDelete}
            onMarkCompleted={handleMarkCompleted}
            isDeleting={isDeleting}
            isCompleting={isCompleting}
          />
        )}
        {!isLoading && sortedAndEnrichedPlantingLogs && sortedAndEnrichedPlantingLogs.length === 0 && !error && (
           <div className="text-center py-10">
            <svg className="mx-auto h-12 w-12 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.53 16.122a3 3 0 00-5.78 1.128 2.25 2.25 0 01-2.4 2.245M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M12.75 9.75v2.25m0 0l-2.25 2.25M12.75 12l2.25-2.25M12.75 12l2.25 2.25M12.75 12l-2.25-2.25M7.5 15h9M7.5 12h.008v.008H7.5V12zm0 0h.008v.008H7.5V12zm0 0h.008v.008H7.5V12zm0 0h.008v.008H7.5V12zm3.75 0h.008v.008H11.25V12zm0 0h.008v.008H11.25V12zm0 0h.008v.008H11.25V12zm0 0h.008v.008H11.25V12zm3.75 0h.008v.008H15V12zm0 0h.008v.008H15V12zm0 0h.008v.008H15V12zm0 0h.008v.008H15V12z" />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">No planting logs</h3>
            <p className="mt-1 text-sm text-gray-500">Get started by recording a new planting event.</p>
            <div className="mt-6">
              <button
                type="button"
                onClick={() => { setEditingLog(null); setShowForm(true); setError(null); }}
                className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
              >
                <svg className="-ml-1 mr-2 h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                </svg>
                Record New Planting
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}