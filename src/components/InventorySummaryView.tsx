'use client';

import React, { useState, useEffect } from 'react';
import { db } from '@/lib/db'; // Removed unused InputInventory

interface GroupedInventoryItem {
  name: string;
  unit: string;
  totalCurrentQuantity: number;
  sources: Array<{ supplier?: string; quantity?: number }>;
}

export default function InventorySummaryView() {
  const [summary, setSummary] = useState<GroupedInventoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAndGroupInventory = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const allInputs = await db.inputInventory
          .where('is_deleted')
          .notEqual(1)
          .and(item => (item.current_quantity || 0) > 0) // Only items with stock
          .toArray();

        const groupedByNameAndUnit: Record<string, GroupedInventoryItem> = {};

        allInputs.forEach(item => {
          const groupKey = `${item.name}_${item.quantity_unit || 'N/A'}`;
          if (!groupedByNameAndUnit[groupKey]) {
            groupedByNameAndUnit[groupKey] = {
              name: item.name,
              unit: item.quantity_unit || 'N/A',
              totalCurrentQuantity: 0,
              sources: [],
            };
          }
          groupedByNameAndUnit[groupKey].totalCurrentQuantity += item.current_quantity || 0;
          groupedByNameAndUnit[groupKey].sources.push({
            supplier: item.supplier,
            quantity: item.current_quantity,
          });
        });
        
        const summaryArray = Object.values(groupedByNameAndUnit).sort((a, b) => a.name.localeCompare(b.name));
        setSummary(summaryArray);

      } catch (err) {
        console.error("Failed to fetch or group inventory:", err);
        setError("Failed to load inventory summary.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchAndGroupInventory();
  }, []);

  if (isLoading) {
    return <div className="p-4"><p>Loading inventory summary...</p></div>;
  }

  if (error) {
    return <div className="p-4"><p className="text-red-500">{error}</p></div>;
  }

  if (summary.length === 0) {
    return <div className="p-4"><p>No inventory items with current stock found.</p></div>;
  }

  return (
    <div className="mt-8 p-4 bg-white shadow sm:rounded-lg">
      <h2 className="text-xl font-semibold text-gray-900 mb-4">Inventory Stock Summary</h2>
      <div className="space-y-6">
        {summary.map((group) => (
          <div key={`${group.name}-${group.unit}`} className="p-4 border rounded-md">
            <h3 className="text-lg font-medium text-gray-800">
              {group.name} - <span className="font-bold text-green-700">{group.totalCurrentQuantity.toLocaleString()} {group.unit}</span> (Total)
            </h3>
            {group.sources.length > 1 && ( // Only show sources if more than one
              <ul className="mt-2 list-disc list-inside pl-4 text-sm text-gray-600 space-y-1">
                {group.sources.map((source, index) => (
                  <li key={index}>
                    From {source.supplier || 'Unknown Supplier'}: {source.quantity?.toLocaleString()} {group.unit}
                  </li>
                ))}
              </ul>
            )}
             {group.sources.length === 1 && group.sources[0].supplier && ( // Show supplier if only one source and supplier is known
                <p className="mt-1 text-sm text-gray-600">Supplier: {group.sources[0].supplier}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}