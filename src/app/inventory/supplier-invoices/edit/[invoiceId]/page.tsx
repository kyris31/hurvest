'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { db, SupplierInvoice, Supplier, Crop, InputInventory, SupplierInvoiceItem } from '@/lib/db';
import Link from 'next/link';
import SupplierInvoiceItemForm from '@/components/SupplierInvoiceItemForm';

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
  | 'line_total_gross' 
  | 'apportioned_discount_amount' 
  | 'apportioned_shipping_cost'
  | 'apportioned_other_charges'
  | 'line_subtotal_after_apportionment'
  | 'vat_percentage' 
  | 'vat_amount_on_line'
> & { line_total_net: number };


export default function EditSupplierInvoicePage() {
  const router = useRouter();
  const params = useParams();
  const invoiceId = params.invoiceId as string;

  const [invoice, setInvoice] = useState<SupplierInvoice | null>(null);
  const [invoiceItems, setInvoiceItems] = useState<SupplierInvoiceItem[]>([]);
  const [supplierName, setSupplierName] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false); 
  const [editingItem, setEditingItem] = useState<SupplierInvoiceItem | null>(null); 
  
  const [showAddItemForm, setShowAddItemForm] = useState(false);

  const fetchInvoiceData = useCallback(async () => {
    if (!invoiceId) return;
    setIsLoading(true);
    setError(null);
    console.log(`[EditPage] fetchInvoiceData called for invoiceId: ${invoiceId}`);
    try {
      const inv = await db.supplierInvoices.get(invoiceId);
      console.log("[EditPage] Fetched invoice data from Dexie:", JSON.stringify(inv));
      if (inv && inv.is_deleted !== 1) {
        console.log("[EditPage] Invoice is valid, attempting to set state.");
        setInvoice(inv);
        console.log("[EditPage] setInvoice(inv) called.");
        if (inv.supplier_id) {
          console.log("[EditPage] Fetching supplier name for ID:", inv.supplier_id);
          const sup = await db.suppliers.get(inv.supplier_id);
          setSupplierName(sup?.name || 'N/A');
          console.log("[EditPage] Supplier name set to:", sup?.name || 'N/A');
        }
        console.log("[EditPage] Fetching invoice items for invoice ID:", invoiceId);
        const items = await db.supplierInvoiceItems.where({ supplier_invoice_id: invoiceId, is_deleted: 0 }).toArray();
        setInvoiceItems(items);
        console.log("[EditPage] Invoice items set, count:", items.length);
      } else {
        console.log("[EditPage] Invoice is null, undefined, or marked as deleted. is_deleted:", inv?.is_deleted);
        setError("Supplier invoice not found or has been deleted.");
        setInvoice(null); 
      }
    } catch (err) {
      console.error("[EditPage] Error during data population:", err);
      setError("Failed to load invoice details.");
    } finally {
      setIsLoading(false);
    }
  }, [invoiceId]);

  useEffect(() => {
    fetchInvoiceData();
  }, [fetchInvoiceData]);

  const handleSaveInvoice = async () => {
    if (!invoice) return;
    if (invoice.status === 'processed' || invoice.status === 'paid' || invoice.status === 'cancelled') {
        setError("Cannot save changes to an invoice that is already processed, paid, or cancelled.");
        return;
    }
    setIsSaving(true);
    setError(null);
    try {
      let calculatedTotalGross = 0;
      invoiceItems.forEach(item => {
        calculatedTotalGross += item.line_total_gross || (item.package_quantity * item.price_per_package_gross) || 0;
      });

      const discountAmount = invoice.discount_amount || 0;
      const shippingCost = invoice.shipping_cost || 0;
      const otherCharges = invoice.other_charges || 0; 
      const vatAmount = invoice.total_vat_amount || 0;

      const subtotalAfterAdjustments = calculatedTotalGross - discountAmount + shippingCost + otherCharges;
      const finalTotalNet = subtotalAfterAdjustments + vatAmount;

      const updatedInvoiceData: Partial<SupplierInvoice> = {
        notes: invoice.notes, 
        status: (invoice.status === 'draft' && invoiceItems.length > 0) ? 'pending_processing' : invoice.status, 
        discount_amount: invoice.discount_amount,
        shipping_cost: invoice.shipping_cost,
        other_charges: invoice.other_charges,
        total_vat_amount: invoice.total_vat_amount,
        total_amount_gross: calculatedTotalGross,
        subtotal_after_adjustments: subtotalAfterAdjustments,
        total_amount_net: finalTotalNet,
        updated_at: new Date().toISOString(),
        _last_modified: Date.now(),
        _synced: 0,
      };

      await db.supplierInvoices.update(invoice.id, updatedInvoiceData);
      setInvoice(prev => prev ? { ...prev, ...updatedInvoiceData } : null);
      alert("Invoice updated with overall adjustments and calculated totals.");
    } catch (err) {
      console.error("Error saving invoice:", err);
      setError("Could not save invoice changes.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleProcessInvoice = async () => {
    if (!invoice || !invoiceItems.length) {
      setError("Invoice or items not loaded, or no items to process.");
      return;
    }
    if (invoice.status !== 'draft' && invoice.status !== 'pending_processing') {
      setError("Invoice can only be processed if status is 'draft' or 'pending_processing'.");
      return;
    }

    setIsSaving(true); 
    setError(null);

    try {
      const currentInvoiceState = await db.supplierInvoices.get(invoice.id);
      if (!currentInvoiceState || currentInvoiceState.is_deleted === 1) {
          setError("Invoice was deleted or not found before processing.");
          setIsSaving(false);
          return;
      }

      const overallDiscountAmount = currentInvoiceState.discount_amount || 0;
      const overallShippingCost = currentInvoiceState.shipping_cost || 0;
      const overallOtherCharges = currentInvoiceState.other_charges || 0;
      const overallVatAmount = currentInvoiceState.total_vat_amount || 0;


      let totalGrossOfAllItems = 0;
      const currentInvoiceItems = await db.supplierInvoiceItems.where({ supplier_invoice_id: invoice.id, is_deleted: 0 }).toArray();
      if (!currentInvoiceItems.length) {
          setError("No items found for this invoice to process.");
          setIsSaving(false);
          return;
      }

      currentInvoiceItems.forEach(item => {
        totalGrossOfAllItems += item.line_total_gross || (item.package_quantity * item.price_per_package_gross) || 0;
      });

      if (totalGrossOfAllItems === 0 && (overallDiscountAmount > 0 || overallShippingCost > 0 || overallOtherCharges > 0 || overallVatAmount > 0) ) {
          setError("Cannot apply overall costs/discounts/VAT as total gross of items is zero.");
          setIsSaving(false);
          return;
      }
      
      // This array will hold the final state of items after all apportionments
      const processedItemsData: SupplierInvoiceItem[] = []; 
      let totalSubtotalOfAllItemsForVATApportion = 0;

      // First pass: apportion discounts, shipping, other charges
      for (const item of currentInvoiceItems) {
        const itemGross = item.line_total_gross || (item.package_quantity * item.price_per_package_gross) || 0;
        let apportionedDiscount = 0;
        let apportionedShipping = 0; 
        let apportionedOther = 0;    

        if (totalGrossOfAllItems > 0) {
          if (overallDiscountAmount > 0) apportionedDiscount = (itemGross / totalGrossOfAllItems) * overallDiscountAmount;
          if (overallShippingCost > 0) apportionedShipping = (itemGross / totalGrossOfAllItems) * overallShippingCost;
          if (overallOtherCharges > 0) apportionedOther = (itemGross / totalGrossOfAllItems) * overallOtherCharges;
        }
        
        const lineSubtotalAfterPrimaryApportionment = itemGross - apportionedDiscount + apportionedShipping + apportionedOther;
        
        processedItemsData.push({
            ...item, // Start with existing item data
            apportioned_discount_amount: apportionedDiscount,
            apportioned_shipping_cost: apportionedShipping,
            apportioned_other_charges: apportionedOther,
            line_subtotal_after_apportionment: lineSubtotalAfterPrimaryApportionment,
            // line_total_net and vat_amount_on_line will be calculated in the next step
        });
        totalSubtotalOfAllItemsForVATApportion += lineSubtotalAfterPrimaryApportionment;
      }
      
      // Second pass: apportion VAT and finalize net totals
      const inventoryUpdates: (() => Promise<any>)[] = [];
      const finalItemUpdatesForDB: {id: string, changes: Partial<SupplierInvoiceItem>}[] = [];

      for (const processedItem of processedItemsData) {
        const preVatSubtotal = processedItem.line_subtotal_after_apportionment || 0;
        let apportionedVat = 0;

        if (overallVatAmount > 0 && totalSubtotalOfAllItemsForVATApportion > 0) {
          apportionedVat = (preVatSubtotal / totalSubtotalOfAllItemsForVATApportion) * overallVatAmount;
        }
        const finalItemNet = preVatSubtotal + apportionedVat;

        console.log(`[ProcessInvoice VAT Apportion] Item: ${processedItem.description_from_invoice}, preVatSubtotal: ${preVatSubtotal}, totalSubtotalForAllItemsForVAT: ${totalSubtotalOfAllItemsForVATApportion}, overallVat: ${overallVatAmount}, apportionedVat: ${apportionedVat}, finalItemNet: ${finalItemNet}`);
        
        finalItemUpdatesForDB.push({
            id: processedItem.id!,
            changes: {
                ...processedItem, // Keep previous apportionments
                vat_amount_on_line: apportionedVat,
                line_total_net: finalItemNet,
                _last_modified: Date.now(),
                _synced: 0,
            }
        });
        
        inventoryUpdates.push(async () => {
          const inventoryQuantity = processedItem.package_quantity * (processedItem.item_quantity_per_package || 1);
          const inventoryUnit = processedItem.item_unit_of_measure || processedItem.package_unit_of_measure || 'unit';
          
          const newInventoryId = crypto.randomUUID();
          const now = new Date().toISOString();
          const newInputInventory: InputInventory = {
            id: newInventoryId, name: processedItem.description_from_invoice, type: 'Purchased Goods', 
            supplier_id: currentInvoiceState.supplier_id, purchase_date: currentInvoiceState.invoice_date,
            supplier_invoice_number: currentInvoiceState.invoice_number,
            initial_quantity: inventoryQuantity, current_quantity: inventoryQuantity,
            quantity_unit: inventoryUnit, total_purchase_cost: finalItemNet, 
            qr_code_data: newInventoryId, 
            created_at: now, updated_at: now, _last_modified: Date.now(), _synced: 0, is_deleted: 0,
          };
          await db.inputInventory.add(newInputInventory);
          // Update the item in finalItemUpdatesForDB with the new input_inventory_id before it's saved in the transaction
          const itemToUpdate = finalItemUpdatesForDB.find(upd => upd.id === processedItem.id);
          if(itemToUpdate) {
            itemToUpdate.changes.input_inventory_id = newInventoryId;
          }
        });
      }

      await db.transaction('rw', db.supplierInvoiceItems, db.supplierInvoices, db.inputInventory, async () => {
        // First, create all inventory items and collect their IDs to update supplier invoice items
        // This order is important if supplierInvoiceItems need the input_inventory_id before their final update.
        // However, inventoryUpdates are async closures, so their execution order within transaction is managed by Dexie.
        // The current approach of updating itemToUpdate.changes.input_inventory_id inside the closure is fine.
        
        for (const invUpdate of inventoryUpdates) { // Create inventory items and prepare SII updates
          await invUpdate();
        }
        for (const update of finalItemUpdatesForDB) { // Save all final changes to SupplierInvoiceItems
          await db.supplierInvoiceItems.update(update.id, update.changes);
        }

        const finalUpdatedItemsForInvoiceSum = await db.supplierInvoiceItems.where({ supplier_invoice_id: currentInvoiceState.id, is_deleted: 0 }).toArray();
        let finalInvoiceTotalGross = 0;
        let finalInvoiceSubtotalAfterAllApportionment = 0; 
        let finalInvoiceTotalNetFromItems = 0;
        
        finalUpdatedItemsForInvoiceSum.forEach(it => {
          finalInvoiceTotalGross += it.line_total_gross || 0;
          // Subtotal for invoice header should be sum of item subtotals *before* item-level VAT is added to them
          finalInvoiceSubtotalAfterAllApportionment += it.line_subtotal_after_apportionment || 0; 
          finalInvoiceTotalNetFromItems += it.line_total_net || 0; // Sum of item final nets (VAT inclusive)
        });
        
        // The invoice's subtotal_after_adjustments is the sum of item (gross - disc + ship + other)
        const invoiceSubtotalForHeader = finalInvoiceSubtotalAfterAllApportionment;
        // The invoice's total_amount_net should be the sum of all final item net amounts
        const invoiceNetForHeader = finalInvoiceTotalNetFromItems; 

        const finalInvoiceUpdateData: Partial<SupplierInvoice> = {
          status: 'processed', 
          total_amount_gross: finalInvoiceTotalGross,
          discount_amount: currentInvoiceState.discount_amount,
          shipping_cost: currentInvoiceState.shipping_cost,
          other_charges: currentInvoiceState.other_charges,
          total_vat_amount: currentInvoiceState.total_vat_amount, // Overall VAT entered by user
          subtotal_after_adjustments: invoiceSubtotalForHeader, 
          total_amount_net: invoiceNetForHeader, 
          updated_at: new Date().toISOString(), _last_modified: Date.now(), _synced: 0,
        };
        await db.supplierInvoices.update(currentInvoiceState.id!, finalInvoiceUpdateData);
      });

      alert("Invoice processed! Item costs (including apportioned VAT) and inventory updated.");
      fetchInvoiceData(); 

    } catch (err) {
      console.error("Error processing invoice:", err);
      setError(`Processing failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleUnprocessInvoice = async () => {
    if (!invoice || invoice.status !== 'processed') {
      setError("Invoice cannot be unprocessed or is not in 'processed' state.");
      return;
    }
    if (!window.confirm("Are you sure you want to unprocess this invoice? This will soft-delete associated inventory batch records and revert item costs. This action can have significant data implications and may require manual adjustments if these inventory items have been used elsewhere.")) {
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      await db.transaction('rw', db.supplierInvoices, db.supplierInvoiceItems, db.inputInventory, async () => {
        const now = new Date().toISOString();
        const timestamp = Date.now();

        const itemsToRevert = await db.supplierInvoiceItems
          .where({ supplier_invoice_id: invoice.id!, is_deleted: 0 })
          .toArray();

        for (const item of itemsToRevert) {
          if (item.input_inventory_id) {
            await db.inputInventory.update(item.input_inventory_id, {
              is_deleted: 1, deleted_at: now, _last_modified: timestamp, _synced: 0,
            });
          }
          await db.supplierInvoiceItems.update(item.id!, {
            input_inventory_id: undefined, 
            apportioned_discount_amount: 0, apportioned_shipping_cost: 0, apportioned_other_charges: 0,
            vat_amount_on_line: 0, // Reset apportioned VAT
            line_subtotal_after_apportionment: item.line_total_gross, 
            line_total_net: item.line_total_gross, 
            _last_modified: timestamp, _synced: 0,
          });
        }
        
        await db.supplierInvoices.update(invoice.id!, {
          status: 'pending_processing', 
          updated_at: now, _last_modified: timestamp, _synced: 0,
        });
      });

      alert("Invoice has been unprocessed. Associated inventory batches were soft-deleted. Please review, make corrections, and re-process or save changes.");
      fetchInvoiceData(); 

    } catch (err) {
      console.error("Error unprocessing invoice:", err);
      setError(`Unprocessing failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsSaving(false);
    }
  };
  
  const handleOpenItemForm = (itemToEdit?: SupplierInvoiceItem | null) => {
    setEditingItem(itemToEdit || null);
    setShowAddItemForm(true);
    setError(null); 
  };

  const handleSaveInvoiceItem = async (
    formData: SupplierInvoiceItemFormData,
    itemIdToUpdate?: string
  ) => {
    if (!invoice) {
      setError("Cannot save item: Parent invoice not loaded.");
      return;
    }
    setError(null);
    setIsSaving(true);
    try {
      const now = new Date().toISOString();
      const lineTotalGross = formData.package_quantity * formData.price_per_package_gross;

      const itemDataPayload: Partial<Omit<SupplierInvoiceItem, 'id' | 'supplier_invoice_id' | 'created_at' | 'is_deleted'>> = {
        description_from_invoice: formData.description_from_invoice,
        package_quantity: formData.package_quantity,
        package_unit_of_measure: formData.package_unit_of_measure,
        item_quantity_per_package: formData.item_quantity_per_package,
        item_unit_of_measure: formData.item_unit_of_measure,
        price_per_package_gross: formData.price_per_package_gross,
        line_total_gross: lineTotalGross,
        line_total_net: formData.line_total_net, // This is preliminary from form (usually gross)
        notes: formData.notes,
        apportioned_discount_amount: editingItem?.apportioned_discount_amount || 0,
        apportioned_shipping_cost: editingItem?.apportioned_shipping_cost || 0,
        apportioned_other_charges: editingItem?.apportioned_other_charges || 0,
        vat_amount_on_line: editingItem?.vat_amount_on_line || 0,
        line_subtotal_after_apportionment: editingItem?.line_subtotal_after_apportionment || lineTotalGross, // Recalculated on process
        updated_at: now,
        _last_modified: Date.now(),
        _synced: 0,
      };

      if (itemIdToUpdate) { 
        await db.supplierInvoiceItems.update(itemIdToUpdate, itemDataPayload);
      } else { 
        const newItemId = crypto.randomUUID();
        const newItemFull: SupplierInvoiceItem = { 
          id: newItemId,
          supplier_invoice_id: invoice.id,
          description_from_invoice: formData.description_from_invoice,
          package_quantity: formData.package_quantity,
          package_unit_of_measure: formData.package_unit_of_measure,
          item_quantity_per_package: formData.item_quantity_per_package,
          item_unit_of_measure: formData.item_unit_of_measure,
          price_per_package_gross: formData.price_per_package_gross,
          line_total_gross: lineTotalGross,
          line_total_net: formData.line_total_net, 
          apportioned_discount_amount: 0,
          apportioned_shipping_cost: 0,
          apportioned_other_charges: 0,
          vat_amount_on_line: 0,
          line_subtotal_after_apportionment: lineTotalGross,
          notes: formData.notes,
          created_at: now,
          updated_at: now,
          _last_modified: Date.now(),
          _synced: 0,
          is_deleted: 0,
        };
        await db.supplierInvoiceItems.add(newItemFull);
      }
      
      setShowAddItemForm(false);
      setEditingItem(null);
      await fetchInvoiceData(); 

    } catch (err) {
      console.error("Failed to save supplier invoice item:", err);
      setError(`Failed to save item: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsSaving(false);
    }
  };

  console.log("[EditPage] Rendering. isLoading:", isLoading, "invoice state:", invoice ? `ID: ${invoice.id}, Status: ${invoice.status}` : null, "error state:", error);

  if (isLoading) {
    console.log("[EditPage] Rendering: Loading UI");
    return <div className="p-6"><h1 className="text-2xl font-semibold text-gray-900">Edit Supplier Invoice</h1><p>Loading invoice details...</p></div>;
  }

  if (error && !invoice) { 
    console.log("[EditPage] Rendering: Error UI (error present and no invoice)");
    return <div className="p-6"><h1 className="text-2xl font-semibold text-gray-900">Error</h1><p className="text-red-500">{error}</p><Link href="/inventory/supplier-invoices" className="text-blue-600 hover:underline">Back to list</Link></div>;
  }

  if (!invoice) { 
    console.log("[EditPage] Rendering: Invoice Not Found UI (invoice is null/undefined)");
    return <div className="p-6"><h1 className="text-2xl font-semibold text-gray-900">Invoice Not Found</h1><p>The requested supplier invoice could not be found or you might not have permission to view it.</p><Link href="/inventory/supplier-invoices" className="text-blue-600 hover:underline">Back to list</Link></div>;
  }
  
  console.log("[EditPage] Rendering: Main content UI for invoice ID:", invoice.id);
  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">
          Edit Supplier Invoice: {invoice.invoice_number}
        </h1>
        <p className="text-sm text-gray-600">Supplier: {supplierName}</p>
        <p className="text-sm text-gray-600">Invoice Date: {new Date(invoice.invoice_date).toLocaleDateString()}</p>
        <p className="text-sm text-gray-600">Status: <span className="font-medium">{invoice.status}</span></p>
      </header>

      {error && <p className="text-red-500 bg-red-100 p-2 rounded mb-4">{error}</p>}

      <div className="bg-white shadow sm:rounded-lg p-6 mb-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Invoice Header</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <p><strong>Invoice Number:</strong> {invoice.invoice_number}</p>
            <p><strong>Invoice Date:</strong> {new Date(invoice.invoice_date).toLocaleDateString()}</p>
            <p><strong>Supplier:</strong> {supplierName}</p>
            <p><strong>Status:</strong> {invoice.status}</p>
            <p><strong>Total Gross (from items):</strong> €{(invoice.total_amount_gross || 0).toFixed(2)}</p>
            <p><strong>Subtotal (after disc/charges):</strong> €{(invoice.subtotal_after_adjustments || 0).toFixed(2)}</p>
            <p><strong>VAT Amount:</strong> €{(invoice.total_vat_amount || 0).toFixed(2)}</p>
            <p className="font-semibold"><strong>Total Net Amount:</strong> €{(invoice.total_amount_net || 0).toFixed(2)}</p>
            
            {(invoice.status === 'draft' || invoice.status === 'pending_processing') && (
              <div className="md:col-span-2">
                <label htmlFor="invoiceNotes" className="block text-sm font-medium text-gray-700">Invoice Notes</label>
                <textarea
                  id="invoiceNotes"
                  rows={2}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
                  value={invoice.notes || ''}
                  onChange={(e) => setInvoice(prev => prev ? {...prev, notes: e.target.value} : null)}
                  disabled={isSaving}
                />
              </div>
            )}
        </div>
      </div>

      <div className="bg-white shadow sm:rounded-lg p-6 mb-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-medium text-gray-900">Invoice Items</h2>
          {(invoice.status === 'draft' || invoice.status === 'pending_processing') && !showAddItemForm && (
            <button 
              onClick={() => handleOpenItemForm(null)} 
              className="inline-flex items-center justify-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700"
              disabled={isSaving}
            >
              Add Item
            </button>
          )}
        </div>
        {showAddItemForm && (
          <div className="my-4 p-4 border border-gray-300 rounded-md bg-gray-50">
            <SupplierInvoiceItemForm 
              initialData={editingItem}
              onSubmit={handleSaveInvoiceItem} 
              onCancel={() => { setShowAddItemForm(false); setEditingItem(null); setError(null); }} 
              isSubmitting={isSaving} 
            />
          </div>
        )}

        {invoiceItems.length === 0 && !showAddItemForm ? (
          <p>No items added to this invoice yet.</p>
        ) : (
          <ul className="divide-y divide-gray-200">
            {invoiceItems.map(item => (
              <li key={item.id} className="py-3 flex justify-between items-center">
                <div>
                  <p className="font-medium">{item.description_from_invoice}</p>
                  <p className="text-sm text-gray-600">
                    Pkgs: {item.package_quantity} {item.package_unit_of_measure || ''}
                    {item.item_quantity_per_package && item.item_unit_of_measure ? 
                      ` (${item.item_quantity_per_package} ${item.item_unit_of_measure}/pkg)` : ''}
                     @ €{(item.price_per_package_gross || 0).toFixed(2)}/pkg
                  </p>
                  <p className="text-sm text-gray-600">Line Total (Gross): €{(item.line_total_gross || 0).toFixed(2)}</p>
                  <p className="text-sm text-gray-500">Apportioned Discount: €{(item.apportioned_discount_amount || 0).toFixed(2)}</p>
                  <p className="text-sm text-gray-500">Apportioned Shipping: €{(item.apportioned_shipping_cost || 0).toFixed(2)}</p>
                  <p className="text-sm text-gray-500">Apportioned Other: €{(item.apportioned_other_charges || 0).toFixed(2)}</p>
                  <p className="text-sm text-gray-600">Line Subtotal (after app.): €{(item.line_subtotal_after_apportionment || 0).toFixed(2)}</p>
                  <p className="text-sm text-gray-500">Apportioned VAT: €{(item.vat_amount_on_line || 0).toFixed(2)}</p>
                  <p className="text-sm font-semibold text-gray-700">Line Total (Net): €{(item.line_total_net || 0).toFixed(2)}</p>
                </div>
                {(invoice?.status === 'draft' || invoice?.status === 'pending_processing') && (
                  <div className="space-x-2">
                    <button 
                      onClick={() => handleOpenItemForm(item)}
                      className="text-indigo-600 hover:text-indigo-900 text-sm"
                      disabled={isSaving}
                    >
                      Edit
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
      
      {(invoice.status === 'draft' || invoice.status === 'pending_processing') && (
        <div className="bg-white shadow sm:rounded-lg p-6 mb-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Overall Invoice Adjustments</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label htmlFor="overallDiscount" className="block text-sm font-medium text-gray-700">Overall Discount Amount (€)</label>
              <input
                type="number" id="overallDiscount" name="overallDiscount" step="any"
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
                value={invoice.discount_amount || ''}
                onChange={(e) => setInvoice(prev => prev ? {...prev, discount_amount: e.target.value === '' ? undefined : parseFloat(e.target.value)} : null)}
                disabled={isSaving}
              />
            </div>
            <div>
              <label htmlFor="shippingCost" className="block text-sm font-medium text-gray-700">Shipping Cost (€)</label>
              <input
                type="number" id="shippingCost" name="shippingCost" step="any"
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
                value={invoice.shipping_cost || ''}
                onChange={(e) => setInvoice(prev => prev ? {...prev, shipping_cost: e.target.value === '' ? undefined : parseFloat(e.target.value)} : null)}
                disabled={isSaving}
              />
            </div>
            <div>
              <label htmlFor="totalVatAmount" className="block text-sm font-medium text-gray-700">Total VAT Amount (€)</label>
              <input
                type="number" id="totalVatAmount" name="totalVatAmount" step="any"
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
                value={invoice.total_vat_amount || ''}
                onChange={(e) => setInvoice(prev => prev ? {...prev, total_vat_amount: e.target.value === '' ? undefined : parseFloat(e.target.value)} : null)}
                disabled={isSaving}
              />
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-3">Note: These values will be used to calculate final net totals and apportion costs to items when the invoice is processed.</p>
        </div>
      )}
      
      {(invoice.status === 'draft' || invoice.status === 'pending_processing') && (
        <div className="bg-white shadow sm:rounded-lg p-6 mb-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Processing</h2>
          <p className="text-gray-500 mt-2">Click "Process Invoice" to finalize costs, apportion them to items, and update inventory records. This action cannot be easily undone.</p>
        </div>
      )}

      <div className="flex justify-end space-x-3 pt-4">
        <Link href="/inventory/supplier-invoices"
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md border border-gray-300"
        >
          Back to List
        </Link>
        <button
          type="button"
          onClick={handleSaveInvoice} 
          disabled={isSaving || invoice.status === 'processed' || invoice.status === 'paid' || invoice.status === 'cancelled'}
          className="px-4 py-2 text-sm font-medium text-white bg-yellow-500 hover:bg-yellow-600 rounded-md shadow-sm disabled:opacity-50"
        >
          {isSaving ? 'Saving...' : 'Save Draft / Update Totals'}
        </button>
        {(invoice.status === 'draft' || invoice.status === 'pending_processing') && (
          <button
            type="button"
            onClick={handleProcessInvoice}
            disabled={isSaving || !invoiceItems.length}
            className="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-md shadow-sm disabled:opacity-50"
          >
            {isSaving ? 'Processing...' : 'Process Invoice & Apportion Costs'}
          </button>
        )}
        {invoice.status === 'processed' && (
          <button
            type="button"
            onClick={handleUnprocessInvoice}
            disabled={isSaving}
            className="px-4 py-2 text-sm font-medium text-white bg-orange-500 hover:bg-orange-600 rounded-md shadow-sm disabled:opacity-50"
          >
            {isSaving ? 'Unprocessing...' : 'Unprocess Invoice (Re-open)'}
          </button>
        )}
      </div>
    </div>
  );
}