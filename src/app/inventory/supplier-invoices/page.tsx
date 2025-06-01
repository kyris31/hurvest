'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { db, SupplierInvoice, Supplier } from '@/lib/db';
import { PlusCircleIcon } from '@heroicons/react/24/outline';
import { formatDateToDDMMYYYY } from '@/lib/dateUtils';

// Placeholder for SupplierInvoiceList component - to be created
// import SupplierInvoiceList from '@/components/SupplierInvoiceList'; 

export default function SupplierInvoicesPage() {
  const [supplierInvoices, setSupplierInvoices] = useState<SupplierInvoice[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // State for filters
  const [filterInvoiceNumber, setFilterInvoiceNumber] = useState('');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [filterSupplierId, setFilterSupplierId] = useState('');

  // supplierMap is defined later at component scope, no need to redefine in useMemo here.
  // const supplierMap = React.useMemo(() => new Map(suppliers.map(s => [s.id, s.name])), [suppliers]);

  const filteredSupplierInvoices = React.useMemo(() => {
    if (!supplierInvoices) return [];
    let items = supplierInvoices;

    if (filterInvoiceNumber) {
      items = items.filter(inv => inv.invoice_number.toLowerCase().includes(filterInvoiceNumber.toLowerCase()));
    }
    if (filterSupplierId) {
      items = items.filter(inv => inv.supplier_id === filterSupplierId);
    }
    if (filterStartDate) {
      items = items.filter(inv => new Date(inv.invoice_date) >= new Date(filterStartDate));
    }
    if (filterEndDate) {
      // Add 1 day to endDate to make the filter inclusive of the selected end date
      const endDate = new Date(filterEndDate);
      endDate.setDate(endDate.getDate() + 1);
      items = items.filter(inv => new Date(inv.invoice_date) < endDate);
    }
    // Default sort by invoice_date descending (newest first)
    return items.sort((a, b) => new Date(b.invoice_date).getTime() - new Date(a.invoice_date).getTime());
  }, [supplierInvoices, filterInvoiceNumber, filterSupplierId, filterStartDate, filterEndDate]);


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

      {/* Filter UI Section */}
      <div className="my-4 p-4 bg-gray-50 shadow rounded-lg">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div>
            <label htmlFor="filterInvoiceNumber" className="block text-sm font-medium text-gray-700">Invoice Number</label>
            <input
              type="text"
              id="filterInvoiceNumber"
              value={filterInvoiceNumber}
              onChange={(e) => setFilterInvoiceNumber(e.target.value)}
              placeholder="Search invoice #"
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            />
          </div>
          <div>
            <label htmlFor="filterSupplierId" className="block text-sm font-medium text-gray-700">Supplier</label>
            <select
              id="filterSupplierId"
              value={filterSupplierId}
              onChange={(e) => setFilterSupplierId(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            >
              <option value="">All Suppliers</option>
              {suppliers.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="filterStartDate" className="block text-sm font-medium text-gray-700">From Date</label>
            <input
              type="date"
              id="filterStartDate"
              value={filterStartDate}
              onChange={(e) => setFilterStartDate(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            />
          </div>
          <div>
            <label htmlFor="filterEndDate" className="block text-sm font-medium text-gray-700">To Date</label>
            <input
              type="date"
              id="filterEndDate"
              value={filterEndDate}
              onChange={(e) => setFilterEndDate(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            />
          </div>
        </div>
      </div>

      {isLoading && <p>Loading supplier invoices...</p>}
      {error && <p className="text-red-500">{error}</p>}

      {!isLoading && !error && (
        <>
          {filteredSupplierInvoices.length === 0 ? (
            <p className="text-center text-gray-500 py-4">
              {filterInvoiceNumber || filterSupplierId || filterStartDate || filterEndDate
                ? "No supplier invoices match your current filters."
                : "No supplier invoices recorded yet."}
            </p>
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
                  {filteredSupplierInvoices.map(invoice => ( // Use filtered list here
                    <tr key={invoice.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{formatDateToDDMMYYYY(invoice.invoice_date)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{invoice.invoice_number}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{supplierMap.get(invoice.supplier_id) || 'N/A'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">€{(invoice.total_amount_net || 0).toFixed(2)}</td>
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