'use client';

import React, { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, Supplier } from '@/lib/db';
import { supabase } from '@/lib/supabaseClient'; // Import supabase client
import { requestPushChanges } from '@/lib/sync'; // Changed from triggerManualSync
import SupplierList from '@/components/SupplierList';
import SupplierForm from '@/components/SupplierForm';
import { PlusCircleIcon } from '@heroicons/react/24/outline';

export default function SuppliersPage() {
  const [showForm, setShowForm] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    if (searchParams.get('action') === 'add') {
      setShowForm(true);
      setEditingSupplier(null);
      const newPath = window.location.pathname;
      router.replace(newPath, undefined); 
    }
  }, [searchParams, router]);

  const suppliers = useLiveQuery(
    async () => {
      try {
        const data = await db.suppliers.orderBy('name').filter(s => s.is_deleted !== 1).toArray();
        setError(null);
        return data;
      } catch (err) {
        console.error("Failed to fetch suppliers with useLiveQuery:", err);
        setError("Failed to load suppliers. Please try again.");
        return [];
      }
    },
    [] 
  );

  const isLoading = suppliers === undefined;

  const handleFormSubmit = async (data: Omit<Supplier, 'id' | '_synced' | '_last_modified' | 'created_at' | 'updated_at' | 'is_deleted' | 'deleted_at'> | Supplier) => {
    setIsSubmitting(true);
    setError(null);
    try {
      const now = new Date().toISOString();
      if ('id' in data && data.id) { // Editing existing
        const updatedSupplier: Partial<Supplier> = {
          ...data,
          updated_at: now,
          _synced: 0,
          _last_modified: Date.now(),
        };
        await db.suppliers.update(data.id, updatedSupplier);
      } else { // Adding new
        const newSupplierData: Omit<Supplier, 'id'> = {
          ...(data as Omit<Supplier, 'id' | '_synced' | '_last_modified' | 'created_at' | 'updated_at' | 'is_deleted' | 'deleted_at'>),
          created_at: now,
          updated_at: now,
          _synced: 0,
          _last_modified: Date.now(),
          is_deleted: 0,
          deleted_at: undefined,
        };
        const id = crypto.randomUUID();
        await db.suppliers.add({ ...newSupplierData, id });
      }
      setShowForm(false);
      setEditingSupplier(null);
      if (searchParams.get('action') === 'add') {
        const newPath = window.location.pathname;
        router.replace(newPath, undefined);
      }
      // Attempt to sync changes immediately if user is authenticated
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        try {
          console.log("Supplier saved locally, requesting push as user is authenticated...");
          const pushResult = await requestPushChanges();
          if (pushResult.success) {
            console.log("SuppliersPage: Push requested successfully after form submit.");
          } else {
            console.error("SuppliersPage: Push request failed after form submit.", pushResult.errors);
            // setError("Supplier saved locally, but failed to push to server immediately. It will sync later.");
          }
        } catch (syncError) {
          console.error("Error requesting push after supplier save:", syncError);
        }
      } else {
        console.log("Supplier saved locally, but user not authenticated. Sync will occur when online and authenticated.");
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "An unknown error occurred.";
      if (err instanceof Error && err.name === 'ConstraintError') {
        setError("Failed to save supplier. The supplier name might already exist if you have a unique constraint.");
      } else {
        setError(`Failed to save supplier: ${errorMessage}`);
      }
      console.error("Failed to save supplier:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (supplier: Supplier) => {
    setEditingSupplier(supplier);
    setShowForm(true);
    setError(null);
  };

  const handleDelete = async (id: string) => {
    setError(null);
    // TODO: Implement dependency checks for suppliers if necessary
    // For example, check if supplier is used in input_inventory or seed_batches
    // For now, direct deletion:
    // const relatedInputItems = await db.inputInventory.where('supplier_id').equals(id).filter(i => i.is_deleted !== 1).count();
    // if (relatedInputItems > 0) {
    //   setError(`Cannot delete supplier: referenced by ${relatedInputItems} input inventory item(s).`);
    //   return;
    // }
    // const relatedSeedBatches = await db.seedBatches.where('supplier_id').equals(id).filter(sb => sb.is_deleted !== 1).count();
    // if (relatedSeedBatches > 0) {
    //   setError(`Cannot delete supplier: referenced by ${relatedSeedBatches} seed batch(es).`);
    //   return;
    // }


    if (window.confirm("Are you sure you want to delete this supplier?")) {
      setIsDeleting(id);
      try {
        await db.markForSync('suppliers', id, {}, true);
        // UI will update via useLiveQuery
         // Attempt to sync changes immediately if user is authenticated
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
            try {
                console.log("Supplier marked for deletion, requesting push as user is authenticated...");
                const pushResult = await requestPushChanges();
                 if (pushResult.success) {
                    console.log("SuppliersPage: Push requested successfully after delete.");
                } else {
                    console.error("SuppliersPage: Push request failed after delete.", pushResult.errors);
                }
            } catch (syncError) {
                console.error("Error requesting push after supplier delete:", syncError);
            }
        } else {
            console.log("Supplier marked for deletion locally, but user not authenticated. Sync will occur when online and authenticated.");
        }
      } catch (err) {
        console.error("Failed to mark supplier for deletion:", err);
        setError("Failed to mark supplier for deletion. See console for details.");
      } finally {
        setIsDeleting(null);
      }
    }
  };

  return (
    <div>
      <header className="bg-white shadow mb-6">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 flex justify-between items-center">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Manage Suppliers</h1>
          <button
            onClick={() => { setEditingSupplier(null); setShowForm(true); setError(null); }}
            className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded shadow-sm transition-colors duration-150 flex items-center"
          >
            <PlusCircleIcon className="h-5 w-5 mr-2" />
            Add New Supplier
          </button>
        </div>
      </header>

      {showForm && (
        <SupplierForm
          initialData={editingSupplier}
          onSubmit={handleFormSubmit}
          onCancel={() => { 
            setShowForm(false); 
            setEditingSupplier(null); 
            setError(null);
            if (searchParams.get('action') === 'add') {
              router.replace('/suppliers', undefined);
            }
          }}
          isSubmitting={isSubmitting}
        />
      )}

      <div className="mt-4 mx-auto max-w-7xl sm:px-6 lg:px-8">
        {error && <p className="text-red-500 mb-4 p-3 bg-red-100 rounded-md">{error}</p>}
        {isLoading && <p className="text-center text-gray-500">Loading suppliers...</p>}
        {!isLoading && !error && suppliers && (
          <SupplierList
            suppliers={suppliers}
            onEdit={handleEdit}
            onDelete={handleDelete}
            isDeleting={isDeleting}
          />
        )}
        {!isLoading && suppliers && suppliers.length === 0 && !error && (
           <div className="text-center py-10">
            <svg className="mx-auto h-12 w-12 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.125-.504 1.125-1.125V14.25m-17.25 4.5h12.75m0 0V4.125c0-.621-.504-1.125-1.125-1.125H4.5A1.125 1.125 0 003.375 4.125v10.5m12.75 0h3.375c.621 0 1.125-.504 1.125-1.125V4.125c0-.621-.504-1.125-1.125-1.125h-3.375m12.75 0H3.375" />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">No suppliers recorded</h3>
            <p className="mt-1 text-sm text-gray-500">Get started by adding your first supplier.</p>
            <div className="mt-6">
              <button
                type="button"
                onClick={() => { setEditingSupplier(null); setShowForm(true); setError(null); }}
                className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
              >
                <PlusCircleIcon className="h-5 w-5 mr-2" />
                Add New Supplier
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}