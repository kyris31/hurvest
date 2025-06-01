'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link'; // Import Link
import { db } from '@/lib/db';
import type { Flock } from '@/lib/db';
import FlockForm from '@/components/Poultry/FlockForm';
import { requestPushChanges } from '@/lib/sync';
import { formatDateToDDMMYYYY } from '@/lib/dateUtils';

export default function FlocksPage() {
  const [flocks, setFlocks] = useState<Flock[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingFlock, setEditingFlock] = useState<Flock | null>(null);
  const [isDeleting, setIsDeleting] = useState<string | null>(null); // Store ID of flock being deleted

  const router = useRouter();
  const searchParams = useSearchParams();

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const allFlocks = await db.flocks.where('is_deleted').notEqual(1).toArray();
      setFlocks(allFlocks.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()));
    } catch (err) {
      console.error("Failed to fetch flocks:", err);
      setError("Failed to load flock data. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (searchParams.get('action') === 'add') {
      setShowForm(true);
      setEditingFlock(null);
    }
  }, [searchParams]);

  const handleEdit = (flock: Flock) => {
    setEditingFlock(flock);
    setShowForm(true);
    setError(null);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm("Are you sure you want to delete this flock and all its related records (health, feed logs etc.)? This action cannot be undone locally.")) {
      setIsDeleting(id);
      setError(null);
      try {
        await db.transaction('rw', db.flocks, db.flock_records, db.feed_logs, async () => {
          // Mark related flock_records for deletion
          const relatedFlockRecords = await db.flock_records.where('flock_id').equals(id).toArray();
          for (const record of relatedFlockRecords) {
            await db.markForSync('flock_records', record.id, {}, true);
          }
          console.log(`Marked ${relatedFlockRecords.length} flock records for deletion related to flock ${id}.`);

          // Mark related feed_logs for deletion
          const relatedFeedLogs = await db.feed_logs.where('flock_id').equals(id).toArray();
          for (const log of relatedFeedLogs) {
            await db.markForSync('feed_logs', log.id, {}, true);
          }
          console.log(`Marked ${relatedFeedLogs.length} feed logs for deletion related to flock ${id}.`);

          // Mark the flock itself for deletion
          await db.markForSync('flocks', id, {}, true);
        });
        
        await fetchData(); // Refresh list
        await requestPushChanges(); // Attempt to push changes immediately
        console.log(`Flock ${id} and its related records marked for deletion.`);
      } catch (err) {
        console.error("Failed to delete flock:", err);
        setError("Failed to delete flock.");
      } finally {
        setIsDeleting(null);
      }
    }
  };

  const handleFormClose = () => {
    setShowForm(false);
    setEditingFlock(null);
    setError(null);
    if (searchParams.get('action') === 'add') {
      router.replace('/poultry/flocks', undefined); // Clear query param
    }
    fetchData(); // Refresh data when form closes
  };
  
  // Placeholder for FlockForm submission logic
  // const handleFormSubmit = async (data: Flock | Omit<Flock, 'id'>) => {
  //   console.log("Form submitted", data);
  //   // Actual save logic will be in FlockForm and call db.markForSync
  //   handleFormClose();
  // };


  return (
    <div>
      <header className="bg-white shadow mb-6">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 flex justify-between items-center">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Flock Management</h1>
          <button
            onClick={() => { setEditingFlock(null); setShowForm(true); setError(null); }}
            className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded shadow-sm transition-colors duration-150"
          >
            Add New Flock
          </button>
        </div>
      </header>

      {showForm && (
        <FlockForm
          initialData={editingFlock}
          onSubmitSuccess={handleFormClose}
          onCancel={handleFormClose}
          // isSubmitting={isSubmitting} // Add isSubmitting state if needed from this page
        />
      )}

      <div className="mt-4">
        {error && <p className="text-red-500 mb-4 p-3 bg-red-100 rounded-md">{error}</p>}
        {isLoading && <p className="text-center text-gray-500">Loading flock records...</p>}
        {!isLoading && !showForm && flocks.length === 0 && (
          <p className="text-center text-gray-500">No flocks found. Click "Add New Flock" to get started.</p>
        )}
        {!isLoading && !showForm && flocks.length > 0 && (
          <div className="overflow-x-auto bg-white shadow-md rounded-lg">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-100">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Breed</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Hatch Date</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Current Birds</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {flocks.map((flock) => (
                  <tr key={flock.id} className={`${isDeleting === flock.id ? 'opacity-50' : ''}`}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{flock.name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{flock.flock_type === 'egg_layer' ? 'Egg Layer' : 'Broiler'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{flock.breed || '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{flock.hatch_date ? formatDateToDDMMYYYY(flock.hatch_date) : '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{flock.current_bird_count ?? flock.initial_bird_count ?? 0}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                      <button
                        onClick={() => handleEdit(flock)}
                        className="text-indigo-600 hover:text-indigo-900 disabled:text-gray-300"
                        disabled={isDeleting === flock.id}
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(flock.id)}
                        className="text-red-600 hover:text-red-900 disabled:text-gray-300"
                        disabled={isDeleting === flock.id}
                      >
                        {isDeleting === flock.id ? 'Deleting...' : 'Delete'}
                      </button>
                      <Link href={`/poultry/flocks/${flock.id}`} className="text-green-600 hover:text-green-900">
                        Details
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}