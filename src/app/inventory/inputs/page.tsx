'use client';

import React, { useState } from 'react'; // Removed useEffect, useCallback
import { useLiveQuery } from 'dexie-react-hooks'; // Import useLiveQuery
import { db, InputInventory, Supplier } from '@/lib/db'; // Added Supplier
import { requestPushChanges } from '@/lib/sync'; // Changed from triggerManualSync
import InputInventoryList from '@/components/InputInventoryList';
import InputInventoryForm from '@/components/InputInventoryForm';

export default function InputInventoryPage() {
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState<InputInventory | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null); // For form submission and fetch errors

  const inventoryItems = useLiveQuery(
    async () => {
      try {
        const items = await db.inputInventory
          .orderBy('_last_modified')
          .filter(item => item.is_deleted !== 1) // Ensure we filter out soft-deleted items
          .reverse()
          .toArray();
        setError(null); // Clear previous fetch errors
        return items;
      } catch (err) {
        console.error("Failed to fetch input inventory with useLiveQuery:", err);
        setError("Failed to load inventory items. Please try again.");
        return []; // Return empty array on error
      }
    },
    [] // Dependencies for the query itself
  );

  const suppliers = useLiveQuery(
    async () => {
      try {
        const activeSuppliers = await db.suppliers
          .filter(s => s.is_deleted !== 1)
          .sortBy('name');
        return activeSuppliers;
      } catch (err) {
        console.error("Failed to fetch suppliers for InputInventoryPage:", err);
        setError("Failed to load supplier data. Please try again."); // Or handle more gracefully
        return [];
      }
    },
    []
  );

  const isLoading = inventoryItems === undefined || suppliers === undefined;

  const handleFormSubmit = async (data: Omit<InputInventory, 'id' | '_synced' | '_last_modified' | 'created_at' | 'updated_at' | 'supplier'> | InputInventory) => {
    setIsSubmitting(true);
    setError(null);
    try {
      const now = new Date().toISOString();
      if ('id' in data && data.id) { // Editing existing
        const updatedItem: Partial<InputInventory> = {
          ...data,
          updated_at: now,
          _synced: 0,
          _last_modified: Date.now(),
        };
        await db.inputInventory.update(data.id, updatedItem);
      } else { // Adding new
        const newItemData: Omit<InputInventory, 'id'> = {
          ...(data as Omit<InputInventory, 'id' | '_synced' | '_last_modified' | 'created_at' | 'updated_at' | 'is_deleted' | 'deleted_at'>),
          created_at: now,
          updated_at: now,
          _synced: 0,
          _last_modified: Date.now(),
          is_deleted: 0,
          deleted_at: undefined,
        };
        const id = crypto.randomUUID();
        await db.inputInventory.add({ ...newItemData, id });
      }
      // await fetchData(); // No longer needed, useLiveQuery handles updates
      setShowForm(false);
      setEditingItem(null);
      // Attempt to sync changes immediately
      try {
        console.log("Input inventory saved locally, requesting push...");
        const pushResult = await requestPushChanges();
        if (pushResult.success) {
          console.log("InputInventoryPage: Push requested successfully after form submit.");
        } else {
          console.error("InputInventoryPage: Push request failed after form submit.", pushResult.errors);
          // setError("Item saved locally, but failed to push to server immediately. It will sync later.");
        }
      } catch (syncError) {
        console.error("Error requesting push after input inventory save:", syncError);
      }
    } catch (err: unknown) {
      console.error("Failed to save inventory item:", err);
       if (err instanceof Error && err.name === 'ConstraintError') { // Assuming 'name' could be unique, though not in schema
        setError("Failed to save item. The item name might need to be unique or another constraint was violated.");
      } else {
        setError("Failed to save inventory item. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (item: InputInventory) => {
    setEditingItem(item);
    setShowForm(true);
    setError(null);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm("Are you sure you want to delete this inventory item? This may affect associated cultivation logs.")) {
      setIsDeleting(id);
      setError(null);
      try {
        await db.markForSync('inputInventory', id, {}, true);
        // After successful local delete marking, request a push to the server
        try {
            console.log("Input inventory item marked for deletion, requesting push...");
            const pushResult = await requestPushChanges();
            if (pushResult.success) {
                console.log("InputInventoryPage: Push requested successfully after delete.");
            } else {
                console.error("InputInventoryPage: Push request failed after delete.", pushResult.errors);
            }
        } catch (syncError) {
            console.error("Error requesting push after input inventory delete:", syncError);
        }
      } catch (err) {
        console.error("Failed to delete inventory item:", err);
        setError("Failed to delete inventory item.");
      } finally {
        setIsDeleting(null);
      }
    }
  };

  return (
    <div>
      <header className="bg-white shadow mb-6">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 flex justify-between items-center">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Input Inventory Management</h1>
          <button
            onClick={() => { setEditingItem(null); setShowForm(true); setError(null); }}
            className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded shadow-sm transition-colors duration-150"
          >
            Add New Item
          </button>
        </div>
      </header>

      {showForm && (
        <InputInventoryForm
          initialData={editingItem}
          onSubmit={handleFormSubmit}
          onCancel={() => { setShowForm(false); setEditingItem(null); setError(null);}}
          isSubmitting={isSubmitting}
        />
      )}

      <div className="mt-4">
        {error && <p className="text-red-500 mb-4 p-3 bg-red-100 rounded-md">{error}</p>}
        {isLoading && <p className="text-center text-gray-500">Loading inventory items...</p>}
        {!isLoading && !error && inventoryItems && suppliers && (
          <InputInventoryList
            inventoryItems={inventoryItems}
            suppliers={suppliers} // Pass suppliers to the list
            onEdit={handleEdit}
            onDelete={handleDelete}
            isDeleting={isDeleting}
          />
        )}
        {!isLoading && inventoryItems && suppliers && inventoryItems.length === 0 && !error && (
           <div className="text-center py-10">
            <svg className="mx-auto h-12 w-12 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.125-.504 1.125-1.125V14.25m-17.25 4.5h12.75m0 0V4.125c0-.621-.504-1.125-1.125-1.125H4.5A1.125 1.125 0 003.375 4.125v10.5m12.75 0h3.375c.621 0 1.125-.504 1.125-1.125V4.125c0-.621-.504-1.125-1.125-1.125h-3.375m12.75 0H3.375" />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">No inventory items</h3>
            <p className="mt-1 text-sm text-gray-500">Get started by adding a new inventory item.</p>
            <div className="mt-6">
              <button
                type="button"
                onClick={() => { setEditingItem(null); setShowForm(true); setError(null); }}
                className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
              >
                <svg className="-ml-1 mr-2 h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                </svg>
                Add New Item
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}