'use client';

import React from 'react';
import { Crop } from '@/lib/db';
import { PencilIcon, TrashIcon } from '@heroicons/react/24/outline';

interface CropListProps {
  crops: Crop[];
  onEdit: (crop: Crop) => void;
  onDelete: (id: string) => Promise<void>;
  isDeleting: string | null; // ID of crop being deleted, or null
}

export default function CropList({ crops, onEdit, onDelete, isDeleting }: CropListProps) {
  if (crops.length === 0) {
    // This case is handled by the page's "No crops found" message.
    // Return null or a minimal fragment if no specific list-level message is needed when empty.
    return null; 
  }

  return (
    <div className="overflow-x-auto shadow-md rounded-lg">
      <table className="min-w-full bg-white">
        <thead className="bg-green-600 text-white">
          <tr>
            <th className="text-left py-3 px-5 uppercase font-semibold text-sm">Name</th>
            <th className="text-left py-3 px-5 uppercase font-semibold text-sm">Variety (Notes)</th>
            <th className="text-left py-3 px-5 uppercase font-semibold text-sm">Type/Category</th>
            <th className="text-center py-3 px-5 uppercase font-semibold text-sm">Synced</th>
            <th className="text-center py-3 px-5 uppercase font-semibold text-sm">Actions</th>
          </tr>
        </thead>
        <tbody className="text-gray-700">
          {crops.map((crop) => (
            <tr key={crop.id} className="border-b border-gray-200 hover:bg-green-50 transition-colors duration-150">
              <td className="py-3 px-5">{crop.name}</td>
              <td className="py-3 px-5">
                {crop.variety || <span className="text-gray-400 italic">No Variety</span>}
                {crop.notes && (
                  <span className="text-xs text-gray-500 ml-1">({crop.notes})</span>
                )}
              </td>
              <td className="py-3 px-5">{crop.type || <span className="text-gray-400">N/A</span>}</td>
              <td className="py-3 px-5 text-center">
                {crop._synced === 0 ? (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                    Pending
                  </span>
                ) : crop._synced === 1 ? (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    Synced
                  </span>
                ) : (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                    Unknown
                  </span>
                )}
              </td>
              <td className="py-3 px-5 text-center space-x-2">
                <button
                  onClick={() => onEdit(crop)}
                  className="text-blue-600 hover:text-blue-800 p-1 rounded-md transition-colors duration-150"
                  title="Edit Crop"
                  disabled={isDeleting === crop.id}
                >
                  <PencilIcon className="h-5 w-5" />
                </button>
                <button
                  onClick={() => onDelete(crop.id)}
                  className="text-red-600 hover:text-red-800 p-1 rounded-md transition-colors duration-150 disabled:opacity-50"
                  title="Delete Crop"
                  disabled={isDeleting === crop.id}
                >
                  {isDeleting === crop.id ? (
                    <svg className="animate-spin h-5 w-5 text-red-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  ) : (
                    <TrashIcon className="h-5 w-5" />
                  )}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}