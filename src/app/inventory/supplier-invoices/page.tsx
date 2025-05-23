'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { db, SupplierInvoice, Supplier } from '@/lib/db';
import { PlusCircleIcon } from '@heroicons/react/24/outline';

// Placeholder for SupplierInvoiceList component - to be created
// import SupplierInvoiceList from '@/components/SupplierInvoiceList'; 

export default function SupplierInvoicesPage() {
  const [supplierInvoices, setSupplierInvoices] = useState<SupplierInvoice[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [sInvoices, supps] = await Promise.all([
        db.supplierInvoices.orderBy('invoice_date').filter(si => si.is_deleted !== 1).reverse().toArray(),
        db.suppliers.filter(s => s.is_deleted !== 1).toArray()
      ]);
      setSupplierInvoices(sInvoices);
      setSuppliers(supps);
    } catch (err) {
      console.error("Failed to fetch supplier invoices:", err);
      setError("Failed to load supplier invoices. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleDeleteInvoice = async (invoiceId: string) => {
    if (!window.confirm("Are you sure you want to delete this supplier invoice and all its items? This action cannot be easily undone locally once synced.")) {
      return;
    }
    setError(null);
    try {
      // Corrected to use db.transaction for read-write operations
      await db.transaction('rw', db.supplierInvoices, db.supplierInvoiceItems, async () => {
        const now = new Date().toISOString();
        const timestamp = Date.now();

        // Mark the main invoice as deleted
        const invoiceUpdateCount = await db.supplierInvoices.update(invoiceId, {
          is_deleted: 1,
          deleted_at: now,
          _synced: 0,
          _last_modified: timestamp,
        });

        if (invoiceUpdateCount === 0) {
          throw new Error("Supplier invoice not found or already deleted during transaction.");
        }

        // Mark all associated items as deleted
        const itemsToDelete = await db.supplierInvoiceItems
          .where({ supplier_invoice_id: invoiceId, is_deleted: 0 })
          .toArray();

        for (const item of itemsToDelete) {
          await db.supplierInvoiceItems.update(item.id, {
            is_deleted: 1,
            deleted_at: now,
            _synced: 0,
            _last_modified: timestamp,
          });
        }
        console.log(`Soft deleted supplier invoice ${invoiceId} and ${itemsToDelete.length} items.`);
      });
      fetchData();
    } catch (err) {
      console.error("Failed to delete supplier invoice:", err);
      setError(`Failed to delete invoice: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const supplierMap = new Map(suppliers.map(s => [s.id, s.name]));

  return (
    <div className="p-4 md:p-6">
      <header className="mb-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-gray-900">Supplier Invoices</h1>
          <Link href="/inventory/supplier-invoices/import"
            className="inline-flex items-center justify-center rounded-md border border-transparent bg-green-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
          >
            <PlusCircleIcon className="mr-2 h-5 w-5" aria-hidden="true" />
            Import New Invoice
          </Link>
        </div>
      </header>

      {isLoading && <p>Loading supplier invoices...</p>}
      {error && <p className="text-red-500">{error}</p>}

      {!isLoading && !error && (
        <>
          {/* Placeholder for SupplierInvoiceList component */}
          {supplierInvoices.length === 0 ? (
            <p>No supplier invoices recorded yet.</p>
          ) : (
            <div className="overflow-x-auto bg-white shadow sm:rounded-lg">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Invoice Date</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Invoice #</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Supplier</th>
                    <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Total Amount</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {supplierInvoices.map(invoice => (
                    <tr key={invoice.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{new Date(invoice.invoice_date).toLocaleDateString()}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{invoice.invoice_number}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{supplierMap.get(invoice.supplier_id) || 'N/A'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">€{invoice.total_amount_net.toFixed(2)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{invoice.status}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                        <Link href={`/inventory/supplier-invoices/edit/${invoice.id}`} /* Changed 'view' to 'edit' */
                          className="text-indigo-600 hover:text-indigo-900"
                        >
                          View/Edit
                        </Link>
                        {/* Add Edit/Delete for 'draft' status later */}
                         <button onClick={() => handleDeleteInvoice(invoice.id)} className="text-red-600 hover:text-red-900">Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {/* We will replace the table above with <SupplierInvoiceList supplierInvoices={supplierInvoices} suppliers={suppliers} ... /> once created */}
        </>
      )}
    </div>
  );
}