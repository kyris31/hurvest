'use client';

import React, { useState, useEffect } from 'react';
import { CropPlan, Crop, Plot, CropSeason, db } from '@/lib/db';
import { formatDateToDDMMYYYY } from '@/lib/dateUtils';

interface CropPlanFormProps {
  initialData?: CropPlan | null;
  onSubmit: (data: Omit<CropPlan, 'id' | '_synced' | '_last_modified' | 'created_at' | 'updated_at' | 'is_deleted' | 'deleted_at'> | CropPlan) => Promise<void>;
  onCancel: () => void;
  isSubmitting: boolean;
}

const PLANTING_TYPES: CropPlan['planting_type'][] = ['DIRECT_SEED', 'TRANSPLANT_NURSERY', 'TRANSPLANT_PURCHASED'];
const PLAN_STATUSES: CropPlan['status'][] = ['DRAFT', 'PLANNED', 'ACTIVE', 'COMPLETED', 'CANCELLED'];

export default function CropPlanForm({ initialData, onSubmit, onCancel, isSubmitting }: CropPlanFormProps) {
  const [planName, setPlanName] = useState('');
  const [cropId, setCropId] = useState<string>('');
  const [plotId, setPlotId] = useState<string | undefined>(undefined);
  const [cropSeasonId, setCropSeasonId] = useState<string>('');
  const [plantingType, setPlantingType] = useState<CropPlan['planting_type']>('DIRECT_SEED');
  const [plannedSowingDate, setPlannedSowingDate] = useState('');
  const [plannedTransplantDate, setPlannedTransplantDate] = useState('');
  const [plannedFirstHarvestDate, setPlannedFirstHarvestDate] = useState('');
  const [plannedLastHarvestDate, setPlannedLastHarvestDate] = useState('');
  const [estimatedDaysToMaturity, setEstimatedDaysToMaturity] = useState<number | ''>('');
  const [targetQuantityPlants, setTargetQuantityPlants] = useState<number | ''>('');
  const [targetQuantityAreaSqm, setTargetQuantityAreaSqm] = useState<number | ''>('');
  const [targetYieldEstimateKg, setTargetYieldEstimateKg] = useState<number | ''>('');
  const [targetYieldUnit, setTargetYieldUnit] = useState('');
  const [status, setStatus] = useState<CropPlan['status']>('DRAFT');
  const [notes, setNotes] = useState('');
  
  const [availableCrops, setAvailableCrops] = useState<Crop[]>([]);
  const [availablePlots, setAvailablePlots] = useState<Plot[]>([]);
  const [availableCropSeasons, setAvailableCropSeasons] = useState<CropSeason[]>([]);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    // Fetch data for dropdowns
    const fetchData = async () => {
      try {
        const [cropsData, plotsData, seasonsData] = await Promise.all([
          db.crops.where('is_deleted').notEqual(1).sortBy('name'),
          db.plots.where('is_deleted').notEqual(1).sortBy('name'),
          db.cropSeasons.where('is_deleted').notEqual(1).sortBy('start_date'),
        ]);
        setAvailableCrops(cropsData);
        setAvailablePlots(plotsData);
        setAvailableCropSeasons(seasonsData);
      } catch (err) {
        console.error("Error fetching data for crop plan form:", err);
        setFormError("Could not load necessary data for the form.");
      }
    };
    fetchData();
  }, []);

  useEffect(() => {
    if (initialData) {
      setPlanName(initialData.plan_name || '');
      setCropId(initialData.crop_id || '');
      setPlotId(initialData.plot_id || undefined);
      setCropSeasonId(initialData.crop_season_id || '');
      setPlantingType(initialData.planting_type || 'DIRECT_SEED');
      setPlannedSowingDate(initialData.planned_sowing_date?.split('T')[0] || '');
      setPlannedTransplantDate(initialData.planned_transplant_date?.split('T')[0] || '');
      setPlannedFirstHarvestDate(initialData.planned_first_harvest_date?.split('T')[0] || '');
      setPlannedLastHarvestDate(initialData.planned_last_harvest_date?.split('T')[0] || '');
      setEstimatedDaysToMaturity(initialData.estimated_days_to_maturity ?? '');
      setTargetQuantityPlants(initialData.target_quantity_plants ?? '');
      setTargetQuantityAreaSqm(initialData.target_quantity_area_sqm ?? '');
      setTargetYieldEstimateKg(initialData.target_yield_estimate_kg ?? '');
      setTargetYieldUnit(initialData.target_yield_unit || '');
      setStatus(initialData.status || 'DRAFT');
      setNotes(initialData.notes || '');
    } else {
      // Reset form for new entry
      setPlanName('');
      setCropId('');
      setPlotId(undefined);
      setCropSeasonId('');
      setPlantingType('DIRECT_SEED');
      setPlannedSowingDate('');
      setPlannedTransplantDate('');
      setPlannedFirstHarvestDate('');
      setPlannedLastHarvestDate('');
      setEstimatedDaysToMaturity('');
      setTargetQuantityPlants('');
      setTargetQuantityAreaSqm('');
      setTargetYieldEstimateKg('');
      setTargetYieldUnit('');
      setStatus('DRAFT');
      setNotes('');
    }
  }, [initialData]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setFormError(null);
    if (!planName.trim() || !cropId || !cropSeasonId || !plantingType) {
      setFormError('Plan Name, Crop, Crop Season, and Planting Type are required.');
      return;
    }

    const planData = {
      plan_name: planName.trim(),
      crop_id: cropId,
      plot_id: plotId || undefined,
      crop_season_id: cropSeasonId,
      planting_type: plantingType,
      planned_sowing_date: plannedSowingDate || undefined,
      planned_transplant_date: plannedTransplantDate || undefined,
      planned_first_harvest_date: plannedFirstHarvestDate || undefined,
      planned_last_harvest_date: plannedLastHarvestDate || undefined,
      estimated_days_to_maturity: estimatedDaysToMaturity === '' ? undefined : Number(estimatedDaysToMaturity),
      target_quantity_plants: targetQuantityPlants === '' ? undefined : Number(targetQuantityPlants),
      target_quantity_area_sqm: targetQuantityAreaSqm === '' ? undefined : Number(targetQuantityAreaSqm),
      target_yield_estimate_kg: targetYieldEstimateKg === '' ? undefined : Number(targetYieldEstimateKg),
      target_yield_unit: targetYieldUnit.trim() || undefined,
      status: status,
      notes: notes.trim() || undefined,
    };

    if (initialData?.id) {
      await onSubmit({ ...initialData, ...planData });
    } else {
      await onSubmit(planData as Omit<CropPlan, 'id' | '_synced' | '_last_modified' | 'created_at' | 'updated_at' | 'is_deleted' | 'deleted_at'>);
    }
  };
  
  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex justify-center items-start p-4 pt-10">
      <div className="bg-white p-6 md:p-8 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <h2 className="text-2xl font-bold mb-6 text-gray-800">
          {initialData ? 'Edit Crop Plan' : 'Create New Crop Plan'}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-6">
          {formError && <p className="text-red-500 text-sm p-3 bg-red-50 rounded-md">{formError}</p>}

          <div>
            <label htmlFor="planName" className="block text-sm font-medium text-gray-700">Plan Name <span className="text-red-500">*</span></label>
            <input type="text" id="planName" value={planName} onChange={e => setPlanName(e.target.value)} required disabled={isSubmitting}
                   className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"/>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label htmlFor="cropId" className="block text-sm font-medium text-gray-700">Crop <span className="text-red-500">*</span></label>
              <select id="cropId" value={cropId} onChange={e => setCropId(e.target.value)} required disabled={isSubmitting}
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm">
                <option value="">Select Crop</option>
                {availableCrops.map(c => <option key={c.id} value={c.id}>{c.name} {c.variety ? `(${c.variety})` : ''}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="plotId" className="block text-sm font-medium text-gray-700">Plot (Optional)</label>
              <select id="plotId" value={plotId || ''} onChange={e => setPlotId(e.target.value || undefined)} disabled={isSubmitting}
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm">
                <option value="">Select Plot</option>
                {availablePlots.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label htmlFor="cropSeasonId" className="block text-sm font-medium text-gray-700">Crop Season <span className="text-red-500">*</span></label>
              <select id="cropSeasonId" value={cropSeasonId} onChange={e => setCropSeasonId(e.target.value)} required disabled={isSubmitting}
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm">
                <option value="">Select Crop Season</option>
                {availableCropSeasons.map(s => <option key={s.id} value={s.id}>{s.name} ({formatDateToDDMMYYYY(s.start_date)} - {formatDateToDDMMYYYY(s.end_date)})</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="plantingType" className="block text-sm font-medium text-gray-700">Planting Type <span className="text-red-500">*</span></label>
              <select id="plantingType" value={plantingType} onChange={e => setPlantingType(e.target.value as CropPlan['planting_type'])} required disabled={isSubmitting}
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm">
                {PLANTING_TYPES.map(pt => <option key={pt} value={pt}>{pt.replace('_', ' ')}</option>)}
              </select>
            </div>
          </div>
          
          <fieldset className="border p-4 rounded-md">
            <legend className="text-sm font-medium text-gray-700 px-1">Planned Dates</legend>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-2">
              <div>
                <label htmlFor="plannedSowingDate" className="block text-xs font-medium text-gray-600">Sowing Date</label>
                <input type="date" id="plannedSowingDate" value={plannedSowingDate} onChange={e => setPlannedSowingDate(e.target.value)} disabled={isSubmitting}
                       className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"/>
              </div>
              <div>
                <label htmlFor="plannedTransplantDate" className="block text-xs font-medium text-gray-600">Transplant Date</label>
                <input type="date" id="plannedTransplantDate" value={plannedTransplantDate} onChange={e => setPlannedTransplantDate(e.target.value)} disabled={isSubmitting || plantingType === 'DIRECT_SEED'}
                       className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"/>
              </div>
              <div>
                <label htmlFor="plannedFirstHarvestDate" className="block text-xs font-medium text-gray-600">First Harvest</label>
                <input type="date" id="plannedFirstHarvestDate" value={plannedFirstHarvestDate} onChange={e => setPlannedFirstHarvestDate(e.target.value)} disabled={isSubmitting}
                       className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"/>
              </div>
              <div>
                <label htmlFor="plannedLastHarvestDate" className="block text-xs font-medium text-gray-600">Last Harvest</label>
                <input type="date" id="plannedLastHarvestDate" value={plannedLastHarvestDate} onChange={e => setPlannedLastHarvestDate(e.target.value)} disabled={isSubmitting}
                       className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"/>
              </div>
            </div>
          </fieldset>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label htmlFor="estimatedDaysToMaturity" className="block text-sm font-medium text-gray-700">Est. Days to Maturity</label>
              <input type="number" id="estimatedDaysToMaturity" value={estimatedDaysToMaturity} onChange={e => setEstimatedDaysToMaturity(e.target.value === '' ? '' : parseInt(e.target.value))} disabled={isSubmitting}
                     className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"/>
            </div>
             <div>
              <label htmlFor="status" className="block text-sm font-medium text-gray-700">Plan Status</label>
              <select id="status" value={status} onChange={e => setStatus(e.target.value as CropPlan['status'])} disabled={isSubmitting}
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm">
                {PLAN_STATUSES.map(st => <option key={st} value={st}>{st.charAt(0).toUpperCase() + st.slice(1).toLowerCase().replace('_', ' ')}</option>)}
              </select>
            </div>
          </div>

          <fieldset className="border p-4 rounded-md">
            <legend className="text-sm font-medium text-gray-700 px-1">Targets (Optional)</legend>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-2">
              <div>
                <label htmlFor="targetQuantityPlants" className="block text-xs font-medium text-gray-600">Plants</label>
                <input type="number" id="targetQuantityPlants" value={targetQuantityPlants} onChange={e => setTargetQuantityPlants(e.target.value === '' ? '' : parseInt(e.target.value))} disabled={isSubmitting}
                       className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"/>
              </div>
              <div>
                <label htmlFor="targetQuantityAreaSqm" className="block text-xs font-medium text-gray-600">Area (sqm)</label>
                <input type="number" step="any" id="targetQuantityAreaSqm" value={targetQuantityAreaSqm} onChange={e => setTargetQuantityAreaSqm(e.target.value === '' ? '' : parseFloat(e.target.value))} disabled={isSubmitting}
                       className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"/>
              </div>
              <div>
                <label htmlFor="targetYieldEstimateKg" className="block text-xs font-medium text-gray-600">Yield Est. (kg)</label>
                <input type="number" step="any" id="targetYieldEstimateKg" value={targetYieldEstimateKg} onChange={e => setTargetYieldEstimateKg(e.target.value === '' ? '' : parseFloat(e.target.value))} disabled={isSubmitting}
                       className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"/>
              </div>
               <div className="md:col-span-3"> {/* Allow yield unit to span if needed or adjust layout */}
                <label htmlFor="targetYieldUnit" className="block text-xs font-medium text-gray-600">Yield Unit</label>
                <input type="text" id="targetYieldUnit" value={targetYieldUnit} onChange={e => setTargetYieldUnit(e.target.value)} disabled={isSubmitting}
                       className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"/>
              </div>
            </div>
          </fieldset>
          
          <div>
            <label htmlFor="notes" className="block text-sm font-medium text-gray-700">Notes</label>
            <textarea id="notes" value={notes} onChange={e => setNotes(e.target.value)} rows={4} disabled={isSubmitting}
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"/>
          </div>

          <div className="flex items-center justify-end space-x-3 pt-4">
            <button type="button" onClick={onCancel} disabled={isSubmitting}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md border border-gray-300 disabled:opacity-50">
              Cancel
            </button>
            <button type="submit" disabled={isSubmitting}
                    className="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50">
              {isSubmitting ? (initialData ? 'Saving Plan...' : 'Creating Plan...') : (initialData ? 'Save Changes' : 'Create Crop Plan')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}