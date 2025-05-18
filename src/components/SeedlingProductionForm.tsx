'use client';

import React, { useState, useEffect, FormEvent } from 'react';
import { db, SeedlingProductionLog, SeedBatch } from '@/lib/db'; // Assuming db is your Dexie instance, removed unused Crop

interface SeedlingProductionFormProps {
  existingLog?: SeedlingProductionLog | null;
  onClose: (refresh?: boolean) => void;
}

const SeedlingProductionForm: React.FC<SeedlingProductionFormProps> = ({ existingLog, onClose }) => {
  const [seedBatchId, setSeedBatchId] = useState<string>(existingLog?.seed_batch_id || '');
  const [cropInfo, setCropInfo] = useState<{ name: string; variety: string; notes: string; cropId: string; batchUnit?: string; seedsPerUnit?: number } | null>(null);
  const [sowingDate, setSowingDate] = useState<string>(existingLog?.sowing_date || new Date().toISOString().split('T')[0]);
  
  // Renamed fields to match new interface
  const [quantitySownValue, setQuantitySownValue] = useState<number | string>(existingLog?.quantity_sown_value || '');
  const [sowingUnitFromBatch, setSowingUnitFromBatch] = useState<string>(existingLog?.sowing_unit_from_batch || ''); // This will be set from selected batch
  const [estimatedTotalIndividualSeedsSown, setEstimatedTotalIndividualSeedsSown] = useState<number | string>(existingLog?.estimated_total_individual_seeds_sown || '');

  const [nurseryLocation, setNurseryLocation] = useState<string>(existingLog?.nursery_location || '');
  const [expectedSeedlings, setExpectedSeedlings] = useState<number | string>(existingLog?.expected_seedlings || '');
  const [actualSeedlingsProduced, setActualSeedlingsProduced] = useState<number | string>(existingLog?.actual_seedlings_produced || '');
  const [notes, setNotes] = useState<string>(existingLog?.notes || '');
  
  // For dropdown display: SeedBatch with its Crop info
  const [displayableSeedBatches, setDisplayableSeedBatches] = useState<(SeedBatch & { cropName?: string; cropVariety?: string })[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchBatchesAndCrops = async () => {
      try {
        let baseQuery = db.seedBatches.where('is_deleted').notEqual(1);
        if (!existingLog) { // For new logs, only show batches with quantity > 0
          baseQuery = baseQuery.and(batch => (batch.current_quantity || 0) > 0);
        }
        const batches = await baseQuery.toArray();
        const crops = await db.crops.where('is_deleted').notEqual(1).toArray();
        const cropsMap = new Map(crops.map(c => [c.id, c]));

        const enrichedBatches = batches.map(batch => {
          const crop = cropsMap.get(batch.crop_id);
          return {
            ...batch,
            cropName: crop?.name,
            cropVariety: crop?.variety
          };
        });

        if (existingLog?.seed_batch_id) {
          const currentBatchInDisplayList = enrichedBatches.find(b => b.id === existingLog.seed_batch_id);
          if (!currentBatchInDisplayList) {
            const existingBatchData = await db.seedBatches.get(existingLog.seed_batch_id);
            if (existingBatchData) {
              const crop = cropsMap.get(existingBatchData.crop_id);
              enrichedBatches.push({
                ...existingBatchData,
                cropName: crop?.name,
                cropVariety: crop?.variety
              });
            }
          }
          setSeedBatchId(existingLog.seed_batch_id);
          setActualSeedlingsProduced(existingLog.actual_seedlings_produced || '');
          setQuantitySownValue(existingLog.quantity_sown_value || '');
          setSowingUnitFromBatch(existingLog.sowing_unit_from_batch || '');
          setEstimatedTotalIndividualSeedsSown(existingLog.estimated_total_individual_seeds_sown || '');
        }
        setDisplayableSeedBatches(enrichedBatches.sort((a,b) => (a.cropName || '').localeCompare(b.cropName || '') || a.batch_code.localeCompare(b.batch_code)));
      } catch (err) {
        console.error("Failed to fetch seed batches and crops:", err);
        setError("Could not load seed batches.");
      }
    };
    fetchBatchesAndCrops();
  }, [existingLog]);

  useEffect(() => {
    const updateFormForSelectedBatch = async () => {
      if (seedBatchId) {
        const selectedFullBatch = displayableSeedBatches.find(b => b.id === seedBatchId);
        if (selectedFullBatch && selectedFullBatch.crop_id) {
          const crop = await db.crops.get(selectedFullBatch.crop_id); // Re-fetch crop for notes, or ensure it's on displayableSeedBatches
          if (crop) {
            setCropInfo({
              name: crop.name,
              variety: crop.variety || '',
              notes: crop.notes || '',
              cropId: crop.id,
              batchUnit: selectedFullBatch.quantity_unit,
              seedsPerUnit: selectedFullBatch.estimated_seeds_per_sowing_unit
            });
            setSowingUnitFromBatch(selectedFullBatch.quantity_unit || ''); // Set the unit for the log
            if (!existingLog) { // Only auto-calculate for new logs
                setQuantitySownValue(''); // Reset quantity when batch changes
                setEstimatedTotalIndividualSeedsSown('');
            }
          } else {
            setCropInfo(null);
            setSowingUnitFromBatch('');
          }
        } else {
          setCropInfo(null);
          setSowingUnitFromBatch('');
        }
      } else {
        setCropInfo(null);
        setSowingUnitFromBatch('');
      }
    };
    updateFormForSelectedBatch();
  }, [seedBatchId, displayableSeedBatches, existingLog]);

  // Auto-calculate estimated_total_individual_seeds_sown
  useEffect(() => {
    if (!existingLog && cropInfo?.batchUnit && cropInfo.batchUnit !== 'seeds' && cropInfo.seedsPerUnit && quantitySownValue) {
      const estimated = Number(quantitySownValue) * cropInfo.seedsPerUnit;
      setEstimatedTotalIndividualSeedsSown(estimated);
    } else if (!existingLog && cropInfo?.batchUnit === 'seeds' && quantitySownValue) {
      setEstimatedTotalIndividualSeedsSown(Number(quantitySownValue));
    }
  }, [quantitySownValue, cropInfo, existingLog]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);

    if (!seedBatchId || !cropInfo?.cropId) {
      setError("Please select a seed batch.");
      setIsLoading(false);
      return;
    }
    if (!quantitySownValue || Number(quantitySownValue) <= 0) {
      setError("Please enter a valid quantity sown.");
      setIsLoading(false);
      return;
    }

    const selectedSeedBatch = displayableSeedBatches.find(b => b.id === seedBatchId);
    if (!selectedSeedBatch) {
        setError("Selected seed batch not found or unavailable.");
        setIsLoading(false);
        return;
    }
    if (!existingLog && (selectedSeedBatch.current_quantity || 0) < Number(quantitySownValue)) {
        setError(`Not enough seeds in batch ${selectedSeedBatch.batch_code}. Available: ${selectedSeedBatch.current_quantity || 0} ${selectedSeedBatch.quantity_unit}`);
        setIsLoading(false);
        return;
    }
    
    const finalEstimatedTotalSeeds = estimatedTotalIndividualSeedsSown ? Number(estimatedTotalIndividualSeedsSown) :
                                     (sowingUnitFromBatch === 'seeds' ? Number(quantitySownValue) : undefined);

    const parsedActualSeedlings = actualSeedlingsProduced ? Number(actualSeedlingsProduced) : (existingLog ? existingLog.actual_seedlings_produced : 0);

    const logData: Omit<SeedlingProductionLog, 'id' | 'created_at' | 'updated_at' | '_synced' | '_last_modified' | 'is_deleted' | 'deleted_at' | 'current_seedlings_available'> = {
      seed_batch_id: seedBatchId,
      crop_id: cropInfo.cropId,
      sowing_date: sowingDate,
      quantity_sown_value: Number(quantitySownValue),
      sowing_unit_from_batch: sowingUnitFromBatch,
      estimated_total_individual_seeds_sown: finalEstimatedTotalSeeds,
      actual_seedlings_produced: parsedActualSeedlings,
      nursery_location: nurseryLocation,
      expected_seedlings: expectedSeedlings ? Number(expectedSeedlings) : undefined,
      notes: notes,
    };

    try {
      if (existingLog) {
        // Update logic: Be careful about re-deducting seeds or changing fundamental sowing info.
        // For now, let's assume editing mainly affects notes, dates, expected seedlings.
        // A more robust update would check if seed_batch_id or quantity_seeds_sown changed and adjust stock accordingly (complex).
        const updatedData = {
            ...existingLog, // Spread existing log first
            ...logData,     // Then new/updated data (includes actual_seedlings_produced)
            // current_seedlings_available needs careful calculation if editing actual_seedlings_produced
            // and some seedlings were already transplanted.
            // Simplification: assume current_seedlings_available is actual_seedlings_produced - (transplanted, which we don't know here easily)
            // For now, if actual_seedlings_produced changes, current_seedlings_available is set to actual_seedlings_produced.
            // This assumes user updates actual_seedlings_produced *before* transplanting, or understands this will reset available count.
            // A more robust solution would be to calculate seedlings_transplanted from PlantingLogs.
            current_seedlings_available: parsedActualSeedlings - (existingLog.actual_seedlings_produced - existingLog.current_seedlings_available), // actual - used
            updated_at: new Date().toISOString(),
            _synced: 0,
            _last_modified: Date.now(),
        };
        // Prevent changing key sowing details for an existing log via this form part
        updatedData.quantity_sown_value = existingLog.quantity_sown_value;
        updatedData.sowing_unit_from_batch = existingLog.sowing_unit_from_batch;
        updatedData.estimated_total_individual_seeds_sown = existingLog.estimated_total_individual_seeds_sown; // This should not change post-sowing
        updatedData.seed_batch_id = existingLog.seed_batch_id;
        updatedData.crop_id = existingLog.crop_id;

        await db.seedlingProductionLogs.put(updatedData);
      } else {
        const newLog: SeedlingProductionLog = {
          ...logData,
          id: crypto.randomUUID(),
          // actual_seedlings_produced is already in logData (defaults to 0 if not set by user, which is fine for new)
          current_seedlings_available: logData.actual_seedlings_produced, // Initially, available is same as produced
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          _synced: 0,
          _last_modified: Date.now(),
          is_deleted: 0,
        };
        await db.seedlingProductionLogs.add(newLog);
        
        // Decrement seed batch quantity
        const newQuantity = (selectedSeedBatch.current_quantity || 0) - Number(quantitySownValue);
        await db.seedBatches.update(seedBatchId, {
            current_quantity: newQuantity,
            _synced: 0,
            _last_modified: Date.now()
        });
      }
      onClose(true); // Refresh list
    } catch (err) {
      console.error("Failed to save seedling production log:", err);
      setError("Failed to save record. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label htmlFor="seedBatchId" className="block text-sm font-medium text-gray-700">Seed Batch</label>
        <select
          id="seedBatchId"
          name="seedBatchId"
          value={seedBatchId}
          onChange={(e) => setSeedBatchId(e.target.value)}
          required
          className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
          disabled={!!existingLog} // Cannot change seed batch for an existing sowing log
        >
          <option value="">Select a Seed Batch</option>
          {displayableSeedBatches.map(batch => (
            <option key={batch.id} value={batch.id}>
              {batch.cropName || 'Unknown Crop'} - {batch.cropVariety || 'N/A'} (Batch: {batch.batch_code}) - Avail: {batch.current_quantity || 0} {batch.quantity_unit}
            </option>
          ))}
        </select>
      </div>

      {cropInfo && (
        <div className="p-3 bg-gray-50 rounded-md border border-gray-200">
          <h4 className="text-sm font-medium text-gray-700">Crop Information:</h4>
          <p className="text-sm text-gray-600">Name: {cropInfo.name}</p>
          <p className="text-sm text-gray-600">Variety: {cropInfo.variety || 'N/A'}</p>
          <p className="text-sm text-gray-600">Notes: {cropInfo.notes || 'N/A'}</p>
        </div>
      )}

      <div>
        <label htmlFor="sowingDate" className="block text-sm font-medium text-gray-700">Sowing Date</label>
        <input
          type="date"
          id="sowingDate"
          name="sowingDate"
          value={sowingDate}
          onChange={(e) => setSowingDate(e.target.value)}
          required
          className="mt-1 block w-full py-2 px-3 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label htmlFor="quantitySownValue" className="block text-sm font-medium text-gray-700">
            Quantity Sown ({sowingUnitFromBatch || 'select batch'})
          </label>
          <input
            type="number"
            id="quantitySownValue"
            name="quantitySownValue"
            value={quantitySownValue}
            onChange={(e) => setQuantitySownValue(e.target.value)}
            required
            min="0.01"
            step="any"
            className="mt-1 block w-full py-2 px-3 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
            disabled={!!existingLog} // Cannot change quantity sown for an existing log
          />
        </div>
        <div>
            <label htmlFor="estimatedTotalIndividualSeedsSown" className="block text-sm font-medium text-gray-700">
                Est. Total Individual Seeds
            </label>
            <input
                type="number"
                id="estimatedTotalIndividualSeedsSown"
                name="estimatedTotalIndividualSeedsSown"
                value={estimatedTotalIndividualSeedsSown}
                onChange={(e) => setEstimatedTotalIndividualSeedsSown(e.target.value)}
                placeholder={cropInfo?.batchUnit !== 'seeds' ? "Enter if known, or auto-calculated" : "Same as Quantity Sown"}
                min="0"
                step="1"
                className="mt-1 block w-full py-2 px-3 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
                disabled={!!existingLog || (cropInfo?.batchUnit === 'seeds')} // Disabled if existing or if unit is 'seeds' (auto-set)
            />
            {cropInfo?.batchUnit && cropInfo.batchUnit !== 'seeds' && !cropInfo.seedsPerUnit && !existingLog &&
                 <p className="mt-1 text-xs text-gray-500">Enter est. seeds or update seed batch with &apos;seeds per {cropInfo.batchUnit}&apos;.</p>
            }
        </div>
      </div>
      
      <div>
        <label htmlFor="nurseryLocation" className="block text-sm font-medium text-gray-700">Nursery Location</label>
        <input
          type="text"
          id="nurseryLocation"
          name="nurseryLocation"
          value={nurseryLocation}
          onChange={(e) => setNurseryLocation(e.target.value)}
          className="mt-1 block w-full py-2 px-3 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
        />
      </div>
      
      {/* Fields for editing existing log - specifically actual seedlings produced */}
      {existingLog && (
        <div>
          <label htmlFor="actualSeedlingsProduced" className="block text-sm font-medium text-gray-700">Actual Seedlings Produced</label>
          <input
            type="number"
            id="actualSeedlingsProduced"
            name="actualSeedlingsProduced"
            value={actualSeedlingsProduced}
            onChange={(e) => setActualSeedlingsProduced(e.target.value)}
            min="0"
            step="1"
            className="mt-1 block w-full py-2 px-3 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
          />
           {/* Display Germination Rate */}
           {existingLog.estimated_total_individual_seeds_sown && existingLog.estimated_total_individual_seeds_sown > 0 && actualSeedlingsProduced !== '' && (
            <p className="mt-1 text-xs text-gray-500">
              Germination Rate: {((Number(actualSeedlingsProduced) / existingLog.estimated_total_individual_seeds_sown) * 100).toFixed(1)}%
            </p>
          )}
        </div>
      )}

      <div>
        <label htmlFor="expectedSeedlings" className="block text-sm font-medium text-gray-700">Expected Seedlings (Optional)</label>
        <input
          type="number"
          id="expectedSeedlings"
          name="expectedSeedlings"
          value={expectedSeedlings}
          onChange={(e) => setExpectedSeedlings(e.target.value)}
          min="0"
          step="1"
          className="mt-1 block w-full py-2 px-3 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
          disabled={!!existingLog} // Typically not edited after initial sowing
        />
      </div>

      <div>
        <label htmlFor="notes" className="block text-sm font-medium text-gray-700">Notes</label>
        <textarea
          id="notes"
          name="notes"
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="mt-1 block w-full py-2 px-3 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="pt-5">
        <div className="flex justify-end space-x-3">
          <button
            type="button"
            onClick={() => onClose(false)}
            className="rounded-md border border-gray-300 bg-white py-2 px-4 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isLoading}
            className="inline-flex justify-center rounded-md border border-transparent bg-green-600 py-2 px-4 text-sm font-medium text-white shadow-sm hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50"
          >
            {isLoading ? 'Saving...' : (existingLog ? 'Update Record' : 'Save Sowing Record')}
          </button>
        </div>
      </div>
    </form>
  );
};

export default SeedlingProductionForm;