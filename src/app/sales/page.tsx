'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { db, Sale, SaleItem, Customer, HarvestLog, PlantingLog, SeedBatch, Crop, Invoice } from '@/lib/db';
import SaleList from '@/components/SaleList';
import SaleForm from '@/components/SaleForm';
import { downloadInvoicePDF } from '@/lib/invoiceGenerator';
import { exportSalesToCSV, exportSalesToPDF } from '@/lib/reportUtils'; // Import CSV and PDF export functions

export default function SalesPage() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [saleItems, setSaleItems] = useState<SaleItem[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [harvestLogs, setHarvestLogs] = useState<HarvestLog[]>([]);
  const [plantingLogs, setPlantingLogs] = useState<PlantingLog[]>([]);
  const [seedBatches, setSeedBatches] = useState<SeedBatch[]>([]);
  const [crops, setCrops] = useState<Crop[]>([]);
  
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingSale, setEditingSale] = useState<(Sale & { items?: SaleItem[] }) | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [
        salesData,
        saleItemsData,
        customersData,
        harvestLogsData,
        plantingLogsData,
        seedBatchesData,
        cropsData
      ] = await Promise.all([
        db.sales.orderBy('sale_date').filter(s => s.is_deleted === 0).reverse().toArray(),
        db.saleItems.where('is_deleted').equals(0).toArray(), // No specific order needed for all items, will be filtered per sale
        db.customers.orderBy('name').filter(c => c.is_deleted === 0).toArray(),
        db.harvestLogs.orderBy('harvest_date').filter(h => h.is_deleted === 0).reverse().toArray(),
        db.plantingLogs.orderBy('planting_date').filter(p => p.is_deleted === 0).reverse().toArray(),
        db.seedBatches.orderBy('_last_modified').filter(sb => sb.is_deleted === 0).reverse().toArray(),
        db.crops.orderBy('name').filter(c => c.is_deleted === 0).toArray(),
      ]);
      setSales(salesData);
      setSaleItems(saleItemsData);
      setCustomers(customersData);
      setHarvestLogs(harvestLogsData);
      setPlantingLogs(plantingLogsData);
      setSeedBatches(seedBatchesData);
      setCrops(cropsData);
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
    saleData: Omit<Sale, 'id' | '_synced' | '_last_modified' | 'created_at' | 'updated_at' | 'total_amount'>, 
    itemsData: Omit<SaleItem, 'id' | 'sale_id' | '_synced' | '_last_modified' | 'created_at' | 'updated_at'>[]
  ) => {
    setIsSubmitting(true);
    setError(null);
    const saleId = editingSale?.id || crypto.randomUUID();
    const now = new Date().toISOString();

    // Calculate total amount with discounts
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
            await db.markForSync(db.saleItems, item.id, true);
          }
          const invoiceToSoftDelete = await db.invoices.where('sale_id').equals(editingSale.id).first();
          if (invoiceToSoftDelete) {
            await db.markForSync(db.invoices, invoiceToSoftDelete.id, true);
          }
          
          const updatedSaleData: Sale = {
            ...(editingSale as Sale), // Cast to ensure all Sale properties are there if editingSale is partial
            ...saleData,
            total_amount: calculatedTotalAmount, // Update with new discounted total
            updated_at: now,
            _synced: 0,
            _last_modified: Date.now(),
            is_deleted: 0,
            deleted_at: undefined,
          };
          await db.sales.update(editingSale.id, updatedSaleData);
        } else {
            const newSale: Sale = {
              id: saleId,
              ...saleData,
              total_amount: calculatedTotalAmount, // Set new discounted total
              created_at: now,
              updated_at: now,
              _synced: 0,
              _last_modified: Date.now(),
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
              _last_modified: Date.now(),
              is_deleted: 0,
              deleted_at: undefined,
            });
          }
          
          // Generate new Invoice (for both add and edit)
          const invoiceNumber = `INV-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;
          const newInvoice: Invoice = {
              id: crypto.randomUUID(),
              sale_id: saleId,
              invoice_number: invoiceNumber,
              invoice_date: saleData.sale_date,
              status: 'generated',
              pdf_url: `placeholder_invoice_${saleId}.pdf`,
              created_at: now,
              updated_at: now,
              _synced: 0,
              _last_modified: Date.now(),
              is_deleted: 0,
              deleted_at: undefined,
          };
          await db.invoices.add(newInvoice);
        console.log(`Invoice ${invoiceNumber} created locally for sale ${saleId}`);
        
      }); // End transaction
      
      // Trigger PDF download after successful transaction
      // This happens outside the Dexie transaction
      downloadInvoicePDF(saleId).catch(pdfError => {
        console.error("Error auto-downloading invoice after sale:", pdfError);
        // Optionally set a non-blocking UI notification about PDF download failure
        // setError("Sale saved, but failed to auto-download invoice. You can download it manually from the list.");
      });

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
    // Fetch non-soft-deleted items for the sale to populate the form
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
        // Soft delete the sale, its items, and its invoice
        await db.transaction('rw', db.sales, db.saleItems, db.invoices, async () => {
            const itemsToSoftDelete = await db.saleItems.where('sale_id').equals(id).toArray();
            for (const item of itemsToSoftDelete) {
              await db.markForSync(db.saleItems, item.id, true);
            }
            const invoiceToSoftDelete = await db.invoices.where('sale_id').equals(id).first();
            if (invoiceToSoftDelete) {
              await db.markForSync(db.invoices, invoiceToSoftDelete.id, true);
            }
            await db.markForSync(db.sales, id, true);
        });
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
    // Call the downloadInvoicePDF function from invoiceGenerator.ts
    try {
        await downloadInvoicePDF(saleId);
    } catch (error) {
        console.error("Failed to download invoice:", error);
        alert("Failed to generate or download invoice. See console for details.");
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
          initialData={editingSale || undefined} // Pass undefined if null
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
            harvestLogs={harvestLogs}
            plantingLogs={plantingLogs}
            seedBatches={seedBatches}
            crops={crops}
            onEdit={handleEdit}
            onDelete={handleDelete}
            isDeleting={isDeleting}
            onViewInvoice={handleViewInvoice}
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
    </div>
  );
}