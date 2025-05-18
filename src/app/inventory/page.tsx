'use client';

import Link from 'next/link';
import React from 'react';
import { exportInventoryToCSV, exportInventoryToPDF, exportGroupedInventorySummaryToPDF } from '@/lib/reportUtils'; // Import CSV and PDF export functions
import InventorySummaryView from '@/components/InventorySummaryView'; // Import the new summary view

export default function InventoryPage() {
  return (
    <div>
      <header className="bg-white shadow mb-6">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex flex-wrap justify-between items-center gap-4">
            <h1 className="text-3xl font-bold tracking-tight text-gray-900">Inventory Management</h1>
            <div className="flex space-x-3">
              <button
                onClick={() => exportInventoryToCSV()}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded shadow-sm transition-colors duration-150 text-sm"
              >
                Export Inventory (CSV)
              </button>
              <button
                onClick={() => exportInventoryToPDF()}
                className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded shadow-sm transition-colors duration-150 text-sm"
              >
                Export Inventory (PDF)
              </button>
            </div>
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-7xl py-6 sm:px-6 lg:px-8">
        <p className="mb-6 text-gray-700">
          Manage your farm&amp;apos;s inventory, including seed batches and other inputs like fertilizers and pesticides.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Link href="/inventory/seed-batches" className="block p-6 bg-green-600 hover:bg-green-700 text-white rounded-lg shadow-md transition-colors duration-150">
            
              <h2 className="text-xl font-semibold mb-2">Seed Batches</h2>
              <p>Track and manage your seed inventory by batch, including supplier and purchase details.</p>
            
          </Link>
          <Link href="/inventory/inputs" className="block p-6 bg-lime-600 hover:bg-lime-700 text-white rounded-lg shadow-md transition-colors duration-150">
            
              <h2 className="text-xl font-semibold mb-2">Other Inputs</h2>
              <p>Manage stock levels for fertilizers, pesticides, soil amendments, and other farming inputs.</p>
            
          </Link>
        </div>
        
        {/* Inventory Summary Section */}
        <div className="mt-8">
          <InventorySummaryView />
          <div className="mt-4 text-right">
            <button
              onClick={() => exportGroupedInventorySummaryToPDF()}
              className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded shadow-sm transition-colors duration-150 text-sm"
            >
              Export Summary (PDF)
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}