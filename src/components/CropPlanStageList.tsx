'use client';

import React from 'react';
import { CropPlanStage } from '@/lib/db';

interface CropPlanStageListProps {
  stages: CropPlanStage[];
  onEditStage: (stage: CropPlanStage) => void;
  onDeleteStage: (stageId: string) => Promise<void>;
  isDeletingStageId: string | null;
  // TODO: Consider adding onMarkStageCompleted if needed directly from list
}

export default function CropPlanStageList({
  stages,
  onEditStage,
  onDeleteStage,
  isDeletingStageId,
}: CropPlanStageListProps) {

  const activeStages = stages.filter(stage => stage.is_deleted !== 1);

  if (activeStages.length === 0) {
    return <p className="text-center text-gray-500 py-4">No stages defined for this plan yet.</p>;
  }

  // Helper to format stage type for display
  const formatStageType = (type: CropPlanStage['stage_type']) => {
    return type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };
  
  // Helper to format status for display
  const formatStatus = (status?: CropPlanStage['status']) => {
    if (!status) return 'Pending';
    return status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };


  return (
    <div className="overflow-x-auto shadow border border-gray-200 rounded-lg">
      <table className="min-w-full bg-white divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Stage Name
            </th>
            <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Type
            </th>
            <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Planned Start
            </th>
            <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Duration (Days)
            </th>
            <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Status
            </th>
            <th scope="col" className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {activeStages.map((stage) => (
            <tr key={stage.id} className="hover:bg-gray-50">
              <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">{stage.stage_name}</td>
              <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">{formatStageType(stage.stage_type)}</td>
              <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                {new Date(stage.planned_start_date).toLocaleDateString()}
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 text-center">{stage.planned_duration_days}</td>
              <td className="px-4 py-3 whitespace-nowrap text-sm">
                <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                  stage.status === 'COMPLETED' ? 'bg-green-100 text-green-800' :
                  stage.status === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-800' :
                  stage.status === 'SKIPPED' ? 'bg-gray-100 text-gray-700' :
                  'bg-yellow-100 text-yellow-800' // PENDING or undefined
                }`} >
                  {formatStatus(stage.status)}
                </span>
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-center text-sm font-medium">
                <button
                  onClick={() => onEditStage(stage)}
                  className="text-indigo-600 hover:text-indigo-900 mr-3 disabled:opacity-50"
                  disabled={isDeletingStageId === stage.id}
                >
                  Edit
                </button>
                <button
                  onClick={() => onDeleteStage(stage.id)}
                  className="text-red-600 hover:text-red-900 disabled:opacity-50"
                  disabled={isDeletingStageId === stage.id}
                >
                  {isDeletingStageId === stage.id ? 'Deleting...' : 'Delete'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}