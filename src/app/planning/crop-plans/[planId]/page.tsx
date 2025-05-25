'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, CropPlan, Crop, Plot, CropSeason, CropPlanStage, CropPlanTask, PlannedStageResource } from '@/lib/db'; // Added PlannedStageResource
import CropPlanStageList from '@/components/CropPlanStageList';
import CropPlanStageForm, { CropPlanStageSubmitData } from '@/components/CropPlanStageForm'; // Import CropPlanStageSubmitData
import CropPlanTaskList from '@/components/CropPlanTaskList';
import { requestPushChanges } from '@/lib/sync';

export default function CropPlanDetailPage() {
  const params = useParams();
  const router = useRouter();
  const planId = typeof params.planId === 'string' ? params.planId : undefined;

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // State for stage management
  const [showStageForm, setShowStageForm] = useState(false);
  const [editingStage, setEditingStage] = useState<CropPlanStage | null>(null);
  const [isSubmittingStage, setIsSubmittingStage] = useState(false);
  const [isDeletingStageId, setIsDeletingStageId] = useState<string | null>(null);

  // State for task management
  const [isUpdatingTaskId, setIsUpdatingTaskId] = useState<string | null>(null);
  
  const cropPlan = useLiveQuery(
    async () => {
      if (!planId) return undefined;
      return db.cropPlans.get(planId);
    },
    [planId] 
  );

  const crop = useLiveQuery(
    async () => {
      if (!cropPlan?.crop_id) return undefined;
      return db.crops.get(cropPlan.crop_id);
    },
    [cropPlan?.crop_id]
  );

  const plot = useLiveQuery(
    async () => {
      if (!cropPlan?.plot_id) return undefined;
      return db.plots.get(cropPlan.plot_id);
    },
    [cropPlan?.plot_id]
  );

  const cropSeason = useLiveQuery(
    async () => {
      if (!cropPlan?.crop_season_id) return undefined;
      return db.cropSeasons.get(cropPlan.crop_season_id);
    },
    [cropPlan?.crop_season_id]
  );

  const stages = useLiveQuery(
    async () => {
      if (!planId) return [];
      return db.cropPlanStages.where('crop_plan_id').equals(planId).filter(s => s.is_deleted !== 1).sortBy('planned_start_date');
    },
    [planId]
  );

  const tasks = useLiveQuery(
    async () => {
      if (!planId || !stages || stages.length === 0) return [];
      const stageIds = stages.map(s => s.id);
      if (stageIds.length === 0) return [];
      return db.cropPlanTasks
        .where('crop_plan_stage_id').anyOf(stageIds)
        .filter(t => t.is_deleted !== 1)
        .sortBy('planned_due_date');
    },
    [planId, stages] // Depends on stages being loaded
  );
  
  const clearMessages = () => {
    setError(null);
    setSuccessMessage(null);
  };

  useEffect(() => {
    if (planId && (cropPlan === null || (cropPlan && cropPlan.is_deleted === 1))) {
      clearMessages();
      setError("Crop plan not found or has been deleted.");
      setIsLoading(false);
    } else if (cropPlan !== undefined && stages !== undefined && tasks !== undefined) { // Wait for tasks too
      setIsLoading(false);
    }
  }, [planId, cropPlan, stages, tasks]);

  if (isLoading) {
    return <div className="text-center p-8">Loading crop plan details...</div>;
  }

  if (error) {
    return (
      <div className="p-4 max-w-4xl mx-auto">
        <p className="text-red-500 bg-red-100 p-4 rounded-md">{error}</p>
        <Link href="/planning/crop-plans" className="mt-4 inline-block text-blue-600 hover:underline">
          &larr; Back to Crop Plans
        </Link>
      </div>
    );
  }

  if (!cropPlan) {
    return (
       <div className="p-4 max-w-4xl mx-auto">
        <p className="text-gray-500 bg-gray-100 p-4 rounded-md">Crop plan data not available.</p>
        <Link href="/planning/crop-plans" className="mt-4 inline-block text-blue-600 hover:underline">
          &larr; Back to Crop Plans
        </Link>
      </div>
    );
  }

  const displayDate = (dateString?: string) => dateString ? new Date(dateString).toLocaleDateString() : 'N/A';

  return (
    <div>
      <header className="bg-white shadow mb-6">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center">
            <h1 className="text-3xl font-bold tracking-tight text-gray-900">
              Crop Plan: {cropPlan.plan_name}
            </h1>
            <Link href="/planning/crop-plans" className="text-sm text-blue-600 hover:underline">
              &larr; Back to All Plans
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="bg-white shadow overflow-hidden sm:rounded-lg mb-6">
          <div className="px-4 py-5 sm:px-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900">Plan Details</h3>
            {/* TODO: Add Edit button for the plan itself here */}
          </div>
          <div className="border-t border-gray-200 px-4 py-5 sm:p-0">
            <dl className="sm:divide-y sm:divide-gray-200">
              <div className="py-3 sm:py-4 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                <dt className="text-sm font-medium text-gray-500">Crop</dt>
                <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">{crop ? `${crop.name} ${crop.variety || ''}`.trim() : 'Loading...'}</dd>
              </div>
              <div className="py-3 sm:py-4 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                <dt className="text-sm font-medium text-gray-500">Plot</dt>
                <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">{plot ? plot.name : (cropPlan.plot_id ? 'Loading...' : 'N/A')}</dd>
              </div>
              <div className="py-3 sm:py-4 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                <dt className="text-sm font-medium text-gray-500">Season</dt>
                <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">{cropSeason ? cropSeason.name : 'Loading...'}</dd>
              </div>
              <div className="py-3 sm:py-4 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                <dt className="text-sm font-medium text-gray-500">Planting Type</dt>
                <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">{cropPlan.planting_type.replace('_', ' ')}</dd>
              </div>
              <div className="py-3 sm:py-4 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                <dt className="text-sm font-medium text-gray-500">Status</dt>
                <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">{cropPlan.status ? cropPlan.status.charAt(0).toUpperCase() + cropPlan.status.slice(1).toLowerCase().replace('_', ' ') : 'N/A'}</dd>
              </div>
              <div className="py-3 sm:py-4 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                <dt className="text-sm font-medium text-gray-500">Planned Sowing</dt>
                <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">{displayDate(cropPlan.planned_sowing_date)}</dd>
              </div>
              {cropPlan.planting_type !== 'DIRECT_SEED' && (
                <div className="py-3 sm:py-4 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                  <dt className="text-sm font-medium text-gray-500">Planned Transplant</dt>
                  <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">{displayDate(cropPlan.planned_transplant_date)}</dd>
                </div>
              )}
              <div className="py-3 sm:py-4 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                <dt className="text-sm font-medium text-gray-500">Est. Days to Maturity</dt>
                <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">{cropPlan.estimated_days_to_maturity ?? 'N/A'}</dd>
              </div>
              <div className="py-3 sm:py-4 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                <dt className="text-sm font-medium text-gray-500">Planned First Harvest</dt>
                <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">{displayDate(cropPlan.planned_first_harvest_date)}</dd>
              </div>
              <div className="py-3 sm:py-4 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                <dt className="text-sm font-medium text-gray-500">Planned Last Harvest</dt>
                <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">{displayDate(cropPlan.planned_last_harvest_date)}</dd>
              </div>
              <div className="py-3 sm:py-4 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                <dt className="text-sm font-medium text-gray-500">Target Plants</dt>
                <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">{cropPlan.target_quantity_plants ?? 'N/A'}</dd>
              </div>
              <div className="py-3 sm:py-4 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                <dt className="text-sm font-medium text-gray-500">Target Area (sqm)</dt>
                <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">{cropPlan.target_quantity_area_sqm ?? 'N/A'}</dd>
              </div>
              <div className="py-3 sm:py-4 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                <dt className="text-sm font-medium text-gray-500">Target Yield (kg)</dt>
                <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">{cropPlan.target_yield_estimate_kg ?? 'N/A'} {cropPlan.target_yield_unit || ''}</dd>
              </div>
              {cropPlan.notes && (
                <div className="py-3 sm:py-4 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                  <dt className="text-sm font-medium text-gray-500">Notes</dt>
                  <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2 whitespace-pre-wrap">{cropPlan.notes}</dd>
                </div>
              )}
            </dl>
          </div>
        </div>

        <div className="mt-8">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-semibold text-gray-900">Plan Stages</h3>
            <button
              onClick={() => { clearMessages(); setEditingStage(null); setShowStageForm(true); }}
              className="bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 px-4 rounded-md text-sm shadow-sm transition-colors duration-150"
            >
              Add New Stage
            </button>
          </div>

          {showStageForm && planId && (
            <CropPlanStageForm
              cropPlanId={planId}
              initialData={editingStage}
              onSubmit={handleStageFormSubmit}
              onCancel={() => { clearMessages(); setShowStageForm(false); setEditingStage(null);}}
              isSubmitting={isSubmittingStage}
            />
          )}

          {stages && stages.length > 0 ? (
            <CropPlanStageList
              stages={stages}
              onEditStage={handleEditStage}
              onDeleteStage={handleDeleteStage}
              isDeletingStageId={isDeletingStageId}
            />
          ) : !showStageForm && !isLoading ? ( // Avoid showing "No stages" while form is open or loading
            <p className="text-gray-500 py-4 text-center">No stages defined for this plan yet. Click "Add New Stage" to begin.</p>
          ) : null}
        </div>
        
        <div className="mt-8">
          <h3 className="text-xl font-semibold text-gray-900 mb-4">Related Tasks</h3>
          {tasks && tasks.length > 0 ? (
            <CropPlanTaskList
              tasks={tasks}
              onToggleTaskStatus={handleToggleTaskStatus}
              isUpdatingTaskId={isUpdatingTaskId}
            />
          ) : !isLoading ? (
             <p className="text-gray-500 py-4 text-center">No tasks found for this plan's stages.</p>
          ) : null}
        </div>

      </main>
    </div>
  );

  // Handler functions for stages
  async function handleStageFormSubmit(formData: CropPlanStageSubmitData) {
    clearMessages();
    setIsSubmittingStage(true);
    const { stageDetails, plannedResources } = formData;
    const now = new Date().toISOString();
    const currentTimestamp = Date.now();

    try {
      await db.transaction('rw', db.cropPlanStages, db.plannedStageResources, async () => {
        let stageIdToUse: string;

        if ('id' in stageDetails && stageDetails.id) { // Editing existing stage
          const stageId = stageDetails.id;
          stageIdToUse = stageId;
          const updatedStageData: Partial<CropPlanStage> = {
            ...stageDetails, // contains all fields from form, including potentially unchanged ones
            updated_at: now,
            _last_modified: currentTimestamp,
            _synced: 0,
          };
          // Ensure we don't try to spread undefined initialData if it was null
          const finalUpdateData = editingStage ? { ...editingStage, ...updatedStageData } : updatedStageData;
          await db.cropPlanStages.update(stageId, finalUpdateData);
          setSuccessMessage(`Stage "${stageDetails.stage_name}" updated successfully.`);

          // Handle resources for existing stage:
          const existingResources = await db.plannedStageResources
            .where('crop_plan_stage_id').equals(stageId)
            .filter(r => r.is_deleted !== 1)
            .toArray();
          
          const resourcesFromFormMap = new Map(plannedResources.map(r => [r.id, r]));
          const existingResourcesMap = new Map(existingResources.map(r => [r.id, r]));

          // Resources to delete (in DB but not in form)
          for (const existingRes of existingResources) {
            if (!resourcesFromFormMap.has(existingRes.id)) {
              await db.markForSync('plannedStageResources', existingRes.id, {}, true);
            }
          }
          // Resources to add or update
          for (const formRes of plannedResources) {
            if (existingResourcesMap.has(formRes.id)) { // Update existing resource
              const updatedResData: Partial<PlannedStageResource> = {
                ...formRes,
                updated_at: now,
                _last_modified: currentTimestamp,
                _synced: 0,
              };
              await db.plannedStageResources.update(formRes.id, updatedResData);
            } else { // Add new resource
              const newResource: Omit<PlannedStageResource, 'id'> = {
                ...formRes, // formRes already has a temp UUID id, but we let DB generate one or use it if it's truly new
                crop_plan_stage_id: stageId,
                created_at: now,
                updated_at: now,
                _last_modified: currentTimestamp,
                _synced: 0,
                is_deleted: 0,
              };
              await db.plannedStageResources.add(newResource as PlannedStageResource); // Cast if ID is handled by Dexie
            }
          }

        } else { // Adding new stage
          const newStageId = crypto.randomUUID();
          stageIdToUse = newStageId;
          const newStageData: CropPlanStage = {
            ...(stageDetails as Omit<CropPlanStage, 'id' | '_synced' | '_last_modified' | 'created_at' | 'updated_at' | 'is_deleted' | 'deleted_at'>), // Cast to base type
            id: newStageId,
            crop_plan_id: planId!,
            created_at: now,
            updated_at: now,
            _synced: 0,
            _last_modified: currentTimestamp,
            is_deleted: 0,
          };
          await db.cropPlanStages.add(newStageData);
          setSuccessMessage(`Stage "${newStageData.stage_name}" added successfully.`);

          // Add all resources from the form, linking to the new stageId
          for (const formRes of plannedResources) {
            const newResource: Omit<PlannedStageResource, 'id'> = {
              ...formRes,
              crop_plan_stage_id: newStageId,
              created_at: now,
              updated_at: now,
              _last_modified: currentTimestamp,
              _synced: 0,
              is_deleted: 0,
            };
            await db.plannedStageResources.add(newResource as PlannedStageResource);
          }
        }
      }); // End of transaction

      setShowStageForm(false);
      setEditingStage(null);
      await requestPushChanges();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to save stage and its resources.";
      console.error("Error saving crop plan stage/resources:", msg, err);
      setError(`Error: ${msg}`);
    } finally {
      setIsSubmittingStage(false);
    }
  }

  function handleEditStage(stage: CropPlanStage) {
    clearMessages();
    setEditingStage(stage);
    setShowStageForm(true);
  }

  async function handleDeleteStage(stageId: string) {
    clearMessages();
    // TODO: Add checks for related CropPlanTasks before deleting a stage
    if (window.confirm("Are you sure you want to delete this stage? This will also delete its tasks.")) {
      setIsDeletingStageId(stageId);
      try {
        // For Dexie, if not cascaded, query and delete tasks:
        // await db.cropPlanTasks.where('crop_plan_stage_id').equals(stageId).delete();
        await db.markForSync('cropPlanStages', stageId, {}, true);
        setSuccessMessage("Stage marked for deletion.");
        await requestPushChanges();
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to delete stage.";
        console.error("Error deleting crop plan stage:",msg, err);
        setError(`Error deleting stage: ${msg}`);
      } finally {
        setIsDeletingStageId(null);
      }
    }
  } // End of handleDeleteStage

  async function handleToggleTaskStatus(taskId: string, currentStatus: CropPlanTask['status']) {
    clearMessages();
    setIsUpdatingTaskId(taskId);
      const newStatus = currentStatus === 'DONE' ? 'TODO' : 'DONE';
      try {
        const changes: Partial<CropPlanTask> = {
          status: newStatus,
          actual_completion_date: newStatus === 'DONE' ? new Date().toISOString().split('T')[0] : undefined,
        };
        await db.markForSync('cropPlanTasks', taskId, changes);
        setSuccessMessage(`Task status updated to ${newStatus}.`);
        await requestPushChanges();
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to update task status.";
        console.error("Error updating task status:", msg, err);
        setError(`Error updating task: ${msg}`);
      } finally {
        setIsUpdatingTaskId(null);
      }
    } // End of handleToggleTaskStatus
} // End of CropPlanDetailPage component