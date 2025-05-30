'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { db, Supplier, SupplierInvoice } from '@/lib/db'; // Added SupplierInvoice import

export default function ImportSupplierInvoicePage() {
  const router = useRouter();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form state for Step 1 (Invoice Header)
  const [supplierId, setSupplierId] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState(''); 
  const [isSubmitting, setIsSubmitting] = useState(false); 

  useEffect(() => {
    const fetchSuppliers = async () => {
      setIsLoading(true);
      try {
        const activeSuppliers = await db.suppliers
          .filter(supplier => supplier.is_deleted !== 1)
          .sortBy('name');
        setSuppliers(activeSuppliers); // Use setSuppliers directly
        setError(null);
      } catch (err) {
        console.error("Failed to fetch suppliers:", err);
        setError("Could not load suppliers.");
      } finally {
        setIsLoading(false);
      }
    };
    fetchSuppliers();
  }, []);
  
  const handleNextStep = async () => { 
    setIsSubmitting(true);
    setError(null);
    if (!supplierId || !invoiceNumber || !invoiceDate) {
      setError("Supplier, Invoice Number, and Invoice Date are required.");
      setIsSubmitting(false);
      return;
    }

    // Validate for duplicate invoice number for the same supplier
    try {
      const trimmedInvoiceNumber = invoiceNumber.trim();
      const existingInvoice = await db.supplierInvoices
        .where(['supplier_id', 'invoice_number'])
        .equals([supplierId, trimmedInvoiceNumber])
        .filter(inv => inv.is_deleted !== 1)
        .first();

      if (existingInvoice) {
        const selectedSupplier = suppliers.find(s => s.id === supplierId);
        setError(`Error: An invoice with number "${trimmedInvoiceNumber}" already exists for supplier "${selectedSupplier?.name || supplierId}". Please use a unique invoice number for this supplier.`);
        setIsSubmitting(false);
        return;
      }

      const newInvoiceId = crypto.randomUUID();
      const now = new Date().toISOString();
      const draftInvoiceData: SupplierInvoice = {
        id: newInvoiceId,
        supplier_id: supplierId,
        invoice_number: invoiceNumber,
        invoice_date: invoiceDate,
        due_date: dueDate || undefined,
        notes: notes.trim() || undefined,
        status: 'draft',
        total_amount_gross: 0, 
        discount_amount: 0,
        shipping_cost: 0,
        other_charges: 0,
        subtotal_after_adjustments: 0,
        total_vat_amount: 0,
        total_amount_net: 0, 
        currency: 'EUR', 
        created_at: now,
        updated_at: now,
        _last_modified: Date.now(),
        _synced: 0,
        is_deleted: 0, // Ensure new invoices are not marked as deleted
      };

      console.log("[ImportPage] Attempting to add new supplier invoice:", newInvoiceId, draftInvoiceData);
      await db.supplierInvoices.add(draftInvoiceData);
      console.log("[ImportPage] Successfully added supplier invoice to Dexie:", newInvoiceId);
      
      router.push(`/inventory/supplier-invoices/edit/${newInvoiceId}`);

    } catch (err) {
      console.error("[ImportPage] Failed to save draft supplier invoice:", err);
      setError(`Failed to save draft invoice: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading && suppliers.length === 0) { 
    return <div className="p-6"><h1 className="text-2xl font-semibold text-gray-900">Import Supplier Invoice</h1><p>Loading data...</p></div>;
  }
  
  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Import Supplier Invoice - Step 1: Header</h1>
      </header>

      {error && <p className="text-red-500 bg-red-100 p-3 rounded mb-4">{error}</p>}

      <form onSubmit={(e) => e.preventDefault()} className="space-y-4">
        <div>
          <label htmlFor="supplierId" className="block text-sm font-medium text-gray-700">
            Supplier <span className="text-red-500">*</span>
          </label>
          <select
            id="supplierId"
            value={supplierId}
            onChange={(e) => setSupplierId(e.target.value)}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
            required
            disabled={isSubmitting}
          >
            <option value="">Select Supplier</option>
            {suppliers.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="invoiceNumber" className="block text-sm font-medium text-gray-700">
            Invoice Number <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            id="invoiceNumber"
            value={invoiceNumber}
            onChange={(e) => setInvoiceNumber(e.target.value)}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
            required
            disabled={isSubmitting}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="invoiceDate" className="block text-sm font-medium text-gray-700">
              Invoice Date <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              id="invoiceDate"
              value={invoiceDate}
              onChange={(e) => setInvoiceDate(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
              required
              disabled={isSubmitting}
            />
          </div>
          <div>
            <label htmlFor="dueDate" className="block text-sm font-medium text-gray-700">Due Date (Optional)</label>
            <input
              type="date"
              id="dueDate"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
              disabled={isSubmitting}
            />
          </div>
        </div>

        <div>
          <label htmlFor="notes" className="block text-sm font-medium text-gray-700">Notes (Optional)</label>
          <textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
            disabled={isSubmitting}
          />
        </div>
        
        <div className="flex justify-end space-x-3 pt-4">
          <button
            type="button"
            onClick={() => router.push('/inventory/supplier-invoices')}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md border border-gray-300"
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleNextStep}
            className="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-md shadow-sm"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Saving Draft...' : 'Next: Add Line Items'}
          </button>
        </div>
      </form>
    </div>
  );
}