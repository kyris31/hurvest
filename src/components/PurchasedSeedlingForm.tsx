'use client';

import React, { useState, useEffect } from 'react';
import { PurchasedSeedling, Crop, Supplier } from '@/lib/db';

interface PurchasedSeedlingFormProps {
  initialData?: PurchasedSeedling | null;
  onSubmit: (data: Omit<PurchasedSeedling, 'id' | '_synced' | '_last_modified' | 'created_at' | 'updated_at' | 'user_id'> | PurchasedSeedling) => Promise<void>;
  onCancel: () => void;
  isSubmitting: boolean;
  availableCrops: Crop[];
  availableSuppliers: Supplier[];
}

export default function PurchasedSeedlingForm({ 
  initialData, 
  onSubmit, 
  onCancel, 
  isSubmitting,
  availableCrops,
  availableSuppliers 
}: PurchasedSeedlingFormProps) {
  const [name, setName] = useState('');
  const [cropId, setCropId] = useState<string>('');
  const [supplierId, setSupplierId] = useState<string>('');
  const [purchaseDate, setPurchaseDate] = useState('');
  const [initialQuantity, setInitialQuantity] = useState<number | ''>('');
  // current_quantity is not directly edited in this form, it's set to initial_quantity on creation
  // and then managed by planting logs.
  const [quantityUnit, setQuantityUnit] = useState('');
  const [totalPurchaseCost, setTotalPurchaseCost] = useState<number | ''>('');
  const [costPerUnitDisplay, setCostPerUnitDisplay] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (initialData) {
      setName(initialData.name);
      setCropId(initialData.crop_id || '');
      setSupplierId(initialData.supplier_id || '');
      setPurchaseDate(initialData.purchase_date ? initialData.purchase_date.split('T')[0] : '');
      setInitialQuantity(initialData.initial_quantity ?? '');
      setQuantityUnit(initialData.quantity_unit || '');
      setTotalPurchaseCost(initialData.total_purchase_cost ?? '');
      setNotes(initialData.notes || '');
      if (initialData.cost_per_unit !== undefined && initialData.cost_per_unit !== null) {
        setCostPerUnitDisplay(initialData.cost_per_unit.toFixed(2));
      } else if (initialData.total_purchase_cost && initialData.initial_quantity && initialData.initial_quantity > 0) {
        setCostPerUnitDisplay((initialData.total_purchase_cost / initialData.initial_quantity).toFixed(2));
      } else {
        setCostPerUnitDisplay('');
      }
    } else {
      // Reset form for new entry
      setName('');
      setCropId('');
      setSupplierId('');
      setPurchaseDate('');
      setInitialQuantity('');
      setQuantityUnit('plants'); // Default unit
      setTotalPurchaseCost('');
      setCostPerUnitDisplay('');
      setNotes('');
    }
  }, [initialData]);

  useEffect(() => {
    // Calculate and display cost_per_unit when totalPurchaseCost or initialQuantity changes
    const numTotalCost = Number(totalPurchaseCost);
    const numInitialQty = Number(initialQuantity);
    if (numTotalCost > 0 && numInitialQty > 0) {
      setCostPerUnitDisplay((numTotalCost / numInitialQty).toFixed(2));
    } else {
      setCostPerUnitDisplay('');
    }
  }, [totalPurchaseCost, initialQuantity]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setFormError(null);
    if (!name.trim() || initialQuantity === '' || Number(initialQuantity) <= 0) {
      setFormError('Seedling Name and a valid positive Initial Quantity are required.');
      return;
    }
    if (totalPurchaseCost !== '' && (isNaN(Number(totalPurchaseCost)) || Number(totalPurchaseCost) < 0)) {
        setFormError('Total Purchase Cost must be a valid non-negative number if provided.');
        return;
    }

    const numInitialQty = Number(initialQuantity);
    const numTotalCost = totalPurchaseCost === '' ? undefined : Number(totalPurchaseCost);
    let calculatedCostPerUnit: number | undefined = undefined;
    if (numTotalCost !== undefined && numInitialQty > 0) {
      calculatedCostPerUnit = numTotalCost / numInitialQty;
    }

    const seedlingData = {
      name: name.trim(),
      crop_id: cropId || undefined,
      supplier_id: supplierId || undefined,
      purchase_date: purchaseDate || undefined,
      initial_quantity: numInitialQty,
      current_quantity: numInitialQty, // Set current_quantity for new items
      quantity_unit: quantityUnit.trim() || undefined,
      total_purchase_cost: numTotalCost,
      cost_per_unit: calculatedCostPerUnit,
      notes: notes.trim() || undefined,
    };
    
    if (initialData?.id) {
      // For edits, current_quantity is part of initialData and should be preserved if not directly editable
      // The form doesn't edit current_quantity directly, so we use initialData's value.
      await onSubmit({ ...initialData, ...seedlingData, current_quantity: initialData.current_quantity });
    } else {
      await onSubmit(seedlingData); // seedlingData now includes current_quantity
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex justify-center items-center p-4">
      <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-lg overflow-y-auto max-h-[90vh]">
        <h2 className="text-2xl font-bold mb-6 text-gray-800">
          {initialData ? 'Edit Purchased Seedlings' : 'Record New Purchased Seedlings'}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          {formError && <p className="text-red-500 text-sm mb-3">{formError}</p>}

          <div>
            <label htmlFor="seedlingName" className="block text-sm font-medium text-gray-700">
              Seedling Name / Description <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="seedlingName"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
              required
              disabled={isSubmitting}
            />
          </div>
          
          <div>
            <label htmlFor="cropId" className="block text-sm font-medium text-gray-700">Associated Crop (Optional)</label>
            <select
              id="cropId"
              name="cropId"
              value={cropId}
              onChange={(e) => setCropId(e.target.value)}
              className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
              disabled={isSubmitting}
            >
              <option value="">Select a Crop (if applicable)</option>
              {availableCrops.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.variety ? ` - ${c.variety}` : ''}
                </option>
              ))}
            </select>
          </div>
          
          <div>
            <label htmlFor="supplierId" className="block text-sm font-medium text-gray-700">Supplier (Optional)</label>
            <select
              id="supplierId"
              name="supplierId"
              value={supplierId}
              onChange={(e) => setSupplierId(e.target.value)}
              className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
              disabled={isSubmitting}
            >
              <option value="">Select a Supplier</option>
              {availableSuppliers.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
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
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="initialQuantity" className="block text-sm font-medium text-gray-700">
                Initial Quantity <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                id="initialQuantity"
                value={initialQuantity}
                onChange={(e) => setInitialQuantity(e.target.value === '' ? '' : parseFloat(e.target.value))}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
                required
                disabled={isSubmitting}
                step="1" // Typically whole seedlings
                min="0"
              />
            </div>
            <div>
              <label htmlFor="quantityUnit" className="block text-sm font-medium text-gray-700">Unit</label>
              <input
                type="text"
                id="quantityUnit"
                value={quantityUnit}
                onChange={(e) => setQuantityUnit(e.target.value)}
                placeholder="e.g., plants, plugs"
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
                disabled={isSubmitting}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="totalPurchaseCost" className="block text-sm font-medium text-gray-700">Total Purchase Cost (€)</label>
              <input
                type="number"
                id="totalPurchaseCost"
                value={totalPurchaseCost}
                onChange={(e) => setTotalPurchaseCost(e.target.value === '' ? '' : parseFloat(e.target.value))}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
                disabled={isSubmitting}
                step="any"
              />
            </div>
            <div>
              <label htmlFor="costPerUnitDisplay" className="block text-sm font-medium text-gray-700">Cost Per Unit (€)</label>
              <input
                type="text" // Display only
                id="costPerUnitDisplay"
                value={costPerUnitDisplay}
                readOnly
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm bg-gray-100 sm:text-sm"
              />
            </div>
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
              {isSubmitting ? (initialData ? 'Saving...' : 'Adding...') : (initialData ? 'Save Changes' : 'Add Seedlings')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}