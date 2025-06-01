'use client';

import React from 'react';
import { CropPlan, Crop, Plot, CropSeason } from '@/lib/db';
import Link from 'next/link';
import { formatDateToDDMMYYYY } from '@/lib/dateUtils';

interface CropPlanListProps {
  cropPlans: CropPlan[];
  crops: Crop[];
  plots: Plot[];
  cropSeasons: CropSeason[];
  onEdit: (plan: CropPlan) => void;
  onDelete: (id: string) => Promise<void>;
  isDeleting: string | null;
}

export default function CropPlanList({
  cropPlans,
  crops,
  plots,
  cropSeasons,
  onEdit,
  onDelete,
  isDeleting
}: CropPlanListProps) {
  
  const activePlans = cropPlans.filter(plan => plan.is_deleted !== 1);

  const getReferencedData = (plan: CropPlan) => {
    const crop = crops.find(c => c.id === plan.crop_id && c.is_deleted !== 1);
    const plot = plots.find(p => p.id === plan.plot_id && p.is_deleted !== 1);
    const season = cropSeasons.find(s => s.id === plan.crop_season_id && s.is_deleted !== 1);
    return {
      cropName: crop ? `${crop.name} ${crop.variety || ''}`.trim() : 'N/A',
      plotName: plot ? plot.name : 'N/A',
      seasonName: season ? season.name : 'N/A',
    };
  };

  if (activePlans.length === 0) {
    return <p className="text-center text-gray-500 mt-8">No crop plans found. Create your first plan!</p>;
  }

  return (
    <div className="overflow-x-auto shadow-md rounded-lg">
      <table className="min-w-full bg-white">
        <thead className="bg-green-600 text-white">
          <tr>
            <th className="text-left py-3 px-5 uppercase font-semibold text-sm">Plan Name</th>
            <th className="text-left py-3 px-5 uppercase font-semibold text-sm">Crop</th>
            <th className="text-left py-3 px-5 uppercase font-semibold text-sm">Plot</th>
            <th className="text-left py-3 px-5 uppercase font-semibold text-sm">Season</th>
            <th className="text-left py-3 px-5 uppercase font-semibold text-sm">Sowing/Transplant</th>
            <th className="text-left py-3 px-5 uppercase font-semibold text-sm">Status</th>
            <th className="text-center py-3 px-5 uppercase font-semibold text-sm">Actions</th>
          </tr>
        </thead>
        <tbody className="text-gray-700">
          {activePlans.map((plan) => {
            const { cropName, plotName, seasonName } = getReferencedData(plan);
            const displayDate = plan.planned_transplant_date || plan.planned_sowing_date;
            return (
              <tr key={plan.id} className="border-b border-gray-200 hover:bg-green-50 transition-colors duration-150">
                <td className="py-3 px-5">
                  <Link href={`/planning/crop-plans/${plan.id}`} className="text-blue-600 hover:underline">
                    {plan.plan_name}
                  </Link>
                </td>
                <td className="py-3 px-5">{cropName}</td>
                <td className="py-3 px-5">{plotName}</td>
                <td className="py-3 px-5">{seasonName}</td>
                <td className="py-3 px-5">{displayDate ? formatDateToDDMMYYYY(displayDate) : 'N/A'}</td>
                <td className="py-3 px-5">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    plan.status === 'PLANNED' ? 'bg-blue-100 text-blue-800' :
                    plan.status === 'ACTIVE' ? 'bg-green-100 text-green-800' :
                    plan.status === 'COMPLETED' ? 'bg-gray-100 text-gray-700' :
                    plan.status === 'CANCELLED' ? 'bg-red-100 text-red-700' :
                    'bg-yellow-100 text-yellow-800' // DRAFT or other
                  }`} >
                    {plan.status ? plan.status.charAt(0).toUpperCase() + plan.status.slice(1).toLowerCase().replace('_', ' ') : 'N/A'}
                  </span>
                </td>
                <td className="py-3 px-5 text-center whitespace-nowrap">
                  <button
                    onClick={() => onEdit(plan)}
                    className="text-blue-600 hover:text-blue-800 font-medium mr-3 transition-colors duration-150"
                    disabled={isDeleting === plan.id}
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => onDelete(plan.id)}
                    className="text-red-600 hover:text-red-800 font-medium transition-colors duration-150 disabled:opacity-50"
                    disabled={isDeleting === plan.id}
                  >
                    {isDeleting === plan.id ? 'Deleting...' : 'Delete'}
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}