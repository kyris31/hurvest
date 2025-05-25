'use client';

import React, { useState, useEffect } from 'react';
import { SupplierInvoiceItem } from '@/lib/db';

// Define the shape of the data the form will submit
// Matches the new structure of SupplierInvoiceItem more closely
type SupplierInvoiceItemFormData = Omit<
  SupplierInvoiceItem,
  | 'id'
  | 'supplier_invoice_id'
  | '_synced'
  | '_last_modified'
  | 'created_at'
  | 'updated_at'
  | 'is_deleted'
  | 'deleted_at'
  | 'input_inventory_id'
  // Fields handled by parent/processing or complex apportionment
  | 'apportioned_discount_amount'
  | 'apportioned_shipping_cost'
  | 'apportioned_other_charges'
  | 'line_subtotal_after_apportionment'
  // line_total_net, line_total_gross, item_vat_percentage, item_vat_amount,
  // item_discount_type, item_discount_value, cost_after_item_adjustments
  // will be included as they are part of SupplierInvoiceItem or calculated by the form.
>;


interface SupplierInvoiceItemFormProps {
  initialData?: SupplierInvoiceItem | null;
  onSubmit: (data: SupplierInvoiceItemFormData, itemIdToUpdate?: string) => Promise<void>;
  onCancel: () => void;
  isSubmitting?: boolean; 
}

export default function SupplierInvoiceItemForm({
  initialData,
  onSubmit,
  onCancel,
  isSubmitting: propIsSubmitting,
}: SupplierInvoiceItemFormProps) {
  const [description, setDescription] = useState(initialData?.description_from_invoice || '');
  const [packageQuantity, setPackageQuantity] = useState<number | ''>(initialData?.package_quantity ?? '');
  const [packageUnitOfMeasure, setPackageUnitOfMeasure] = useState(initialData?.package_unit_of_measure || '');
  const [itemQuantityPerPackage, setItemQuantityPerPackage] = useState<number | ''>(initialData?.item_quantity_per_package ?? '');
  const [itemUnitOfMeasure, setItemUnitOfMeasure] = useState(initialData?.item_unit_of_measure || '');
  const [pricePerPackageGross, setPricePerPackageGross] = useState<number | ''>(initialData?.price_per_package_gross ?? '');
  
  const [itemDiscountType, setItemDiscountType] = useState<'Percentage' | 'Amount' | ''>(initialData?.item_discount_type ?? '');
  const [itemDiscountValue, setItemDiscountValue] = useState<number | ''>(initialData?.item_discount_value ?? '');
  const [itemVatPercentage, setItemVatPercentage] = useState<number | ''>(initialData?.item_vat_percentage ?? '');

  const [notes, setNotes] = useState(initialData?.notes || '');
  const [formError, setFormError] = useState<string | null>(null);
  const [internalIsSubmitting, setInternalIsSubmitting] = useState(false);

  const isActuallySubmitting = propIsSubmitting ?? internalIsSubmitting;

  useEffect(() => {
    if (initialData) {
      setDescription(initialData.description_from_invoice || '');
      setPackageQuantity(initialData.package_quantity ?? '');
      setPackageUnitOfMeasure(initialData.package_unit_of_measure || '');
      setItemQuantityPerPackage(initialData.item_quantity_per_package ?? '');
      setItemUnitOfMeasure(initialData.item_unit_of_measure || '');
      setPricePerPackageGross(initialData.price_per_package_gross ?? '');
      setItemDiscountType(initialData.item_discount_type ?? '');
      setItemDiscountValue(initialData.item_discount_value ?? '');
      setItemVatPercentage(initialData.item_vat_percentage ?? '');
      setNotes(initialData.notes || '');
    } else {
      // Reset for new item
      setDescription('');
      setPackageQuantity('');
      setPackageUnitOfMeasure('');
      setItemQuantityPerPackage('');
      setItemUnitOfMeasure('');
      setPricePerPackageGross('');
      setItemDiscountType('');
      setItemDiscountValue('');
      setItemVatPercentage('');
      setNotes('');
    }
  }, [initialData]);


  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setFormError(null);

    if (!description.trim() || packageQuantity === '' || pricePerPackageGross === '') {
      setFormError('Description, Packages Purchased, and Price per Package are required.');
      return;
    }
    if (isNaN(Number(packageQuantity)) || Number(packageQuantity) <= 0) {
      setFormError('Packages Purchased must be a positive number.');
      return;
    }
    if (itemQuantityPerPackage !== '' && (isNaN(Number(itemQuantityPerPackage)) || Number(itemQuantityPerPackage) <= 0)) {
      setFormError('Item Quantity per Package must be a positive number if provided.');
      return;
    }
    if (isNaN(Number(pricePerPackageGross)) || Number(pricePerPackageGross) < 0) {
      setFormError('Price per Package must be a non-negative number.');
      return;
    }
    if (itemDiscountValue !== '' && (isNaN(Number(itemDiscountValue)) || Number(itemDiscountValue) < 0)) {
      setFormError('Item Discount Value must be a non-negative number.');
      return;
    }
    if (itemVatPercentage !== '' && (isNaN(Number(itemVatPercentage)) || Number(itemVatPercentage) < 0)) {
      setFormError('Item VAT Percentage must be a non-negative number.');
      return;
    }
    
    setInternalIsSubmitting(true);
    try {
      const lineTotalGrossOriginal = Number(packageQuantity) * Number(pricePerPackageGross);

      let itemDiscountApplied = 0;
      if (itemDiscountType && (itemDiscountValue !== '' && !isNaN(Number(itemDiscountValue)))) {
        const discountVal = Number(itemDiscountValue);
        if (itemDiscountType === 'Percentage') {
          itemDiscountApplied = lineTotalGrossOriginal * (discountVal / 100);
        } else { // Amount
          itemDiscountApplied = discountVal;
        }
      }

      const priceAfterItemDiscount = lineTotalGrossOriginal - itemDiscountApplied;

      let calculatedItemVatAmount = 0;
      const currentItemVatPercentage = (itemVatPercentage !== '' && !isNaN(Number(itemVatPercentage))) ? Number(itemVatPercentage) : 0;
      if (currentItemVatPercentage > 0) {
        calculatedItemVatAmount = priceAfterItemDiscount * (currentItemVatPercentage / 100);
      }
      
      const costAfterItemAdjustments = priceAfterItemDiscount + calculatedItemVatAmount;
      // For the form submission, line_total_net will be this cost_after_item_adjustments.
      // The parent (EditSupplierInvoicePage) will handle apportioning invoice-level costs
      // and calculating the *final* line_total_net.

      const formData: SupplierInvoiceItemFormData = {
        description_from_invoice: description.trim(),
        package_quantity: Number(packageQuantity),
        package_unit_of_measure: packageUnitOfMeasure.trim() || undefined,
        item_quantity_per_package: itemQuantityPerPackage === '' ? undefined : Number(itemQuantityPerPackage),
        item_unit_of_measure: itemUnitOfMeasure.trim() || undefined,
        price_per_package_gross: Number(pricePerPackageGross),
        line_total_gross: lineTotalGrossOriginal,
        item_discount_type: itemDiscountType || undefined,
        item_discount_value: (itemDiscountValue !== '' && !isNaN(Number(itemDiscountValue))) ? Number(itemDiscountValue) : undefined,
        item_vat_percentage: currentItemVatPercentage > 0 ? currentItemVatPercentage : undefined,
        item_vat_amount: calculatedItemVatAmount,
        cost_after_item_adjustments: costAfterItemAdjustments,
        line_total_net: costAfterItemAdjustments, // Preliminary net; final net after invoice-level apportionment
        notes: notes.trim() || undefined,
      };
      await onSubmit(formData, initialData?.id);
      
      if (!initialData) {
        setDescription('');
        setPackageQuantity('');
        setPackageUnitOfMeasure('');
        setItemQuantityPerPackage('');
        setItemUnitOfMeasure('');
        setPricePerPackageGross('');
        setItemDiscountType('');
        setItemDiscountValue('');
        setItemVatPercentage('');
        setNotes('');
      }
    } catch (err) {
      console.error("Error submitting invoice item form:", err);
      setFormError(err instanceof Error ? err.message : "Submission failed");
    } finally {
      setInternalIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {formError && <p className="text-sm text-red-600">{formError}</p>}
      <div>
        <label htmlFor="itemDescription" className="block text-sm font-medium text-gray-700">
          Item Description (as on invoice) <span className="text-red-500">*</span>
        </label>
        <input
          type="text" id="itemDescription" value={description} onChange={(e) => setDescription(e.target.value)}
          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
          required disabled={isActuallySubmitting}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label htmlFor="packageQuantity" className="block text-sm font-medium text-gray-700">
            Packages Purchased <span className="text-red-500">*</span>
          </label>
          <input
            type="number" id="packageQuantity" value={packageQuantity}
            onChange={(e) => setPackageQuantity(e.target.value === '' ? '' : parseFloat(e.target.value))}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
            required step="any" min="0.01" disabled={isActuallySubmitting}
          />
        </div>
        <div>
          <label htmlFor="packageUnitOfMeasure" className="block text-sm font-medium text-gray-700">Package Unit</label>
          <input
            type="text" id="packageUnitOfMeasure" value={packageUnitOfMeasure}
            onChange={(e) => setPackageUnitOfMeasure(e.target.value)}
            placeholder="e.g., bottle, bag, case"
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
            disabled={isActuallySubmitting}
          />
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label htmlFor="itemQuantityPerPackage" className="block text-sm font-medium text-gray-700">Item Qty / Package</label>
          <input
            type="number" id="itemQuantityPerPackage" value={itemQuantityPerPackage}
            onChange={(e) => setItemQuantityPerPackage(e.target.value === '' ? '' : parseFloat(e.target.value))}
            placeholder="e.g., 20 (if L per bottle)"
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
            step="any" min="0" disabled={isActuallySubmitting}
          />
        </div>
        <div>
          <label htmlFor="itemUnitOfMeasure" className="block text-sm font-medium text-gray-700">Item Unit</label>
          <input
            type="text" id="itemUnitOfMeasure" value={itemUnitOfMeasure}
            onChange={(e) => setItemUnitOfMeasure(e.target.value)}
            placeholder="e.g., L, kg, items"
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
            disabled={isActuallySubmitting}
          />
        </div>
      </div>

      <div>
        <label htmlFor="pricePerPackageGross" className="block text-sm font-medium text-gray-700">
          Price per Package (€ Gross) <span className="text-red-500">*</span>
        </label>
        <input
          type="number" id="pricePerPackageGross" value={pricePerPackageGross}
          onChange={(e) => setPricePerPackageGross(e.target.value === '' ? '' : parseFloat(e.target.value))}
          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
          required step="any" min="0" disabled={isActuallySubmitting}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label htmlFor="itemDiscountType" className="block text-sm font-medium text-gray-700">Item Discount Type</label>
          <select
            id="itemDiscountType" value={itemDiscountType}
            onChange={(e) => setItemDiscountType(e.target.value as 'Percentage' | 'Amount' | '')}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
            disabled={isActuallySubmitting}
          >
            <option value="">None</option>
            <option value="Percentage">Percentage (%)</option>
            <option value="Amount">Amount (€)</option>
          </select>
        </div>
        <div>
          <label htmlFor="itemDiscountValue" className="block text-sm font-medium text-gray-700">Item Discount Value</label>
          <input
            type="number" id="itemDiscountValue" value={itemDiscountValue}
            onChange={(e) => setItemDiscountValue(e.target.value === '' ? '' : parseFloat(e.target.value))}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
            step="any" min="0" disabled={isActuallySubmitting || !itemDiscountType}
            placeholder={!itemDiscountType ? "Select type first" : ""}
          />
        </div>
        <div>
          <label htmlFor="itemVatPercentage" className="block text-sm font-medium text-gray-700">Item VAT (%)</label>
          <input
            type="number" id="itemVatPercentage" value={itemVatPercentage}
            onChange={(e) => setItemVatPercentage(e.target.value === '' ? '' : parseFloat(e.target.value))}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
            step="any" min="0" placeholder="e.g., 19" disabled={isActuallySubmitting}
          />
        </div>
      </div>
      
      <div>
        <label htmlFor="itemNotes" className="block text-sm font-medium text-gray-700">Notes (Optional)</label>
        <textarea
          id="itemNotes" value={notes} onChange={(e) => setNotes(e.target.value)}
          rows={2}
          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
          disabled={isActuallySubmitting}
        />
      </div>

      <div className="flex justify-end space-x-2 pt-2">
        <button
          type="button" onClick={onCancel} disabled={isActuallySubmitting}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md border border-gray-300"
        >
          Cancel
        </button>
        <button
          type="submit" disabled={isActuallySubmitting}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md shadow-sm"
        >
          {isActuallySubmitting ? (initialData ? 'Updating...' : 'Adding...') : (initialData ? 'Update Item' : 'Add Item to Invoice')}
        </button>
      </div>
    </form>
  );
}