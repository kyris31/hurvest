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
  // These are handled by the processing logic or are not directly set by the item form in this page
  | 'apportioned_discount_amount'
  | 'apportioned_shipping_cost'
  | 'apportioned_other_charges'
  | 'line_subtotal_after_apportionment'
  // line_total_net, line_total_gross, item_vat_percentage, item_vat_amount,
  // item_discount_type, item_discount_value, cost_after_item_adjustments
  // are expected from the form or are part of SupplierInvoiceItem
>;
// The form now submits a more complete SupplierInvoiceItem-like object.

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

  // Memoized calculations for display and saving
  const calculatedTotals = React.useMemo(() => {
    if (!invoiceItems || invoiceItems.length === 0) {
      return { itemsGross: 0, itemsVAT: 0, itemsNet: 0 };
    }
    const itemsGross = invoiceItems.reduce((sum, item) => sum + (item.line_total_gross || 0), 0);
    const itemsVAT = invoiceItems.reduce((sum, item) => sum + (item.item_vat_amount || 0), 0);
    // itemsNet should be sum of item.line_total_net, which already includes item-specific VAT and discounts
    const itemsNet = invoiceItems.reduce((sum, item) => sum + (item.line_total_net || 0), 0);
    return { itemsGross, itemsVAT, itemsNet };
  }, [invoiceItems]);

  // These are for the header display, taking into account invoice-level adjustments
  const displayTotalGross = calculatedTotals.itemsGross;
  const displayTotalVAT = calculatedTotals.itemsVAT + (invoice?.total_vat_amount || 0); // If invoice.total_vat_amount is an OVERALL adjustment
                                                                                      // For now, let's assume header VAT is sum of item VATs for display
                                                                                      // and invoice.total_vat_amount is for overall adjustments.
                                                                                      // The user feedback implies header VAT should be sum of item VATs.
  
  const displaySubtotalAfterDiscCharges = displayTotalGross
                                          - (invoice?.discount_amount || 0)
                                          + (invoice?.shipping_cost || 0)
                                          + (invoice?.other_charges || 0);
                                          
  const displayTotalNet = displaySubtotalAfterDiscCharges + calculatedTotals.itemsVAT; // Sum of item VATs for display

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
      // Use the memoized totals for saving
      const currentCalculatedTotalGross = calculatedTotals.itemsGross;
      const currentCalculatedTotalItemVAT = calculatedTotals.itemsVAT;

      const discountAmount = invoice.discount_amount || 0;
      const shippingCost = invoice.shipping_cost || 0;
      const otherCharges = invoice.other_charges || 0;
      
      // For saving, total_vat_amount on the invoice should be the sum of item VATs.
      // Any overall invoice VAT adjustment is not explicitly handled by this simple save,
      // that's part of the 'Process Invoice' complexity or would need a dedicated field.
      const finalVatToSave = currentCalculatedTotalItemVAT;

      const subtotalAfterDiscCharges = currentCalculatedTotalGross - discountAmount + shippingCost + otherCharges;
      const finalTotalNetToSave = subtotalAfterDiscCharges + finalVatToSave;

      const updatedInvoiceData: Partial<SupplierInvoice> = {
        notes: invoice.notes,
        status: (invoice.status === 'draft' && invoiceItems.length > 0) ? 'pending_processing' : invoice.status,
        discount_amount: invoice.discount_amount, // Keep user-entered overall adjustments
        shipping_cost: invoice.shipping_cost,
        other_charges: invoice.other_charges,
        total_vat_amount: finalVatToSave, // Save the sum of item VATs
        total_amount_gross: currentCalculatedTotalGross,
        subtotal_after_adjustments: subtotalAfterDiscCharges,
        total_amount_net: finalTotalNetToSave,
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

      // First pass: Calculate base for apportionment (cost_after_item_adjustments)
      // and then apportion invoice-level discounts, shipping, other charges.
      for (const item of currentInvoiceItems) {
        // Use subtotal_before_item_vat as the base for apportioning non-VAT invoice level costs.
        // This value is calculated and saved by SupplierInvoiceItemForm.
        // Fallback if subtotal_before_item_vat is not present (e.g., for older records before this field was added).
        let baseCostForItemApportionment = item.subtotal_before_item_vat;
        if (baseCostForItemApportionment === undefined || baseCostForItemApportionment === null) {
            // Fallback calculation for older items: item gross - item discount
            const itemGross = item.line_total_gross || 0;
            let itemDiscountAmount = 0;
            if (item.item_discount_type === 'Amount' && item.item_discount_value) {
                itemDiscountAmount = item.item_discount_value;
            } else if (item.item_discount_type === 'Percentage' && item.item_discount_value) {
                itemDiscountAmount = itemGross * (item.item_discount_value / 100);
            }
            baseCostForItemApportionment = itemGross - itemDiscountAmount;
        }
        baseCostForItemApportionment = baseCostForItemApportionment ?? 0;

        let apportionedInvDiscount = 0;
        let apportionedInvShipping = 0;
        let apportionedInvOther = 0;

        // Apportion invoice-level adjustments based on the item's *original gross value*
        // to maintain fairness in distribution, not its already discounted/VATed value.
        const itemOriginalGross = item.line_total_gross || 0;
        if (totalGrossOfAllItems > 0 && itemOriginalGross > 0) {
          if (overallDiscountAmount > 0) apportionedInvDiscount = (itemOriginalGross / totalGrossOfAllItems) * overallDiscountAmount;
          if (overallShippingCost > 0) apportionedInvShipping = (itemOriginalGross / totalGrossOfAllItems) * overallShippingCost;
          if (overallOtherCharges > 0) apportionedInvOther = (itemOriginalGross / totalGrossOfAllItems) * overallOtherCharges;
        }
        
        // The subtotal for VAT apportionment starts with the item's cost after its own adjustments,
        // then applies the apportioned invoice-level (non-VAT) adjustments.
        const lineSubtotalForVatApportionment = baseCostForItemApportionment - apportionedInvDiscount + apportionedInvShipping + apportionedInvOther;
        
        processedItemsData.push({
            ...item,
            apportioned_discount_amount: apportionedInvDiscount, // These are INVOICE level apportionments
            apportioned_shipping_cost: apportionedInvShipping,
            apportioned_other_charges: apportionedInvOther,
            line_subtotal_after_apportionment: lineSubtotalForVatApportionment,
            // item_vat_amount is already on the item from the form.
            // The vat_amount_on_line in the DB was for the *apportioned invoice VAT*.
            // We will calculate and store the apportioned invoice VAT separately if needed,
            // or simply add it to the line_total_net.
        });
        totalSubtotalOfAllItemsForVATApportion += lineSubtotalForVatApportionment;
      }
      
      // Second pass: apportion INVOICE-LEVEL VAT and finalize net totals
      const inventoryUpdates: (() => Promise<any>)[] = [];
      const finalItemUpdatesForDB: {id: string, changes: Partial<SupplierInvoiceItem>}[] = [];

      for (const processedItem of processedItemsData) {
        // processedItem.line_subtotal_after_apportionment already includes item's own VAT (via cost_after_item_adjustments)
        // and apportioned invoice-level discounts/shipping/other charges.
        // Now we only need to add the apportioned INVOICE-LEVEL VAT.
        const subtotalBeforeInvoiceVat = processedItem.line_subtotal_after_apportionment || 0;
        let apportionedInvoiceVat = 0;

        if (overallVatAmount > 0 && totalSubtotalOfAllItemsForVATApportion > 0) {
          // Apportion the INVOICE's total_vat_amount based on the item's subtotal contribution
          apportionedInvoiceVat = (subtotalBeforeInvoiceVat / totalSubtotalOfAllItemsForVATApportion) * overallVatAmount;
        }
        
        // The final net cost for the item includes its own cost (with its own VAT),
        // plus/minus apportioned invoice-level adjustments, plus apportioned invoice-level VAT.
        const finalItemNet = subtotalBeforeInvoiceVat + apportionedInvoiceVat;

        console.log(`[ProcessInvoice VAT Apportion] Item: ${processedItem.description_from_invoice}, subtotalBeforeInvoiceVat: ${subtotalBeforeInvoiceVat}, totalSubtotalForAllItemsForVAT: ${totalSubtotalOfAllItemsForVATApportion}, overallInvoiceVat: ${overallVatAmount}, apportionedInvoiceVat: ${apportionedInvoiceVat}, finalItemNet: ${finalItemNet}`);
        
        finalItemUpdatesForDB.push({
            id: processedItem.id!,
            changes: {
                // Spread processedItem to keep its calculated fields like apportioned_discount_amount etc.
                // and its original item-specific VAT details.
                ...processedItem,
                // item_vat_amount (item's own VAT) is already on processedItem from its initial save.
                // line_subtotal_after_apportionment is now correctly BEFORE any VAT.
                line_total_net: finalItemNet, // This is (subtotal_after_app_excl_vat + item_vat + apportioned_invoice_vat)
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
          // line_subtotal_after_apportionment is now pre-VAT, so this sum is correct for a pre-VAT subtotal.
          finalInvoiceSubtotalAfterAllApportionment += it.line_subtotal_after_apportionment || 0;
          finalInvoiceTotalNetFromItems += it.line_total_net || 0; // Sum of item final nets (all VAT inclusive)
        });
        
        // This is the sum of item subtotals after item discounts and after apportioned invoice-level non-VAT costs. It's PRE-VAT.
        const invoiceSubtotalForHeader = finalInvoiceSubtotalAfterAllApportionment;
        
        // The invoice's total_vat_amount should be the sum of all item.item_vat_amount PLUS any overallVatAmount entered at invoice level
        // For now, the overallVatAmount is used for apportionment. The sum of item_vat_amounts is what the header should reflect if it's a sum.
        // Let's recalculate the sum of actual item VATs for storage on the invoice header, plus the apportioned overall.
        // This part is tricky: if overallVatAmount is an override, it's used. If it's an addition, it's added.
        // The current logic uses overallVatAmount for apportionment.
        // The display variables `calculatedTotals.itemsVAT` already sum up `item.item_vat_amount`.
        // Let's ensure the stored `total_vat_amount` on the invoice reflects the sum of item VATs + any overall invoice VAT that was apportioned.
        // The `finalInvoiceTotalNetFromItems` already includes all VAT.
        // So, total VAT = finalInvoiceTotalNetFromItems - invoiceSubtotalForHeader
        const calculatedTotalVatForInvoice = finalInvoiceTotalNetFromItems - invoiceSubtotalForHeader;


        const finalInvoiceUpdateData: Partial<SupplierInvoice> = {
          status: 'processed',
          total_amount_gross: finalInvoiceTotalGross, // Sum of item gross
          discount_amount: currentInvoiceState.discount_amount, // Overall invoice discount
          shipping_cost: currentInvoiceState.shipping_cost,     // Overall invoice shipping
          other_charges: currentInvoiceState.other_charges,   // Overall invoice other charges
          total_vat_amount: calculatedTotalVatForInvoice, // Sum of all applied VAT (item + apportioned invoice)
          subtotal_after_adjustments: invoiceSubtotalForHeader, // Sum of item subtotals after item disc & non-VAT invoice apportionments
          total_amount_net: finalInvoiceTotalNetFromItems, // Sum of item final net amounts
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
            item_discount_type: item.item_discount_type, // Keep original item discounts
            item_discount_value: item.item_discount_value,
            item_vat_percentage: item.item_vat_percentage,
            item_vat_amount: item.item_vat_amount,
            cost_after_item_adjustments: item.cost_after_item_adjustments,
            apportioned_discount_amount: 0, // Reset INVOICE level apportionments
            apportioned_shipping_cost: 0,
            apportioned_other_charges: 0,
            // line_subtotal_after_apportionment should revert to cost_after_item_adjustments
            line_subtotal_after_apportionment: item.cost_after_item_adjustments || item.line_total_gross,
            // line_total_net should also revert to cost_after_item_adjustments
            line_total_net: item.cost_after_item_adjustments || item.line_total_gross,
            _last_modified: timestamp, _synced: 0,
          });
        }
        
        await db.supplierInvoices.update(invoice.id!, {
          status: 'pending_processing',
          // Optionally re-calculate invoice totals based on reverted items if needed here
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
      // formData from SupplierInvoiceItemForm now contains more calculated fields
      
      const itemDataPayload: Partial<Omit<SupplierInvoiceItem, 'id' | 'supplier_invoice_id' | 'created_at' | 'is_deleted'>> = {
        description_from_invoice: formData.description_from_invoice,
        package_quantity: formData.package_quantity,
        package_unit_of_measure: formData.package_unit_of_measure,
        item_quantity_per_package: formData.item_quantity_per_package,
        item_unit_of_measure: formData.item_unit_of_measure,
        price_per_package_gross: formData.price_per_package_gross,
        line_total_gross: formData.line_total_gross, // From form
        item_discount_type: formData.item_discount_type,
        item_discount_value: formData.item_discount_value,
        item_vat_percentage: formData.item_vat_percentage,
        item_vat_amount: formData.item_vat_amount, // From form
        cost_after_item_adjustments: formData.cost_after_item_adjustments, // From form (subtotal_before_item_vat + item_vat_amount)
        subtotal_before_item_vat: formData.subtotal_before_item_vat, // From form
        line_total_net: formData.cost_after_item_adjustments, // Preliminary net (includes item VAT), will be finalized on process
        notes: formData.notes,
        // Apportioned amounts are reset/recalculated during process, so initialize to 0 or keep existing if editing before re-process
        apportioned_discount_amount: editingItem?.apportioned_discount_amount || 0,
        apportioned_shipping_cost: editingItem?.apportioned_shipping_cost || 0,
        apportioned_other_charges: editingItem?.apportioned_other_charges || 0,
        // This should be the subtotal before any VAT, after item discount, before invoice-level apportionments.
        // It will be recalculated during process. For initial save/edit before process, it's subtotal_before_item_vat.
        line_subtotal_after_apportionment: editingItem?.line_subtotal_after_apportionment !== undefined ? editingItem.line_subtotal_after_apportionment : formData.subtotal_before_item_vat,
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
          line_total_gross: formData.line_total_gross,
          item_discount_type: formData.item_discount_type,
          item_discount_value: formData.item_discount_value,
          item_vat_percentage: formData.item_vat_percentage,
          item_vat_amount: formData.item_vat_amount,
          cost_after_item_adjustments: formData.cost_after_item_adjustments, // (subtotal_before_item_vat + item_vat_amount)
          subtotal_before_item_vat: formData.subtotal_before_item_vat,
          line_total_net: formData.cost_after_item_adjustments, // Preliminary (includes item VAT)
          apportioned_discount_amount: 0,
          apportioned_shipping_cost: 0,
          apportioned_other_charges: 0,
          line_subtotal_after_apportionment: formData.subtotal_before_item_vat, // Preliminary (is pre-VAT)
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
            <p><strong>Total Gross (from items):</strong> €{(displayTotalGross || 0).toFixed(2)}</p>
            <p><strong>Subtotal (after disc/charges):</strong> €{(displaySubtotalAfterDiscCharges || 0).toFixed(2)}</p>
            <p><strong>VAT Amount:</strong> €{(calculatedTotals.itemsVAT || 0).toFixed(2)}</p>
            <p className="font-semibold"><strong>Total Net Amount:</strong> €{(displayTotalNet || 0).toFixed(2)}</p>
            
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
                  <p className="text-sm text-gray-500">Item VAT: €{(item.item_vat_amount || 0).toFixed(2)}</p>
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