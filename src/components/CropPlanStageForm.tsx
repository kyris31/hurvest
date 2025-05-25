'use client';

import React, { useState, useEffect } from 'react';
import { CropPlanStage, PlannedStageResource, InputInventory, db } from '@/lib/db';

// Define a type for the data passed up by the form
export interface CropPlanStageSubmitData {
  stageDetails: Omit<CropPlanStage, 'id' | '_synced' | '_last_modified' | 'created_at' | 'updated_at' | 'is_deleted' | 'deleted_at'> | CropPlanStage;
  plannedResources: PlannedStageResource[];
}

interface CropPlanStageFormProps {
  cropPlanId: string; // To associate the stage with its parent plan
  initialData?: CropPlanStage | null;
  onSubmit: (data: CropPlanStageSubmitData) => Promise<void>; 
  onCancel: () => void;
  isSubmitting: boolean;
}

const STAGE_TYPES: CropPlanStage['stage_type'][] = [
  'NURSERY_SOWING', 
  'NURSERY_POTTING_ON', 
  'DIRECT_SEEDING', 
  'SOIL_PREPARATION', 
  'TRANSPLANTING', 
  'FIELD_MAINTENANCE', 
  'PEST_DISEASE_CONTROL', 
  'HARVEST_WINDOW'
];
const STAGE_STATUSES: CropPlanStage['status'][] = ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'SKIPPED'];

export default function CropPlanStageForm({
  cropPlanId,
  initialData,
  onSubmit,
  onCancel,
  isSubmitting,
}: CropPlanStageFormProps) {
  // Common fields
  const [stageName, setStageName] = useState('');
  const [stageType, setStageType] = useState<CropPlanStage['stage_type']>('NURSERY_SOWING');
  const [plannedStartDate, setPlannedStartDate] = useState('');
  const [plannedDurationDays, setPlannedDurationDays] = useState<number | ''>('');
  const [status, setStatus] = useState<CropPlanStage['status']>('PENDING');
  const [notes, setNotes] = useState('');

  // Nursery fields
  const [nurseryTotalDays, setNurseryTotalDays] = useState<number | ''>('');
  const [nurserySeedingTrayType, setNurserySeedingTrayType] = useState('');
  const [nurserySeedsPerCell, setNurserySeedsPerCell] = useState<number | ''>('');
  const [nurserySoilMixDetails, setNurserySoilMixDetails] = useState('');
  const [nurserySeedingTechnique, setNurserySeedingTechnique] = useState('');
  const [nurseryDaysBeforeRepotting, setNurseryDaysBeforeRepotting] = useState<number | ''>('');
  const [nurseryRepottingContainerType, setNurseryRepottingContainerType] = useState('');

  // Direct Seed fields
  const [directSeedRowsPerBed, setDirectSeedRowsPerBed] = useState<number | ''>('');
  const [directSeedSeederType, setDirectSeedSeederType] = useState('');
  const [directSeedSpacingInRowCm, setDirectSeedSpacingInRowCm] = useState<number | ''>('');
  const [directSeedSpacingBetweenRowsCm, setDirectSeedSpacingBetweenRowsCm] = useState<number | ''>('');
  const [directSeedDepthCm, setDirectSeedDepthCm] = useState<number | ''>('');
  const [directSeedCalibration, setDirectSeedCalibration] = useState('');

  // Transplant fields
  const [transplantRowsPerBed, setTransplantRowsPerBed] = useState<number | ''>('');
  const [transplantSpacingInRowCm, setTransplantSpacingInRowCm] = useState<number | ''>('');
  const [transplantSpacingBetweenRowsCm, setTransplantSpacingBetweenRowsCm] = useState<number | ''>('');
  const [transplantSourceContainerType, setTransplantSourceContainerType] = useState('');
  const [transplantRowMarkingMethod, setTransplantRowMarkingMethod] = useState('');
  const [transplantIrrigationDetails, setTransplantIrrigationDetails] = useState('');
  
  // Generic Task Details
  const [genericFieldTaskDetails, setGenericFieldTaskDetails] = useState('');
  
  const [additionalDetailsJson, setAdditionalDetailsJson] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  // State for resource management
  const [plannedResources, setPlannedResources] = useState<PlannedStageResource[]>([]);
  const [showResourceForm, setShowResourceForm] = useState(false);
  const [editingResource, setEditingResource] = useState<Partial<PlannedStageResource> | null>(null);
  const [editingResourceIndex, setEditingResourceIndex] = useState<number | null>(null);
  const [availableInputItems, setAvailableInputItems] = useState<InputInventory[]>([]);

  useEffect(() => {
    const loadInputItems = async () => {
      try {
        const items = await db.inputInventory.where('is_deleted').notEqual(1).toArray();
        setAvailableInputItems(items);
      } catch (err) {
        console.error("Failed to load input items for resource form:", err);
      }
    };
    loadInputItems();

    if (initialData?.id) {
      const loadStageResources = async () => {
        if (!initialData || !initialData.id) return;
        try {
          const resources = await db.plannedStageResources
            .where('crop_plan_stage_id')
            .equals(initialData.id)
            .filter(r => r.is_deleted !== 1)
            .toArray();
          setPlannedResources(resources);
        } catch (err) {
          console.error(`Failed to load resources for stage ${initialData.id}:`, err);
          setFormError("Could not load planned resources for this stage.");
        }
      };
      loadStageResources();
    } else {
      setPlannedResources([]);
    }

    if (initialData) {
      setStageName(initialData.stage_name || '');
      setStageType(initialData.stage_type || 'NURSERY_SOWING');
      setPlannedStartDate(initialData.planned_start_date?.split('T')[0] || '');
      setPlannedDurationDays(initialData.planned_duration_days ?? '');
      setStatus(initialData.status || 'PENDING');
      setNotes(initialData.notes || '');
      setNurseryTotalDays(initialData.nursery_total_days ?? '');
      setNurserySeedingTrayType(initialData.nursery_seeding_tray_type || '');
      setNurserySeedsPerCell(initialData.nursery_seeds_per_cell ?? '');
      setNurserySoilMixDetails(initialData.nursery_soil_mix_details || '');
      setNurserySeedingTechnique(initialData.nursery_seeding_technique || '');
      setNurseryDaysBeforeRepotting(initialData.nursery_days_before_repotting ?? '');
      setNurseryRepottingContainerType(initialData.nursery_repotting_container_type || '');
      setDirectSeedRowsPerBed(initialData.direct_seed_rows_per_bed ?? '');
      setDirectSeedSeederType(initialData.direct_seed_seeder_type || '');
      setDirectSeedSpacingInRowCm(initialData.direct_seed_spacing_in_row_cm ?? '');
      setDirectSeedSpacingBetweenRowsCm(initialData.direct_seed_spacing_between_rows_cm ?? '');
      setDirectSeedDepthCm(initialData.direct_seed_depth_cm ?? '');
      setDirectSeedCalibration(initialData.direct_seed_calibration || '');
      setTransplantRowsPerBed(initialData.transplant_rows_per_bed ?? '');
      setTransplantSpacingInRowCm(initialData.transplant_spacing_in_row_cm ?? '');
      setTransplantSpacingBetweenRowsCm(initialData.transplant_spacing_between_rows_cm ?? '');
      setTransplantSourceContainerType(initialData.transplant_source_container_type || '');
      setTransplantRowMarkingMethod(initialData.transplant_row_marking_method || '');
      setTransplantIrrigationDetails(initialData.transplant_irrigation_details || '');
      setGenericFieldTaskDetails(initialData.generic_field_task_details || '');
      setAdditionalDetailsJson(initialData.additional_details_json || '');
    } else {
      setStageName('');
      setStageType('NURSERY_SOWING');
      setPlannedStartDate('');
      setPlannedDurationDays('');
      setStatus('PENDING');
      setNotes('');
      setNurseryTotalDays(''); setNurserySeedingTrayType(''); setNurserySeedsPerCell(''); setNurserySoilMixDetails(''); setNurserySeedingTechnique(''); setNurseryDaysBeforeRepotting(''); setNurseryRepottingContainerType('');
      setDirectSeedRowsPerBed(''); setDirectSeedSeederType(''); setDirectSeedSpacingInRowCm(''); setDirectSeedSpacingBetweenRowsCm(''); setDirectSeedDepthCm(''); setDirectSeedCalibration('');
      setTransplantRowsPerBed(''); setTransplantSpacingInRowCm(''); setTransplantSpacingBetweenRowsCm(''); setTransplantSourceContainerType(''); setTransplantRowMarkingMethod(''); setTransplantIrrigationDetails('');
      setGenericFieldTaskDetails('');
      setAdditionalDetailsJson('');
    }
  }, [initialData]);

  const handleResourceSave = (resourceData: PlannedStageResource) => {
    if (editingResourceIndex !== null) {
      const updatedResources = [...plannedResources];
      updatedResources[editingResourceIndex] = resourceData;
      setPlannedResources(updatedResources);
    } else {
      setPlannedResources([...plannedResources, { ...resourceData, id: crypto.randomUUID() }]);
    }
    setShowResourceForm(false);
    setEditingResource(null);
    setEditingResourceIndex(null);
  };

  const handleEditResource = (resource: PlannedStageResource, index: number) => {
    setEditingResource({...resource});
    setEditingResourceIndex(index);
    setShowResourceForm(true);
  };

  const handleRemoveResource = (index: number) => {
    if (window.confirm("Are you sure you want to remove this planned resource?")) {
      const updatedResources = plannedResources.filter((_, i) => i !== index);
      setPlannedResources(updatedResources);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setFormError(null);
    if (!stageName.trim() || !stageType || !plannedStartDate || plannedDurationDays === '') {
      setFormError('Stage Name, Type, Planned Start Date, and Duration are required.');
      return;
    }
    if (Number(plannedDurationDays) <= 0) {
        setFormError('Planned Duration must be greater than 0.');
        return;
    }

    let stageDetailsData: Partial<CropPlanStage> = {
      crop_plan_id: cropPlanId,
      stage_name: stageName.trim(),
      stage_type: stageType,
      planned_start_date: plannedStartDate,
      planned_duration_days: Number(plannedDurationDays),
      status: status,
      notes: notes.trim() || undefined,
      additional_details_json: additionalDetailsJson.trim() || undefined,
    };

    if (stageType === 'NURSERY_SOWING' || stageType === 'NURSERY_POTTING_ON') {
      stageDetailsData = { ...stageDetailsData, 
        nursery_total_days: nurseryTotalDays === '' ? undefined : Number(nurseryTotalDays),
        nursery_seeding_tray_type: nurserySeedingTrayType.trim() || undefined,
        nursery_seeds_per_cell: nurserySeedsPerCell === '' ? undefined : Number(nurserySeedsPerCell),
        nursery_soil_mix_details: nurserySoilMixDetails.trim() || undefined,
        nursery_seeding_technique: nurserySeedingTechnique.trim() || undefined,
        nursery_days_before_repotting: nurseryDaysBeforeRepotting === '' ? undefined : Number(nurseryDaysBeforeRepotting),
        nursery_repotting_container_type: nurseryRepottingContainerType.trim() || undefined,
      };
    } else if (stageType === 'DIRECT_SEEDING') {
      stageDetailsData = { ...stageDetailsData,
        direct_seed_rows_per_bed: directSeedRowsPerBed === '' ? undefined : Number(directSeedRowsPerBed),
        direct_seed_seeder_type: directSeedSeederType.trim() || undefined,
        direct_seed_spacing_in_row_cm: directSeedSpacingInRowCm === '' ? undefined : Number(directSeedSpacingInRowCm),
        direct_seed_spacing_between_rows_cm: directSeedSpacingBetweenRowsCm === '' ? undefined : Number(directSeedSpacingBetweenRowsCm),
        direct_seed_depth_cm: directSeedDepthCm === '' ? undefined : Number(directSeedDepthCm),
        direct_seed_calibration: directSeedCalibration.trim() || undefined,
      };
    } else if (stageType === 'TRANSPLANTING') {
      stageDetailsData = { ...stageDetailsData,
        transplant_rows_per_bed: transplantRowsPerBed === '' ? undefined : Number(transplantRowsPerBed),
        transplant_spacing_in_row_cm: transplantSpacingInRowCm === '' ? undefined : Number(transplantSpacingInRowCm),
        transplant_spacing_between_rows_cm: transplantSpacingBetweenRowsCm === '' ? undefined : Number(transplantSpacingBetweenRowsCm),
        transplant_source_container_type: transplantSourceContainerType.trim() || undefined,
        transplant_row_marking_method: transplantRowMarkingMethod.trim() || undefined,
        transplant_irrigation_details: transplantIrrigationDetails.trim() || undefined,
      };
    } else if (stageType === 'SOIL_PREPARATION' || stageType === 'FIELD_MAINTENANCE' || stageType === 'PEST_DISEASE_CONTROL') {
        stageDetailsData = { ...stageDetailsData, generic_field_task_details: genericFieldTaskDetails.trim() || undefined };
    }

    const finalStageDetails = initialData?.id 
      ? { ...initialData, ...stageDetailsData } 
      : stageDetailsData as Omit<CropPlanStage, 'id' | '_synced' | '_last_modified' | 'created_at' | 'updated_at' | 'is_deleted' | 'deleted_at'>;

    const submitData: CropPlanStageSubmitData = {
      stageDetails: finalStageDetails,
      plannedResources: plannedResources 
    };

    await onSubmit(submitData);
  };
  
  const renderSpecificFields = () => {
    switch (stageType) {
      case 'NURSERY_SOWING':
      case 'NURSERY_POTTING_ON':
        return (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div><label htmlFor="nurseryTotalDays" className="block text-xs font-medium text-gray-600">Total Days in Nursery</label><input type="number" id="nurseryTotalDays" value={nurseryTotalDays} onChange={e => setNurseryTotalDays(e.target.value === '' ? '' : parseInt(e.target.value))} className="mt-1 w-full input-sm"/></div>
              <div><label htmlFor="nurserySeedingTrayType" className="block text-xs font-medium text-gray-600">Seeding Tray Type</label><input type="text" id="nurserySeedingTrayType" value={nurserySeedingTrayType} onChange={e => setNurserySeedingTrayType(e.target.value)} className="mt-1 w-full input-sm"/></div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <div><label htmlFor="nurserySeedsPerCell" className="block text-xs font-medium text-gray-600">Seeds/Cell</label><input type="number" id="nurserySeedsPerCell" value={nurserySeedsPerCell} onChange={e => setNurserySeedsPerCell(e.target.value === '' ? '' : parseInt(e.target.value))} className="mt-1 w-full input-sm"/></div>
              <div><label htmlFor="nurserySeedingTechnique" className="block text-xs font-medium text-gray-600">Seeding Technique</label><input type="text" id="nurserySeedingTechnique" value={nurserySeedingTechnique} onChange={e => setNurserySeedingTechnique(e.target.value)} className="mt-1 w-full input-sm"/></div>
            </div>
             <div className="mt-4"><label htmlFor="nurserySoilMixDetails" className="block text-xs font-medium text-gray-600">Soil Mix Details</label><textarea id="nurserySoilMixDetails" value={nurserySoilMixDetails} onChange={e => setNurserySoilMixDetails(e.target.value)} rows={2} className="mt-1 w-full input-sm"/></div>
            {stageType === 'NURSERY_POTTING_ON' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                <div><label htmlFor="nurseryDaysBeforeRepotting" className="block text-xs font-medium text-gray-600">Days Before Repotting</label><input type="number" id="nurseryDaysBeforeRepotting" value={nurseryDaysBeforeRepotting} onChange={e => setNurseryDaysBeforeRepotting(e.target.value === '' ? '' : parseInt(e.target.value))} className="mt-1 w-full input-sm"/></div>
                <div><label htmlFor="nurseryRepottingContainerType" className="block text-xs font-medium text-gray-600">Repotting Container</label><input type="text" id="nurseryRepottingContainerType" value={nurseryRepottingContainerType} onChange={e => setNurseryRepottingContainerType(e.target.value)} className="mt-1 w-full input-sm"/></div>
              </div>
            )}
          </>
        );
      case 'DIRECT_SEEDING':
        return (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div><label htmlFor="directSeedRowsPerBed" className="block text-xs font-medium text-gray-600">Rows/Bed</label><input type="number" id="directSeedRowsPerBed" value={directSeedRowsPerBed} onChange={e => setDirectSeedRowsPerBed(e.target.value === '' ? '' : parseInt(e.target.value))} className="mt-1 w-full input-sm"/></div>
              <div><label htmlFor="directSeedSeederType" className="block text-xs font-medium text-gray-600">Seeder Type</label><input type="text" id="directSeedSeederType" value={directSeedSeederType} onChange={e => setDirectSeedSeederType(e.target.value)} className="mt-1 w-full input-sm"/></div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
              <div><label htmlFor="directSeedSpacingInRowCm" className="block text-xs font-medium text-gray-600">Spacing In-Row (cm)</label><input type="number" step="any" id="directSeedSpacingInRowCm" value={directSeedSpacingInRowCm} onChange={e => setDirectSeedSpacingInRowCm(e.target.value === '' ? '' : parseFloat(e.target.value))} className="mt-1 w-full input-sm"/></div>
              <div><label htmlFor="directSeedSpacingBetweenRowsCm" className="block text-xs font-medium text-gray-600">Spacing Between Rows (cm)</label><input type="number" step="any" id="directSeedSpacingBetweenRowsCm" value={directSeedSpacingBetweenRowsCm} onChange={e => setDirectSeedSpacingBetweenRowsCm(e.target.value === '' ? '' : parseFloat(e.target.value))} className="mt-1 w-full input-sm"/></div>
              <div><label htmlFor="directSeedDepthCm" className="block text-xs font-medium text-gray-600">Depth (cm)</label><input type="number" step="any" id="directSeedDepthCm" value={directSeedDepthCm} onChange={e => setDirectSeedDepthCm(e.target.value === '' ? '' : parseFloat(e.target.value))} className="mt-1 w-full input-sm"/></div>
            </div>
            <div className="mt-4"><label htmlFor="directSeedCalibration" className="block text-xs font-medium text-gray-600">Seeder Calibration</label><input type="text" id="directSeedCalibration" value={directSeedCalibration} onChange={e => setDirectSeedCalibration(e.target.value)} className="mt-1 w-full input-sm"/></div>
          </>
        );
      case 'TRANSPLANTING':
        return (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div><label htmlFor="transplantRowsPerBed" className="block text-xs font-medium text-gray-600">Rows/Bed</label><input type="number" id="transplantRowsPerBed" value={transplantRowsPerBed} onChange={e => setTransplantRowsPerBed(e.target.value === '' ? '' : parseInt(e.target.value))} className="mt-1 w-full input-sm"/></div>
              <div><label htmlFor="transplantSourceContainerType" className="block text-xs font-medium text-gray-600">Source Container Type</label><input type="text" id="transplantSourceContainerType" value={transplantSourceContainerType} onChange={e => setTransplantSourceContainerType(e.target.value)} className="mt-1 w-full input-sm"/></div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <div><label htmlFor="transplantSpacingInRowCm" className="block text-xs font-medium text-gray-600">Spacing In-Row (cm)</label><input type="number" step="any" id="transplantSpacingInRowCm" value={transplantSpacingInRowCm} onChange={e => setTransplantSpacingInRowCm(e.target.value === '' ? '' : parseFloat(e.target.value))} className="mt-1 w-full input-sm"/></div>
              <div><label htmlFor="transplantSpacingBetweenRowsCm" className="block text-xs font-medium text-gray-600">Spacing Between Rows (cm)</label><input type="number" step="any" id="transplantSpacingBetweenRowsCm" value={transplantSpacingBetweenRowsCm} onChange={e => setTransplantSpacingBetweenRowsCm(e.target.value === '' ? '' : parseFloat(e.target.value))} className="mt-1 w-full input-sm"/></div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <div><label htmlFor="transplantRowMarkingMethod" className="block text-xs font-medium text-gray-600">Row Marking Method</label><input type="text" id="transplantRowMarkingMethod" value={transplantRowMarkingMethod} onChange={e => setTransplantRowMarkingMethod(e.target.value)} className="mt-1 w-full input-sm"/></div>
              <div><label htmlFor="transplantIrrigationDetails" className="block text-xs font-medium text-gray-600">Irrigation Details</label><input type="text" id="transplantIrrigationDetails" value={transplantIrrigationDetails} onChange={e => setTransplantIrrigationDetails(e.target.value)} className="mt-1 w-full input-sm"/></div>
            </div>
          </>
        );
      case 'SOIL_PREPARATION':
      case 'FIELD_MAINTENANCE':
      case 'PEST_DISEASE_CONTROL':
        return (
          <div>
            <label htmlFor="genericFieldTaskDetails" className="block text-xs font-medium text-gray-600">Task Details</label>
            <textarea id="genericFieldTaskDetails" value={genericFieldTaskDetails} onChange={e => setGenericFieldTaskDetails(e.target.value)} rows={3} className="mt-1 w-full input-sm"/>
          </div>
        );
      default:
        return null;
    }
  };
  
  const commonInputClass = "mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm";
  const commonLabelClass = "block text-sm font-medium text-gray-700";
  const specificFieldLabelClass = "block text-xs font-medium text-gray-600";
  const specificFieldInputClass = `mt-1 w-full px-2 py-1.5 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-xs ${isSubmitting ? 'bg-gray-50' : ''}`;

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-75 overflow-y-auto h-full w-full z-[60] flex justify-center items-start p-4 pt-10">
      <div className="bg-white p-6 md:p-8 rounded-lg shadow-xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-semibold mb-6 text-gray-800">
          {initialData ? 'Edit Plan Stage' : 'Add New Plan Stage'}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-5">
          {formError && <p className="text-red-500 text-sm p-3 bg-red-50 rounded-md">{formError}</p>}

          <div>
            <label htmlFor="stageName" className={commonLabelClass}>Stage Name <span className="text-red-500">*</span></label>
            <input type="text" id="stageName" value={stageName} onChange={e => setStageName(e.target.value)} required disabled={isSubmitting} className={commonInputClass}/>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-5">
            <div>
              <label htmlFor="stageType" className={commonLabelClass}>Stage Type <span className="text-red-500">*</span></label>
              <select id="stageType" value={stageType} onChange={e => setStageType(e.target.value as CropPlanStage['stage_type'])} required disabled={isSubmitting} className={commonInputClass}>
                {STAGE_TYPES.map(st => <option key={st} value={st}>{st.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="status" className={commonLabelClass}>Status</label>
              <select id="status" value={status} onChange={e => setStatus(e.target.value as CropPlanStage['status'])} disabled={isSubmitting} className={commonInputClass}>
                {STAGE_STATUSES.map(st => <option key={st} value={st}>{st.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="plannedStartDate" className={commonLabelClass}>Planned Start Date <span className="text-red-500">*</span></label>
              <input type="date" id="plannedStartDate" value={plannedStartDate} onChange={e => setPlannedStartDate(e.target.value)} required disabled={isSubmitting} className={commonInputClass}/>
            </div>
            <div>
              <label htmlFor="plannedDurationDays" className={commonLabelClass}>Planned Duration (Days) <span className="text-red-500">*</span></label>
              <input type="number" id="plannedDurationDays" value={plannedDurationDays} onChange={e => setPlannedDurationDays(e.target.value === '' ? '' : parseInt(e.target.value))} required disabled={isSubmitting} className={commonInputClass} min="1"/>
            </div>
          </div>
          
          <fieldset className="border p-3 rounded-md mt-3">
            <legend className="text-sm font-medium text-gray-600 px-1">{stageType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())} Details</legend>
            <div className="space-y-3 mt-2">
              {renderSpecificFields()}
            </div>
          </fieldset>
          
          <div>
            <label htmlFor="notes" className={commonLabelClass}>Stage Notes</label>
            <textarea id="notes" value={notes} onChange={e => setNotes(e.target.value)} rows={3} disabled={isSubmitting} className={commonInputClass}/>
          </div>
          
          <div>
            <label htmlFor="additionalDetailsJson" className={commonLabelClass}>Additional Details (JSON)</label>
            <textarea id="additionalDetailsJson" value={additionalDetailsJson} onChange={e => setAdditionalDetailsJson(e.target.value)} rows={2} disabled={isSubmitting} 
                      placeholder='e.g., {"custom_field": "value"}'
                      className={`${commonInputClass} font-mono text-xs`}/>
            <p className="text-xs text-gray-500 mt-1">Use valid JSON for any extra parameters not covered above.</p>
          </div>

          <fieldset className="border p-3 rounded-md mt-3">
            <legend className="text-sm font-medium text-gray-700 px-1">Planned Resources</legend>
            <div className="mt-2 space-y-3">
              {plannedResources.length === 0 && !showResourceForm && (
                <p className="text-xs text-gray-500 text-center">No resources planned for this stage yet.</p>
              )}
              {plannedResources.map((resource, index) => (
                <div key={index} className="p-2 border rounded-md bg-gray-50 text-xs">
                  <p><strong>Type:</strong> {resource.resource_type.replace('_', ' ')}</p>
                  <p><strong>Desc:</strong> {resource.description}</p>
                  {resource.input_inventory_id && <p><strong>Item:</strong> {availableInputItems.find(i=>i.id === resource.input_inventory_id)?.name || 'N/A'}</p>}
                  {resource.planned_quantity && <p><strong>Qty:</strong> {resource.planned_quantity} {resource.quantity_unit || ''}</p>}
                  {resource.estimated_cost && <p><strong>Est. Cost:</strong> ${resource.estimated_cost.toFixed(2)}</p>}
                  {resource.notes && <p><strong>Notes:</strong> {resource.notes}</p>}
                  <div className="mt-1 text-right">
                    <button type="button" onClick={() => handleEditResource(resource, index)} className="text-blue-600 hover:text-blue-800 text-xs mr-2">Edit</button>
                    <button type="button" onClick={() => handleRemoveResource(index)} className="text-red-600 hover:text-red-800 text-xs">Remove</button>
                  </div>
                </div>
              ))}
              {showResourceForm && editingResource && (
                <ResourceSubForm
                  initialResourceData={editingResource}
                  onSaveResource={handleResourceSave}
                  onCancelResource={() => { setShowResourceForm(false); setEditingResource(null); setEditingResourceIndex(null); }}
                  availableInputItems={availableInputItems}
                />
              )}
              {!showResourceForm && (
                <button 
                  type="button" 
                  onClick={() => { setEditingResource({resource_type: 'LABOR', description: ''}); setEditingResourceIndex(null); setShowResourceForm(true); }}
                  className="mt-2 text-sm text-blue-600 hover:text-blue-800 font-medium py-1 px-2 border border-blue-500 rounded-md hover:bg-blue-50"
                >
                  + Add Resource
                </button>
              )}
            </div>
          </fieldset>

          <div className="flex items-center justify-end space-x-3 pt-3">
            <button type="button" onClick={onCancel} disabled={isSubmitting}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md border border-gray-300 disabled:opacity-50">
              Cancel
            </button>
            <button type="submit" disabled={isSubmitting}
                    className="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50">
              {isSubmitting ? (initialData ? 'Saving Stage...' : 'Adding Stage...') : (initialData ? 'Save Stage Changes' : 'Add Stage to Plan')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Sub-component for adding/editing a single resource
interface ResourceSubFormProps {
  initialResourceData: Partial<PlannedStageResource>; 
  onSaveResource: (resourceData: PlannedStageResource) => void;
  onCancelResource: () => void;
  availableInputItems: InputInventory[];
}

function ResourceSubForm({ initialResourceData, onSaveResource, onCancelResource, availableInputItems }: ResourceSubFormProps) {
  const [resourceType, setResourceType] = useState<PlannedStageResource['resource_type']>(initialResourceData.resource_type || 'LABOR');
  const [description, setDescription] = useState(initialResourceData.description || '');
  const [inputInventoryId, setInputInventoryId] = useState(initialResourceData.input_inventory_id || undefined);
  const [plannedQuantity, setPlannedQuantity] = useState<number | ''>(initialResourceData.planned_quantity ?? '');
  const [quantityUnit, setQuantityUnit] = useState(initialResourceData.quantity_unit || '');
  const [estimatedCost, setEstimatedCost] = useState<number | ''>(initialResourceData.estimated_cost ?? '');
  const [resourceNotes, setResourceNotes] = useState(initialResourceData.notes || '');
  const [subFormError, setSubFormError] = useState<string | null>(null);

  useEffect(() => {
    setResourceType(initialResourceData.resource_type || 'LABOR');
    setDescription(initialResourceData.description || '');
    setInputInventoryId(initialResourceData.input_inventory_id || undefined);
    setPlannedQuantity(initialResourceData.planned_quantity ?? '');
    setQuantityUnit(initialResourceData.quantity_unit || '');
    setEstimatedCost(initialResourceData.estimated_cost ?? '');
    setResourceNotes(initialResourceData.notes || '');
  }, [initialResourceData]);

  const handleSubFormSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubFormError(null);
    if (!description.trim()) {
      setSubFormError('Resource description is required.');
      return;
    }
    if (resourceType === 'INPUT_ITEM' && !inputInventoryId) {
      setSubFormError('Please select an input item for this resource type.');
      return;
    }

    onSaveResource({
      id: initialResourceData.id || crypto.randomUUID(), 
      crop_plan_stage_id: initialResourceData.crop_plan_stage_id || '', 
      resource_type: resourceType,
      description: description.trim(),
      input_inventory_id: resourceType === 'INPUT_ITEM' ? inputInventoryId : undefined,
      planned_quantity: plannedQuantity === '' ? undefined : Number(plannedQuantity),
      quantity_unit: quantityUnit.trim() || undefined,
      estimated_cost: estimatedCost === '' ? undefined : Number(estimatedCost),
      notes: resourceNotes.trim() || undefined,
      is_deleted: 0, 
      _synced: 0,
      _last_modified: Date.now(),
    });
  };
  
  const commonInputClassSub = "mt-1 block w-full px-2 py-1.5 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-xs"; // Renamed to avoid conflict
  const commonLabelClassSub = "block text-xs font-medium text-gray-700"; // Renamed to avoid conflict

  return (
    <form onSubmit={handleSubFormSubmit} className="space-y-3 p-3 border border-indigo-300 rounded-md mt-2 bg-indigo-50">
      <h4 className="text-sm font-semibold text-indigo-700 mb-2">
        {initialResourceData.id && initialResourceData.description ? 'Edit Resource' : 'Add New Resource'}
      </h4>
      {subFormError && <p className="text-red-600 text-xs">{subFormError}</p>}
      
      <div>
        <label htmlFor="resourceTypeSub" className={commonLabelClassSub}>Resource Type</label> {/* Changed htmlFor and id */}
        <select id="resourceTypeSub" value={resourceType} onChange={e => setResourceType(e.target.value as PlannedStageResource['resource_type'])} className={commonInputClassSub}>
          <option value="LABOR">Labor</option>
          <option value="INPUT_ITEM">Input Item</option>
          <option value="EQUIPMENT">Equipment</option>
          <option value="OTHER">Other</option>
        </select>
      </div>

      <div>
        <label htmlFor="resourceDescriptionSub" className={commonLabelClassSub}>Description <span className="text-red-500">*</span></label> {/* Changed htmlFor and id */}
        <input type="text" id="resourceDescriptionSub" value={description} onChange={e => setDescription(e.target.value)} required className={commonInputClassSub} />
      </div>

      {resourceType === 'INPUT_ITEM' && (
        <div>
          <label htmlFor="inputInventoryIdSub" className={commonLabelClassSub}>Input Item <span className="text-red-500">*</span></label> {/* Changed htmlFor and id */}
          <select id="inputInventoryIdSub" value={inputInventoryId || ''} onChange={e => setInputInventoryId(e.target.value || undefined)} required={resourceType === 'INPUT_ITEM'} className={commonInputClassSub}>
            <option value="">Select Input Item</option>
            {availableInputItems.map(item => (
              <option key={item.id} value={item.id}>{item.name} ({item.quantity_unit || 'units'})</option>
            ))}
          </select>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="plannedQuantitySub" className={commonLabelClassSub}>Planned Quantity</label> {/* Changed htmlFor and id */}
          <input type="number" step="any" id="plannedQuantitySub" value={plannedQuantity} onChange={e => setPlannedQuantity(e.target.value === '' ? '' : parseFloat(e.target.value))} className={commonInputClassSub} />
        </div>
        <div>
          <label htmlFor="quantityUnitSub" className={commonLabelClassSub}>Unit</label> {/* Changed htmlFor and id */}
          <input type="text" id="quantityUnitSub" value={quantityUnit} onChange={e => setQuantityUnit(e.target.value)} className={commonInputClassSub} />
        </div>
      </div>
      
      <div>
        <label htmlFor="estimatedCostSub" className={commonLabelClassSub}>Estimated Cost ($)</label> {/* Changed htmlFor and id */}
        <input type="number" step="any" id="estimatedCostSub" value={estimatedCost} onChange={e => setEstimatedCost(e.target.value === '' ? '' : parseFloat(e.target.value))} className={commonInputClassSub} />
      </div>

      <div>
        <label htmlFor="resourceNotesSub" className={commonLabelClassSub}>Resource Notes</label> {/* Changed htmlFor and id */}
        <textarea id="resourceNotesSub" value={resourceNotes} onChange={e => setResourceNotes(e.target.value)} rows={2} className={commonInputClassSub} />
      </div>

      <div className="flex items-center justify-end space-x-2 pt-2">
        <button type="button" onClick={onCancelResource} className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-200 hover:bg-gray-300 rounded-md border border-gray-300">
          Cancel
        </button>
        <button type="submit" className="px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-indigo-500">
          {initialResourceData.id && initialResourceData.description ? 'Save Resource' : 'Add Resource'}
        </button>
      </div>
    </form>
  );
}