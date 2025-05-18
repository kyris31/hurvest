'use client';

import React, { useState, useEffect } from 'react';
import { PlantingLog, SeedBatch, Crop, SeedlingProductionLog, db } from '@/lib/db'; // Added SeedlingProductionLog

interface PlantingLogFormProps {
  initialData?: PlantingLog | null;
  onSubmit: (data: Omit<PlantingLog, 'id' | '_synced' | '_last_modified' | 'created_at' | 'updated_at'> | PlantingLog) => Promise<void>;
  onCancel: () => void;
  isSubmitting: boolean;
}

export default function PlantingLogForm({ initialData, onSubmit, onCancel, isSubmitting }: PlantingLogFormProps) {
  const [plantingSourceType, setPlantingSourceType] = useState<'seedBatch' | 'seedlingLog'>('seedBatch');
  const [seedBatchId, setSeedBatchId] = useState<string | undefined>(undefined);
  const [seedlingProductionLogId, setSeedlingProductionLogId] = useState<string | undefined>(undefined);
  const [plantingDate, setPlantingDate] = useState('');
  const [locationDescription, setLocationDescription] = useState(''); // General location
  const [plotAffected, setPlotAffected] = useState(''); // Specific plot
  const [quantityPlanted, setQuantityPlanted] = useState<number | ''>('');
  const [quantityUnit, setQuantityUnit] = useState('');
  const [expectedHarvestDate, setExpectedHarvestDate] = useState('');
  const [notes, setNotes] = useState('');
  
  // Store full crop details with seed batches
  const [availableSeedBatches, setAvailableSeedBatches] = useState<(SeedBatch & { cropDetails?: Crop })[]>([]);
  const [availableSeedlingLogs, setAvailableSeedlingLogs] = useState<(SeedlingProductionLog & { cropName?: string })[]>([]);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    const fetchFormData = async () => {
      try {
        const [batchesData, cropsData, seedlingLogsData] = await Promise.all([
          db.seedBatches.filter(sb => sb.is_deleted !== 1).toArray(),
          db.crops.filter(c => c.is_deleted !== 1).toArray(),
          db.seedlingProductionLogs.where('is_deleted').notEqual(1)
            .and(sl => (sl.current_seedlings_available || 0) > 0)
            .toArray(),
        ]);
        
        const cropsMap = new Map(cropsData.map(crop => [crop.id, crop]));

        const enrichedBatches = batchesData.map(batch => {
          const crop = cropsMap.get(batch.crop_id);
          return { ...batch, cropDetails: crop };
        });
        setAvailableSeedBatches(enrichedBatches);

        const enrichedSeedlingLogs = seedlingLogsData.map(sl => {
          const crop = cropsMap.get(sl.crop_id);
          return { ...sl, cropName: crop?.name || 'Unknown Crop' };
        });
        setAvailableSeedlingLogs(enrichedSeedlingLogs);

      } catch (error) {
        console.error("Failed to fetch form data for planting logs", error);
        setFormError("Could not load seed/seedling data.");
      }
    };
    fetchFormData();

    if (initialData) {
      if (initialData.seedling_production_log_id) {
        setPlantingSourceType('seedlingLog');
        setSeedlingProductionLogId(initialData.seedling_production_log_id);
        setSeedBatchId(undefined);
      } else {
        setPlantingSourceType('seedBatch');
        setSeedBatchId(initialData.seed_batch_id);
        setSeedlingProductionLogId(undefined);
      }
      setPlantingDate(initialData.planting_date ? initialData.planting_date.split('T')[0] : '');
      setLocationDescription(initialData.location_description || '');
      setPlotAffected(initialData.plot_affected || ''); // Set plot_affected
      setQuantityPlanted(initialData.quantity_planted ?? '');
      setQuantityUnit(initialData.quantity_unit || '');
      setExpectedHarvestDate(initialData.expected_harvest_date ? initialData.expected_harvest_date.split('T')[0] : '');
      setNotes(initialData.notes || '');
    } else {
      // Reset form
      setPlantingSourceType('seedBatch');
      setSeedBatchId(undefined);
      setSeedlingProductionLogId(undefined);
      setPlantingDate('');
      setLocationDescription('');
      setPlotAffected(''); // Reset plot_affected
      setQuantityPlanted('');
      setQuantityUnit(''); // Will be auto-set based on source
      setExpectedHarvestDate('');
      setNotes('');
    }
  }, [initialData]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setFormError(null);
    if (!plantingDate || quantityPlanted === '' || Number(quantityPlanted) <= 0) {
      setFormError('Planting Date and a valid Quantity Planted (>0) are required.');
      return;
    }
    if (isNaN(Number(quantityPlanted))) {
        setFormError('Quantity planted must be a valid number.');
        return;
    }

    let finalLogData: Omit<PlantingLog, 'id' | '_synced' | '_last_modified' | 'created_at' | 'updated_at'>;
    let stockUpdatePromise: Promise<any> | null = null;

    if (plantingSourceType === 'seedBatch') {
      if (!seedBatchId) {
        setFormError('Please select a Seed Batch for direct sowing.');
        return;
      }
      const selectedBatch = availableSeedBatches.find(b => b.id === seedBatchId);
      if (!selectedBatch) {
        setFormError('Selected seed batch not found.');
        return;
      }
      const availableQty = selectedBatch.current_quantity ?? selectedBatch.initial_quantity;
      if (availableQty !== undefined && Number(quantityPlanted) > availableQty) {
        setFormError(`Not enough in seed batch. Available: ${availableQty} ${selectedBatch.quantity_unit || ''}.`);
        return;
      }
      
      finalLogData = {
        seed_batch_id: seedBatchId,
        seedling_production_log_id: undefined,
        planting_date: plantingDate,
        location_description: locationDescription.trim() || undefined,
        plot_affected: plotAffected.trim() || undefined,
        quantity_planted: Number(quantityPlanted),
        quantity_unit: quantityUnit.trim() || selectedBatch.quantity_unit || 'items',
        expected_harvest_date: expectedHarvestDate || undefined,
        notes: notes.trim() || undefined,
      };

      if (!initialData) { // Only deduct stock for new plantings
        const newStock = (availableQty || 0) - Number(quantityPlanted);
        stockUpdatePromise = db.seedBatches.update(seedBatchId, {
          current_quantity: newStock,
          _synced: 0,
          _last_modified: Date.now()
        });
      }

    } else if (plantingSourceType === 'seedlingLog') {
      if (!seedlingProductionLogId) {
        setFormError('Please select a Seedling Production Log for transplanting.');
        return;
      }
      const selectedSeedlingLog = availableSeedlingLogs.find(sl => sl.id === seedlingProductionLogId);
      if (!selectedSeedlingLog) {
        setFormError('Selected seedling log not found.');
        return;
      }
      if (Number(quantityPlanted) > (selectedSeedlingLog.current_seedlings_available || 0)) {
        setFormError(`Not enough seedlings available. Available: ${selectedSeedlingLog.current_seedlings_available || 0}.`);
        return;
      }

      finalLogData = {
        seed_batch_id: undefined,
        seedling_production_log_id: seedlingProductionLogId,
        planting_date: plantingDate,
        location_description: locationDescription.trim() || undefined,
        plot_affected: plotAffected.trim() || undefined,
        quantity_planted: Number(quantityPlanted),
        quantity_unit: 'seedlings', // Unit is always seedlings when transplanting
        expected_harvest_date: expectedHarvestDate || undefined,
        notes: notes.trim() || undefined,
      };
      
      if (!initialData) { // Only deduct stock for new plantings
        const newAvailableSeedlings = (selectedSeedlingLog.current_seedlings_available || 0) - Number(quantityPlanted);
        stockUpdatePromise = db.seedlingProductionLogs.update(seedlingProductionLogId, {
          current_seedlings_available: newAvailableSeedlings,
          _synced: 0,
          _last_modified: Date.now()
        });
      }
    } else {
      setFormError("Invalid planting source type selected."); // Should not happen
      return;
    }

    try {
        if (stockUpdatePromise && !initialData) { // Ensure stock is updated before submitting log for new entries
            await stockUpdatePromise;
        }
        if (initialData?.id) {
            // Note: Editing an existing planting log does not currently re-adjust stock of the original source.
            // This could be added if changing source/quantity on edit is a requirement.
            await onSubmit({ ...initialData, ...finalLogData });
        } else {
            await onSubmit(finalLogData);
        }
    } catch (err: unknown) { // Changed from any to unknown
        const errorMessage = err instanceof Error ? err.message : "An error occurred while saving. Stock might not have been updated if planting log failed.";
        console.error("Error during stock update or planting log submission:", err);
        setFormError(errorMessage);
        // Potentially add logic here to revert stock update if onSubmit fails, though that adds complexity.
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex justify-center items-center p-4">
      <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-lg">
        <h2 className="text-2xl font-bold mb-6 text-gray-800">
          {initialData ? 'Edit Planting Log' : 'Record New Planting'}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          {formError && <p className="text-red-500 text-sm mb-3">{formError}</p>}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Planting Source</label>
            <div className="flex items-center space-x-4">
              <label className="inline-flex items-center">
                <input
                  type="radio"
                  name="plantingSourceType"
                  value="seedBatch"
                  checked={plantingSourceType === 'seedBatch'}
                  onChange={() => { setPlantingSourceType('seedBatch'); setSeedlingProductionLogId(undefined); setQuantityUnit(''); }}
                  className="form-radio h-4 w-4 text-green-600"
                  disabled={isSubmitting || !!initialData?.seedling_production_log_id} // Disable if editing a seedling-sourced log
                />
                <span className="ml-2 text-sm text-gray-700">Direct Sow (from Seed Batch)</span>
              </label>
              <label className="inline-flex items-center">
                <input
                  type="radio"
                  name="plantingSourceType"
                  value="seedlingLog"
                  checked={plantingSourceType === 'seedlingLog'}
                  onChange={() => { setPlantingSourceType('seedlingLog'); setSeedBatchId(undefined); setQuantityUnit('seedlings'); }}
                  className="form-radio h-4 w-4 text-green-600"
                  disabled={isSubmitting || !!initialData?.seed_batch_id} // Disable if editing a seedbatch-sourced log
                />
                <span className="ml-2 text-sm text-gray-700">Transplant (from Seedling Log)</span>
              </label>
            </div>
          </div>

          {plantingSourceType === 'seedBatch' && (
            <div>
              <label htmlFor="seedBatchId" className="block text-sm font-medium text-gray-700">Seed Batch</label>
              <select
                id="seedBatchId"
                value={seedBatchId || ''}
                onChange={(e) => {
                  setSeedBatchId(e.target.value || undefined);
                  const selected = availableSeedBatches.find(b => b.id === e.target.value);
                  setQuantityUnit(selected?.quantity_unit || '');
                }}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
                disabled={isSubmitting || !!initialData} // Disable if editing
                required={plantingSourceType === 'seedBatch'}
              >
                <option value="">Select a Seed Batch</option>
                {availableSeedBatches.map(batch => {
                  const crop = batch.cropDetails;
                  let label = crop?.name ? `${crop.name}${crop.variety ? ` - ${crop.variety}` : ''}` : "Unknown Crop";
                  label += ` (Batch: ${batch.batch_code || 'N/A'})`;
                  const displayQty = batch.current_quantity ?? batch.initial_quantity;
                  if (displayQty !== undefined) {
                    label += ` - Avail: ${displayQty} ${batch.quantity_unit || ''}`;
                  }
                  return (
                    <option key={batch.id} value={batch.id}>
                      {label}
                    </option>
                  );
                })}
              </select>
            </div>
          )}

          {plantingSourceType === 'seedlingLog' && (
            <div>
              <label htmlFor="seedlingProductionLogId" className="block text-sm font-medium text-gray-700">Seedling Production Log</label>
              <select
                id="seedlingProductionLogId"
                value={seedlingProductionLogId || ''}
                onChange={(e) => setSeedlingProductionLogId(e.target.value || undefined)}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
                disabled={isSubmitting || !!initialData} // Disable if editing
                required={plantingSourceType === 'seedlingLog'}
              >
                <option value="">Select a Seedling Log</option>
                {availableSeedlingLogs.map(sl => (
                  <option key={sl.id} value={sl.id}>
                    {sl.cropName} - Sown: {new Date(sl.sowing_date).toLocaleDateString()} (Avail: {sl.current_seedlings_available})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label htmlFor="plantingDate" className="block text-sm font-medium text-gray-700">
              Planting Date <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              id="plantingDate"
              value={plantingDate}
              onChange={(e) => setPlantingDate(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
              required
              disabled={isSubmitting}
            />
          </div>

          <div>
            <label htmlFor="locationDescription" className="block text-sm font-medium text-gray-700">Location (e.g., Field A, Row 5)</label>
            <input
              type="text"
              id="locationDescription"
              value={locationDescription}
              onChange={(e) => setLocationDescription(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
              disabled={isSubmitting}
            />
          </div>

          <div>
            <label htmlFor="plotAffected" className="block text-sm font-medium text-gray-700">Plot Affected (e.g., A1, B2-East)</label>
            <input
              type="text"
              id="plotAffected"
              value={plotAffected}
              onChange={(e) => setPlotAffected(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
              disabled={isSubmitting}
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="quantityPlanted" className="block text-sm font-medium text-gray-700">
                Quantity Planted <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                id="quantityPlanted"
                value={quantityPlanted}
                onChange={(e) => setQuantityPlanted(e.target.value === '' ? '' : parseFloat(e.target.value))}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
                required
                disabled={isSubmitting}
                step="any"
              />
            </div>
            <div>
              <label htmlFor="quantityUnit" className="block text-sm font-medium text-gray-700">Unit (e.g., seeds, seedlings)</label>
              <input
                type="text"
                id="quantityUnit"
                value={quantityUnit}
                onChange={(e) => setQuantityUnit(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
                disabled={isSubmitting}
              />
            </div>
          </div>

          <div>
            <label htmlFor="expectedHarvestDate" className="block text-sm font-medium text-gray-700">Expected Harvest Date</label>
            <input
              type="date"
              id="expectedHarvestDate"
              value={expectedHarvestDate}
              onChange={(e) => setExpectedHarvestDate(e.target.value)}
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
              disabled={isSubmitting}
              className="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
            >
              {isSubmitting ? (initialData ? 'Saving...' : 'Recording...') : (initialData ? 'Save Changes' : 'Record Planting')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}