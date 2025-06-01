'use client';

import React, { useState, useEffect } from 'react';
import { HarvestLog, PlantingLog, SeedBatch, Crop, Tree, db } from '@/lib/db'; // Added Tree
import { formatDateToDDMMYYYY } from '@/lib/dateUtils';

interface HarvestLogFormProps {
  initialData?: HarvestLog | null;
  onSubmit: (data: Omit<HarvestLog, 'id' | '_synced' | '_last_modified' | 'created_at' | 'updated_at'> | HarvestLog) => Promise<void>;
  onCancel: () => void;
  isSubmitting: boolean;
}

export default function HarvestLogForm({ initialData, onSubmit, onCancel, isSubmitting }: HarvestLogFormProps) {
  const [harvestSourceType, setHarvestSourceType] = useState<'plantingLog' | 'tree'>('plantingLog');
  const [plantingLogId, setPlantingLogId] = useState<string | undefined>(undefined);
  const [treeId, setTreeId] = useState<string | undefined>(undefined);
  const [harvestDate, setHarvestDate] = useState('');
  const [quantityHarvested, setQuantityHarvested] = useState<number | ''>('');
  const [quantityUnit, setQuantityUnit] = useState('');
  const [qualityGrade, setQualityGrade] = useState('');
  const [notes, setNotes] = useState('');
  
  // Store enriched planting logs
  const [availablePlantingLogs, setAvailablePlantingLogs] = useState<(PlantingLog & {
    cropDetails?: Crop; // Full crop object
    seedBatchDetails?: SeedBatch; // Full seed batch object
  })[]>([]);
  const [availableTrees, setAvailableTrees] = useState<Tree[]>([]);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    const fetchFormData = async () => {
      try {
        const [plantingLogsData, seedBatchesData, cropsData, seedlingLogsData, inputInventoryData, treesData, purchasedSeedlingsData] = await Promise.all([
          db.plantingLogs.filter(pl => pl.is_deleted !== 1 && pl.status !== 'completed' && pl.status !== 'terminated').reverse().toArray(), // Only active planting logs, removed orderBy
          db.seedBatches.filter(sb => sb.is_deleted !== 1).toArray(),
          db.crops.filter(c => c.is_deleted !== 1).toArray(),
          db.seedlingProductionLogs.filter(sl => sl.is_deleted !== 1).toArray(),
          db.inputInventory.filter(ii => ii.is_deleted !== 1 && ii.crop_id != null).toArray(),
          db.trees.orderBy('identifier').filter(t => t.is_deleted !== 1).toArray(), // Fetch trees
          db.purchasedSeedlings.filter(ps => ps.is_deleted !== 1).toArray() // Fetch purchased seedlings
        ]);
        // console.log('[HarvestLogForm] Fetched plantingLogsData:', JSON.stringify(plantingLogsData)); // Removed
        // const fraoulaLogInitial = plantingLogsData.find(pl => pl.id === "09cc4d35-c340-4cb3-aa19-3eac9472b924");
        // console.log('[HarvestLogForm] Fraoula log in initial plantingLogsData:', JSON.stringify(fraoulaLogInitial)); // Removed


        const cropsMap = new Map(cropsData.map(crop => [crop.id, crop]));
        const seedBatchesMap = new Map(seedBatchesData.map(batch => [batch.id, batch]));
        const purchasedSeedlingsMap = new Map(purchasedSeedlingsData.map(ps => [ps.id, ps])); // Map for purchased seedlings

        const enrichedPlantingLogs = plantingLogsData.map(pl => {
          let finalCrop: Crop | undefined = undefined;
          let finalSeedBatch: SeedBatch | undefined = undefined;

          if (pl.purchased_seedling_id) {
            const purchasedSeedling = purchasedSeedlingsMap.get(pl.purchased_seedling_id);
            if (purchasedSeedling && purchasedSeedling.crop_id) {
              finalCrop = cropsMap.get(purchasedSeedling.crop_id);
            }
          } else if (pl.input_inventory_id) {
            const inventoryItem = inputInventoryData.find(ii => ii.id === pl.input_inventory_id);
            if (inventoryItem && inventoryItem.crop_id) {
              finalCrop = cropsMap.get(inventoryItem.crop_id);
            }
          } else if (pl.seedling_production_log_id) {
            const seedlingLog = seedlingLogsData.find(sl => sl.id === pl.seedling_production_log_id);
            if (seedlingLog) {
              if (seedlingLog.crop_id) {
                finalCrop = cropsMap.get(seedlingLog.crop_id);
              }
              if (!finalCrop && seedlingLog.seed_batch_id) {
                finalSeedBatch = seedBatchesMap.get(seedlingLog.seed_batch_id);
                if (finalSeedBatch && finalSeedBatch.crop_id) {
                  finalCrop = cropsMap.get(finalSeedBatch.crop_id);
                }
              }
              if (!finalSeedBatch && seedlingLog.seed_batch_id) {
                finalSeedBatch = seedBatchesMap.get(seedlingLog.seed_batch_id);
              }
            }
          } else if (pl.seed_batch_id) {
            finalSeedBatch = seedBatchesMap.get(pl.seed_batch_id);
            if (finalSeedBatch && finalSeedBatch.crop_id) {
              finalCrop = cropsMap.get(finalSeedBatch.crop_id);
            }
          }
          
          return {
            ...pl,
            cropDetails: finalCrop,
            seedBatchDetails: finalSeedBatch
          };
        });
        // Sort enrichedPlantingLogs by crop name then date
        enrichedPlantingLogs.sort((a,b) => {
            const nameA = a.cropDetails?.name || 'Z'; // Sort N/A last
            const nameB = b.cropDetails?.name || 'Z';
            const nameCompare = nameA.localeCompare(nameB, undefined, {sensitivity: 'base'});
            if (nameCompare !== 0) return nameCompare;
            return new Date(b.planting_date).getTime() - new Date(a.planting_date).getTime();
        });
        // Removed duplicate sort and logs
        setAvailablePlantingLogs(enrichedPlantingLogs);
        
        // Sort trees by identifier
        treesData.sort((a,b) => (a.identifier || '').localeCompare(b.identifier || '', undefined, {sensitivity: 'base'}));
        setAvailableTrees(treesData);

      } catch (error) {
        console.error("Failed to fetch form data for harvest logs", error);
        setFormError("Could not load source data.");
      }
    };
    fetchFormData();

    if (initialData) {
      if (initialData.tree_id) {
        setHarvestSourceType('tree');
        setTreeId(initialData.tree_id);
        setPlantingLogId(undefined);
      } else {
        setHarvestSourceType('plantingLog');
        setPlantingLogId(initialData.planting_log_id);
        setTreeId(undefined);
      }
      setHarvestDate(initialData.harvest_date ? initialData.harvest_date.split('T')[0] : '');
      setQuantityHarvested(initialData.quantity_harvested ?? '');
      setQuantityUnit(initialData.quantity_unit);
      setQualityGrade(initialData.quality_grade || '');
      setNotes(initialData.notes || '');
    } else {
      // Reset form
      setHarvestSourceType('plantingLog');
      setPlantingLogId(undefined);
      setTreeId(undefined);
      setHarvestDate('');
      setQuantityHarvested('');
      setQuantityUnit('');
      setQualityGrade('');
      setNotes('');
    }
  }, [initialData]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setFormError(null);
    if (harvestSourceType === 'plantingLog' && !plantingLogId) {
      setFormError('Please select a Planting Log.');
      return;
    }
    if (harvestSourceType === 'tree' && !treeId) {
      setFormError('Please select a Tree.');
      return;
    }
    if (!harvestDate || quantityHarvested === '' || !quantityUnit.trim()) {
      setFormError('Harvest Date, Quantity Harvested, and Unit are required.');
      return;
    }
    if (isNaN(Number(quantityHarvested))) {
        setFormError('Quantity Harvested must be a valid number.');
        return;
    }

    const logData: Partial<HarvestLog> = { // Use Partial as planting_log_id or tree_id will be set
      harvest_date: harvestDate,
      quantity_harvested: Number(quantityHarvested),
      quantity_unit: quantityUnit.trim(),
      quality_grade: qualityGrade.trim() || undefined,
      notes: notes.trim() || undefined,
    };

    if (harvestSourceType === 'plantingLog') {
      logData.planting_log_id = plantingLogId;
      logData.tree_id = undefined;
    } else {
      logData.tree_id = treeId;
      logData.planting_log_id = undefined;
    }

    if (initialData?.id) {
      await onSubmit({ ...initialData, ...logData } as HarvestLog); // Cast to HarvestLog
    } else {
      await onSubmit(logData as Omit<HarvestLog, 'id' | '_synced' | '_last_modified' | 'created_at' | 'updated_at'>); // Cast
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex justify-center items-center p-4">
      <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-lg">
        <h2 className="text-2xl font-bold mb-6 text-gray-800">
          {initialData ? 'Edit Harvest Log' : 'Record New Harvest'}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          {formError && <p className="text-red-500 text-sm mb-3">{formError}</p>}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Harvest Source</label>
            <div className="flex space-x-4">
              <label className="inline-flex items-center">
                <input
                  type="radio" name="harvestSourceType" value="plantingLog"
                  checked={harvestSourceType === 'plantingLog'}
                  onChange={() => { setHarvestSourceType('plantingLog'); setTreeId(undefined); }}
                  className="form-radio h-4 w-4 text-green-600"
                  disabled={isSubmitting || (!!initialData && !!initialData.tree_id)}
                />
                <span className="ml-2 text-sm text-gray-700">From Planting Log</span>
              </label>
              <label className="inline-flex items-center">
                <input
                  type="radio" name="harvestSourceType" value="tree"
                  checked={harvestSourceType === 'tree'}
                  onChange={() => { setHarvestSourceType('tree'); setPlantingLogId(undefined); }}
                  className="form-radio h-4 w-4 text-green-600"
                  disabled={isSubmitting || (!!initialData && !!initialData.planting_log_id)}
                />
                <span className="ml-2 text-sm text-gray-700">From Tree</span>
              </label>
            </div>
          </div>

          {harvestSourceType === 'plantingLog' && (
            <div>
              <label htmlFor="plantingLogId" className="block text-sm font-medium text-gray-700">
                Planting Log <span className="text-red-500">*</span>
              </label>
              <select
                id="plantingLogId"
                value={plantingLogId || ''}
                onChange={(e) => setPlantingLogId(e.target.value || undefined)}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
                required={harvestSourceType === 'plantingLog'}
                disabled={isSubmitting || availablePlantingLogs.length === 0}
              >
                <option value="">Select a Planting Log</option>
                {availablePlantingLogs.map(pl => {
                  try {
                    let label = `${formatDateToDDMMYYYY(pl.planting_date)} - `;
                    const crop = pl.cropDetails;
                    if (crop) {
                      label += crop.name || 'Unnamed Crop';
                      if (crop.variety) label += ` ${crop.variety}`;
                    } else if (pl.seedBatchDetails) {
                       label += `Unknown Crop (Batch: ${pl.seedBatchDetails.batch_code})`;
                    } else {
                       label += 'N/A Crop';
                    }
                    label += ` - Loc: ${pl.plot_affected || pl.location_description || 'N/A'}`;
                    return ( <option key={pl.id} value={pl.id}> {label} </option> );
                  } catch (e) {
                    console.error(`[HarvestLogForm] Error rendering option for pl.id ${pl.id}:`, e, JSON.stringify(pl));
                    return null; // Skip rendering this option if an error occurs
                  }
                })}
              </select>
              {availablePlantingLogs.length === 0 && harvestSourceType === 'plantingLog' && <p className="text-xs text-gray-500 mt-1">No active planting logs available.</p>}
            </div>
          )}

          {harvestSourceType === 'tree' && (
            <div>
              <label htmlFor="treeId" className="block text-sm font-medium text-gray-700">
                Tree <span className="text-red-500">*</span>
              </label>
              <select
                id="treeId"
                value={treeId || ''}
                onChange={(e) => setTreeId(e.target.value || undefined)}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
                required={harvestSourceType === 'tree'}
                disabled={isSubmitting || availableTrees.length === 0}
              >
                <option value="">Select a Tree</option>
                {availableTrees.map(tree => (
                  <option key={tree.id} value={tree.id}>
                    {tree.identifier || 'Unnamed Tree'} ({tree.species}{tree.variety ? ` - ${tree.variety}` : ''}) - Loc: {tree.location_description || 'N/A'}
                  </option>
                ))}
              </select>
              {availableTrees.length === 0 && harvestSourceType === 'tree' && <p className="text-xs text-gray-500 mt-1">No trees available. Please add one first.</p>}
            </div>
          )}

          <div>
            <label htmlFor="harvestDate" className="block text-sm font-medium text-gray-700">
              Harvest Date <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              id="harvestDate"
              value={harvestDate}
              onChange={(e) => setHarvestDate(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
              required
              disabled={isSubmitting}
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="quantityHarvested" className="block text-sm font-medium text-gray-700">
                Quantity Harvested <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                id="quantityHarvested"
                value={quantityHarvested}
                onChange={(e) => setQuantityHarvested(e.target.value === '' ? '' : parseFloat(e.target.value))}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
                required
                disabled={isSubmitting}
                step="any"
              />
            </div>
            <div>
              <label htmlFor="quantityUnit" className="block text-sm font-medium text-gray-700">
                Unit <span className="text-red-500">*</span> (e.g., kg, pieces, bunches)
              </label>
              <input
                type="text"
                id="quantityUnit"
                value={quantityUnit}
                onChange={(e) => setQuantityUnit(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
                required
                disabled={isSubmitting}
              />
            </div>
          </div>

          <div>
            <label htmlFor="qualityGrade" className="block text-sm font-medium text-gray-700">Quality Grade (Optional)</label>
            <input
              type="text"
              id="qualityGrade"
              value={qualityGrade}
              onChange={(e) => setQualityGrade(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
              disabled={isSubmitting}
            />
          </div>

          <div>
            <label htmlFor="notes" className="block text-sm font-medium text-gray-700">Notes</label>
            <textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
              disabled={isSubmitting}
            />
          </div>

          <div className="flex items-center justify-end space-x-3 pt-2">
            <button
              type="button"
              onClick={onCancel}
              disabled={isSubmitting}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md border border-gray-300 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || (availablePlantingLogs.length === 0 && !initialData)}
              className="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
            >
              {isSubmitting ? (initialData ? 'Saving...' : 'Recording...') : (initialData ? 'Save Changes' : 'Record Harvest')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}