'use client';

import React, { useState, useEffect } from 'react';
import { SeedBatch, Crop, db, Supplier } from '@/lib/db';

interface SeedBatchFormProps {
  initialData?: SeedBatch | null;
  onSubmit: (data: Omit<SeedBatch, 'id' | '_synced' | '_last_modified' | 'created_at' | 'updated_at'> | SeedBatch) => Promise<void>;
  onCancel: () => void;
  isSubmitting: boolean;
}

export default function SeedBatchForm({ initialData, onSubmit, onCancel, isSubmitting }: SeedBatchFormProps) {
  const [cropId, setCropId] = useState('');
  const [batchCode, setBatchCode] = useState('');
  const [sourceType, setSourceType] = useState<SeedBatch['source_type']>('purchased');
  const [supplierId, setSupplierId] = useState<string>('');
  const [purchaseDate, setPurchaseDate] = useState('');
  const [dateAddedToInventory, setDateAddedToInventory] = useState(''); // Added state
  const [initialQuantity, setInitialQuantity] = useState<number | ''>('');
  const [quantityUnit, setQuantityUnit] = useState('');
  const [totalPurchaseCost, setTotalPurchaseCost] = useState<number | ''>('');
  const [estimatedSeedsPerSowingUnit, setEstimatedSeedsPerSowingUnit] = useState<number | ''>('');
  const [organicStatus, setOrganicStatus] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [availableCrops, setAvailableCrops] = useState<Crop[]>([]);
  const [availableSuppliers, setAvailableSuppliers] = useState<Supplier[]>([]);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const cropsData = await db.crops.filter(c => c.is_deleted !== 1).sortBy('name');
        setAvailableCrops(cropsData);
        const suppliersData = await db.suppliers.filter(s => s.is_deleted !== 1).sortBy('name');
        setAvailableSuppliers(suppliersData);
      } catch (error) {
        console.error("Failed to fetch form data for SeedBatchForm", error);
        setFormError("Could not load required data (crops/suppliers).");
      }
    };
    fetchData();

    if (initialData) {
      setCropId(initialData.crop_id);
      setBatchCode(initialData.batch_code);
      const currentSourceType = initialData.source_type || 'purchased';
      setSourceType(currentSourceType);

      if (currentSourceType === 'self_produced') {
        setSupplierId('');
        setPurchaseDate('');
        setTotalPurchaseCost('');
      } else {
        setSupplierId(initialData.supplier_id || '');
        setPurchaseDate(initialData.purchase_date ? initialData.purchase_date.split('T')[0] : '');
        setTotalPurchaseCost(initialData.total_purchase_cost ?? '');
      }
      setDateAddedToInventory(
        initialData.date_added_to_inventory ? initialData.date_added_to_inventory.split('T')[0] : 
        (initialData.purchase_date ? initialData.purchase_date.split('T')[0] : 
        (initialData.created_at ? initialData.created_at.split('T')[0] : new Date().toISOString().split('T')[0]))
      );
      setInitialQuantity(initialData.initial_quantity ?? '');
      setQuantityUnit(initialData.quantity_unit || '');
      setEstimatedSeedsPerSowingUnit(initialData.estimated_seeds_per_sowing_unit ?? '');
      setOrganicStatus(initialData.organic_status || '');
      setNotes(initialData.notes || '');
    } else {
      // Defaults for new form
      setCropId('');
      setBatchCode('');
      setSourceType('purchased');
      setSupplierId(''); 
      setPurchaseDate('');
      setDateAddedToInventory(new Date().toISOString().split('T')[0]); // Default to today
      setInitialQuantity('');
      setQuantityUnit('');
      setTotalPurchaseCost('');
      setEstimatedSeedsPerSowingUnit('');
      setOrganicStatus(''); 
      setNotes('');
    }
  }, [initialData]);

  const generateBatchCode = () => {
    const now = new Date();
    const datePart = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
    const timePart = `${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
    const uniquePart = String(Date.now()).slice(-4);
    return `SB-${datePart}-${timePart}-${uniquePart}`;
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setFormError(null);

    const finalBatchCode = initialData ? batchCode : generateBatchCode();

    if (!cropId || initialQuantity === '' || !dateAddedToInventory) {
      setFormError('Crop, Date Added to Inventory, and Quantity are required.');
      return;
    }
    if (isNaN(Number(initialQuantity))) {
        setFormError('Quantity must be a valid number.');
        return;
    }
    
    const seedBatchData = {
      crop_id: cropId,
      batch_code: finalBatchCode,
      source_type: sourceType,
      supplier_id: sourceType === 'purchased' ? (supplierId || undefined) : undefined,
      purchase_date: sourceType === 'purchased' ? (purchaseDate || undefined) : undefined,
      date_added_to_inventory: dateAddedToInventory || undefined,
      initial_quantity: Number(initialQuantity),
      current_quantity: initialData?.id ? (initialData.current_quantity ?? Number(initialQuantity)) : Number(initialQuantity),
      quantity_unit: quantityUnit.trim() || undefined,
      total_purchase_cost: sourceType === 'purchased' ? (totalPurchaseCost === '' ? undefined : Number(totalPurchaseCost)) : undefined,
      estimated_seeds_per_sowing_unit: estimatedSeedsPerSowingUnit === '' ? undefined : Number(estimatedSeedsPerSowingUnit),
      organic_status: organicStatus.trim() || undefined,
      notes: notes.trim() || undefined,
    };

    if (initialData?.id) {
      const dataToSubmit: SeedBatch = {
        ...initialData,
        ...seedBatchData,
        batch_code: initialData.batch_code, 
        qr_code_data: initialData.qr_code_data 
      };
      await onSubmit(dataToSubmit);
    } else {
      const newId = crypto.randomUUID();
      const dataToSubmit: Omit<SeedBatch, 'id' | '_synced' | '_last_modified' | 'created_at' | 'updated_at'> & { qr_code_data?: string } = {
        ...seedBatchData,
        batch_code: finalBatchCode,
        qr_code_data: newId, 
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
                if (details.length > 0) {
                  label += ` (${details.join(' - ')})`;
                } else if (!crop.variety) { 
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
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Source Type</label>
            <div className="flex items-center space-x-4">
              <label className="inline-flex items-center">
                <input
                  type="radio"
                  name="sourceType"
                  value="purchased"
                  checked={sourceType === 'purchased'}
                  onChange={() => setSourceType('purchased')}
                  className="form-radio h-4 w-4 text-green-600"
                  disabled={isSubmitting}
                />
                <span className="ml-2 text-sm text-gray-700">Purchased</span>
              </label>
              <label className="inline-flex items-center">
                <input
                  type="radio"
                  name="sourceType"
                  value="self_produced"
                  checked={sourceType === 'self_produced'}
                  onChange={() => {
                    setSourceType('self_produced');
                    setSupplierId('');
                    setPurchaseDate('');
                    setTotalPurchaseCost('');
                  }}
                  className="form-radio h-4 w-4 text-green-600"
                  disabled={isSubmitting}
                />
                <span className="ml-2 text-sm text-gray-700">Self-Produced</span>
              </label>
            </div>
          </div>
          
          <div>
            <label htmlFor="dateAddedToInventory" className="block text-sm font-medium text-gray-700">Date Added to Inventory <span className="text-red-500">*</span></label>
            <input
              type="date"
              id="dateAddedToInventory"
              value={dateAddedToInventory}
              onChange={(e) => setDateAddedToInventory(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
              disabled={isSubmitting}
              required 
            />
          </div>

          {sourceType === 'purchased' && (
            <>
              <div>
                <label htmlFor="supplierId" className="block text-sm font-medium text-gray-700">Supplier</label>
                <select
                  id="supplierId"
                  name="supplierId"
                  value={supplierId}
                  onChange={(e) => setSupplierId(e.target.value)}
                  className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
                  disabled={isSubmitting || availableSuppliers.length === 0}
                >
                  <option value="">Select a Supplier (Optional)</option>
                  {availableSuppliers.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
                {availableSuppliers.length === 0 && <p className="text-xs text-gray-500 mt-1">No suppliers available.</p>}
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
            </>
          )}
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="initialQuantity" className="block text-sm font-medium text-gray-700">
                Quantity <span className="text-red-500">*</span>
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

          <div className={`grid grid-cols-${sourceType === 'purchased' ? '2' : '1'} gap-4`}>
            {sourceType === 'purchased' && (
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
            )}
            <div className={sourceType !== 'purchased' ? "col-span-2" : ""}>
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