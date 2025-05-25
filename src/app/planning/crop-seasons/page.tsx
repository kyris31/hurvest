'use client';

import React, { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, CropSeason } from '@/lib/db';
import CropSeasonList from '@/components/CropSeasonList';
import CropSeasonForm from '@/components/CropSeasonForm';
import { requestPushChanges } from '@/lib/sync';

export default function CropSeasonsPage() {
  const [showForm, setShowForm] = useState(false);
  const [editingSeason, setEditingSeason] = useState<CropSeason | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const cropSeasons = useLiveQuery(
    async () => {
      try {
        // Order by start_date, then name for consistent listing
        return await db.cropSeasons.orderBy('start_date').filter(cs => cs.is_deleted !== 1).toArray();
      } catch (err) {
        console.error("Failed to fetch crop seasons:", err);
        setError("Failed to load crop seasons. Please try refreshing the page.");
        return [];
      }
    },
    [] // dependencies
  );

  const clearMessages = () => {
    setError(null);
    setSuccessMessage(null);
  };

  const handleFormSubmit = async (data: Omit<CropSeason, 'id' | '_synced' | '_last_modified' | 'created_at' | 'updated_at' | 'is_deleted' | 'deleted_at'> | CropSeason) => {
    clearMessages();
    setIsSubmitting(true);
    const now = new Date().toISOString();
    const currentTimestamp = Date.now();

    try {
      if ('id' in data && data.id) { // Editing existing season
        const updatedSeason: CropSeason = {
          ...(data as CropSeason),
          updated_at: now,
          _last_modified: currentTimestamp,
          _synced: 0,
        };
        await db.cropSeasons.update(data.id, updatedSeason);
        setSuccessMessage(`Crop Season "${updatedSeason.name}" updated successfully.`);
      } else { // Adding new season
        const newSeasonData: Omit<CropSeason, 'id'> = {
          ...(data as Omit<CropSeason, 'id' | '_synced' | '_last_modified' | 'created_at' | 'updated_at' | 'is_deleted' | 'deleted_at'>),
          created_at: now,
          updated_at: now,
          _synced: 0,
          _last_modified: currentTimestamp,
          is_deleted: 0,
        };
        const newId = crypto.randomUUID();
        await db.cropSeasons.add({ ...newSeasonData, id: newId });
        setSuccessMessage(`Crop Season "${newSeasonData.name}" created successfully.`);
      }
      setShowForm(false);
      setEditingSeason(null);
      await requestPushChanges();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to save crop season.";
      console.error(msg, err);
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (season: CropSeason) => {
    clearMessages();
    setEditingSeason(season);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    clearMessages();
    // TODO: Add checks for related CropPlans before deleting a season
    if (window.confirm("Are you sure you want to delete this crop season? This action cannot be undone.")) {
      setIsDeleting(id);
      try {
        await db.markForSync('cropSeasons', id, {}, true);
        setSuccessMessage("Crop season marked for deletion.");
        await requestPushChanges();
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to delete crop season.";
        console.error(msg, err);
        setError(msg);
      } finally {
        setIsDeleting(null);
      }
    }
  };
  
  if (!cropSeasons) {
    return <div className="text-center p-8">Loading crop seasons...</div>;
  }

  return (
    <div>
      <header className="bg-white shadow mb-6">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 flex justify-between items-center">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Manage Crop Seasons</h1>
          <button
            onClick={() => { clearMessages(); setEditingSeason(null); setShowForm(true); }}
            className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded shadow-sm transition-colors duration-150"
          >
            Add New Season
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {error && <p className="text-red-500 mb-4 p-3 bg-red-100 rounded-md">{error}</p>}
        {successMessage && <p className="text-green-700 mb-4 p-3 bg-green-100 rounded-md">{successMessage}</p>}

        {showForm && (
          <CropSeasonForm
            initialData={editingSeason}
            onSubmit={handleFormSubmit}
            onCancel={() => { clearMessages(); setShowForm(false); setEditingSeason(null); }}
            isSubmitting={isSubmitting}
          />
        )}

        <div className="mt-4">
          <CropSeasonList
            cropSeasons={cropSeasons}
            onEdit={handleEdit}
            onDelete={handleDelete}
            isDeleting={isDeleting}
          />
        </div>
      </main>
    </div>
  );
}