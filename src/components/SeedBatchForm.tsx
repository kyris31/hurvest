'use client';

import React, { useState, useEffect } from 'react';
import { SeedBatch, Crop, db } from '@/lib/db';

interface SeedBatchFormProps {
  initialData?: SeedBatch | null;
  onSubmit: (data: Omit<SeedBatch, 'id' | '_synced' | '_last_modified' | 'created_at' | 'updated_at'> | SeedBatch) => Promise<void>;
  onCancel: () => void;
  isSubmitting: boolean;
}

export default function SeedBatchForm({ initialData, onSubmit, onCancel, isSubmitting }: SeedBatchFormProps) {
  const [cropId, setCropId] = useState('');
  const [batchCode, setBatchCode] = useState('');
  // const [variety, setVariety] = useState(''); // Variety is now part of the selected Crop, remove from SeedBatch state
  const [supplier, setSupplier] = useState('');
  const [purchaseDate, setPurchaseDate] = useState('');
  const [initialQuantity, setInitialQuantity] = useState<number | ''>('');
  // const [currentQuantity, setCurrentQuantity] = useState<number | ''>(''); // For new batches, current = initial
  const [quantityUnit, setQuantityUnit] = useState('');
  const [totalPurchaseCost, setTotalPurchaseCost] = useState<number | ''>('');
  const [estimatedSeedsPerSowingUnit, setEstimatedSeedsPerSowingUnit] = useState<number | ''>('');
  const [organicStatus, setOrganicStatus] = useState<string>(''); // New state for organic_status
  const [notes, setNotes] = useState('');
  const [availableCrops, setAvailableCrops] = useState<Crop[]>([]);
  const [availableSuppliers, setAvailableSuppliers] = useState<string[]>([]);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [cropsData, seedBatchesData, inputInventoryData] = await Promise.all([
          db.crops.filter(c => c.is_deleted !== 1).toArray(),
          db.seedBatches.filter(sb => sb.is_deleted !== 1).toArray(), // Still fetch for suppliers
          db.inputInventory.filter(ii => ii.is_deleted !== 1).toArray() // Still fetch for suppliers
        ]);
        
        setAvailableCrops(cropsData);

        const seedSuppliers = new Set(seedBatchesData.map(sb => sb.supplier).filter(Boolean) as string[]);
        const inputSuppliers = new Set(inputInventoryData.map(ii => ii.supplier).filter(Boolean) as string[]);
        const allSuppliers = Array.from(new Set([...seedSuppliers, ...inputSuppliers])).sort();
        setAvailableSuppliers(allSuppliers);

      } catch (error) {
        console.error("Failed to fetch form data for SeedBatchForm", error);
        setFormError("Could not load required data (crops/suppliers).");
      }
    };
    fetchData();

    if (initialData) {
      setCropId(initialData.crop_id);
      setBatchCode(initialData.batch_code);
      // setVariety(initialData.variety || ''); // Variety removed from SeedBatch
      setSupplier(initialData.supplier || '');
      setPurchaseDate(initialData.purchase_date ? initialData.purchase_date.split('T')[0] : '');
      setInitialQuantity(initialData.initial_quantity ?? '');
      // setCurrentQuantity(initialData.current_quantity ?? ''); // Load current quantity for editing
      setQuantityUnit(initialData.quantity_unit || '');
      setTotalPurchaseCost(initialData.total_purchase_cost ?? '');
      setEstimatedSeedsPerSowingUnit(initialData.estimated_seeds_per_sowing_unit ?? '');
      setOrganicStatus(initialData.organic_status || ''); // Load organic status
      setNotes(initialData.notes || '');
    } else {
      setCropId('');
      setBatchCode('');
      setSupplier('');
      setPurchaseDate('');
      setInitialQuantity('');
      // setCurrentQuantity(''); // Reset for new
      setQuantityUnit('');
      setTotalPurchaseCost('');
      setEstimatedSeedsPerSowingUnit('');
      setOrganicStatus(''); // Reset organic status
      setNotes('');
    }
  }, [initialData]);

  const generateBatchCode = () => {
    const now = new Date();
    const datePart = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
    const timePart = `${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
    // Simple unique part, can be enhanced (e.g. crop name prefix, random chars)
    const uniquePart = String(Date.now()).slice(-4);
    return `SB-${datePart}-${timePart}-${uniquePart}`;
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setFormError(null);

    const finalBatchCode = initialData ? batchCode : generateBatchCode();

    if (!cropId || initialQuantity === '') {
      setFormError('Crop and Quantity are required.');
      return;
    }
    if (isNaN(Number(initialQuantity))) {
        setFormError('Quantity must be a valid number.');
        return;
    }

    const seedBatchData = {
      crop_id: cropId,
      batch_code: finalBatchCode,
      // variety: variety.trim() || undefined, // Variety removed from SeedBatch data
      supplier: supplier.trim() || undefined,
      purchase_date: purchaseDate || undefined,
      initial_quantity: Number(initialQuantity),
      // For new batches, current_quantity is same as initial_quantity
      // For existing, current_quantity is managed by usage, but form might allow direct edit if needed (not typical for this form)
      current_quantity: initialData?.id ? (initialData.current_quantity ?? Number(initialQuantity)) : Number(initialQuantity),
      quantity_unit: quantityUnit.trim() || undefined,
      total_purchase_cost: totalPurchaseCost === '' ? undefined : Number(totalPurchaseCost),
      estimated_seeds_per_sowing_unit: estimatedSeedsPerSowingUnit === '' ? undefined : Number(estimatedSeedsPerSowingUnit),
      organic_status: organicStatus.trim() || undefined,
      notes: notes.trim() || undefined,
      // qr_code_data will be handled below
    };

    if (initialData?.id) {
      // Preserve existing qr_code_data on edit
      const dataToSubmit: SeedBatch = {
        ...initialData,
        ...seedBatchData,
        batch_code: initialData.batch_code, // Ensure original batch_code is preserved
        qr_code_data: initialData.qr_code_data // Preserve existing QR code
      };
      await onSubmit(dataToSubmit);
    } else {
      const newId = crypto.randomUUID();
      const dataToSubmit: Omit<SeedBatch, 'id' | '_synced' | '_last_modified' | 'created_at' | 'updated_at'> & { qr_code_data?: string } = {
        ...seedBatchData,
        batch_code: finalBatchCode, // Already generated
        qr_code_data: newId, // Use the new ID as QR code data
        // current_quantity is already set to initial_quantity in seedBatchData for new items
      };
      await onSubmit(dataToSubmit);
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex justify-center items-center p-4">
      <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-lg">
        <h2 className="text-2xl font-bold mb-6 text-gray-800">
          {initialData ? 'Edit Seed Batch' : 'Add New Seed Batch'}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          {formError && <p className="text-red-500 text-sm mb-3">{formError}</p>}

          <div>
            <label htmlFor="cropId" className="block text-sm font-medium text-gray-700">
              Crop <span className="text-red-500">*</span>
            </label>
            <select
              id="cropId"
              value={cropId}
              onChange={(e) => setCropId(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
              required
              disabled={isSubmitting || availableCrops.length === 0}
            >
              <option value="">Select a Crop</option>
              {availableCrops.map(crop => {
                let label = crop.name;
                if (crop.variety) {
                  label += ` ${crop.variety}`;
                }
                const details = [];
                if (crop.type) {
                  details.push(crop.type);
                }
                if (crop.notes) {
                  details.push(crop.notes);
                }
                if (details.length > 0) {
                  label += ` (${details.join(' - ')})`;
                } else if (!crop.variety) { // Add N/A if no variety and no details
                    label += ' (N/A)';
                }
                return <option key={crop.id} value={crop.id}>{label}</option>;
              })}
            </select>
            {availableCrops.length === 0 && <p className="text-xs text-gray-500 mt-1">No crops available. Please add a crop first.</p>}
          </div>

          {initialData && (
            <div>
              <label htmlFor="batchCodeDisplay" className="block text-sm font-medium text-gray-700">
                Batch Code (Read-only)
              </label>
              <input
                type="text"
                id="batchCodeDisplay"
                value={batchCode}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm bg-gray-100 sm:text-sm"
                readOnly
              />
            </div>
          )}

          {/* Variety field removed from form as it's part of the selected Crop */}
          {/*
          <div>
            <label htmlFor="variety" className="block text-sm font-medium text-gray-700">Variety</label>
            <input
              type="text"
              id="variety"
              value={variety}
              onChange={(e) => setVariety(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
              disabled={isSubmitting}
            />
          </div>
          */}

          <div>
            <label htmlFor="supplier" className="block text-sm font-medium text-gray-700">Supplier</label>
            <div className="flex items-center">
                <select
                    id="supplierSelect"
                    value={supplier}
                    onChange={(e) => setSupplier(e.target.value)}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
                    disabled={isSubmitting}
                >
                    <option value="">Select or type new supplier</option>
                    {availableSuppliers.map(s => (
                        <option key={s} value={s}>{s}</option>
                    ))}
                </select>
                {/* Optional: Button to clear selection and type new, or just allow typing in a combined field */}
            </div>
             <input
              type="text"
              id="supplierText"
              placeholder="Or type new supplier name"
              value={supplier} // This will reflect dropdown selection or typed value
              onChange={(e) => setSupplier(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
              disabled={isSubmitting}
            />
          </div>


          <div>
            <label htmlFor="purchaseDate" className="block text-sm font-medium text-gray-700">Purchase Date</label>
            <input
              type="date"
              id="purchaseDate"
              value={purchaseDate}
              onChange={(e) => setPurchaseDate(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
              disabled={isSubmitting}
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="initialQuantity" className="block text-sm font-medium text-gray-700">
                Quantity <span className="text-red-500">*</span> {/* Label Change */}
              </label>
              <input
                type="number"
                id="initialQuantity"
                value={initialQuantity}
                onChange={(e) => setInitialQuantity(e.target.value === '' ? '' : parseFloat(e.target.value))}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
                required
                disabled={isSubmitting}
                step="any"
              />
            </div>
            <div>
              <label htmlFor="quantityUnit" className="block text-sm font-medium text-gray-700">Unit (e.g., seeds, g, kg)</label>
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

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="totalPurchaseCost" className="block text-sm font-medium text-gray-700">Total Purchase Cost (€)</label>
              <input
                type="number"
                id="totalPurchaseCost"
                value={totalPurchaseCost}
                onChange={(e) => setTotalPurchaseCost(e.target.value === '' ? '' : parseFloat(e.target.value))}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
                disabled={isSubmitting}
                step="0.01"
                min="0"
              />
            </div>
            <div>
              <label htmlFor="estimatedSeedsPerSowingUnit" className="block text-sm font-medium text-gray-700">Est. Seeds / Unit</label>
              <input
                type="number"
                id="estimatedSeedsPerSowingUnit"
                value={estimatedSeedsPerSowingUnit}
                onChange={(e) => setEstimatedSeedsPerSowingUnit(e.target.value === '' ? '' : parseFloat(e.target.value))}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
                disabled={isSubmitting}
                step="1"
                min="0"
                placeholder={quantityUnit && !['seeds', 'seed', 'pcs'].includes(quantityUnit.toLowerCase()) ? `e.g., seeds per ${quantityUnit}` : "N/A if unit is 'seeds'"}
              />
            </div>
          </div>

          <div>
            <label htmlFor="organicStatus" className="block text-sm font-medium text-gray-700">Organic Status</label>
            <select
              id="organicStatus"
              value={organicStatus}
              onChange={(e) => setOrganicStatus(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
              disabled={isSubmitting}
            >
              <option value="">Select Status (Optional)</option>
              <option value="Certified Organic">Certified Organic</option>
              <option value="Organic (Not Certified)">Organic (Not Certified)</option>
              <option value="Untreated">Untreated</option>
              <option value="Conventional">Conventional</option>
              <option value="Unknown">Unknown</option>
            </select>
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
              disabled={isSubmitting || (availableCrops.length === 0 && !initialData)}
              className="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
            >
              {isSubmitting ? (initialData ? 'Saving...' : 'Adding...') : (initialData ? 'Save Changes' : 'Add Seed Batch')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}