'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Sale, SaleItem, Customer, HarvestLog, db } from '@/lib/db'; // Removed unused PlantingLog, Crop, SeedBatch
import CustomerForm from './CustomerForm'; // To create new customers on the fly

interface SaleFormProps {
  initialData?: Sale & { items?: SaleItem[] };
  onSubmit: (saleData: Omit<Sale, 'id' | '_synced' | '_last_modified' | 'created_at' | 'updated_at' | 'total_amount'>, itemsData: Omit<SaleItem, 'id' | 'sale_id' | '_synced' | '_last_modified' | 'created_at' | 'updated_at'>[]) => Promise<void>;
  onCancel: () => void;
  isSubmitting: boolean;
}

interface EnrichedHarvestLog extends HarvestLog {
  cropName?: string;
  plantingDate?: string;
}

export default function SaleForm({ initialData, onSubmit, onCancel, isSubmitting }: SaleFormProps) {
  const [saleDate, setSaleDate] = useState('');
  const [customerId, setCustomerId] = useState<string | undefined>(undefined);
  const [notes, setNotes] = useState('');
  // Extend SaleItem in state to include discount_type and discount_value for the form
  const [items, setItems] = useState<(Partial<SaleItem & {
    key: string,
    availableQuantity?: number,
    cropName?: string,
    // Form-specific discount fields, SaleItem interface already has discount_type and discount_value
    // We can use them directly if SaleItem is properly typed in the state.
    // Let's ensure the SaleItem type itself is used for these.
  }>)[]>([]);
  
  const [availableCustomers, setAvailableCustomers] = useState<Customer[]>([]);
  const [availableHarvests, setAvailableHarvests] = useState<EnrichedHarvestLog[]>([]);
  
  const [showCustomerForm, setShowCustomerForm] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const fetchFormData = useCallback(async () => {
    try {
      const [customers, harvests, plantingLogs, seedBatches, crops] = await Promise.all([
        db.customers.orderBy('name').filter(c => c.is_deleted !==1).toArray(),
        db.harvestLogs.orderBy('harvest_date').filter(h => h.is_deleted !== 1).reverse().toArray(),
        db.plantingLogs.filter(p => p.is_deleted !== 1).toArray(), // No specific order, ensure filtered
        db.seedBatches.filter(sb => sb.is_deleted !== 1).toArray(), // Ensure filtered
        db.crops.filter(c => c.is_deleted !== 1).toArray(), // Ensure filtered
      ]);
      setAvailableCustomers(customers);
      
      const enrichedHarvests = harvests.map(h => {
        const pLog = plantingLogs.find(pl => pl.id === h.planting_log_id);
        let cropName = 'Unknown Crop';
        if (pLog && pLog.seed_batch_id) {
          const sBatch = seedBatches.find(sb => sb.id === pLog.seed_batch_id);
          if (sBatch) {
            const crop = crops.find(c => c.id === sBatch.crop_id);
            cropName = crop?.name || 'Unknown Crop';
          }
        } else if (pLog) {
            // Fallback if no seed batch linked
        }
        return { ...h, cropName, plantingDate: pLog?.planting_date };
      });
      setAvailableHarvests(enrichedHarvests);

    } catch (error) {
      console.error("Failed to fetch form data for sales", error);
      setFormError("Could not load customer or harvest data.");
    }
  }, []);

  useEffect(() => {
    fetchFormData();
    if (initialData) {
      setSaleDate(initialData.sale_date ? initialData.sale_date.split('T')[0] : new Date().toISOString().split('T')[0]);
      setCustomerId(initialData.customer_id || undefined);
      setNotes(initialData.notes || '');
      if (initialData.items) {
         const initialItems = initialData.items.map((item, index) => {
            // Ensure availableHarvests is populated before trying to find
            const harvest = availableHarvests.length > 0 ? availableHarvests.find(h => h.id === item.harvest_log_id) : undefined;
            return {
                ...item,
                key: `item-${index}-${Date.now()}`,
                availableQuantity: harvest?.quantity_harvested,
                cropName: harvest?.cropName,
                quantity_sold: item.quantity_sold,
                price_per_unit: item.price_per_unit,
                discount_type: item.discount_type || null, // Initialize from data
                discount_value: item.discount_value || null // Initialize from data
            };
        });
        setItems(initialItems);
      } else {
        setItems([{ key: `item-0-${Date.now()}`, harvest_log_id: '', quantity_sold: 0, price_per_unit: 0, discount_type: null, discount_value: null, notes: '' }]);
      }
    } else {
      setSaleDate(new Date().toISOString().split('T')[0]);
      setItems([{ key: `item-0-${Date.now()}`, harvest_log_id: '', quantity_sold: 0, price_per_unit: 0, discount_type: null, discount_value: null, notes: '' }]);
    }
  }, [initialData, fetchFormData, availableHarvests]); // Added availableHarvests

  const handleItemChange = (index: number, field: keyof SaleItem | 'quantity_sold_str' | 'price_per_unit_str' | 'discount_value_str', value: unknown) => {
    const newItemsState = [...items];
    const currentItem = { ...newItemsState[index] } as Partial<SaleItem & { key: string, availableQuantity?: number, cropName?: string }>;

    if (field === 'quantity_sold_str') {
        currentItem.quantity_sold = value === '' ? undefined : parseFloat(value as string);
    } else if (field === 'price_per_unit_str') {
        currentItem.price_per_unit = value === '' ? undefined : parseFloat(value as string);
    } else if (field === 'discount_value_str') {
        currentItem.discount_value = value === '' ? null : parseFloat(value as string);
    } else if (field === 'discount_type') {
        currentItem.discount_type = value === '' ? null : (value as SaleItem['discount_type']);
        // If switching type, might want to clear discount_value or validate
        if (value === null || value === '') currentItem.discount_value = null;
    }
     else {
        // Handle specific string fields of SaleItem
        if (field === 'harvest_log_id') {
            currentItem.harvest_log_id = value as string;
        } else if (field === 'notes') {
            currentItem.notes = value as string | undefined; // notes can be string or undefined
        }
        // No other string fields on SaleItem are expected to be set via this generic path.
        // quantity_unit is not directly on SaleItem for this form's purpose.
    }
    
    if (field === 'harvest_log_id' && value) {
        const selectedHarvest = availableHarvests.find(h => h.id === value);
        currentItem.availableQuantity = selectedHarvest?.quantity_harvested; // This is fine
        currentItem.cropName = selectedHarvest?.cropName; // This is fine
    }
    newItemsState[index] = currentItem;
    setItems(newItemsState);
  };

  const addItem = () => {
    setItems([...items, {
        key: `item-${items.length}-${Date.now()}`,
        harvest_log_id: '',
        quantity_sold: 0,
        price_per_unit: 0,
        discount_type: null,
        discount_value: null,
        notes: ''
    }]);
  };

  const removeItem = (index: number) => {
    const newItemsState = items.filter((_, i) => i !== index);
    setItems(newItemsState);
  };

  const handleCustomerSubmit = async (customerData: Omit<Customer, 'id' | '_synced' | '_last_modified' | 'created_at' | 'updated_at'> | Customer) => {
    try {
      const now = new Date().toISOString();
      const id = crypto.randomUUID();
      const newCustomer : Customer = {
        ...(customerData as Omit<Customer, 'id' | '_synced' | '_last_modified' | 'created_at' | 'updated_at' | 'is_deleted' | 'deleted_at'>),
        id,
        created_at: now,
        updated_at: now,
        _synced: 0,
        _last_modified: Date.now(),
        is_deleted: 0,
      };
      await db.customers.add(newCustomer);
      await fetchFormData(); 
      setCustomerId(id); 
      setShowCustomerForm(false);
      return id;
    } catch (err) {
      console.error("Failed to add customer:", err);
      setFormError("Failed to add new customer.");
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setFormError(null);
    if (!saleDate) {
      setFormError('Sale Date is required.');
      return;
    }
    if (items.length === 0) {
      setFormError('At least one item is required for a sale.');
      return;
    }

    const saleItemsData: Omit<SaleItem, 'id' | 'sale_id' | '_synced' | '_last_modified' | 'created_at' | 'updated_at'>[] = [];
    for (const [index, item] of items.entries()) { // Use .entries() to get index
      if (!item.harvest_log_id || item.quantity_sold === undefined || item.price_per_unit === undefined || Number(item.quantity_sold) <= 0 || Number(item.price_per_unit) < 0) { // Allow 0 price, but not negative
        setFormError(`Item ${index + 1}: Product, valid Quantity (>0), and Price (>=0) are required.`);
        return;
      }
      if (isNaN(Number(item.quantity_sold)) || isNaN(Number(item.price_per_unit))) {
        setFormError(`Item ${index + 1}: Quantity and Price must be numbers.`);
        return;
      }
      // Validate discount value based on type
      if (item.discount_type) {
        if (item.discount_value === undefined || item.discount_value === null || isNaN(Number(item.discount_value)) || Number(item.discount_value) < 0) {
          setFormError(`Item ${index + 1}: Discount Value must be a non-negative number if Discount Type is selected.`);
          return;
        }
        if (item.discount_type === 'Percentage' && Number(item.discount_value) > 100) {
          setFormError(`Item ${index + 1}: Percentage discount cannot exceed 100.`);
          return;
        }
      } else if (item.discount_value !== undefined && item.discount_value !== null && Number(item.discount_value) !== 0) { // Allow 0 discount value if type is null
         setFormError(`Item ${index + 1}: Discount Value should only be set if Discount Type is selected (or set to 0 if no discount).`);
         return;
      }


      saleItemsData.push({
        harvest_log_id: item.harvest_log_id,
        quantity_sold: Number(item.quantity_sold),
        price_per_unit: Number(item.price_per_unit),
        discount_type: item.discount_type || null,
        discount_value: (item.discount_type && item.discount_value !== null && item.discount_value !== undefined) ? Number(item.discount_value) : null,
        notes: item.notes,
      });
    }

    const saleData = {
      sale_date: saleDate,
      customer_id: customerId || undefined,
      notes: notes.trim() || undefined,
    };

    await onSubmit(saleData, saleItemsData);
  };
  
  const calculateItemTotal = (item: Partial<SaleItem>): number => {
    const quantity = Number(item.quantity_sold);
    const price = Number(item.price_per_unit);
    if (isNaN(quantity) || isNaN(price)) return 0;

    let itemTotal = quantity * price;
    if (item.discount_type && (item.discount_value !== null && item.discount_value !== undefined)) {
        const discountValue = Number(item.discount_value);
        if (item.discount_type === 'Amount') {
            itemTotal -= discountValue;
        } else if (item.discount_type === 'Percentage') {
            itemTotal -= itemTotal * (discountValue / 100);
        }
    }
    return Math.max(0, itemTotal); // Ensure total doesn't go below zero
  };

  const calculateOverallTotal = () => {
    return items.reduce((sum, item) => sum + calculateItemTotal(item), 0);
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex justify-center items-center p-4">
      <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-3xl">
        <h2 className="text-2xl font-bold mb-6 text-gray-800">
          {initialData ? 'Edit Sale' : 'Record New Sale'}
        </h2>

        {showCustomerForm && (
          <div className="fixed inset-0 bg-gray-800 bg-opacity-75 z-[60] flex justify-center items-center">
            <CustomerForm 
              onSubmit={handleCustomerSubmit}
              onCancel={() => setShowCustomerForm(false)}
              isSubmitting={false} 
            />
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {formError && <p className="text-red-500 text-sm mb-3 p-2 bg-red-50 rounded">{formError}</p>}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="saleDate" className="block text-sm font-medium text-gray-700">
                Sale Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                id="saleDate"
                value={saleDate}
                onChange={(e) => setSaleDate(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
                required
                disabled={isSubmitting}
              />
            </div>
            <div>
              <label htmlFor="customerId" className="block text-sm font-medium text-gray-700">Customer (Optional)</label>
              <div className="flex items-center space-x-2">
                <select
                  id="customerId"
                  value={customerId || ''}
                  onChange={(e) => setCustomerId(e.target.value || undefined)}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
                  disabled={isSubmitting}
                >
                  <option value="">Select a Customer</option>
                  <optgroup label="Individual Customers">
                    {availableCustomers.filter(c => c.customer_type === 'Individual' || !c.customer_type).map(cust => (
                      <option key={cust.id} value={cust.id}>{cust.name}</option>
                    ))}
                  </optgroup>
                  <optgroup label="Commercial Customers">
                    {availableCustomers.filter(c => c.customer_type === 'Commercial').map(cust => (
                      <option key={cust.id} value={cust.id}>{cust.name}</option>
                    ))}
                  </optgroup>
                </select>
                <button
                  type="button"
                  onClick={() => setShowCustomerForm(true)}
                  className="mt-1 px-3 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none"
                  title="Add New Customer"
                >
                  +
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-3 pt-2 border-t mt-4">
            <h3 className="text-lg font-medium text-gray-900">Sale Items</h3>
            {items.map((item, index) => (
              <div key={item.key} className="p-3 border rounded-md space-y-2 bg-gray-50 relative">
                {items.length > 1 && (
                     <button 
                        type="button" 
                        onClick={() => removeItem(index)}
                        className="absolute top-1 right-1 text-red-500 hover:text-red-700 p-1"
                        title="Remove Item"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                )}
                <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                  <div className="md:col-span-2">
                    <label htmlFor={`itemHarvest-${index}`} className="block text-xs font-medium text-gray-700">Product (Harvest Log) <span className="text-red-500">*</span></label>
                    <select
                      id={`itemHarvest-${index}`}
                      value={item.harvest_log_id || ''}
                      onChange={(e) => handleItemChange(index, 'harvest_log_id', e.target.value)}
                      className="mt-1 block w-full px-2 py-1.5 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-xs"
                      required
                      disabled={isSubmitting}
                    >
                      <option value="">Select Harvested Product</option>
                      {availableHarvests.map(h => (
                        <option key={h.id} value={h.id}>
                          {h.cropName} (Harvested: {new Date(h.harvest_date).toLocaleDateString()}) - Qty: {h.quantity_harvested} {h.quantity_unit}
                        </option>
                      ))}
                    </select>
                    {item.harvest_log_id && item.availableQuantity !== undefined && <p className="text-xs text-gray-500 mt-0.5">Available: {item.availableQuantity}</p>}
                  </div>
                  <div>
                    <label htmlFor={`itemQty-${index}`} className="block text-xs font-medium text-gray-700">Quantity <span className="text-red-500">*</span></label>
                    <input
                      type="text" 
                      id={`itemQty-${index}`}
                      value={item.quantity_sold === undefined ? '' : String(item.quantity_sold)}
                      onChange={(e) => handleItemChange(index, 'quantity_sold_str', e.target.value)}
                      className="mt-1 block w-full px-2 py-1.5 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-xs"
                      required
                      disabled={isSubmitting}
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label htmlFor={`itemPrice-${index}`} className="block text-xs font-medium text-gray-700">Price/Unit <span className="text-red-500">*</span></label>
                    <input
                      type="text" 
                      id={`itemPrice-${index}`}
                      value={item.price_per_unit === undefined ? '' : String(item.price_per_unit)}
                      onChange={(e) => handleItemChange(index, 'price_per_unit_str', e.target.value)}
                      className="mt-1 block w-full px-2 py-1.5 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-xs"
                      required
                      disabled={isSubmitting}
                      placeholder="0.00"
                    />
                  </div>
                  {/* Discount fields will go here, making the grid more complex or needing a new row */}
                </div>
                {/* New row for discount and item notes */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-2">
                    <div>
                        <label className="block text-xs font-medium text-gray-700">Discount Type</label>
                        <div className="mt-1 flex space-x-4">
                            <label className="inline-flex items-center">
                                <input
                                    type="radio"
                                    name={`discountType-${item.key}`}
                                    value="Amount"
                                    checked={item.discount_type === 'Amount'}
                                    onChange={(e) => handleItemChange(index, 'discount_type', e.target.value)}
                                    className="form-radio h-4 w-4 text-green-600"
                                    disabled={isSubmitting}
                                />
                                <span className="ml-2 text-xs text-gray-700">€ Amount</span>
                            </label>
                            <label className="inline-flex items-center">
                                <input
                                    type="radio"
                                    name={`discountType-${item.key}`}
                                    value="Percentage"
                                    checked={item.discount_type === 'Percentage'}
                                    onChange={(e) => handleItemChange(index, 'discount_type', e.target.value)}
                                    className="form-radio h-4 w-4 text-green-600"
                                    disabled={isSubmitting}
                                />
                                <span className="ml-2 text-xs text-gray-700">% Percentage</span>
                            </label>
                             <label className="inline-flex items-center">
                                <input
                                    type="radio"
                                    name={`discountType-${item.key}`}
                                    value="" // Represents null or no discount
                                    checked={!item.discount_type}
                                    onChange={() => handleItemChange(index, 'discount_type', '')}
                                    className="form-radio h-4 w-4 text-gray-400"
                                    disabled={isSubmitting}
                                />
                                <span className="ml-2 text-xs text-gray-500">None</span>
                            </label>
                        </div>
                    </div>
                    <div className="md:col-span-1">
                        <label htmlFor={`itemDiscountValue-${index}`} className="block text-xs font-medium text-gray-700">
                            Discount Value ({item.discount_type === 'Percentage' ? '%' : '€'})
                        </label>
                        <input
                            type="text"
                            id={`itemDiscountValue-${index}`}
                            value={item.discount_value === null || item.discount_value === undefined ? '' : String(item.discount_value)}
                            onChange={(e) => handleItemChange(index, 'discount_value_str', e.target.value)}
                            className="mt-1 block w-full px-2 py-1.5 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-xs"
                            disabled={isSubmitting || !item.discount_type}
                            placeholder="0"
                        />
                    </div>
                     <div className="md:col-span-1">
                        <label htmlFor={`itemNotes-${index}`} className="block text-xs font-medium text-gray-700">Item Notes</label>
                        <input
                            type="text"
                            id={`itemNotes-${index}`}
                            value={item.notes || ''}
                            onChange={(e) => handleItemChange(index, 'notes', e.target.value)}
                            className="mt-1 block w-full px-2 py-1.5 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-xs"
                            disabled={isSubmitting}
                        />
                    </div>
                </div>
                 <p className="text-xs text-right font-medium text-gray-700 mt-1">Item Subtotal: €{calculateItemTotal(item).toFixed(2)}</p>
              </div>
            ))}
            <button
              type="button"
              onClick={addItem}
              className="mt-2 px-3 py-1.5 border border-dashed border-green-400 text-sm font-medium rounded-md text-green-700 hover:bg-green-50 focus:outline-none"
              disabled={isSubmitting}
            >
              + Add Item
            </button>
          </div>
          
          <div className="pt-4 border-t">
            <label htmlFor="saleNotes" className="block text-sm font-medium text-gray-700">Overall Sale Notes</label>
            <textarea
              id="saleNotes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
              disabled={isSubmitting}
            />
          </div>

          <div className="flex items-center justify-between pt-4 border-t">
            <h3 className="text-xl font-semibold text-gray-800">
                Overall Total: €{calculateOverallTotal().toFixed(2)}
            </h3>
            <div className="flex items-center space-x-3">
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
                {isSubmitting ? (initialData ? 'Saving...' : 'Recording Sale...') : (initialData ? 'Save Changes' : 'Record Sale')}
                </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}