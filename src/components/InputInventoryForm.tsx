'use client';

import React, { useState, useEffect } from 'react';
import { db, InputInventory, Supplier, Crop } from '@/lib/db'; // Added Crop

interface InputInventoryFormProps {
  initialData?: InputInventory | null;
  onSubmit: (data: Omit<InputInventory, 'id' | '_synced' | '_last_modified' | 'created_at' | 'updated_at'> | InputInventory) => Promise<void>;
  onCancel: () => void;
  isSubmitting: boolean;
}

export default function InputInventoryForm({ initialData, onSubmit, onCancel, isSubmitting }: InputInventoryFormProps) {
  const [name, setName] = useState('');
  const [type, setType] = useState('');
  const [cropId, setCropId] = useState<string>(''); // New state for associated crop
  const [supplierId, setSupplierId] = useState<string>('');
  const [availableSuppliers, setAvailableSuppliers] = useState<Supplier[]>([]);
  const [availableCrops, setAvailableCrops] = useState<Crop[]>([]); // New state for crops
  const [purchaseDate, setPurchaseDate] = useState('');
  const [quantityPurchased, setQuantityPurchased] = useState<number | ''>('');
  const [currentQuantityDisplay, setCurrentQuantityDisplay] = useState<number | ''>('');
  const [quantityUnit, setQuantityUnit] = useState('');
  const [totalPurchaseCost, setTotalPurchaseCost] = useState<number | ''>('');
  const [minimumStockLevel, setMinimumStockLevel] = useState<number | ''>('');
  const [notes, setNotes] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const activeSuppliers = await db.suppliers
          .filter(supplier => supplier.is_deleted !== 1)
          .sortBy('name');
        setAvailableSuppliers(activeSuppliers);

        const activeCrops = await db.crops
          .filter(crop => crop.is_deleted !== 1)
          .sortBy('name');
        setAvailableCrops(activeCrops);

      } catch (err) {
        console.error("Failed to fetch suppliers or crops for form:", err);
        setFormError("Could not load required data (suppliers/crops).");
      }
    };
    fetchData();

    if (initialData) {
      setName(initialData.name);
      setType(initialData.type || '');
      setCropId(initialData.crop_id || ''); // Load crop_id
      setSupplierId(initialData.supplier_id || '');
      setPurchaseDate(initialData.purchase_date ? initialData.purchase_date.split('T')[0] : '');
      setQuantityPurchased(initialData.initial_quantity ?? '');
      setCurrentQuantityDisplay(initialData.current_quantity ?? '');
      setQuantityUnit(initialData.quantity_unit || '');
      setTotalPurchaseCost(initialData.total_purchase_cost ?? '');
      setMinimumStockLevel(initialData.minimum_stock_level ?? '');
      setNotes(initialData.notes || '');
    } else {
      // Reset form
      setName('');
      setType('');
      setCropId(''); // Reset crop_id
      setSupplierId('');
      setPurchaseDate('');
      setQuantityPurchased('');
      setCurrentQuantityDisplay('');
      setQuantityUnit('');
      setTotalPurchaseCost('');
      setMinimumStockLevel('');
      setNotes('');
    }
  }, [initialData]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setFormError(null);
    if (!name.trim() || (quantityPurchased === '' && !initialData) ) { // Quantity purchased only required for new items
      setFormError('Item Name is required. Quantity Purchased is required for new items.');
      return;
    }

    if (quantityPurchased !== '' && (isNaN(quantityPurchased as number) || Number(quantityPurchased) <= 0) && !initialData) {
        setFormError('Quantity Purchased must be a positive number for new items.');
        return;
    }
    
    if (totalPurchaseCost !== '' && (isNaN(totalPurchaseCost as number) || Number(totalPurchaseCost) < 0)) {
        setFormError('Total Purchase Cost must be a valid non-negative number if provided.');
        return;
    }
    if (minimumStockLevel !== '' && (isNaN(minimumStockLevel as number) || Number(minimumStockLevel) < 0)) {
        setFormError('Minimum Stock Level must be a valid non-negative number if provided.');
        return;
    }

    const numQuantityPurchased = quantityPurchased === '' ? undefined : Number(quantityPurchased);

    const inventoryData = {
      name: name.trim(),
      type: type.trim() || undefined,
      crop_id: cropId || undefined, // Add crop_id
      supplier_id: supplierId || undefined,
      purchase_date: purchaseDate || undefined,
      initial_quantity: initialData ? initialData.initial_quantity : numQuantityPurchased, // Keep initial if editing
      current_quantity: initialData ? initialData.current_quantity : numQuantityPurchased,
      quantity_unit: quantityUnit.trim() || undefined,
      total_purchase_cost: totalPurchaseCost === '' ? undefined : Number(totalPurchaseCost),
      minimum_stock_level: minimumStockLevel === '' ? undefined : Number(minimumStockLevel),
      notes: notes.trim() || undefined,
    };
    
    if (initialData?.id) {
      const dataToSubmit: InputInventory = {
        ...initialData,
        name: inventoryData.name,
        type: inventoryData.type,
        crop_id: inventoryData.crop_id,
        supplier_id: inventoryData.supplier_id,
        purchase_date: inventoryData.purchase_date,
        // initial_quantity, current_quantity, total_purchase_cost are not typically edited directly here for existing items
        // They are set on creation or current_quantity is adjusted by usage.
        // If you want to allow editing these, the form logic needs to be more specific.
        // For now, we preserve them from initialData if editing.
        initial_quantity: initialData.initial_quantity, 
        current_quantity: initialData.current_quantity, // This should be updated by usage, not directly here unless it's a stock adjustment form
        quantity_unit: inventoryData.quantity_unit,
        total_purchase_cost: initialData.total_purchase_cost,
        minimum_stock_level: inventoryData.minimum_stock_level,
        notes: inventoryData.notes,
      };
      await onSubmit(dataToSubmit);
    } else {
      const newId = crypto.randomUUID();
      await onSubmit({
        ...inventoryData,
        initial_quantity: numQuantityPurchased, // Ensure this is set for new items
        current_quantity: numQuantityPurchased, // Current is same as initial for new items
        qr_code_data: newId
      });
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex justify-center items-center p-4">
      <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-lg">
        <h2 className="text-2xl font-bold mb-6 text-gray-800">
          {initialData ? 'Edit Inventory Item' : 'Add New Inventory Item'}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          {formError && <p className="text-red-500 text-sm mb-3">{formError}</p>}

          <div>
            <label htmlFor="itemName" className="block text-sm font-medium text-gray-700">
              Item Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="itemName"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
              required
              disabled={isSubmitting}
            />
          </div>

          <div>
            <label htmlFor="itemType" className="block text-sm font-medium text-gray-700">Type (e.g., Fertilizer, Seedling, Tool)</label>
            <input
              type="text"
              id="itemType"
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
              disabled={isSubmitting}
              placeholder="e.g., Seedling, Fertilizer, Feed"
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
            <label htmlFor="supplierId" className="block text-sm font-medium text-gray-700">Supplier</label>
            <select
              id="supplierId"
              name="supplierId"
              value={supplierId}
              onChange={(e) => setSupplierId(e.target.value)}
              className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
              disabled={isSubmitting}
            >
              <option value="">Select a Supplier (Optional)</option>
              {availableSuppliers.map(s => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
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
              <label htmlFor="quantityPurchased" className="block text-sm font-medium text-gray-700">
                {initialData ? 'Original Qty Purchased' : 'Quantity Purchased'} <span className="text-red-500">{!initialData ? '*' : ''}</span>
              </label>
              <input
                type="number"
                id="quantityPurchased"
                value={quantityPurchased}
                onChange={(e) => setQuantityPurchased(e.target.value === '' ? '' : parseFloat(e.target.value))}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
                required={!initialData} // Only required for new items
                disabled={isSubmitting || !!initialData} // Disable if editing existing item
                step="any"
              />
            </div>
            <div>
              <label htmlFor="currentQuantityDisplay" className="block text-sm font-medium text-gray-700">
                Current Quantity
              </label>
              <input
                type="number"
                id="currentQuantityDisplay"
                value={currentQuantityDisplay}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm bg-gray-100 sm:text-sm"
                readOnly 
                disabled
                step="any"
              />
               <p className="text-xs text-gray-500 mt-1">
                {initialData ? "Updated by usage (e.g., cultivation, planting)." : "Set from Quantity Purchased."}
               </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="quantityUnit" className="block text-sm font-medium text-gray-700">Unit (e.g., kg, L, bags, seedlings)</label>
              <input
                type="text"
                id="quantityUnit"
                value={quantityUnit}
                onChange={(e) => setQuantityUnit(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
                disabled={isSubmitting}
              />
            </div>
            <div>
              <label htmlFor="totalPurchaseCost" className="block text-sm font-medium text-gray-700">Total Purchase Cost (€)</label>
              <input
                type="number"
                id="totalPurchaseCost"
                value={totalPurchaseCost}
                onChange={(e) => setTotalPurchaseCost(e.target.value === '' ? '' : parseFloat(e.target.value))}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
                disabled={isSubmitting || !!initialData} // Disable if editing existing item
                step="any" // Changed from 0.01 to any for flexibility
              />
            </div>
          </div>

          <div>
            <label htmlFor="minimumStockLevel" className="block text-sm font-medium text-gray-700">Minimum Stock Level (for alerts)</label>
            <input
              type="number"
              id="minimumStockLevel"
              value={minimumStockLevel}
              onChange={(e) => setMinimumStockLevel(e.target.value === '' ? '' : parseFloat(e.target.value))}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
              disabled={isSubmitting}
              step="any"
              min="0"
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
              {isSubmitting ? (initialData ? 'Saving...' : 'Adding...') : (initialData ? 'Save Changes' : 'Add Item')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}