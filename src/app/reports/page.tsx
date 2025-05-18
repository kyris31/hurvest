'use client';

import React, { useState, useEffect } from 'react';
import { db } from '@/lib/db'; // Import db for categories, removed unused InputInventory
import {
    exportSalesToCSV,
    exportInventoryToCSV,
    exportHarvestLogsToCSV,
    exportSalesToPDF,
    exportInventoryToPDF,
    exportHarvestLogsToPDF,
    exportInventoryValueToCSV,
    exportInventoryValueToPDF,
    exportSeedlingLifecycleToCSV,
    exportSeedlingLifecycleToPDF,
    exportOrganicComplianceToCSV, // Placeholder
    exportOrganicComplianceToPDF, // Placeholder
    exportInputItemUsageLedgerToPDF,
    exportDetailedInputUsageToCSV,
    exportSeedSourceDeclarationToCSV,
    exportDetailedInputUsageToPDF, // Import new PDF export
    exportSeedSourceDeclarationToPDF, // Import new PDF export
    // InventoryReportFilters type might need to be exported from reportUtils if not already
} from '@/lib/reportUtils';

// Define a common DateRangeFilters interface if not already exported from reportUtils
interface DateRangeFilters {
    startDate?: string | null;
    endDate?: string | null;
}

// InventoryReportFilters can extend DateRangeFilters or be used separately
interface InventoryReportFilters extends DateRangeFilters {
    category?: string | null;
}


export default function ReportsPage() {
  const [inventoryCategory, setInventoryCategory] = useState<string>('');
  // Generic date filters for all reports
  const [reportStartDate, setReportStartDate] = useState<string>('');
  const [reportEndDate, setReportEndDate] = useState<string>('');
  
  const [availableCategories, setAvailableCategories] = useState<string[]>([]);

  useEffect(() => {
    const fetchCategories = async () => {
      const inputs = await db.inputInventory.where('is_deleted').notEqual(1).toArray();
      const types = new Set(inputs.map(i => i.type).filter(Boolean) as string[]);
      types.add("Seed Batch");
      setAvailableCategories(Array.from(types).sort());
    };
    fetchCategories();
  }, []);

  const handleExportWithDateFilters = (
    exportFn: (filters?: DateRangeFilters) => Promise<void>
  ) => {
    const filters: DateRangeFilters = {
      startDate: reportStartDate || null,
      endDate: reportEndDate || null,
    };
    exportFn(filters);
  };
  
  const handleExportInventoryWithAllFilters = (
    exportFn: (filters?: InventoryReportFilters) => Promise<void>
  ) => {
    const filters: InventoryReportFilters = {
      category: inventoryCategory || null,
      startDate: reportStartDate || null, // Use generic date filters
      endDate: reportEndDate || null,     // Use generic date filters
    };
    exportFn(filters);
  };


  return (
    <div>
      <header className="bg-white shadow mb-6">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Reports & Exports</h1>
        </div>
      </header>
      <div className="mx-auto max-w-7xl py-6 sm:px-6 lg:px-8 space-y-8">
        
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4 text-gray-800">Report Filters</h2>
          <p className="mb-3 text-sm text-gray-600">
            Apply date ranges to all reports. Category filter applies only to Inventory reports.
          </p>
          {/* Generic Date Filters */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 border-b pb-6">
            <div>
              <label htmlFor="reportStartDate" className="block text-sm font-medium text-gray-700">Start Date (for all reports)</label>
              <input
                type="date"
                id="reportStartDate"
                name="reportStartDate"
                value={reportStartDate}
                onChange={(e) => setReportStartDate(e.target.value)}
                className="mt-1 block w-full py-2 px-3 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
              />
            </div>
            <div>
              <label htmlFor="reportEndDate" className="block text-sm font-medium text-gray-700">End Date (for all reports)</label>
              <input
                type="date"
                id="reportEndDate"
                name="reportEndDate"
                value={reportEndDate}
                onChange={(e) => setReportEndDate(e.target.value)}
                className="mt-1 block w-full py-2 px-3 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
              />
            </div>
             {/* Inventory Category Filter - Placed here for proximity but applies only to inventory */}
            <div>
              <label htmlFor="inventoryCategory" className="block text-sm font-medium text-gray-700">Inventory Category</label>
              <select
                id="inventoryCategory"
                name="inventoryCategory"
                value={inventoryCategory}
                onChange={(e) => setInventoryCategory(e.target.value)}
                className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
              >
                <option value="">All Inventory Categories</option>
                {availableCategories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
          </div>

          <h2 className="text-xl font-semibold mb-4 text-gray-800">Download Data Exports</h2>
          <div className="space-y-6">
            {/* Sales Reports */}
            <div>
              <h3 className="text-lg font-medium text-gray-700 mb-2">Sales Reports</h3>
              <div className="flex flex-wrap gap-4">
                <button
                  onClick={() => handleExportWithDateFilters(exportSalesToCSV)}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded shadow-sm transition-colors duration-150"
                >
                  Export Sales (CSV)
                </button>
                <button
                  onClick={() => handleExportWithDateFilters(exportSalesToPDF)}
                  className="bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded shadow-sm transition-colors duration-150"
                >
                  Export Sales (PDF)
                </button>
              </div>
            </div>

            {/* Inventory Reports Section */}
            <div className="border-t pt-6">
              <h3 className="text-lg font-medium text-gray-700 mb-3">Inventory Reports</h3>
              <p className="text-xs text-gray-500 mb-3">Uses selected Inventory Category and the general Start/End Date filters above.</p>
              <div className="flex flex-wrap gap-4">
                <button
                  onClick={() => handleExportInventoryWithAllFilters(exportInventoryToCSV)}
                  className="bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2 px-4 rounded shadow-sm transition-colors duration-150"
                >
                  Export Inventory Summary (CSV)
                </button>
                <button
                  onClick={() => handleExportInventoryWithAllFilters(exportInventoryToPDF)}
                  className="bg-orange-600 hover:bg-orange-700 text-white font-semibold py-2 px-4 rounded shadow-sm transition-colors duration-150"
                >
                  Export Inventory Summary (PDF)
                </button>
                 <button
                  onClick={() => handleExportInventoryWithAllFilters(exportInventoryValueToCSV)}
                  className="bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded shadow-sm transition-colors duration-150"
                >
                  Export Inventory Value (CSV)
                </button>
                <button
                  onClick={() => handleExportInventoryWithAllFilters(exportInventoryValueToPDF)}
                  className="bg-lime-600 hover:bg-lime-700 text-white font-semibold py-2 px-4 rounded shadow-sm transition-colors duration-150"
                >
                  Export Inventory Value (PDF)
                </button>
                <button
                  onClick={() => exportInputItemUsageLedgerToPDF()} // Call directly, no filters for now
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 px-4 rounded shadow-sm transition-colors duration-150"
                >
                  Export Input Usage Ledger (PDF)
                </button>
              </div>
            </div>

            {/* Harvest Log Reports */}
            <div className="border-t pt-6">
              <h3 className="text-lg font-medium text-gray-700 mb-2">Harvest Log Reports</h3>
              <p className="text-xs text-gray-500 mb-3">Uses the general Start/End Date filters above.</p>
              <div className="flex flex-wrap gap-4">
                <button
                  onClick={() => handleExportWithDateFilters(exportHarvestLogsToCSV)}
                  className="bg-teal-600 hover:bg-teal-700 text-white font-semibold py-2 px-4 rounded shadow-sm transition-colors duration-150"
                >
                  Export Harvest Logs (CSV)
                </button>
                <button
                  onClick={() => handleExportWithDateFilters(exportHarvestLogsToPDF)}
                  className="bg-cyan-600 hover:bg-cyan-700 text-white font-semibold py-2 px-4 rounded shadow-sm transition-colors duration-150"
                >
                  Export Harvest Logs (PDF)
                </button>
              </div>
            </div>

            {/* Seedling Lifecycle Report */}
            <div className="border-t pt-6">
              <h3 className="text-lg font-medium text-gray-700 mb-2">Seedling Lifecycle Report</h3>
              <p className="text-xs text-gray-500 mb-3">Traces seedlings from planting through harvest and sales. Uses the general Start/End Date filters above (filters by planting date).</p>
              <div className="flex flex-wrap gap-4">
                <button
                  onClick={() => handleExportWithDateFilters(exportSeedlingLifecycleToCSV)}
                  className="bg-sky-600 hover:bg-sky-700 text-white font-semibold py-2 px-4 rounded shadow-sm transition-colors duration-150"
                >
                  Export Seedling Lifecycle (CSV)
                </button>
                <button
                  onClick={() => handleExportWithDateFilters(exportSeedlingLifecycleToPDF)}
                  className="bg-rose-600 hover:bg-rose-700 text-white font-semibold py-2 px-4 rounded shadow-sm transition-colors duration-150"
                >
                  Export Seedling Lifecycle (PDF)
                </button>
              </div>
            </div>
            
            {/* Organic Compliance Reports Placeholder */}
            <div className="border-t pt-6">
              <h3 className="text-lg font-medium text-gray-700 mb-2">Organic Compliance Reports</h3>
              <p className="text-xs text-gray-500 mb-3">Generates reports for organic certification (placeholder functionality). Uses the general Start/End Date filters above.</p>
              <div className="flex flex-wrap gap-4">
                <button
                  onClick={() => handleExportWithDateFilters(exportOrganicComplianceToCSV)}
                  className="bg-amber-600 hover:bg-amber-700 text-white font-semibold py-2 px-4 rounded shadow-sm transition-colors duration-150"
                >
                  Export Organic Compliance (CSV)
                </button>
                <button
                  onClick={() => handleExportWithDateFilters(exportOrganicComplianceToPDF)}
                  className="bg-yellow-600 hover:bg-yellow-700 text-white font-semibold py-2 px-4 rounded shadow-sm transition-colors duration-150"
                >
                  Export Organic Compliance (PDF)
                </button>
                <button
                  onClick={() => handleExportWithDateFilters(exportDetailedInputUsageToCSV)}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2 px-4 rounded shadow-sm transition-colors duration-150"
                >
                  Export Detailed Input Usage (CSV)
                </button>
                <button
                  onClick={() => handleExportWithDateFilters(exportDetailedInputUsageToPDF)}
                  className="bg-emerald-700 hover:bg-emerald-800 text-white font-semibold py-2 px-4 rounded shadow-sm transition-colors duration-150"
                >
                  Export Detailed Input Usage (PDF)
                </button>
                <button
                  onClick={() => handleExportWithDateFilters(exportSeedSourceDeclarationToCSV)}
                  className="bg-teal-600 hover:bg-teal-700 text-white font-semibold py-2 px-4 rounded shadow-sm transition-colors duration-150"
                >
                  Export Seed Source Declaration (CSV)
                </button>
                <button
                  onClick={() => handleExportWithDateFilters(exportSeedSourceDeclarationToPDF)}
                  className="bg-teal-700 hover:bg-teal-800 text-white font-semibold py-2 px-4 rounded shadow-sm transition-colors duration-150"
                >
                  Export Seed Source Declaration (PDF)
                </button>
              </div>
            </div>

            {/* Example:
            <div>
              <h3 className="text-lg font-medium text-gray-700 mb-2">Planting Log Reports</h3>
              <div className="flex flex-wrap gap-4">
                <button
                  // onClick={exportPlantingLogsToCSV}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 px-4 rounded shadow-sm transition-colors duration-150"
                >
                  Export Planting Logs (CSV)
                </button>
                 <button
                  // onClick={exportPlantingLogsToPDF}
                  className="bg-pink-600 hover:bg-pink-700 text-white font-semibold py-2 px-4 rounded shadow-sm transition-colors duration-150"
                >
                  Export Planting Logs (PDF)
                </button>
              </div>
            </div>
            */}
          </div>
        </div>
        {/* The stray div and commented buttons below were causing the parsing error. */}
        {/* Placeholder for future on-page report displays or more complex report generation options */}
        {/*
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4 text-gray-800">On-Page Financial Summary (Future)</h2>
           <p className="text-gray-500">This section will display configurable financial summaries and charts directly on the page.</p>
        </div>
        */}

      </div>
    </div>
  );
}