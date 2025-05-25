'use client';

import React, { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, CropPlan, Crop, Plot, CropSeason } from '@/lib/db';
import CropPlanList from '@/components/CropPlanList';
import CropPlanForm from '@/components/CropPlanForm';
import { requestPushChanges } from '@/lib/sync';

export default function CropPlansPage() {
  const [showForm, setShowForm] = useState(false);
  const [editingPlan, setEditingPlan] = useState<CropPlan | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const cropPlans = useLiveQuery(
    async () => db.cropPlans.orderBy('planned_sowing_date').filter(cp => cp.is_deleted !== 1).toArray(),
    []
  );
  const crops = useLiveQuery(async () => db.crops.where('is_deleted').notEqual(1).toArray(), []);
  const plots = useLiveQuery(async () => db.plots.where('is_deleted').notEqual(1).toArray(), []);
  const cropSeasons = useLiveQuery(async () => db.cropSeasons.where('is_deleted').notEqual(1).toArray(), []);

  const clearMessages = () => {
    setError(null);
    setSuccessMessage(null);
  };

  const handleFormSubmit = async (data: Omit<CropPlan, 'id' | '_synced' | '_last_modified' | 'created_at' | 'updated_at' | 'is_deleted' | 'deleted_at'> | CropPlan) => {
    clearMessages();
    setIsSubmitting(true);
    const now = new Date().toISOString();
    const currentTimestamp = Date.now();

    try {
      if ('id' in data && data.id) { // Editing
        const updatedPlan: CropPlan = {
          ...(data as CropPlan),
          updated_at: now,
          _last_modified: currentTimestamp,
          _synced: 0,
        };
        await db.cropPlans.update(data.id, updatedPlan);
        setSuccessMessage(`Crop Plan "${updatedPlan.plan_name}" updated successfully.`);
      } else { // Adding new
        const newPlanData: Omit<CropPlan, 'id'> = {
          ...(data as Omit<CropPlan, 'id' | '_synced' | '_last_modified' | 'created_at' | 'updated_at' | 'is_deleted' | 'deleted_at'>),
          created_at: now,
          updated_at: now,
          _synced: 0,
          _last_modified: currentTimestamp,
          is_deleted: 0,
        };
        const newId = crypto.randomUUID();
        await db.cropPlans.add({ ...newPlanData, id: newId });
        setSuccessMessage(`Crop Plan "${newPlanData.plan_name}" created successfully.`);
      }
      setShowForm(false);
      setEditingPlan(null);
      await requestPushChanges();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to save crop plan.";
      console.error(msg, err);
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (plan: CropPlan) => {
    clearMessages();
    setEditingPlan(plan);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    clearMessages();
    // TODO: Add checks for related CropPlanStages before deleting a plan
    if (window.confirm("Are you sure you want to delete this crop plan? This will also delete its stages and tasks.")) {
      setIsDeleting(id);
      try {
        // Also delete related stages and tasks (Dexie will handle cascading deletes if foreign keys are set up with onDelete: 'CASCADE')
        // For now, manual deletion or rely on Supabase cascade if defined.
        // For Dexie, if not cascaded, query and delete them:
        // await db.cropPlanStages.where('crop_plan_id').equals(id).delete(); 
        // await db.cropPlanTasks.where(...).delete(); // More complex if tasks link to stages
        
        await db.markForSync('cropPlans', id, {}, true);
        setSuccessMessage("Crop plan marked for deletion.");
        await requestPushChanges();
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to delete crop plan.";
        console.error(msg, err);
        setError(msg);
      } finally {
        setIsDeleting(null);
      }
    }
  };
  
  const isLoading = !cropPlans || !crops || !plots || !cropSeasons;

  return (
    <div>
      <header className="bg-white shadow mb-6">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 flex justify-between items-center">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Crop Plans</h1>
          <button
            onClick={() => { clearMessages(); setEditingPlan(null); setShowForm(true); }}
            className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded shadow-sm transition-colors duration-150"
          >
            Add New Crop Plan
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {error && <p className="text-red-500 mb-4 p-3 bg-red-100 rounded-md">{error}</p>}
        {successMessage && <p className="text-green-700 mb-4 p-3 bg-green-100 rounded-md">{successMessage}</p>}

        {showForm && (
          <CropPlanForm
            initialData={editingPlan}
            onSubmit={handleFormSubmit}
            onCancel={() => { clearMessages(); setShowForm(false); setEditingPlan(null); }}
            isSubmitting={isSubmitting}
          />
        )}

        <div className="mt-4">
          {isLoading ? (
            <p className="text-center text-gray-500">Loading crop plan data...</p>
          ) : (
            <CropPlanList
              cropPlans={cropPlans || []}
              crops={crops || []}
              plots={plots || []}
              cropSeasons={cropSeasons || []}
              onEdit={handleEdit}
              onDelete={handleDelete}
              isDeleting={isDeleting}
            />
          )}
        </div>
      </main>
    </div>
  );
}