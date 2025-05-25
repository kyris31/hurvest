'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, PurchasedSeedling, Crop, Supplier } from '@/lib/db';
import { supabase } from '@/lib/supabaseClient'; // Import supabase client
import { requestPushChanges } from '@/lib/sync';
import PurchasedSeedlingList from '@/components/PurchasedSeedlingList'; // Uncommented
import PurchasedSeedlingForm from '@/components/PurchasedSeedlingForm'; // Uncommented

export default function PurchasedSeedlingsPage() {
  const [showForm, setShowForm] = useState(false);
  const [editingSeedling, setEditingSeedling] = useState<PurchasedSeedling | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const purchasedSeedlings = useLiveQuery(
    async () => {
      try {
        return await db.purchasedSeedlings.orderBy('purchase_date').filter(ps => ps.is_deleted !== 1).reverse().toArray();
      } catch (err) {
        console.error("Failed to fetch purchased seedlings:", err);
        setError("Failed to load purchased seedlings. Please try again.");
        return [];
      }
    },
    []
  );

  // Required for the form (dropdowns)
  const crops = useLiveQuery(() => db.crops.filter(c => c.is_deleted !== 1).sortBy('name'), []);
  const suppliers = useLiveQuery(() => db.suppliers.filter(s => s.is_deleted !== 1).sortBy('name'), []);

  const isLoading = purchasedSeedlings === undefined || crops === undefined || suppliers === undefined;

  const handleFormSubmit = async (data: Omit<PurchasedSeedling, 'id' | '_synced' | '_last_modified' | 'created_at' | 'updated_at' | 'user_id'> | PurchasedSeedling) => {
    setIsSubmitting(true);
    setError(null);
    try {
      const now = new Date().toISOString();
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id;

      if (!userId && process.env.NEXT_PUBLIC_SUPABASE_URL) {
        console.warn("User ID not available from Supabase session, user_id field will be undefined for purchased seedling if RLS requires it.");
      }
      
      let costPerUnit = data.cost_per_unit;
      if (data.total_purchase_cost && data.initial_quantity && data.initial_quantity > 0) {
        costPerUnit = data.total_purchase_cost / data.initial_quantity;
      }


      if ('id' in data && data.id) { // Editing existing
        const updatedSeedling: Partial<PurchasedSeedling> = {
          ...data,
          cost_per_unit: costPerUnit,
          updated_at: now,
          _synced: 0,
          _last_modified: Date.now(),
          user_id: data.user_id || userId, // Preserve existing user_id or set if missing
        };
        await db.purchasedSeedlings.update(data.id, updatedSeedling);
      } else { // Adding new
        const newSeedlingData: Omit<PurchasedSeedling, 'id'> = {
          ...(data as Omit<PurchasedSeedling, 'id' | '_synced' | '_last_modified' | 'created_at' | 'updated_at' | 'is_deleted' | 'deleted_at' | 'user_id'>),
          initial_quantity: data.initial_quantity || 0,
          current_quantity: data.initial_quantity || 0, // Current is same as initial for new items
          cost_per_unit: costPerUnit,
          created_at: now,
          updated_at: now,
          _synced: 0,
          _last_modified: Date.now(),
          is_deleted: 0,
          user_id: userId,
        };
        const newId = crypto.randomUUID();
        await db.purchasedSeedlings.add({ ...newSeedlingData, id: newId });
      }
      setShowForm(false);
      setEditingSeedling(null);
      await requestPushChanges();
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Failed to save purchased seedling.";
      console.error(errorMessage, err);
      setError(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (seedling: PurchasedSeedling) => {
    setEditingSeedling(seedling);
    setShowForm(true);
    setError(null);
  };

  const handleDelete = async (id: string) => {
    setError(null);
    // TODO: Add checks for related records (e.g., PlantingLogs) before allowing deletion
    // For example:
    // const relatedPlantingLogs = await db.plantingLogs.where('purchased_seedling_id').equals(id).filter(pl => pl.is_deleted !== 1).count();
    // if (relatedPlantingLogs > 0) {
    //   setError(`Cannot delete: This seedling batch is used in ${relatedPlantingLogs} planting log(s).`);
    //   return;
    // }

    if (window.confirm("Are you sure you want to delete this purchased seedling record?")) {
      setIsDeleting(id);
      try {
        await db.markForSync('purchasedSeedlings', id, {}, true);
        await requestPushChanges();
      } catch (err) {
        console.error("Failed to mark purchased seedling for deletion:", err);
        setError("Failed to mark for deletion. See console.");
      } finally {
        setIsDeleting(null);
      }
    }
  };

  return (
    <div>
      <header className="bg-white shadow mb-6">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 flex justify-between items-center">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Purchased Seedlings</h1>
          <button
            onClick={() => { setEditingSeedling(null); setShowForm(true); setError(null); }}
            className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded shadow-sm transition-colors duration-150"
          >
            Record Purchased Seedlings
          </button>
        </div>
      </header>

      {/* {showForm && crops && suppliers && (
        <PurchasedSeedlingForm
          initialData={editingSeedling}
          onSubmit={handleFormSubmit}
          onCancel={() => { setShowForm(false); setEditingSeedling(null); setError(null);}}
          isSubmitting={isSubmitting}
          availableCrops={crops}
          availableSuppliers={suppliers}
        />
      )}
      {/* <p className="text-center p-4">PurchasedSeedlingForm and PurchasedSeedlingList components to be created.</p> */}


      <div className="mt-4">
        {error && <p className="text-red-500 mb-4 p-3 bg-red-100 rounded-md">{error}</p>}
        {isLoading && <p className="text-center text-gray-500">Loading purchased seedlings...</p>}
        {!isLoading && !error && purchasedSeedlings && crops && suppliers && (
          <PurchasedSeedlingList
            purchasedSeedlings={purchasedSeedlings}
            crops={crops}
            suppliers={suppliers}
            onEdit={handleEdit}
            onDelete={handleDelete}
            isDeleting={isDeleting}
          />
        )}
        {!isLoading && purchasedSeedlings && purchasedSeedlings.length === 0 && !error && (
           <div className="text-center py-10">
            <svg className="mx-auto h-12 w-12 text-gray-400" /* ... icon ... */ >
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.53 16.122a3 3 0 00-5.78 1.128 2.25 2.25 0 01-2.4 2.245M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M12.75 9.75v2.25m0 0l-2.25 2.25M12.75 12l2.25-2.25M12.75 12l2.25 2.25M12.75 12l-2.25-2.25M7.5 15h9M7.5 12h.008v.008H7.5V12zm0 0h.008v.008H7.5V12zm0 0h.008v.008H7.5V12zm0 0h.008v.008H7.5V12zm3.75 0h.008v.008H11.25V12zm0 0h.008v.008H11.25V12zm0 0h.008v.008H11.25V12zm0 0h.008v.008H11.25V12zm3.75 0h.008v.008H15V12zm0 0h.008v.008H15V12zm0 0h.008v.008H15V12zm0 0h.008v.008H15V12z" />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">No purchased seedlings</h3>
            <p className="mt-1 text-sm text-gray-500">Get started by recording your first batch of purchased seedlings.</p>
            <div className="mt-6">
              <button
                type="button"
                onClick={() => { setEditingSeedling(null); setShowForm(true); setError(null); }}
                className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
              >
                <svg className="-ml-1 mr-2 h-5 w-5" /* ... icon ... */ >
                  <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                </svg>
                Record Purchased Seedlings
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}