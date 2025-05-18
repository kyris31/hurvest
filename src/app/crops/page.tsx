'use client';

import React, { useState } from 'react'; // Removed useCallback as fetchData is now inline, Removed useEffect
import { useLiveQuery } from 'dexie-react-hooks';
import { db, Crop } from '@/lib/db';
import CropList from '@/components/CropList';
import CropForm from '@/components/CropForm';
import { PlusCircleIcon } from '@heroicons/react/24/outline';

// syncCounter prop is no longer needed with useLiveQuery
// interface CropsPageProps {
//   syncCounter?: number;
// }

export default function CropsPage(/*{ syncCounter }: CropsPageProps*/) {
  const [showForm, setShowForm] = useState(false);
  const [editingCrop, setEditingCrop] = useState<Crop | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null); // For form submission errors primarily

  // Use useLiveQuery to reactively get crops
  const crops = useLiveQuery(
    async () => {
      try {
        // console.log("CropsPage: useLiveQuery fetching crops..."); // DEBUG
        const cropsData = await db.crops.orderBy('name').filter(c => c.is_deleted !== 1).toArray();
        // console.log('CropsPage: useLiveQuery fetched cropsData:', JSON.stringify(cropsData.slice(0, 2), null, 2)); // DEBUG
        setError(null); // Clear previous fetch errors if successful
        return cropsData;
      } catch (err) {
        console.error("Failed to fetch crops with useLiveQuery:", err);
        setError("Failed to load crops. Please try again.");
        return []; // Return empty array on error
      }
    },
    [] // Dependencies for the query itself, not for re-triggering. Re-runs when Dexie data changes.
  );

  // isLoading can be inferred from crops being undefined initially
  const isLoading = crops === undefined;

  // This useEffect is no longer needed as useLiveQuery handles data fetching and updates.
  // useEffect(() => {
  //   console.log("CropsPage: fetchData triggered by syncCounter or initial load.", syncCounter);
  //   fetchData();
  // }, [fetchData, syncCounter]);

  const handleFormSubmit = async (cropData: Omit<Crop, 'id' | '_synced' | '_last_modified' | 'created_at' | 'updated_at' | 'is_deleted' | 'deleted_at'>) => {
    setIsSubmitting(true);
    setError(null);
    const now = new Date().toISOString();

    try {
      if (editingCrop) {
        const updatedCrop: Partial<Crop> = {
          ...cropData,
          updated_at: now,
          _synced: 0,
          _last_modified: Date.now(),
        };
        await db.crops.update(editingCrop.id, updatedCrop);
      } else {
        const newCrop: Crop = {
          id: crypto.randomUUID(),
          ...cropData,
          created_at: now,
          updated_at: now,
          _synced: 0,
          _last_modified: Date.now(),
          is_deleted: 0,
        };
        await db.crops.add(newCrop);
      }
      // await fetchData(); // No longer need to manually call fetchData, useLiveQuery handles updates
      setShowForm(false);
      setEditingCrop(null);
    } catch (err: unknown) {
      // It's good practice to check the type of the error before accessing properties
      const errorMessage = err instanceof Error ? err.message : "Failed to save crop. Please try again.";
      console.error("Failed to save crop:", err);
      setError(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (crop: Crop) => {
    setEditingCrop(crop);
    setShowForm(true);
    setError(null);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm("Are you sure you want to delete this crop? This might affect related records if not handled by database constraints (e.g., seed batches).")) {
      setIsDeleting(id);
      setError(null);
      try {
        await db.markForSync(db.crops, id, true);
        // await fetchData(); // No longer need to manually call fetchData
      } catch (err) {
        console.error("Failed to delete crop:", err);
        setError("Failed to delete crop.");
      } finally {
        setIsDeleting(null);
      }
    }
  };

  return (
    <div>
      <header className="bg-white shadow mb-6">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex flex-wrap justify-between items-center gap-4">
            <h1 className="text-3xl font-bold tracking-tight text-gray-900">Manage Crops</h1>
            <button
              onClick={() => { setEditingCrop(null); setShowForm(true); setError(null); }}
              className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded shadow-sm transition-colors duration-150 text-sm flex items-center"
            >
              <PlusCircleIcon className="h-5 w-5 mr-2" />
              Add New Crop
            </button>
          </div>
        </div>
      </header>

      {showForm && (
        <CropForm
          initialData={editingCrop || undefined}
          onSubmit={handleFormSubmit}
          onCancel={() => { setShowForm(false); setEditingCrop(null); setError(null);}}
          isSubmitting={isSubmitting}
        />
      )}

      <div className="mx-auto max-w-7xl py-0 sm:px-6 lg:px-8"> {/* Adjusted padding */}
        {error && <p className="text-red-500 mb-4 p-3 bg-red-100 rounded-md">{error}</p>}
        {isLoading && <p className="text-center text-gray-500">Loading crops...</p>}
        {!isLoading && !error && crops && (
          <CropList
            crops={crops} // crops is now directly from useLiveQuery
            onEdit={handleEdit}
            onDelete={handleDelete}
            isDeleting={isDeleting}
          />
        )}
        {!isLoading && crops && crops.length === 0 && !error && (
           <div className="text-center py-10">
            <svg className="mx-auto h-12 w-12 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 15.75V18m-7.5-6.75h.008v.008H8.25v-.008zm0 2.25h.008v.008H8.25v-.008zm0 2.25h.008v.008H8.25v-.008zm0 2.25h.008v.008H8.25v-.008zm.375-6.75h.008v.008H8.625v-.008zm0 2.25h.008v.008H8.625v-.008zm0 2.25h.008v.008H8.625v-.008zm0 2.25h.008v.008H8.625v-.008zm.375-6.75h.008v.008H9v-.008zm0 2.25h.008v.008H9v-.008zm0 2.25h.008v.008H9v-.008zm.375-6.75h.008v.008h-.008v-.008zm0 2.25h.008v.008h-.008v-.008zm0 2.25h.008v.008h-.008v-.008zm0 2.25h.008v.008h-.008v-.008zm.375-6.75h.008v.008H9.75v-.008zm0 2.25h.008v.008H9.75v-.008zm0 2.25h.008v.008H9.75v-.008zm0 2.25h.008v.008H9.75v-.008zm.375-6.75h.008v.008H10.125v-.008zm0 2.25h.008v.008H10.125v-.008zm0 2.25h.008v.008H10.125v-.008zm0 2.25h.008v.008H10.125v-.008zm.375-6.75h.008v.008H10.5v-.008zm0 2.25h.008v.008H10.5v-.008zm0 2.25h.008v.008H10.5v-.008zm.375-6.75h.008v.008h-.008v-.008zm0 2.25h.008v.008h-.008v-.008zm0 2.25h.008v.008h-.008v-.008zm0 2.25h.008v.008h-.008v-.008zm.375-6.75h.008v.008H11.25v-.008zm0 2.25h.008v.008H11.25v-.008zm0 2.25h.008v.008H11.25v-.008zm0 2.25h.008v.008H11.25v-.008zm.375-6.75h.008v.008H11.625v-.008zm0 2.25h.008v.008H11.625v-.008zm0 2.25h.008v.008H11.625v-.008zm0 2.25h.008v.008H11.625v-.008zm.375-6.75h.008v.008H12v-.008zm0 2.25h.008v.008H12v-.008zm0 2.25h.008v.008H12v-.008zm.375-6.75h.008v.008h-.008v-.008zm0 2.25h.008v.008h-.008v-.008zm0 2.25h.008v.008h-.008v-.008zm0 2.25h.008v.008h-.008v-.008zm.375-6.75h.008v.008H12.75v-.008zm0 2.25h.008v.008H12.75v-.008zm0 2.25h.008v.008H12.75v-.008zm0 2.25h.008v.008H12.75v-.008zm.375-6.75h.008v.008H13.125v-.008zm0 2.25h.008v.008H13.125v-.008zm0 2.25h.008v.008H13.125v-.008zm0 2.25h.008v.008H13.125v-.008zm.375-6.75h.008v.008H13.5v-.008zm0 2.25h.008v.008H13.5v-.008zm0 2.25h.008v.008H13.5v-.008zm.375-6.75h.008v.008h-.008v-.008zm0 2.25h.008v.008h-.008v-.008zm0 2.25h.008v.008h-.008v-.008zm0 2.25h.008v.008h-.008v-.008zm.375-6.75h.008v.008H14.25v-.008zm0 2.25h.008v.008H14.25v-.008zm0 2.25h.008v.008H14.25v-.008zm0 2.25h.008v.008H14.25v-.008zm.375-6.75h.008v.008H14.625v-.008zm0 2.25h.008v.008H14.625v-.008zm0 2.25h.008v.008H14.625v-.008zm0 2.25h.008v.008H14.625v-.008zm.375-6.75h.008v.008H15v-.008zm0 2.25h.008v.008H15v-.008zm0 2.25h.008v.008H15v-.008zm.375-6.75h.008v.008h-.008v-.008zm0 2.25h.008v.008h-.008v-.008zm0 2.25h.008v.008h-.008v-.008zm0 2.25h.008v.008h-.008v-.008zm.375-6.75h.008v.008H15.75v-.008zm0 2.25h.008v.008H15.75v-.008zm0 2.25h.008v.008H15.75v-.008zm0 2.25h.008v.008H15.75v-.008zM6 12.75a.75.75 0 11-1.5 0 .75.75 0 011.5 0zM10.5 12.75a.75.75 0 11-1.5 0 .75.75 0 011.5 0zM15 12.75a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">No crops found</h3>
            <p className="mt-1 text-sm text-gray-500">Get started by adding your first crop.</p>
            <div className="mt-6">
              <button
                type="button"
                onClick={() => { setEditingCrop(null); setShowForm(true); setError(null); }}
                className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
              >
                <PlusCircleIcon className="h-5 w-5 mr-2" />
                Add New Crop
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}