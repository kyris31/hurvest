'use client';

import React, { useState, useEffect } from 'react';
// Ensure all necessary types are imported, including CultivationActivityPlantingLink
import { CultivationLog, PlantingLog, InputInventory, SeedBatch, Crop, SeedlingProductionLog, PurchasedSeedling, db, CultivationActivityPlantingLink, CultivationActivityUsedInput } from '@/lib/db';

// Define UsedInputItem interface locally if it's specific to this form's state management
interface UsedInputItem {
  id?: string; // ID of the CultivationActivityUsedInput link if editing an existing one
  input_inventory_id: string;
  quantity_used: number | ''; // Allow empty string for input field
  quantity_unit: string;
  original_input_inventory_id?: string; // For tracking changes during edit
  original_quantity_used?: number;     // For tracking changes during edit
  is_deleted_in_form?: boolean; // UI flag to mark for deletion before submit
}

interface CultivationLogFormData {
  logData: Omit<CultivationLog, 'id' | '_synced' | '_last_modified' | 'created_at' | 'updated_at' | 'is_deleted' | 'deleted_at'> | CultivationLog;
  usedInputs: Array<{ // This is what gets sent to the parent
    id?: string; // ID of CultivationActivityUsedInput
    input_inventory_id: string;
    quantity_used: number;
    quantity_unit: string;
    is_deleted?: boolean; // To signal deletion to parent
  }>;
  selectedPlantingLogIds: string[]; // Add this to the form data structure
}

interface CultivationLogFormProps {
  initialLogData?: CultivationLog | null;
  initialUsedInputs?: CultivationActivityUsedInput[]; // Expecting the DB type from parent
  plantingLogs: (PlantingLog & { cropName?: string; seedBatchCode?: string; displayLabel?: string })[];
  inputInventory: InputInventory[];
  activityPlantingLinks?: CultivationActivityPlantingLink[]; // For pre-selecting planting logs if editing

  onSubmit: (data: CultivationLogFormData) => Promise<void>;
  onCancel: () => void;
  isSubmitting: boolean;
}

export default function CultivationLogForm({
  initialLogData,
  initialUsedInputs = [],
  plantingLogs: availablePlantingLogsFromProps,
  inputInventory: availableInputsFromProps,
  activityPlantingLinks: activityPlantingLinksFromProps, // Use this prop
  onSubmit,
  onCancel,
  isSubmitting
}: CultivationLogFormProps) {
  const [selectedPlantingLogIds, setSelectedPlantingLogIds] = useState<string[]>([]);
  const [activityDate, setActivityDate] = useState('');
  const [activityType, setActivityType] = useState('');
  const [plotAffected, setPlotAffected] = useState('');
  const [notes, setNotes] = useState('');
  const [usedInputs, setUsedInputs] = useState<UsedInputItem[]>([]); // State for form's used inputs
  const [formError, setFormError] = useState<string | null>(null);
  // selectedPlantingLogInfo is no longer needed for single selection display


  const activityTypes = [
    "Watering", "Fertilizing", "Pest Control", "Disease Control",
    "Weeding", "Pruning", "Thinning", "Scouting", "Soil Preparation",
    "Mulching", "Trellising", "Other"
  ];


  // Removed useEffect for fetching availablePlantingLogs and availableInputs, as they are now passed as props.

 useEffect(() => {
    const loadInitialData = async () => {
      if (initialLogData && initialLogData.id) {
        setActivityDate(initialLogData.activity_date ? initialLogData.activity_date.split('T')[0] : '');
        setActivityType(initialLogData.activity_type);
        setPlotAffected(initialLogData.plot_affected || '');
        setNotes(initialLogData.notes || '');

        // Use activityPlantingLinksFromProps to set selectedPlantingLogIds
        console.log('[CultivationLogForm] loadInitialData for log ID:', initialLogData.id);
        console.log('[CultivationLogForm] received activityPlantingLinksFromProps:', JSON.stringify(activityPlantingLinksFromProps));
        console.log('[CultivationLogForm] received availablePlantingLogsFromProps:', JSON.stringify(availablePlantingLogsFromProps.map(p => ({id: p.id, displayLabel: p.displayLabel}))));

        if (activityPlantingLinksFromProps) {
            const currentLinks = activityPlantingLinksFromProps.filter(link => {
                const match = link.cultivation_log_id === initialLogData.id && link.is_deleted !== 1;
                console.log(`[CultivationLogForm DEBUG] Comparing link.cult_id (${link.cultivation_log_id}) vs initialLogData.id (${initialLogData.id}) - Match: ${match}`);
                return match;
            });
            console.log('[CultivationLogForm] Filtered currentLinks based on initialLogData.id:', JSON.stringify(currentLinks));
            const plantingLogIdsToSelect = currentLinks.map(link => link.planting_log_id);
            console.log('[CultivationLogForm] plantingLogIdsToSelect for checkboxes:', plantingLogIdsToSelect);
            setSelectedPlantingLogIds(plantingLogIdsToSelect);
        } else {
            console.warn('[CultivationLogForm] activityPlantingLinksFromProps was undefined or empty. Falling back to DB query for planting links.');
            // Fallback if prop not provided, though parent should provide it for edits
            const linksFromDb = await db.cultivationActivityPlantingLinks
                .where('cultivation_log_id').equals(initialLogData.id)
                .filter(link => link.is_deleted !== 1)
                .toArray();
            console.log('[CultivationLogForm] linksFromDb (fallback):', JSON.stringify(linksFromDb));
            const plantingLogIdsToSelectFromDb = linksFromDb.map(link => link.planting_log_id);
            console.log('[CultivationLogForm] plantingLogIdsToSelectFromDb (fallback):', plantingLogIdsToSelectFromDb);
            setSelectedPlantingLogIds(plantingLogIdsToSelectFromDb);
        }


        // Set used inputs from initialUsedInputs prop (which should be CultivationActivityUsedInput[])
        setUsedInputs(initialUsedInputs.map(dbLink => ({
          id: dbLink.id, // This is the ID of the CultivationActivityUsedInput record
          input_inventory_id: dbLink.input_inventory_id,
          quantity_used: dbLink.quantity_used,
          quantity_unit: dbLink.quantity_unit,
          original_input_inventory_id: dbLink.input_inventory_id,
          original_quantity_used: dbLink.quantity_used,
        })));

      } else {
        // Reset form for new entry
        setSelectedPlantingLogIds([]);
        setActivityDate('');
        setActivityType('');
        setPlotAffected('');
        setUsedInputs([]);
        setNotes('');
      }
    };
    loadInitialData();
  }, [initialLogData, initialUsedInputs, availablePlantingLogsFromProps, activityPlantingLinksFromProps]);


  const handlePlantingLogSelectionChange = (plantingLogId: string) => {
    setSelectedPlantingLogIds(prevSelectedIds => {
      const newSelectedIds = prevSelectedIds.includes(plantingLogId)
        ? prevSelectedIds.filter(id => id !== plantingLogId) // Unselect
        : [...prevSelectedIds, plantingLogId]; // Select
      console.log('[CultivationLogForm] handlePlantingLogSelectionChange - New selected IDs:', newSelectedIds);
      return newSelectedIds;
    });
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    console.log('[CultivationLogForm] handleSubmit triggered.'); // Log: Start of handleSubmit
    e.preventDefault();
    setFormError(null);
    console.log('[CultivationLogForm] Initial values: activityDate:', activityDate, 'activityType:', activityType, 'selectedPlantingLogIds:', selectedPlantingLogIds.length, 'plotAffected:', plotAffected);

    if (!activityDate || !activityType.trim()) {
      const errorMsg = 'Activity Date and Activity Type are required.';
      console.log('[CultivationLogForm] Validation failed:', errorMsg);
      setFormError(errorMsg);
      return;
    }
    if (selectedPlantingLogIds.length === 0 && !plotAffected.trim()) {
      const errorMsg = 'Either select at least one Planting Log or specify the Plot Affected.';
      console.log('[CultivationLogForm] Validation failed:', errorMsg);
      setFormError(errorMsg);
      return;
    }
    // New validation for usedInputs array
    for (const [index, usedIn] of usedInputs.entries()) {
      if (!usedIn.input_inventory_id) {
        const errorMsg = `Input item #${index + 1}: An item must be selected.`;
        console.log('[CultivationLogForm] Validation failed:', errorMsg);
        setFormError(errorMsg);
        return;
      }
      if (usedIn.quantity_used === '' || isNaN(Number(usedIn.quantity_used)) || Number(usedIn.quantity_used) <= 0) {
        const itemName = availableInputsFromProps.find(i => i.id === usedIn.input_inventory_id)?.name || `Item #${index + 1}`;
        const errorMsg = `Quantity used for "${itemName}" must be a positive number.`;
        console.log('[CultivationLogForm] Validation failed:', errorMsg);
        setFormError(errorMsg);
        return;
      }
      if (!usedIn.quantity_unit.trim()) {
        const itemName = availableInputsFromProps.find(i => i.id === usedIn.input_inventory_id)?.name || `Item #${index + 1}`;
        const errorMsg = `Unit for "${itemName}" is required.`;
        console.log('[CultivationLogForm] Validation failed:', errorMsg);
        setFormError(errorMsg);
        return;
      }
    }
    console.log('[CultivationLogForm] All validations passed.');

    // Data for the main CultivationLog record
    const logCoreData: Omit<CultivationLog, 'id' | '_synced' | '_last_modified' | 'created_at' | 'updated_at' | 'is_deleted' | 'deleted_at'> = {
      activity_date: activityDate,
      activity_type: activityType.trim(),
      plot_affected: plotAffected.trim() || undefined,
      notes: notes.trim() || undefined,
    };
    
    const finalLogData: CultivationLog | Omit<CultivationLog, 'id' | '_synced' | '_last_modified' | 'created_at' | 'updated_at' | 'is_deleted' | 'deleted_at'> =
      initialLogData?.id
        ? { ...initialLogData, ...logCoreData } // Preserve ID and other fields if editing
        : logCoreData;

    const formDataToSubmit: CultivationLogFormData = {
      logData: finalLogData,
      usedInputs: usedInputs
        .filter(ui => !ui.is_deleted_in_form) // Filter out items marked for deletion in UI
        .map(ui => ({
          id: ui.id, // ID of the CultivationActivityUsedInput link
          input_inventory_id: ui.input_inventory_id,
          quantity_used: Number(ui.quantity_used),
          quantity_unit: ui.quantity_unit,
        })),
      selectedPlantingLogIds: selectedPlantingLogIds, // Add selected IDs from form state
    };
    
    console.log('[CultivationLogForm] Data being submitted:', JSON.stringify(formDataToSubmit, null, 2)); // Log: Data before calling onSubmit

    try {
      console.log('[CultivationLogForm] Calling onSubmit prop...');
      await onSubmit(formDataToSubmit); // This now sends the structured data
      console.log('[CultivationLogForm] onSubmit prop finished.');
      // onCancel(); // Parent will call onCancel after its own successful transaction
    } catch (err) {
        console.error("[CultivationLogForm] Error during onSubmit call or in parent's handler:", err);
        setFormError(`Failed to save: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
        console.log('[CultivationLogForm] handleSubmit finished.');
    }
  };

  // Use availableInputsFromProps directly
  const displayableAvailableInputs = React.useMemo(() => {
    if (!availableInputsFromProps.length) return [];

    return availableInputsFromProps.map(inputFromDb => {
      let allocatedInForm = 0;
      usedInputs.forEach(usedItemInForm => {
        // Check if the item in form matches the DB item and has a valid quantity
        if (usedItemInForm.input_inventory_id === inputFromDb.id &&
            usedItemInForm.quantity_used !== '' &&
            !isNaN(Number(usedItemInForm.quantity_used))) {
          allocatedInForm += Number(usedItemInForm.quantity_used);
        }
      });
      
      const currentStockInDb = inputFromDb.current_quantity || 0;
      let displayStock = currentStockInDb;

      const existingFormItem = usedInputs.find(ui => ui.input_inventory_id === inputFromDb.id);
      if (existingFormItem) {
         if (existingFormItem.original_input_inventory_id === inputFromDb.id && typeof existingFormItem.original_quantity_used === 'number') {
             displayStock = currentStockInDb + existingFormItem.original_quantity_used - Number(existingFormItem.quantity_used || 0);
         } else {
             displayStock = currentStockInDb - Number(existingFormItem.quantity_used || 0);
         }
      }


      return {
        ...inputFromDb,
        display_stock: displayStock < 0 ? 0 : displayStock, // Ensure not negative
      };
    // Filter to show items that still have stock OR are already selected in the form
    }).filter(input => input.display_stock > 0 || usedInputs.some(ui => ui.input_inventory_id === input.id) );
  }, [availableInputsFromProps, usedInputs]);

  const handleAddUsedInput = () => {
    setUsedInputs([...usedInputs, { input_inventory_id: '', quantity_used: '', quantity_unit: '' }]);
  };

  const handleRemoveUsedInput = (index: number) => {
    setUsedInputs(usedInputs.filter((_, i) => i !== index));
  };

  const handleUsedInputChange = (index: number, field: keyof UsedInputItem, value: string | number) => {
    const newUsedInputs = usedInputs.map((item, i) => {
      if (i === index) {
        const updatedItem = { ...item };
        if (field === 'quantity_used') {
          updatedItem[field] = value === '' ? '' : Number(value);
        } else if (field === 'input_inventory_id' || field === 'quantity_unit') {
          updatedItem[field] = String(value);
        }
        return updatedItem;
      }
      return item;
    });
    setUsedInputs(newUsedInputs);
  };


  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex justify-center items-center p-4">
      <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <h2 className="text-2xl font-bold mb-6 text-gray-800">
          {initialLogData ? 'Edit Cultivation Log' : 'Record Cultivation Activity'}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-6">
          {formError && <p className="text-red-500 text-sm mb-3">{formError}</p>}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Affected Planting Logs (select one or more, or leave blank if using "Plot Affected" only)
            </label>
            <div className="max-h-72 overflow-y-auto border border-gray-300 rounded-md p-2 space-y-1"> {/* Reduced max-h-96 to max-h-72 */}
              {availablePlantingLogsFromProps.length === 0 && <p className="text-xs text-gray-500">No active planting logs available.</p>}
              {availablePlantingLogsFromProps.map(pl => {
                const isChecked = selectedPlantingLogIds.includes(pl.id);
                // For detailed debugging of checkbox state:
                console.log(`[CultivationLogForm] Checkbox render: PL ID: ${pl.id}, Label: ${pl.displayLabel}, selectedIDs: ${JSON.stringify(selectedPlantingLogIds)}, isChecked: ${isChecked}`);
                return (
                  <div key={`checkbox-div-${pl.id}`} className="flex items-center">
                    <input
                      type="checkbox"
                      id={`pl-${pl.id}`}
                      value={pl.id}
                      checked={isChecked}
                      onChange={() => handlePlantingLogSelectionChange(pl.id)}
                      className="h-4 w-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
                      disabled={isSubmitting}
                    />
                    <label htmlFor={`pl-${pl.id}`} className="ml-2 text-sm text-gray-700">
                      {pl.displayLabel}
                    </label>
                  </div>
                );
              })}
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="activityDate" className="block text-sm font-medium text-gray-700">
                Activity Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                id="activityDate"
                value={activityDate}
                onChange={(e) => setActivityDate(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
                required
                disabled={isSubmitting}
              />
            </div>
            <div>
              <label htmlFor="activityType" className="block text-sm font-medium text-gray-700">
                Activity Type <span className="text-red-500">*</span>
              </label>
              <select
                id="activityType"
                value={activityType}
                onChange={(e) => setActivityType(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
                required
                disabled={isSubmitting}
              >
                <option value="">Select Activity Type</option>
                {activityTypes.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="plotAffected" className="block text-sm font-medium text-gray-700">Plot Affected (e.g., A1, B2-East)</label>
            <input
              type="text"
              id="plotAffected"
              value={plotAffected}
              onChange={(e) => {
                const newValue = e.target.value;
                console.log('[CultivationLogForm] plotAffected onChange - New value:', newValue);
                setPlotAffected(newValue);
              }}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
              disabled={isSubmitting}
              placeholder={"Enter plot details (e.g., specific rows, or general area)"}
            />
          </div>
          
          <hr className="my-2"/>
          <p className="text-sm font-medium text-gray-700 mb-1">Inputs Used (Optional):</p>
          {usedInputs.map((usedIn, index) => (
            <div key={index} className="p-3 border border-gray-200 rounded-md space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
                <div className="md:col-span-2">
                  <label htmlFor={`used-input-item-${index}`} className="block text-xs font-medium text-gray-600">Input Item</label>
                  <select
                    id={`used-input-item-${index}`}
                    value={usedIn.input_inventory_id}
                    onChange={(e) => handleUsedInputChange(index, 'input_inventory_id', e.target.value)}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
                    disabled={isSubmitting}
                  >
                    <option value="">Select Item</option>
                    {displayableAvailableInputs.map(input => {
                      const isSelectedInThisRow = usedIn.input_inventory_id === input.id;
                      return (
                        <option
                          key={input.id}
                          value={input.id}
                          disabled={!isSelectedInThisRow && input.display_stock <= 0}
                        >
                          {input.name} ({input.type || 'N/A'})
                          {input.purchase_date ? ` - P:${new Date(input.purchase_date).toLocaleDateString()}` : ''}
                          {' '}- Stock: {input.display_stock ?? 'N/A'} {input.quantity_unit || ''}
                        </option>
                      );
                    })}
                  </select>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemoveUsedInput(index)}
                  className="px-3 py-2 text-xs font-medium text-red-700 bg-red-100 hover:bg-red-200 rounded-md border border-red-300 disabled:opacity-50"
                  disabled={isSubmitting}
                >
                  Remove
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor={`used-input-qty-${index}`} className="block text-xs font-medium text-gray-600">Quantity Used</label>
                  <input
                    type="number"
                    id={`used-input-qty-${index}`}
                    value={usedIn.quantity_used}
                    onChange={(e) => handleUsedInputChange(index, 'quantity_used', e.target.value)}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
                    disabled={isSubmitting || !usedIn.input_inventory_id}
                    step="any"
                  />
                </div>
                <div>
                  <label htmlFor={`used-input-unit-${index}`} className="block text-xs font-medium text-gray-600">Unit</label>
                  <input
                    type="text"
                    id={`used-input-unit-${index}`}
                    value={usedIn.quantity_unit}
                    onChange={(e) => handleUsedInputChange(index, 'quantity_unit', e.target.value)}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
                    disabled={isSubmitting || !usedIn.input_inventory_id}
                  />
                </div>
              </div>
            </div>
          ))}
          <button
            type="button"
            onClick={handleAddUsedInput}
            disabled={isSubmitting}
            className="mt-2 px-4 py-2 text-sm font-medium text-green-700 bg-green-100 hover:bg-green-200 rounded-md border border-green-300 disabled:opacity-50"
          >
            + Add Input Item
          </button>

          <div>
            <label htmlFor="notes" className="block text-sm font-medium text-gray-700">Notes</label>
            <textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm disabled:bg-gray-50"
              disabled={isSubmitting}
            />
          </div>

          <div className="flex items-center justify-end space-x-3 pt-4 border-t border-gray-200 mt-6">
            <button
              type="button"
              onClick={onCancel}
              disabled={isSubmitting}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md border border-gray-300 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || (availablePlantingLogsFromProps.length === 0 && !initialLogData)}
              className="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
            >
              {isSubmitting ? (initialLogData ? 'Saving...' : 'Recording...') : (initialLogData ? 'Save Changes' : 'Record Activity')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}