'use client';

import React, { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, Plot } from '@/lib/db';
import PlotList from '@/components/PlotList';
import PlotForm from '@/components/PlotForm';
import { requestPushChanges } from '@/lib/sync'; // Assuming sync library utility

export default function PlotsPage() {
  const [showForm, setShowForm] = useState(false);
  const [editingPlot, setEditingPlot] = useState<Plot | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const plots = useLiveQuery(
    async () => {
      try {
        return await db.plots.orderBy('name').filter(p => p.is_deleted !== 1).toArray();
      } catch (err) {
        console.error("Failed to fetch plots:", err);
        setError("Failed to load plots. Please try refreshing the page.");
        return [];
      }
    },
    [] // dependencies
  );

  const clearMessages = () => {
    setError(null);
    setSuccessMessage(null);
  };

  const handleFormSubmit = async (data: Omit<Plot, 'id' | '_synced' | '_last_modified' | 'created_at' | 'updated_at' | 'is_deleted' | 'deleted_at'> | Plot) => {
    clearMessages();
    setIsSubmitting(true);
    const now = new Date().toISOString();
    const currentTimestamp = Date.now();

    try {
      if ('id' in data && data.id) { // Editing existing plot
        const updatedPlot: Plot = {
          ...(data as Plot),
          updated_at: now,
          _last_modified: currentTimestamp,
          _synced: 0,
        };
        await db.plots.update(data.id, updatedPlot);
        setSuccessMessage(`Plot "${updatedPlot.name}" updated successfully.`);
      } else { // Adding new plot
        const newPlotData: Omit<Plot, 'id'> = {
          ...(data as Omit<Plot, 'id' | '_synced' | '_last_modified' | 'created_at' | 'updated_at' | 'is_deleted' | 'deleted_at'>),
          created_at: now,
          updated_at: now,
          _synced: 0,
          _last_modified: currentTimestamp,
          is_deleted: 0,
        };
        const newId = crypto.randomUUID();
        await db.plots.add({ ...newPlotData, id: newId });
        setSuccessMessage(`Plot "${newPlotData.name}" created successfully.`);
      }
      setShowForm(false);
      setEditingPlot(null);
      await requestPushChanges();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to save plot.";
      console.error(msg, err);
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (plot: Plot) => {
    clearMessages();
    setEditingPlot(plot);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    clearMessages();
    // TODO: Add checks for related CropPlans before deleting a plot
    // For now, direct delete:
    if (window.confirm("Are you sure you want to delete this plot? This action cannot be undone.")) {
      setIsDeleting(id);
      try {
        await db.markForSync('plots', id, {}, true);
        setSuccessMessage("Plot marked for deletion.");
        await requestPushChanges();
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to delete plot.";
        console.error(msg, err);
        setError(msg);
      } finally {
        setIsDeleting(null);
      }
    }
  };

  if (!plots) {
    return <div className="text-center p-8">Loading plots...</div>;
  }

  return (
    <div>
      <header className="bg-white shadow mb-6">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 flex justify-between items-center">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Manage Plots</h1>
          <button
            onClick={() => { clearMessages(); setEditingPlot(null); setShowForm(true); }}
            className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded shadow-sm transition-colors duration-150"
          >
            Add New Plot
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {error && <p className="text-red-500 mb-4 p-3 bg-red-100 rounded-md">{error}</p>}
        {successMessage && <p className="text-green-700 mb-4 p-3 bg-green-100 rounded-md">{successMessage}</p>}

        {showForm && (
          <PlotForm
            initialData={editingPlot}
            onSubmit={handleFormSubmit}
            onCancel={() => { clearMessages(); setShowForm(false); setEditingPlot(null); }}
            isSubmitting={isSubmitting}
          />
        )}

        <div className="mt-4">
          <PlotList
            plots={plots}
            onEdit={handleEdit}
            onDelete={handleDelete}
            isDeleting={isDeleting}
          />
        </div>
      </main>
    </div>
  );
}