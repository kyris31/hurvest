'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation'; // For query params
import { db, Customer, Sale, SaleItem } from '@/lib/db'; // Added Sale and SaleItem
import CustomerList from '@/components/CustomerList';
import CustomerForm from '@/components/CustomerForm';

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [sales, setSales] = useState<Sale[]>([]); // State for sales
  const [saleItems, setSaleItems] = useState<SaleItem[]>([]); // State for sale items
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    if (searchParams.get('action') === 'add') {
      setShowForm(true);
      setEditingCustomer(null);
      // Optional: remove query param after use
      // router.replace('/customers', undefined); // next/navigation
    }
  }, [searchParams, router]);


  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      // Fetch active customers, sales, and saleItems
      const [customersData, salesData, saleItemsData] = await Promise.all([
        db.customers.orderBy('name').filter(c => c.is_deleted !== 1).toArray(),
        db.sales.filter(s => s.is_deleted !== 1).toArray(),
        db.saleItems.filter(si => si.is_deleted !== 1).toArray()
      ]);
      setCustomers(customersData);
      setSales(salesData);
      setSaleItems(saleItemsData);
      setError(null);
    } catch (err) {
      console.error("Failed to fetch customers data:", err);
      setError("Failed to load customer data. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleFormSubmit = async (data: Omit<Customer, 'id' | '_synced' | '_last_modified' | 'created_at' | 'updated_at'> | Customer) => {
    setIsSubmitting(true);
    setError(null);
    try {
      const now = new Date().toISOString();
      if ('id' in data && data.id) { // Editing existing
        const updatedCustomer: Partial<Customer> = {
          ...data,
          updated_at: now,
          _synced: 0,
          _last_modified: Date.now(),
        };
        await db.customers.update(data.id, updatedCustomer);
      } else { // Adding new
        const newCustomerData: Omit<Customer, 'id'> = {
          ...(data as Omit<Customer, 'id' | '_synced' | '_last_modified' | 'created_at' | 'updated_at' | 'is_deleted' | 'deleted_at'>),
          created_at: now,
          updated_at: now,
          _synced: 0,
          _last_modified: Date.now(),
          is_deleted: 0,
          deleted_at: undefined,
        };
        const id = crypto.randomUUID();
        await db.customers.add({ ...newCustomerData, id });
      }
      await fetchData();
      setShowForm(false);
      setEditingCustomer(null);
       if (searchParams.get('action') === 'add') {
        router.replace('/customers', undefined); // Clear query param
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Failed to save customer. Please try again.";
      console.error("Failed to save customer:", err);
      setError(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (customer: Customer) => {
    setEditingCustomer(customer);
    setShowForm(true);
    setError(null);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm("Are you sure you want to delete this customer? This might affect associated sales records.")) {
      setIsDeleting(id);
      setError(null);
      try {
        await db.markForSync(db.customers, id, true);
        // Note: Sales referencing this customer will have a customer_id that no longer points to an active customer.
        // The UI displaying sales should handle this gracefully (e.g., show "Deleted Customer").
        await fetchData();
      } catch (err) {
        console.error("Failed to delete customer:", err);
        setError("Failed to delete customer.");
      } finally {
        setIsDeleting(null);
      }
    }
  };

  return (
    <div>
      <header className="bg-white shadow mb-6">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 flex justify-between items-center">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Customers</h1>
          <button
            onClick={() => { setEditingCustomer(null); setShowForm(true); setError(null); }}
            className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded shadow-sm transition-colors duration-150"
          >
            Add New Customer
          </button>
        </div>
      </header>

      {showForm && (
        <CustomerForm
          initialData={editingCustomer}
          onSubmit={handleFormSubmit}
          onCancel={() => { 
            setShowForm(false); 
            setEditingCustomer(null); 
            setError(null);
            if (searchParams.get('action') === 'add') {
              router.replace('/customers', undefined); // Clear query param on cancel too
            }
          }}
          isSubmitting={isSubmitting}
        />
      )}

      <div className="mt-4">
        {error && <p className="text-red-500 mb-4 p-3 bg-red-100 rounded-md">{error}</p>}
        {isLoading && <p className="text-center text-gray-500">Loading customer records...</p>}
        {!isLoading && !error && (
          <CustomerList
            customers={customers}
            sales={sales}
            saleItems={saleItems}
            onEdit={handleEdit}
            onDelete={handleDelete}
            isDeleting={isDeleting}
          />
        )}
        {!isLoading && customers.length === 0 && !error && (
           <div className="text-center py-10">
             <svg className="mx-auto h-12 w-12 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.247-3.03c-.526-.976-1.646-1.693-2.942-1.693a3.75 3.75 0 00-3.75 3.75c0 1.296.717 2.416 1.693 2.942m9.319 2.025a9.094 9.094 0 00-3.742-.479m-4.682 2.72c.976.526 1.693 1.646 1.693 2.942a3.75 3.75 0 003.75-3.75c0-1.296-.717-2.416-1.693-2.942m3.644-1.352A9.094 9.094 0 0112 18.75c-2.648 0-4.991-.99-6.773-2.632A10.483 10.483 0 012.25 10.5c0-1.296.717-2.416 1.693-2.942m13.001 2.942a9.094 9.094 0 01-3.742.479m4.682-2.72a10.483 10.483 0 00-2.632-6.773A3.75 3.75 0 0012 2.25c-1.296 0-2.416.717-2.942 1.693m13.001 2.942A10.483 10.483 0 0118.75 12c0 2.648-.99 4.991-2.632 6.773M5.25 10.5A3.75 3.75 0 001.5 6.75c0-1.296.717-2.416 1.693-2.942m0 13.002A3.75 3.75 0 001.5 17.25c0 1.296.717 2.416 1.693 2.942m0-13.002a10.483 10.483 0 016.773-2.632M5.25 10.5A10.483 10.483 0 002.25 12c0 2.648.99 4.991 2.632 6.773" />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">No customers recorded</h3>
            <p className="mt-1 text-sm text-gray-500">Get started by adding a new customer.</p>
            <div className="mt-6">
              <button
                type="button"
                onClick={() => { setEditingCustomer(null); setShowForm(true); setError(null); }}
                className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
              >
                Add New Customer
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}