'use client';

import React, { useState, useEffect } from 'react';
import { db, InputInventory, Supplier } from '@/lib/db'; // Added db and Supplier import

interface InputInventoryFormProps {
  initialData?: InputInventory | null;
  onSubmit: (data: Omit<InputInventory, 'id' | '_synced' | '_last_modified' | 'created_at' | 'updated_at' | 'supplier'> | InputInventory) => Promise<void>;
  onCancel: () => void;
  isSubmitting: boolean;
}

export default function InputInventoryForm({ initialData, onSubmit, onCancel, isSubmitting }: InputInventoryFormProps) {
  const [name, setName] = useState('');
  const [type, setType] = useState('');
  const [supplierId, setSupplierId] = useState<string>(''); // Changed to supplierId
  const [availableSuppliers, setAvailableSuppliers] = useState<Supplier[]>([]);
  const [purchaseDate, setPurchaseDate] = useState('');
  const [quantityPurchased, setQuantityPurchased] = useState<number | ''>(''); // Renamed from initialQuantity for clarity in form
  const [currentQuantityDisplay, setCurrentQuantityDisplay] = useState<number | ''>(''); // For read-only display
  const [quantityUnit, setQuantityUnit] = useState('');
  const [totalPurchaseCost, setTotalPurchaseCost] = useState<number | ''>(''); // Renamed from costPerUnit
  const [minimumStockLevel, setMinimumStockLevel] = useState<number | ''>(''); // New state
  const [notes, setNotes] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSuppliers = async () => {
      try {
        // Apply orderBy on the table directly, then filter.
        // Or, more commonly, if 'is_deleted' is an index, you'd do:
        // db.suppliers.where('is_deleted').notEqual(1).sortBy('name')
        // However, sortBy on a collection is for client-side sort after fetch.
        // For indexedDB efficiency, if 'name' is an index, orderBy is better on the table.
        // If 'name' is not an index, this will sort client-side after fetching all non-deleted.
        const activeSuppliers = await db.suppliers
          .filter(supplier => supplier.is_deleted !== 1)
          .sortBy('name'); // sortBy is for collections, sorts client-side
        // If 'name' is an indexed field and you want DB-side ordering on non-deleted items:
        // This is more complex as orderBy is on Table/WhereClause.
        // A simpler approach for now, assuming moderate number of suppliers:
        // Fetch all non-deleted, then sort client-side.
        // const allNonDeletedSuppliers = await db.suppliers.where('is_deleted').notEqual(1).toArray();
        // const activeSuppliers = allNonDeletedSuppliers.sort((a, b) => a.name.localeCompare(b.name));
        // For simplicity and given useLiveQuery often handles this well, let's use filter().sortBy()
        setAvailableSuppliers(activeSuppliers);
      } catch (err) {
        console.error("Failed to fetch suppliers for form:", err);
        // Optionally set a form error here
      }
    };
    fetchSuppliers();

    if (initialData) {
      setName(initialData.name);
      setType(initialData.type || '');
      setSupplierId(initialData.supplier_id || ''); // Use supplier_id
      setPurchaseDate(initialData.purchase_date ? initialData.purchase_date.split('T')[0] : '');
      setQuantityPurchased(initialData.initial_quantity ?? '');
      setCurrentQuantityDisplay(initialData.current_quantity ?? ''); // For display
      setQuantityUnit(initialData.quantity_unit || '');
      setTotalPurchaseCost(initialData.total_purchase_cost ?? ''); // Use new field name
      setMinimumStockLevel(initialData.minimum_stock_level ?? ''); // Set new state
      setNotes(initialData.notes || '');
    } else {
      // Reset form
      setName('');
      setType('');
      setSupplierId(''); // Reset supplierId
      setPurchaseDate('');
      setQuantityPurchased('');
      setCurrentQuantityDisplay('');
      setQuantityUnit('');
      setTotalPurchaseCost('');
      setMinimumStockLevel(''); // Reset new state
      setNotes('');
    }
  }, [initialData]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setFormError(null);
    if (!name.trim() || quantityPurchased === '') {
      setFormError('Item Name and Quantity Purchased are required.');
      return;
    }

    if (isNaN(quantityPurchased as number) || Number(quantityPurchased) <= 0) {
        setFormError('Quantity Purchased must be a positive number.');
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

    const numQuantityPurchased = Number(quantityPurchased);

    const inventoryData = {
      name: name.trim(),
      type: type.trim() || undefined,
      supplier_id: supplierId || undefined,
      purchase_date: purchaseDate || undefined,
      initial_quantity: numQuantityPurchased,
      current_quantity: initialData ? initialData.current_quantity : numQuantityPurchased,
      quantity_unit: quantityUnit.trim() || undefined,
      total_purchase_cost: totalPurchaseCost === '' ? undefined : Number(totalPurchaseCost),
      minimum_stock_level: minimumStockLevel === '' ? undefined : Number(minimumStockLevel), // Add to data
      notes: notes.trim() || undefined,
    };
    
    if (initialData?.id) {
      // When editing, we only update fields that are editable.
      // initial_quantity and total_purchase_cost are generally set at creation.
      // If these need to be editable, the form and logic would be more complex (e.g. "New Stock Entry" vs "Edit Item Details")
      // For now, editing primarily affects name, type, supplier, unit, notes.
      // Current quantity is updated by usage.
      // Removed unused initial_quantity, current_quantity, total_purchase_cost from destructuring
      const { ...editableFields } = inventoryData;
      const dataToSubmit = {
        ...initialData,
        ...editableFields,
        // Ensure these are not accidentally changed if the form fields were different for edit
        initial_quantity: initialData.initial_quantity,
        current_quantity: initialData.current_quantity,
        total_purchase_cost: initialData.total_purchase_cost
      };
      await onSubmit(dataToSubmit);
    } else {
      const newId = crypto.randomUUID();
      // For new items, current_quantity is same as initial_quantity
      // And set qr_code_data to the newId
      await onSubmit({
        ...inventoryData,
        current_quantity: numQuantityPurchased,
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
            <label htmlFor="itemType" className="block text-sm font-medium text-gray-700">Type (e.g., Fertilizer, Pesticide)</label>
            <input
              type="text"
              id="itemType"
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
              disabled={isSubmitting}
            />
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
              <label htmlFor="initialQuantity" className="block text-sm font-medium text-gray-700">
                Initial Quantity <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                id="quantityPurchased"
                value={quantityPurchased}
                onChange={(e) => setQuantityPurchased(e.target.value === '' ? '' : parseFloat(e.target.value))}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
                required
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
                readOnly // Make it strictly read-only
                disabled
                step="any"
              />
               <p className="text-xs text-gray-500 mt-1">
                {initialData ? "Updated via Cultivation Logs." : "Set automatically from Quantity Purchased."}
               </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="quantityUnit" className="block text-sm font-medium text-gray-700">Unit (e.g., kg, L, bags)</label>
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
                step="any"
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