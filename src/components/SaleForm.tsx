'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Sale, SaleItem, Customer, HarvestLog, InputInventory, db } from '@/lib/db';
import CustomerForm from './CustomerForm';

interface SaleFormProps {
  initialData?: Sale & { items?: SaleItem[] };
  onSubmit: (
    saleData: Omit<Sale, 'id' | '_synced' | '_last_modified' | 'created_at' | 'updated_at' | 'total_amount' | 'payment_history'>, 
    itemsData: (Omit<SaleItem, 'id' | 'sale_id' | '_synced' | '_last_modified' | 'created_at' | 'updated_at'> & { sourceType?: 'harvest' | 'inventory' })[]
  ) => Promise<void>;
  onCancel: () => void;
  isSubmitting: boolean;
}

interface SellableProduct {
  id: string; 
  displayName: string;
  availableQuantity: number;
  quantityUnit: string;
  sourceType: 'harvest' | 'inventory'; 
  originalRecord: HarvestLog | InputInventory; 
}

export default function SaleForm({ initialData, onSubmit, onCancel, isSubmitting }: SaleFormProps) {
  const [saleDate, setSaleDate] = useState('');
  const [customerId, setCustomerId] = useState<string | undefined>(undefined);
  const [notes, setNotes] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<Sale['payment_method']>('on_account');
  const [paymentStatus, setPaymentStatus] = useState<Sale['payment_status']>('unpaid');
  const [amountPaid, setAmountPaid] = useState<number | ''>('');

  const [items, setItems] = useState<(Partial<SaleItem & {
    key: string;
    productName?: string; 
    availableQuantity?: number; 
    selectedProductId?: string; 
    sourceType?: 'harvest' | 'inventory';
  }>)[]>([]);
  
  const [availableCustomers, setAvailableCustomers] = useState<Customer[]>([]);
  const [sellableProducts, setSellableProducts] = useState<SellableProduct[]>([]);
  
  const [showCustomerForm, setShowCustomerForm] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const fetchFormData = useCallback(async () => {
    try {
      const [customers, harvests, plantingLogs, seedBatches, crops, seedlingLogs, allInputInventory] = await Promise.all([
        db.customers.orderBy('name').filter(c => c.is_deleted !==1).toArray(),
        db.harvestLogs.orderBy('harvest_date').filter(h => h.is_deleted !== 1 && (h.current_quantity_available ?? h.quantity_harvested) > 0).reverse().toArray(),
        db.plantingLogs.filter(p => p.is_deleted !== 1).toArray(),
        db.seedBatches.filter(sb => sb.is_deleted !== 1).toArray(),
        db.crops.filter(c => c.is_deleted !== 1).toArray(),
        db.seedlingProductionLogs.filter(sl => sl.is_deleted !== 1).toArray(),
        db.inputInventory.filter(ii => ii.is_deleted !== 1 && (ii.current_quantity ?? 0) > 0).toArray(),
      ]);
      setAvailableCustomers(customers);
      
      const cropsMap = new Map(crops.map(c => [c.id, c]));
      const products: SellableProduct[] = [];

      harvests.forEach(h => {
        const pLog = plantingLogs.find(pl => pl.id === h.planting_log_id);
        let cropName = 'Unknown Harvested Crop';
        if (pLog) {
          if (pLog.input_inventory_id) { 
            const invItem = allInputInventory.find(ii => ii.id === pLog.input_inventory_id);
            if (invItem && invItem.crop_id) cropName = cropsMap.get(invItem.crop_id)?.name || invItem.name || cropName;
            else if (invItem) cropName = invItem.name || cropName;
          } else if (pLog.seedling_production_log_id) {
            const sLog = seedlingLogs.find(sl => sl.id === pLog.seedling_production_log_id);
            if (sLog && sLog.crop_id) cropName = cropsMap.get(sLog.crop_id)?.name || cropName;
          } else if (pLog.seed_batch_id) {
            const sBatch = seedBatches.find(sb => sb.id === pLog.seed_batch_id);
            if (sBatch && sBatch.crop_id) cropName = cropsMap.get(sBatch.crop_id)?.name || cropName;
          }
        }
        products.push({
          id: h.id,
          displayName: `${cropName} (Harvested: ${new Date(h.harvest_date).toLocaleDateString()})`,
          availableQuantity: h.current_quantity_available !== undefined ? h.current_quantity_available : h.quantity_harvested,
          quantityUnit: h.quantity_unit,
          sourceType: 'harvest',
          originalRecord: h,
        });
      });

      const inventoryGroups: Record<string, { displayName: string, totalAvailable: number, unit: string, originalRecords: InputInventory[] }> = {};
      allInputInventory.forEach(ii => {
        if (ii.type === 'Purchased Goods' && (ii.current_quantity || 0) > 0) {
          const groupKey = `${ii.name}::${ii.quantity_unit || 'unit'}`;
          if (!inventoryGroups[groupKey]) {
            inventoryGroups[groupKey] = {
              displayName: `${ii.name} (Stock - Resale)`,
              totalAvailable: 0,
              unit: ii.quantity_unit || 'unit',
              originalRecords: []
            };
          }
          inventoryGroups[groupKey].totalAvailable += (ii.current_quantity || 0);
          inventoryGroups[groupKey].originalRecords.push(ii);
        }
      });

      Object.values(inventoryGroups).forEach(group => {
        if (group.originalRecords.length > 0) {
          products.push({
            id: group.originalRecords[0].id, 
            displayName: group.displayName,
            availableQuantity: group.totalAvailable,
            quantityUnit: group.unit,
            sourceType: 'inventory', 
            originalRecord: group.originalRecords[0], 
          });
        }
      });
      setSellableProducts(products.sort((a,b) => a.displayName.localeCompare(b.displayName)));
    } catch (error) {
      console.error("Failed to fetch form data for sales", error);
      setFormError("Could not load customer or product data.");
    }
  }, []);

  useEffect(() => {
    fetchFormData();
  }, [fetchFormData]); 


  useEffect(() => { 
    if (initialData) {
      setSaleDate(initialData.sale_date ? initialData.sale_date.split('T')[0] : new Date().toISOString().split('T')[0]);
      setCustomerId(initialData.customer_id || undefined);
      setNotes(initialData.notes || '');
      setPaymentMethod(initialData.payment_method || 'on_account');
      setPaymentStatus(initialData.payment_status || 'unpaid');
      setAmountPaid(initialData.amount_paid === undefined || initialData.amount_paid === null ? '' : initialData.amount_paid);
      
      if (initialData.items && sellableProducts.length > 0) { 
         const initialItems = initialData.items.map((item, index) => {
            const product = sellableProducts.find(p =>
                (item.harvest_log_id && p.sourceType === 'harvest' && p.id === item.harvest_log_id) ||
                (item.input_inventory_id && p.sourceType === 'inventory' && p.id === item.input_inventory_id) 
                // For edited consolidated items, p.id is the representative batch ID.
                // This might need adjustment if an edit needs to reflect multiple original batches.
                // For now, it links to the representative.
            );
            return {
                ...item,
                key: `item-${index}-${Date.now()}`,
                selectedProductId: product?.id,
                productName: product?.displayName,
                availableQuantity: product?.availableQuantity,
                sourceType: product?.sourceType,
                quantity_sold: item.quantity_sold,
                price_per_unit: item.price_per_unit,
                discount_type: item.discount_type || null,
                discount_value: item.discount_value || null
            };
        });
        setItems(initialItems);
      } else if (!initialData.items) { 
        setItems([{ key: `item-0-${Date.now()}`, quantity_sold: 0, price_per_unit: 0, discount_type: null, discount_value: null, notes: '' }]);
      }
    } else { 
      setSaleDate(new Date().toISOString().split('T')[0]);
      setPaymentMethod('on_account');
      setPaymentStatus('unpaid');
      setAmountPaid('');
      setItems([{ key: `item-0-${Date.now()}`, quantity_sold: 0, price_per_unit: 0, discount_type: null, discount_value: null, notes: '' }]);
    }
  }, [initialData, sellableProducts]); 


  const handleItemChange = (index: number, field: keyof SaleItem | 'quantity_sold_str' | 'price_per_unit_str' | 'discount_value_str' | 'selectedProductId', value: unknown) => {
    const newItemsState = [...items];
    const currentItem = { ...newItemsState[index] } as Partial<SaleItem & { key: string, availableQuantity?: number, productName?: string, selectedProductId?: string, sourceType?: 'harvest' | 'inventory' }>;

    if (field === 'selectedProductId') {
        const selectedProduct = sellableProducts.find(p => p.id === (value as string)); 
        if (selectedProduct) {
            currentItem.selectedProductId = selectedProduct.id; 
            currentItem.productName = selectedProduct.displayName;
            currentItem.availableQuantity = selectedProduct.availableQuantity;
            currentItem.sourceType = selectedProduct.sourceType;
            
            currentItem.harvest_log_id = undefined;
            currentItem.input_inventory_id = undefined;

            if (selectedProduct.sourceType === 'harvest') {
                currentItem.harvest_log_id = selectedProduct.id; 
            } else if (selectedProduct.sourceType === 'inventory') {
                currentItem.input_inventory_id = selectedProduct.id; 
            }
        } else {
            currentItem.selectedProductId = undefined;
            currentItem.productName = undefined;
            currentItem.availableQuantity = undefined;
            currentItem.sourceType = undefined;
            currentItem.harvest_log_id = undefined;
            currentItem.input_inventory_id = undefined;
        }
    } else if (field === 'quantity_sold_str') {
        currentItem.quantity_sold = value === '' ? undefined : parseFloat(value as string);
    } else if (field === 'price_per_unit_str') {
        currentItem.price_per_unit = value === '' ? undefined : parseFloat(value as string);
    } else if (field === 'discount_value_str') {
        currentItem.discount_value = value === '' ? null : parseFloat(value as string);
    } else if (field === 'discount_type') {
        currentItem.discount_type = value === '' ? null : (value as SaleItem['discount_type']);
        if (value === null || value === '') currentItem.discount_value = null;
    } else if (field === 'notes') {
        currentItem.notes = value as string | undefined;
    } else if (field === 'quantity_sold' && typeof value === 'number') {
        currentItem.quantity_sold = value;
    } else if (field === 'price_per_unit' && typeof value === 'number') {
        currentItem.price_per_unit = value;
    }
    
    newItemsState[index] = currentItem;
    setItems(newItemsState);
  };

  const addItem = () => {
    setItems([...items, {
        key: `item-${items.length}-${Date.now()}`,
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
      // return id; // Not used, can be removed if not needed by caller
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

    const saleItemsData: (Omit<SaleItem, 'id' | 'sale_id' | '_synced' | '_last_modified' | 'created_at' | 'updated_at'> & { sourceType?: 'harvest' | 'inventory' })[] = [];
    for (const [index, item] of items.entries()) {
      if (!item.selectedProductId || item.quantity_sold === undefined || item.price_per_unit === undefined || Number(item.quantity_sold) <= 0 || Number(item.price_per_unit) < 0) {
        setFormError(`Item ${index + 1}: Product, valid Quantity (>0), and Price (>=0) are required.`);
        return;
      }
      if (item.availableQuantity !== undefined && Number(item.quantity_sold) > item.availableQuantity) {
        setFormError(`Item ${index + 1} (${item.productName || 'Selected Product'}): Quantity sold (${Number(item.quantity_sold)}) exceeds available stock (${item.availableQuantity}).`);
        return;
      }
      if (isNaN(Number(item.quantity_sold)) || isNaN(Number(item.price_per_unit))) {
        setFormError(`Item ${index + 1}: Quantity and Price must be numbers.`);
        return;
      }
      if (item.discount_type) {
        if (item.discount_value === undefined || item.discount_value === null || isNaN(Number(item.discount_value)) || Number(item.discount_value) < 0) {
          setFormError(`Item ${index + 1}: Discount Value must be a non-negative number if Discount Type is selected.`);
          return;
        }
        if (item.discount_type === 'Percentage' && Number(item.discount_value) > 100) {
          setFormError(`Item ${index + 1}: Percentage discount cannot exceed 100.`);
          return;
        }
      } else if (item.discount_value !== undefined && item.discount_value !== null && Number(item.discount_value) !== 0) {
         setFormError(`Item ${index + 1}: Discount Value should only be set if Discount Type is selected (or set to 0 if no discount).`);
         return;
      }

      const saleItemEntry: Omit<SaleItem, 'id' | 'sale_id' | '_synced' | '_last_modified' | 'created_at' | 'updated_at'> & { sourceType?: 'harvest' | 'inventory' } = {
        quantity_sold: Number(item.quantity_sold),
        price_per_unit: Number(item.price_per_unit),
        discount_type: item.discount_type || null,
        discount_value: (item.discount_type && item.discount_value !== null && item.discount_value !== undefined) ? Number(item.discount_value) : null,
        notes: item.notes,
        sourceType: item.sourceType, 
        harvest_log_id: undefined,
        input_inventory_id: undefined,
      };

      if (item.sourceType === 'harvest' && item.harvest_log_id) {
        saleItemEntry.harvest_log_id = item.harvest_log_id;
      } else if (item.sourceType === 'inventory' && item.input_inventory_id) {
        saleItemEntry.input_inventory_id = item.input_inventory_id; 
      } else {
        setFormError(`Item ${index + 1}: Product source type or specific ID (harvest/inventory) is missing.`);
        return;
      }
      saleItemsData.push(saleItemEntry);
    }

    const saleData = {
      sale_date: saleDate,
      customer_id: customerId || undefined,
      payment_method: paymentMethod,
      payment_status: paymentStatus,
      amount_paid: amountPaid === '' ? undefined : Number(amountPaid),
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
    return Math.max(0, itemTotal); 
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
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t mt-4">
            <div>
              <label htmlFor="paymentMethod" className="block text-sm font-medium text-gray-700">Payment Method</label>
              <select
                id="paymentMethod"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as Sale['payment_method'])}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
                disabled={isSubmitting}
              >
                <option value="on_account">On Account</option>
                <option value="cash">Cash</option>
                <option value="card">Card</option>
                <option value="bank_transfer">Bank Transfer</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label htmlFor="paymentStatus" className="block text-sm font-medium text-gray-700">Payment Status</label>
              <select
                id="paymentStatus"
                value={paymentStatus}
                onChange={(e) => setPaymentStatus(e.target.value as Sale['payment_status'])}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
                disabled={isSubmitting}
              >
                <option value="unpaid">Unpaid</option>
                <option value="partially_paid">Partially Paid</option>
                <option value="paid">Paid</option>
              </select>
            </div>
            <div>
              <label htmlFor="amountPaid" className="block text-sm font-medium text-gray-700">Amount Paid (€)</label>
              <input
                type="number"
                step="0.01"
                id="amountPaid"
                value={amountPaid}
                onChange={(e) => setAmountPaid(e.target.value === '' ? '' : parseFloat(e.target.value))}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
                disabled={isSubmitting || paymentStatus === 'unpaid'}
                placeholder="0.00"
              />
            </div>
          </div>

          <div className="space-y-3 pt-4 border-t mt-4">
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
                <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                  <div className="md:col-span-4">
                    <label htmlFor={`product-${index}`} className="block text-xs font-medium text-gray-700">Product <span className="text-red-500">*</span></label>
                    <select
                      id={`product-${index}`}
                      value={item.selectedProductId || ''}
                      onChange={(e) => handleItemChange(index, 'selectedProductId', e.target.value)}
                      className="mt-1 block w-full px-2 py-1.5 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm text-xs"
                      required
                      disabled={isSubmitting}
                    >
                      <option value="">Select Product</option>
                      {sellableProducts.map(p => (
                        <option key={p.id} value={p.id}>
                          {`${p.displayName} (Avail: ${p.availableQuantity} ${p.quantityUnit})`}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <label htmlFor={`quantity-${index}`} className="block text-xs font-medium text-gray-700">Quantity <span className="text-red-500">*</span></label>
                    <input
                      type="number"
                      id={`quantity-${index}`}
                      value={item.quantity_sold === undefined ? '' : item.quantity_sold}
                      onChange={(e) => handleItemChange(index, 'quantity_sold_str', e.target.value)}
                      className="mt-1 block w-full px-2 py-1.5 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm text-xs"
                      required
                      disabled={isSubmitting}
                      step="any"
                      min="0.001" // Ensure positive quantity
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label htmlFor={`price-${index}`} className="block text-xs font-medium text-gray-700">Price/Unit <span className="text-red-500">*</span></label>
                    <input
                      type="number"
                      id={`price-${index}`}
                      value={item.price_per_unit === undefined ? '' : item.price_per_unit}
                      onChange={(e) => handleItemChange(index, 'price_per_unit_str', e.target.value)}
                      className="mt-1 block w-full px-2 py-1.5 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm text-xs"
                      required
                      disabled={isSubmitting}
                      step="0.01"
                      min="0"
                    />
                  </div>
                  <div className="md:col-span-2">
                     <label htmlFor={`discountType-${index}`} className="block text-xs font-medium text-gray-700">Discount</label>
                        <div className="mt-1 flex space-x-1">
                            <select 
                                id={`discountType-${index}`}
                                value={item.discount_type || ''}
                                onChange={(e) => handleItemChange(index, 'discount_type', e.target.value || null)}
                                className="block w-1/2 px-2 py-1.5 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm text-xs"
                                disabled={isSubmitting}
                            >
                                <option value="">Type</option>
                                <option value="Amount">Amount (€)</option>
                                <option value="Percentage">Percentage (%)</option>
                            </select>
                            <input
                                type="number"
                                id={`discountValue-${index}`}
                                value={item.discount_value === null || item.discount_value === undefined ? '' : item.discount_value}
                                onChange={(e) => handleItemChange(index, 'discount_value_str', e.target.value)}
                                className="block w-1/2 px-2 py-1.5 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm text-xs"
                                disabled={isSubmitting || !item.discount_type}
                                step="any"
                                min="0"
                                placeholder="Value"
                            />
                        </div>
                  </div>
                  <div className="md:col-span-2 flex items-end">
                    <p className="text-xs text-gray-800 w-full text-right pr-1">
                        Subtotal: €{calculateItemTotal(item).toFixed(2)}
                    </p>
                  </div>
                </div>
                 <div className="mt-1">
                    <label htmlFor={`itemNotes-${index}`} className="block text-xs font-medium text-gray-700">Item Notes</label>
                    <input
                        type="text"
                        id={`itemNotes-${index}`}
                        value={item.notes || ''}
                        onChange={(e) => handleItemChange(index, 'notes', e.target.value)}
                        className="mt-1 block w-full px-2 py-1.5 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm text-xs"
                        disabled={isSubmitting}
                        placeholder="Optional notes for this item"
                    />
                </div>
              </div>
            ))}
            <button
              type="button"
              onClick={addItem}
              className="mt-2 px-3 py-1.5 text-xs font-medium text-green-700 bg-green-100 hover:bg-green-200 rounded-md border border-green-300"
              disabled={isSubmitting}
            >
              + Add Item
            </button>
          </div>

          <div className="pt-4 border-t">
            <label htmlFor="overallSaleNotes" className="block text-sm font-medium text-gray-700">Overall Sale Notes</label>
            <textarea
              id="overallSaleNotes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
              disabled={isSubmitting}
              placeholder="Any overall notes for this sale..."
            />
          </div>

          <div className="flex items-center justify-between pt-5 border-t">
            <h3 className="text-xl font-semibold text-gray-900">
              Overall Total: €{calculateOverallTotal().toFixed(2)}
            </h3>
            <div className="flex items-center justify-end space-x-3">
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
                disabled={isSubmitting || items.length === 0 || items.some(i => !i.selectedProductId || Number(i.quantity_sold) <= 0)}
                className="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
              >
                {isSubmitting ? (initialData ? 'Saving...' : 'Recording...') : (initialData ? 'Save Changes' : 'Record Sale')}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}