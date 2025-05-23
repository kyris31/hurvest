'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { db, Sale, SaleItem, Customer, Invoice } from '@/lib/db'; // Removed unused HarvestLog etc. for this page directly
import SaleList from '@/components/SaleList';
import SaleForm from '@/components/SaleForm';
import RecordPaymentModal from '@/components/RecordPaymentModal';
import { downloadInvoicePDF } from '@/lib/invoiceGenerator';
import { exportSalesToCSV, exportSalesToPDF } from '@/lib/reportUtils';
import { requestPushChanges } from '@/lib/sync';

export default function SalesPage() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [saleItems, setSaleItems] = useState<SaleItem[]>([]); // Still needed for SaleList calculations
  const [customers, setCustomers] = useState<Customer[]>([]); // Still needed for SaleList
  // These are fetched but not directly passed to SaleList if it doesn't use them.
  // const [harvestLogs, setHarvestLogs] = useState<HarvestLog[]>([]);
  // const [plantingLogs, setPlantingLogs] = useState<PlantingLog[]>([]);
  // const [seedBatches, setSeedBatches] = useState<SeedBatch[]>([]);
  // const [crops, setCrops] = useState<Crop[]>([]);
  
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingSale, setEditingSale] = useState<(Sale & { items?: SaleItem[] }) | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [showRecordPaymentModal, setShowRecordPaymentModal] = useState(false);
  const [saleToRecordPaymentFor, setSaleToRecordPaymentFor] = useState<Sale | null>(null);
  const [isRecordingPayment, setIsRecordingPayment] = useState(false);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [
        salesData,
        saleItemsData,
        customersData,
        // harvestLogsData, // Not directly passed to SaleList if unused by it
        // plantingLogsData,
        // seedBatchesData,
        // cropsData
      ] = await Promise.all([
        db.sales.orderBy('sale_date').filter(s => s.is_deleted === 0).reverse().toArray(),
        db.saleItems.where('is_deleted').equals(0).toArray(),
        db.customers.orderBy('name').filter(c => c.is_deleted === 0).toArray(),
        // db.harvestLogs.orderBy('harvest_date').filter(h => h.is_deleted === 0).reverse().toArray(),
        // db.plantingLogs.orderBy('planting_date').filter(p => p.is_deleted === 0).reverse().toArray(),
        // db.seedBatches.orderBy('_last_modified').filter(sb => sb.is_deleted === 0).reverse().toArray(),
        // db.crops.orderBy('name').filter(c => c.is_deleted === 0).toArray(),
      ]);
      setSales(salesData);
      setSaleItems(saleItemsData);
      setCustomers(customersData);
      // setHarvestLogs(harvestLogsData);
      // setPlantingLogs(plantingLogsData);
      // setSeedBatches(seedBatchesData);
      // setCrops(cropsData);
      setError(null);
    } catch (err) {
      console.error("Failed to fetch sales data:", err);
      setError("Failed to load sales or related data. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleFormSubmit = async (
    saleDataFromForm: Omit<Sale, 'id' | '_synced' | '_last_modified' | 'created_at' | 'updated_at' | 'total_amount' | 'payment_history'>, 
    itemsData: Omit<SaleItem, 'id' | 'sale_id' | '_synced' | '_last_modified' | 'created_at' | 'updated_at'>[]
  ) => {
    setIsSubmitting(true);
    setError(null);
    const saleId = editingSale?.id || crypto.randomUUID();
    const now = new Date().toISOString();
    const currentTimestamp = Date.now();

    let calculatedTotalAmount = 0;
    for (const item of itemsData) {
        const quantity = Number(item.quantity_sold);
        const price = Number(item.price_per_unit);
        let itemTotal = 0;
        if (!isNaN(quantity) && !isNaN(price)) {
            itemTotal = quantity * price;
            if (item.discount_type && (item.discount_value !== null && item.discount_value !== undefined)) {
                const discountValue = Number(item.discount_value);
                if (item.discount_type === 'Amount') {
                    itemTotal -= discountValue;
                } else if (item.discount_type === 'Percentage') {
                    itemTotal -= itemTotal * (discountValue / 100);
                }
            }
        }
        calculatedTotalAmount += Math.max(0, itemTotal);
    }

    try {
      await db.transaction('rw', db.sales, db.saleItems, db.invoices, async () => {
        if (editingSale) {
          const itemsToSoftDelete = await db.saleItems.where('sale_id').equals(editingSale.id).toArray();
          for (const item of itemsToSoftDelete) {
            await db.markForSync('saleItems', item.id, {}, true);
          }
          const invoiceToSoftDelete = await db.invoices.where('sale_id').equals(editingSale.id).first();
          if (invoiceToSoftDelete) {
            await db.markForSync('invoices', invoiceToSoftDelete.id, {}, true);
          }
          
          // Construct only the changes for the update operation
          const saleChanges: Partial<Sale> = {
            ...saleDataFromForm, // contains payment_method, payment_status, amount_paid from form
            total_amount: calculatedTotalAmount,
            updated_at: now,
            _synced: 0,
            _last_modified: currentTimestamp,
            is_deleted: 0, // Ensure it's not marked deleted if editing
            deleted_at: undefined,
            // payment_history is managed by RecordPaymentModal, not directly here for edits unless specifically designed
          };
          await db.sales.update(editingSale.id, saleChanges);
        } else { // Adding new sale
            const newSale: Sale = {
              id: saleId,
              ...saleDataFromForm,
              total_amount: calculatedTotalAmount,
              payment_history: (saleDataFromForm.payment_method && saleDataFromForm.amount_paid && saleDataFromForm.amount_paid > 0) ? 
                                [{ date: saleDataFromForm.sale_date, amount: Number(saleDataFromForm.amount_paid), method: saleDataFromForm.payment_method, notes: 'Initial payment with sale' }] 
                                : [], // Initialize payment_history
              created_at: now,
              updated_at: now,
              _synced: 0,
              _last_modified: currentTimestamp,
              is_deleted: 0,
              deleted_at: undefined,
            };
            await db.sales.add(newSale);
          }

          for (const item of itemsData) {
            const newItemId = crypto.randomUUID();
            await db.saleItems.add({
              id: newItemId,
              sale_id: saleId,
              ...item,
              created_at: now,
              updated_at: now,
              _synced: 0,
              _last_modified: currentTimestamp,
              is_deleted: 0,
              deleted_at: undefined,
            });
          }
          
          const invoiceNumber = `INV-${new Date().getFullYear()}-${String(currentTimestamp).slice(-6)}`;
          const newInvoice: Invoice = {
              id: crypto.randomUUID(),
              sale_id: saleId,
              invoice_number: invoiceNumber,
              invoice_date: saleDataFromForm.sale_date,
              status: 'Draft',
              pdf_url: `placeholder_invoice_${saleId}.pdf`,
              created_at: now,
              updated_at: now,
              _synced: 0,
              _last_modified: currentTimestamp,
              is_deleted: 0,
              deleted_at: undefined,
          };
          await db.invoices.add(newInvoice);
        console.log(`Invoice ${invoiceNumber} created locally for sale ${saleId}`);
      }); 
      
      downloadInvoicePDF(saleId).catch(pdfError => {
        console.error("Error auto-downloading invoice after sale:", pdfError);
      });

      console.log("SalesPage: Attempting immediate push after form submit...");
      const pushResult = await requestPushChanges();
      if (pushResult.success) {
        console.log("SalesPage: Immediate push successful.");
      } else {
        console.error("SalesPage: Immediate push failed.", pushResult.errors);
      }

      await fetchData();
      setShowForm(false);
      setEditingSale(null);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Failed to save sale. Please try again.";
      console.error("Failed to save sale:", err);
      setError(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = async (saleToEdit: Sale) => {
    const itemsForSale = await db.saleItems
        .where('sale_id').equals(saleToEdit.id)
        .and(item => item.is_deleted !== 1)
        .toArray();
    setEditingSale({ ...saleToEdit, items: itemsForSale });
    setShowForm(true);
    setError(null);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm("Are you sure you want to delete this sale? This will also delete associated sale items and invoice. This action cannot be undone locally.")) {
      setIsDeleting(id);
      setError(null);
      try {
        await db.transaction('rw', db.sales, db.saleItems, db.invoices, async () => {
            const itemsToSoftDelete = await db.saleItems.where('sale_id').equals(id).toArray();
            for (const item of itemsToSoftDelete) {
              await db.markForSync('saleItems', item.id, {}, true);
            }
            const invoiceToSoftDelete = await db.invoices.where('sale_id').equals(id).first();
            if (invoiceToSoftDelete) {
              await db.markForSync('invoices', invoiceToSoftDelete.id, {}, true);
            }
            await db.markForSync('sales', id, {}, true);
        });
        
        console.log("SalesPage: Attempting immediate push after delete operation...");
        const deletePushResult = await requestPushChanges();
        if (deletePushResult.success) {
          console.log("SalesPage: Immediate push after delete successful.");
        } else {
          console.error("SalesPage: Immediate push after delete failed.", deletePushResult.errors);
        }
        await fetchData();
      } catch (err) {
        console.error("Failed to delete sale:", err);
        setError("Failed to delete sale.");
      } finally {
        setIsDeleting(null);
      }
    }
  };
  
  const handleViewInvoice = async (saleId: string) => {
    try {
        await downloadInvoicePDF(saleId);
    } catch (error) {
        console.error("Failed to download invoice:", error);
        alert("Failed to generate or download invoice. See console for details.");
    }
  };

  const handleOpenRecordPaymentModal = (sale: Sale) => {
    setSaleToRecordPaymentFor(sale);
    setShowRecordPaymentModal(true);
    setError(null);
  };

  const handleRecordPaymentSubmit = async (
    saleId: string, 
    paymentDetails: { date: string; amount: number; method: Sale['payment_method']; notes?: string }
  ) => {
    setIsRecordingPayment(true);
    setError(null);
    try {
      const saleToUpdate = await db.sales.get(saleId);
      if (!saleToUpdate) {
        throw new Error("Sale not found to record payment.");
      }

      const newPaymentEntry = {
        date: paymentDetails.date,
        amount: Number(paymentDetails.amount),
        method: paymentDetails.method,
        notes: paymentDetails.notes,
      };

      const updatedPaymentHistory = [...(saleToUpdate.payment_history || []), newPaymentEntry];
      const newTotalAmountPaid = updatedPaymentHistory.reduce((sum, p) => sum + p.amount, 0);
      
      let newPaymentStatus: Sale['payment_status'] = 'partially_paid';
      if (newTotalAmountPaid >= (saleToUpdate.total_amount || 0)) {
        newPaymentStatus = 'paid';
      } else if (newTotalAmountPaid <= 0) { // if total paid becomes 0 or less (e.g. refund scenario not yet handled)
        newPaymentStatus = 'unpaid';
      }
      // If newTotalAmountPaid is > 0 but < total_amount, it remains 'partially_paid'

      const saleUpdates: Partial<Sale> = {
        amount_paid: newTotalAmountPaid,
        payment_status: newPaymentStatus,
        payment_history: updatedPaymentHistory,
        updated_at: new Date().toISOString(),
        _synced: 0,
        _last_modified: Date.now(),
      };

      await db.sales.update(saleId, saleUpdates);
      console.log(`Payment recorded for sale ${saleId}. New amount paid: ${newTotalAmountPaid}, Status: ${newPaymentStatus}`);
      
      await requestPushChanges();
      await fetchData(); 
      setShowRecordPaymentModal(false);
      setSaleToRecordPaymentFor(null);

    } catch (err) {
      console.error("Failed to record payment:", err);
      setError(err instanceof Error ? err.message : "Could not record payment.");
    } finally {
      setIsRecordingPayment(false);
    }
  };

  return (
    <div>
      <header className="bg-white shadow mb-6">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex flex-wrap justify-between items-center gap-4">
            <h1 className="text-3xl font-bold tracking-tight text-gray-900">Sales Records</h1>
            <div className="flex space-x-3">
              <button
                onClick={() => exportSalesToCSV()}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded shadow-sm transition-colors duration-150 text-sm"
              >
                Export Sales (CSV)
              </button>
              <button
                onClick={() => exportSalesToPDF()}
                className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded shadow-sm transition-colors duration-150 text-sm"
              >
                Export Sales (PDF)
              </button>
              <button
                onClick={() => { setEditingSale(null); setShowForm(true); setError(null); }}
                className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded shadow-sm transition-colors duration-150 text-sm"
              >
                Record New Sale
              </button>
            </div>
          </div>
        </div>
      </header>

      {showForm && (
        <SaleForm
          initialData={editingSale || undefined}
          onSubmit={handleFormSubmit}
          onCancel={() => { setShowForm(false); setEditingSale(null); setError(null);}}
          isSubmitting={isSubmitting}
        />
      )}

      <div className="mt-4">
        {error && <p className="text-red-500 mb-4 p-3 bg-red-100 rounded-md">{error}</p>}
        {isLoading && <p className="text-center text-gray-500">Loading sales records...</p>}
        {!isLoading && !error && (
          <SaleList
            sales={sales}
            customers={customers}
            saleItems={saleItems}
            // Removed unused props: harvestLogs, plantingLogs, seedBatches, crops
            onEdit={handleEdit}
            onDelete={handleDelete}
            isDeleting={isDeleting}
            onViewInvoice={handleViewInvoice}
            onOpenRecordPaymentModal={handleOpenRecordPaymentModal}
          />
        )}
        {!isLoading && sales.length === 0 && !error && (
           <div className="text-center py-10">
            <svg className="mx-auto h-12 w-12 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">No sales recorded</h3>
            <p className="mt-1 text-sm text-gray-500">Get started by recording a new sale.</p>
            <div className="mt-6">
              <button
                type="button"
                onClick={() => { setEditingSale(null); setShowForm(true); setError(null); }}
                className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
              >
                <svg className="-ml-1 mr-2 h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                </svg>
                Record New Sale
              </button>
            </div>
          </div>
        )}
      </div>

      {showRecordPaymentModal && saleToRecordPaymentFor && (
        <RecordPaymentModal
          isOpen={showRecordPaymentModal}
          sale={saleToRecordPaymentFor}
          onClose={() => {
            setShowRecordPaymentModal(false);
            setSaleToRecordPaymentFor(null);
            setError(null);
          }}
          onRecordPayment={handleRecordPaymentSubmit}
          isSubmitting={isRecordingPayment}
        />
      )}
    </div>
  );
}