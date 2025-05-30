'use client';

import React, { useState, useEffect, useCallback, useContext } from 'react';
import { db, CultivationLog, PlantingLog, SeedBatch, Crop, InputInventory, CultivationActivityUsedInput, CultivationActivityPlantingLink, SeedlingProductionLog, PurchasedSeedling } from '@/lib/db';
import { requestPushChanges } from '@/lib/sync';
import { useDbContext } from '@/contexts/DbContext';
import CultivationLogList from '@/components/CultivationLogList';
import CultivationLogForm from '@/components/CultivationLogForm';

export default function CultivationLogsPage() {
  const [cultivationLogs, setCultivationLogs] = useState<CultivationLog[]>([]);
  // This state will hold the enriched planting logs
  const [plantingLogs, setPlantingLogs] = useState<(PlantingLog & { cropName?: string; seedBatchCode?: string; displayLabel?: string })[]>([]);
  const [seedBatches, setSeedBatches] = useState<SeedBatch[]>([]);
  const [crops, setCrops] = useState<Crop[]>([]);
  const [inputInventory, setInputInventory] = useState<InputInventory[]>([]);
  const [activityUsedInputs, setActivityUsedInputs] = useState<CultivationActivityUsedInput[]>([]);
  const [activityPlantingLinks, setActivityPlantingLinks] = useState<CultivationActivityPlantingLink[]>([]);
  
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingLog, setEditingLog] = useState<CultivationLog | null>(null);
  const [editingUsedInputs, setEditingUsedInputs] = useState<CultivationActivityUsedInput[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const { isDbReady, dbInstance } = useDbContext();

  interface CultivationLogFormData {
    logData: Omit<CultivationLog, 'id' | '_synced' | '_last_modified' | 'created_at' | 'updated_at' | 'is_deleted' | 'deleted_at'> | CultivationLog;
    usedInputs: Array<{
      id?: string;
      input_inventory_id: string;
      quantity_used: number;
      quantity_unit: string;
      is_deleted?: boolean;
    }>;
    // selectedPlantingLogIds will be handled by this component based on what's submitted from the form
  }

  const fetchData = useCallback(async () => {
    if (!isDbReady || !dbInstance) {
      console.log(`CultivationLogsPage: DB not ready (isDbReady: ${isDbReady}, dbInstance: ${!!dbInstance}), fetchData skipped.`);
      setIsLoading(false);
      return;
    }
    console.log("CultivationLogsPage: DB is ready, proceeding with fetchData.");
    setIsLoading(true);
    try {
      const currentDb = dbInstance || db;
      const [
        cLogsData,
        rawPlantingLogsData,
        sBatchesData,
        crpsData,
        inputsData,
        usedInputsData,
        plantingLinksData,
        seedlingProdLogsData,
        purchasedSeedlingsData
      ] = await Promise.all([
        currentDb.cultivationLogs.orderBy('activity_date').filter(cl => cl.is_deleted === 0).reverse().toArray(),
        currentDb.plantingLogs.orderBy('planting_date').filter(pl => pl.is_deleted !== 1 && (pl.status === 'active' || pl.status === undefined || pl.status === null)).reverse().toArray(),
        currentDb.seedBatches.orderBy('_last_modified').filter(sb => sb.is_deleted === 0).reverse().toArray(),
        currentDb.crops.orderBy('name').filter(c => c.is_deleted === 0).toArray(),
        currentDb.inputInventory.orderBy('name').filter(ii => ii.is_deleted === 0).toArray(),
        currentDb.cultivationActivityUsedInputs.filter(aui => aui.is_deleted === 0).toArray(),
        currentDb.cultivationActivityPlantingLinks.filter(apl => apl.is_deleted === 0).toArray(),
        currentDb.seedlingProductionLogs.filter(sl => sl.is_deleted !== 1).toArray(),
        currentDb.purchasedSeedlings.filter(ps => ps.is_deleted !== 1).toArray(),
      ]);

      const cropsMap = new Map(crpsData.map(c => [c.id, c]));
      const seedBatchesMap = new Map(sBatchesData.map(sb => [sb.id, sb]));
      const seedlingProdLogsMap = new Map(seedlingProdLogsData.map(sl => [sl.id, sl]));
      const purchasedSeedlingsMap = new Map(purchasedSeedlingsData.map(ps => [ps.id, ps]));

      const enrichedPlantingLogs = rawPlantingLogsData.map(pl => {
        let cropName = 'N/A';
        let varietyName = '';
        let sourceDetails = '';

        if (pl.seed_batch_id) {
          const sb = seedBatchesMap.get(pl.seed_batch_id);
          if (sb) {
            sourceDetails = `Batch: ${sb.batch_code}`;
            const crop = sb.crop_id ? cropsMap.get(sb.crop_id) : undefined;
            if (crop) {
              cropName = crop.name;
              varietyName = crop.variety || '';
            }
          }
        } else if (pl.seedling_production_log_id) {
          const sl = seedlingProdLogsMap.get(pl.seedling_production_log_id);
          if (sl) {
            sourceDetails = `Self-Prod. Log`;
            const crop = sl.crop_id ? cropsMap.get(sl.crop_id) : undefined;
            if (crop) {
              cropName = crop.name;
              varietyName = crop.variety || '';
            } else if (sl.seed_batch_id) {
              const sb = seedBatchesMap.get(sl.seed_batch_id);
               if (sb && sb.crop_id) {
                  const c = cropsMap.get(sb.crop_id);
                  if(c) { cropName = c.name; varietyName = c.variety || '';}
               }
            }
          }
        } else if (pl.purchased_seedling_id) {
          const ps = purchasedSeedlingsMap.get(pl.purchased_seedling_id);
          if (ps) {
            sourceDetails = `Purchased: ${ps.name}`;
            const crop = ps.crop_id ? cropsMap.get(ps.crop_id) : undefined;
            if (crop) {
              cropName = crop.name;
              varietyName = crop.variety || '';
            }
          }
        } else if (pl.input_inventory_id) {
          sourceDetails = `Input Item`; // Should ideally not be the primary source for "crop" context
        }
        
        const displayLabel = `${new Date(pl.planting_date).toLocaleDateString()} - ${cropName}${varietyName ? ` (${varietyName})` : ''} - ${sourceDetails} - Plot: ${pl.plot_affected || pl.location_description || 'N/A'}`;
        return { ...pl, cropName, displayLabel };
      });
      
      enrichedPlantingLogs.sort((a, b) => {
          const nameA = a.cropName || 'zzz';
          const nameB = b.cropName || 'zzz';
          const nameCompare = nameA.localeCompare(nameB, undefined, { sensitivity: 'base' });
          if (nameCompare !== 0) return nameCompare;
          return new Date(b.planting_date).getTime() - new Date(a.planting_date).getTime();
      });

      setCultivationLogs(cLogsData);
      setPlantingLogs(enrichedPlantingLogs); // Set the enriched list
      setSeedBatches(sBatchesData);
      setCrops(crpsData);
      setInputInventory(inputsData);
      setActivityUsedInputs(usedInputsData);
      setActivityPlantingLinks(plantingLinksData);
      setError(null);
    } catch (err) {
      console.error("Failed to fetch cultivation data:", err);
      setError("Failed to load cultivation logs or related data. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, [isDbReady, dbInstance]); // Removed fetchData from its own dependency array

  useEffect(() => {
    if (isDbReady && dbInstance) {
      fetchData();
    } else {
      console.log(`CultivationLogsPage: useEffect - DB not ready (isDbReady: ${isDbReady}, dbInstance: ${!!dbInstance}), waiting.`);
    }
  }, [fetchData, isDbReady, dbInstance]);

  const handleFormSubmit = async (formData: CultivationLogFormData) => {
    setIsSubmitting(true);
    setError(null);
    const currentDb = dbInstance || db;
    const { logData, usedInputs } = formData;
    const now = new Date().toISOString();
    const timestamp = Date.now();
    const cultivationLogId = ('id' in logData && logData.id) ? logData.id : crypto.randomUUID();

    // Extract selectedPlantingLogIds from the form if it's passed back, or manage it via a separate state in page.tsx
    // For this example, assuming CultivationLogForm passes back selectedPlantingLogIds if it manages them.
    // Or, if CultivationLogForm only manages its internal state, we'd get them from selectedPlantingLogIds state of this page.
    // Let's assume for now the form data might include it, or we use this page's state.
    // For simplicity, we'll assume the form doesn't pass selectedPlantingLogIds back directly in formData,
    // and we rely on the `selectedPlantingLogIds` state managed by the form, which isn't directly accessible here.
    // This part needs careful handling of how selectedPlantingLogIds are communicated from form to this handler.
    // A common pattern is for the form to call a specific handler for planting log selection changes.
    // For now, we'll assume the form's `onSubmit` needs to be adapted to include these if not already.
    // Let's assume `formData` will be extended or we use a separate mechanism for `selectedPlantingLogIds`.
    // For this iteration, we'll assume `selectedPlantingLogIds` is available from the form's state via a prop or callback.
    // This example will proceed as if `formData` contains `selectedPlantingLogIds`.
    // This needs to be reconciled with CultivationLogForm's actual onSubmit data structure.
    // The current CultivationLogForm's handleSubmit calls onSubmit with only logData and usedInputs.
    // So, we need to get selectedPlantingLogIds from the form's state, which is not directly available here.
    // This implies CultivationLogForm's onSubmit needs to pass these.
    // Let's modify CultivationLogForm to pass selectedPlantingLogIds.
    // For now, this function will assume it gets it.

    // This is a placeholder - selectedPlantingLogIds needs to be correctly passed from the form
    const finalSelectedPlantingLogIds = (formData as any).selectedPlantingLogIds || [];


    try {
      await currentDb.transaction('rw', 
        currentDb.cultivationLogs, 
        currentDb.inputInventory, 
        currentDb.cultivationActivityUsedInputs,
        currentDb.cultivationActivityPlantingLinks // Add to transaction
      , async () => {
        if ('id' in logData && logData.id) {
          const updatedLogData: Partial<CultivationLog> = { 
            ...logData, 
            updated_at: now, 
            _synced: 0, 
            _last_modified: timestamp
          };
          await currentDb.cultivationLogs.update(logData.id, updatedLogData);
        } else {
          const newLog: CultivationLog = {
            ...(logData as Omit<CultivationLog, 'id' | '_synced' | '_last_modified' | 'created_at' | 'updated_at' | 'is_deleted' | 'deleted_at'>),
            id: cultivationLogId,
            created_at: now,
            updated_at: now,
            _synced: 0,
            _last_modified: timestamp,
            is_deleted: 0,
            deleted_at: undefined,
          };
          await currentDb.cultivationLogs.add(newLog);
        }

        // Manage CultivationActivityPlantingLinks
        const existingPlantingLinks = ('id' in logData && logData.id)
          ? await currentDb.cultivationActivityPlantingLinks.where('cultivation_log_id').equals(logData.id).filter(link => link.is_deleted === 0).toArray()
          : [];
        
        const linksToDelete = existingPlantingLinks.filter(link => !finalSelectedPlantingLogIds.includes(link.planting_log_id));
        const plantingLogIdsToAdd = finalSelectedPlantingLogIds.filter((id: string) => !existingPlantingLinks.some(link => link.planting_log_id === id));

        for (const link of linksToDelete) {
          await currentDb.markForSync('cultivationActivityPlantingLinks', link.id, {}, true);
        }
        for (const plId of plantingLogIdsToAdd) {
          await currentDb.cultivationActivityPlantingLinks.add({
            id: crypto.randomUUID(),
            cultivation_log_id: cultivationLogId,
            planting_log_id: plId,
            created_at: now,
            updated_at: now,
            _synced: 0,
            _last_modified: timestamp,
            is_deleted: 0,
          });
        }
        
        // Process CultivationActivityUsedInputs (as before)
        const existingUsedInputsDb = ('id' in logData && logData.id) 
          ? await currentDb.cultivationActivityUsedInputs.where('cultivation_log_id').equals(logData.id).filter(link => link.is_deleted === 0).toArray()
          : [];

        for (const existingInput of existingUsedInputsDb) {
          const formInputEquivalent = usedInputs.find(ui => ui.id === existingInput.id);
          if (!formInputEquivalent || formInputEquivalent.is_deleted) {
            const inventoryItem = await currentDb.inputInventory.get(existingInput.input_inventory_id);
            if (inventoryItem) {
              await currentDb.inputInventory.update(existingInput.input_inventory_id, {
                current_quantity: (inventoryItem.current_quantity ?? 0) + existingInput.quantity_used,
                _synced: 0, _last_modified: timestamp
              });
            }
            await currentDb.markForSync('cultivationActivityUsedInputs', existingInput.id, {}, true);
          }
        }
        
        for (const formInput of usedInputs) {
          if (formInput.is_deleted) continue;

          const inventoryItem = await currentDb.inputInventory.get(formInput.input_inventory_id);
          if (!inventoryItem) throw new Error(`Input item with ID ${formInput.input_inventory_id} not found.`);

          const existingLinkEquivalent = existingUsedInputsDb.find(ei => ei.id === formInput.id);
          let quantityChange = formInput.quantity_used;

          if (existingLinkEquivalent) { // Update existing link
            if (existingLinkEquivalent.input_inventory_id !== formInput.input_inventory_id) { // Item changed
              // Revert old item
              const oldInventoryItem = await currentDb.inputInventory.get(existingLinkEquivalent.input_inventory_id);
              if (oldInventoryItem) {
                await currentDb.inputInventory.update(existingLinkEquivalent.input_inventory_id, {
                  current_quantity: (oldInventoryItem.current_quantity ?? 0) + existingLinkEquivalent.quantity_used,
                  _synced: 0, _last_modified: timestamp
                });
              }
              // Deduct new item (quantityChange is already formInput.quantity_used)
            } else { // Item same, quantity might have changed
              quantityChange = formInput.quantity_used - existingLinkEquivalent.quantity_used;
            }
          } else { // New link
            // quantityChange is already formInput.quantity_used (negative effect on stock)
          }

          if (quantityChange !== 0) {
             const newInventoryQuantity = (inventoryItem.current_quantity ?? 0) - (existingLinkEquivalent && existingLinkEquivalent.input_inventory_id === formInput.input_inventory_id ? quantityChange : formInput.quantity_used) ;

            if (newInventoryQuantity < 0) {
              throw new Error(`Not enough ${inventoryItem.name} in stock. Available: ${inventoryItem.current_quantity ?? 0}, Tried to use: ${formInput.quantity_used}`);
            }
            await currentDb.inputInventory.update(formInput.input_inventory_id, {
              current_quantity: newInventoryQuantity,
              _synced: 0, _last_modified: timestamp
            });
          }

          if (formInput.id) { // Update existing CultivationActivityUsedInput
            await currentDb.cultivationActivityUsedInputs.update(formInput.id, {
              cultivation_log_id: cultivationLogId, // Ensure it's linked to the correct log
              input_inventory_id: formInput.input_inventory_id,
              quantity_used: formInput.quantity_used,
              quantity_unit: formInput.quantity_unit,
              _synced: 0, _last_modified: timestamp, is_deleted: 0, updated_at: now,
            });
          } else { // Add new CultivationActivityUsedInput
            await currentDb.cultivationActivityUsedInputs.add({
              id: crypto.randomUUID(),
              cultivation_log_id: cultivationLogId,
              input_inventory_id: formInput.input_inventory_id,
              quantity_used: formInput.quantity_used,
              quantity_unit: formInput.quantity_unit,
              created_at: now, updated_at: now, _synced: 0, _last_modified: timestamp, is_deleted: 0,
            });
          }
        }
      });

      try {
        console.log("CultivationLogsPage: Push requesting after form submit...");
        const pushResult = await requestPushChanges();
        if (pushResult.success) {
          console.log("CultivationLogsPage: Push requested successfully after form submit.");
        } else {
          console.error("CultivationLogsPage: Push request failed after form submit.", pushResult.errors);
        }
      } catch (syncError) {
        console.error("Error requesting push after cultivation log save:", syncError);
      }

      await fetchData();
      setShowForm(false);
      setEditingLog(null);
      setEditingUsedInputs([]);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Failed to save cultivation log. Please try again.";
      console.error("Failed to save cultivation log:", err);
      setError(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = async (log: CultivationLog) => {
    setEditingLog(log);
    const currentDb = dbInstance || db;
    if (log.id && currentDb) {
      const usedInputsData = await currentDb.cultivationActivityUsedInputs
        .where('cultivation_log_id')
        .equals(log.id)
        .filter(item => item.is_deleted === 0)
        .toArray();
      setEditingUsedInputs(usedInputsData);
    } else {
      setEditingUsedInputs([]);
    }
    setShowForm(true);
    setError(null);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm("Are you sure you want to delete this cultivation log? This may affect inventory if inputs were used.")) {
      setIsDeleting(id);
      setError(null);
      const currentDb = dbInstance || db;
      try {
        await currentDb.transaction('rw', currentDb.cultivationLogs, currentDb.inputInventory, currentDb.cultivationActivityUsedInputs, currentDb.cultivationActivityPlantingLinks, async () => {
          const logToDelete = await currentDb.cultivationLogs.get(id);
          if (!logToDelete) {
            console.warn(`CultivationLog with id ${id} not found for deletion.`);
            return;
          }

          const relatedUsedInputs = await currentDb.cultivationActivityUsedInputs
            .where('cultivation_log_id').equals(id).filter(item => item.is_deleted === 0).toArray();
          for (const usedInput of relatedUsedInputs) {
            if (usedInput.input_inventory_id && usedInput.quantity_used > 0) {
              const affectedInventoryItem = await currentDb.inputInventory.get(usedInput.input_inventory_id);
              if (affectedInventoryItem) {
                await currentDb.inputInventory.update(usedInput.input_inventory_id, {
                  current_quantity: (affectedInventoryItem.current_quantity ?? 0) + usedInput.quantity_used,
                  _synced: 0, _last_modified: Date.now()
                });
              }
            }
            await currentDb.markForSync('cultivationActivityUsedInputs', usedInput.id, {}, true);
          }

          const relatedPlantingLinks = await currentDb.cultivationActivityPlantingLinks
            .where('cultivation_log_id').equals(id).filter(item => item.is_deleted === 0).toArray();
          for (const link of relatedPlantingLinks) {
            await currentDb.markForSync('cultivationActivityPlantingLinks', link.id, {}, true);
          }
          
          await currentDb.markForSync('cultivationLogs', id, {}, true);
        });
        
        try {
            console.log("CultivationLogsPage: Push requesting after delete...");
            const pushResult = await requestPushChanges();
            if (pushResult.success) {
                console.log("CultivationLogsPage: Push requested successfully after delete.");
            } else {
                console.error("CultivationLogsPage: Push request failed after delete.", pushResult.errors);
            }
        } catch (syncError) {
            console.error("Error requesting push after cultivation log delete:", syncError);
        }

        await fetchData();
      } catch (err) {
        console.error("Failed to delete cultivation log:", err);
        setError("Failed to delete cultivation log.");
      } finally {
        setIsDeleting(null);
      }
    }
  };

  return (
    <div>
      <header className="bg-white shadow mb-6">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 flex justify-between items-center">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Cultivation Logs</h1>
          <button
            onClick={() => { setEditingLog(null); setEditingUsedInputs([]); setShowForm(true); setError(null); }}
            className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded shadow-sm transition-colors duration-150"
          >
            Record Cultivation Activity
          </button>
        </div>
      </header>

      {showForm && (
        console.log("[CultivationLogsPage] Rendering CultivationLogForm. 'plantingLogs' prop being passed:", JSON.stringify(plantingLogs.map(p => ({id: p.id, displayLabel: (p as any).displayLabel })))),
        <CultivationLogForm
          initialLogData={editingLog}
          initialUsedInputs={editingUsedInputs}
          onSubmit={handleFormSubmit}
          onCancel={() => {
            setShowForm(false);
            setEditingLog(null);
            setEditingUsedInputs([]);
            setError(null);
          }}
          isSubmitting={isSubmitting}
          plantingLogs={plantingLogs} // This is now the enriched list
          inputInventory={inputInventory}
          activityPlantingLinks={activityPlantingLinks}
        />
      )}

      <div className="mt-4">
        {error && <p className="text-red-500 mb-4 p-3 bg-red-100 rounded-md">{error}</p>}
        {isLoading && <p className="text-center text-gray-500">Loading cultivation logs...</p>}
        {!isLoading && !error && (
          <CultivationLogList
            cultivationLogs={cultivationLogs}
            plantingLogs={plantingLogs} // Pass the enriched list
            seedBatches={seedBatches}
            crops={crops}
            inputInventory={inputInventory}
            activityUsedInputs={activityUsedInputs}
            activityPlantingLinks={activityPlantingLinks}
            onEdit={handleEdit}
            onDelete={handleDelete}
            isDeleting={isDeleting}
          />
        )}
        {!isLoading && cultivationLogs.length === 0 && !error && (
           <div className="text-center py-10">
            <svg className="mx-auto h-12 w-12 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 7.5l3 2.25-3 2.25m3 0H3m2.25 0l3 2.25M3.75 12m0 0V7.5m0 4.5V12m0 0h16.5m0 0l-3-2.25m3 2.25l-3 2.25M12 3.75l3 2.25-3 2.25m3 0V3.75m0 0l3 2.25m-3-2.25l3-2.25m0 0l3 2.25M3.75 12h16.5" />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">No cultivation logs</h3>
            <p className="mt-1 text-sm text-gray-500">Get started by recording a cultivation activity.</p>
            <div className="mt-6">
              <button
                type="button"
                onClick={() => { setEditingLog(null); setEditingUsedInputs([]); setShowForm(true); setError(null); }}
                className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
              >
                <svg className="-ml-1 mr-2 h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                </svg>
                Record Cultivation Activity
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}