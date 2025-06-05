'use client';
import Link from 'next/link';

import React, { useState, useEffect } from 'react';
import { db } from '@/lib/db';
import type { Flock, Customer } from '@/lib/db'; // Import Flock and Customer types
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
    exportDetailedInputUsageToPDF,
    exportSeedSourceDeclarationToPDF,
    getPoultryFeedEfficiencyData, // Import new report function
    exportPlantingLogsToCSV, // Added for Planting Logs
    exportPlantingLogsToPDF,  // Added for Planting Logs
    exportStatementOfAccountToPDF // Import the new function
} from '@/lib/reportUtils';
import type { PoultryFeedEfficiencyReportData, StatementOfAccountFilters } from '@/lib/reportUtils'; // Import type & new filter type

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
  const [availableFlocks, setAvailableFlocks] = useState<Flock[]>([]);
  const [selectedFlockForEfficiency, setSelectedFlockForEfficiency] = useState<string>('');
  const [feedEfficiencyData, setFeedEfficiencyData] = useState<PoultryFeedEfficiencyReportData | null>(null);
  const [availableCustomers, setAvailableCustomers] = useState<Customer[]>([]); // Added for statement
  const [selectedCustomerForStatement, setSelectedCustomerForStatement] = useState<string>(''); // Added for statement
  const [isFetchingEfficiency, setIsFetchingEfficiency] = useState(false);


  useEffect(() => {
    const fetchCategories = async () => {
      const inputs = await db.inputInventory.where('is_deleted').notEqual(1).toArray();
      const types = new Set(inputs.map(i => i.type).filter(Boolean) as string[]);
      types.add("Seed Batch"); // Assuming "Seed Batch" is a distinct category not in input types
      setAvailableCategories(Array.from(types).sort());
    };
    const fetchFlocks = async () => {
      const flocks = await db.flocks.where('is_deleted').notEqual(1).toArray();
      setAvailableFlocks(flocks.sort((a,b) => a.name.localeCompare(b.name)));
    };
    const fetchCustomers = async () => {
      let customers = await db.customers.where('is_deleted').notEqual(1).toArray();
      customers = customers.sort((a, b) => a.name.localeCompare(b.name)); // Sort after fetching
      setAvailableCustomers(customers);
    };
    fetchCategories();
    fetchFlocks();
    fetchCustomers(); // Added
  }, []);

  const handleGenerateFeedEfficiencyReport = async () => {
    if (!selectedFlockForEfficiency) {
      alert("Please select a flock.");
      return;
    }
    setIsFetchingEfficiency(true);
    setFeedEfficiencyData(null);
    try {
      const data = await getPoultryFeedEfficiencyData(selectedFlockForEfficiency);
      setFeedEfficiencyData(data);
    } catch (error) {
      console.error("Error generating feed efficiency report:", error);
      alert("Failed to generate feed efficiency report.");
    } finally {
      setIsFetchingEfficiency(false);
    }
  };

  const handleExportWithDateFilters = (
    exportFn: (filters?: DateRangeFilters) => Promise<void>
  ) => {
    const filters: DateRangeFilters = {
      startDate: reportStartDate || null,
      endDate: reportEndDate || null,
    };
    exportFn(filters);
  };

  const handleExportStatementOfAccount = () => {
    if (!selectedCustomerForStatement) {
      alert("Please select a customer for the statement.");
      return;
    }
    const filters: DateRangeFilters & { customerId: string } = { // Type for filters including customerId
      startDate: reportStartDate || null,
      endDate: reportEndDate || null,
      customerId: selectedCustomerForStatement,
    };
    exportStatementOfAccountToPDF(filters as StatementOfAccountFilters); // Call the actual export function
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
                {/* Statement of Account UI Elements */}
                <div className="mt-4 pt-4 border-t md:col-span-2"> {/* Use md:col-span-2 to allow dropdown and button to align better */}
                  <label htmlFor="customerForStatement" className="block text-sm font-medium text-gray-700 mb-1">
                    Customer for Statement
                  </label>
                  <div className="flex items-center gap-x-2">
                    <select
                      id="customerForStatement"
                      value={selectedCustomerForStatement}
                      onChange={(e) => setSelectedCustomerForStatement(e.target.value)}
                      className="block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
                    >
                      <option value="">-- Select Customer --</option>
                      {availableCustomers.map(customer => (
                        <option key={customer.id} value={customer.id}>
                          {customer.name} ({customer.customer_type || 'Individual'})
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={handleExportStatementOfAccount}
                      disabled={!selectedCustomerForStatement}
                      className="bg-green-700 hover:bg-green-800 text-white font-semibold py-2 px-4 rounded shadow-sm transition-colors duration-150 disabled:opacity-50 whitespace-nowrap"
                    >
                      Statement of Account (PDF)
                    </button>
                  </div>
                </div>
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
            
            {/* Poultry Reports Section */}
            <div className="border-t pt-6">
              <h3 className="text-lg font-medium text-gray-700 mb-3">Poultry Reports</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div>
                  <label htmlFor="flockForEfficiency" className="block text-sm font-medium text-gray-700">Select Flock for Feed Efficiency</label>
                  <select
                    id="flockForEfficiency"
                    value={selectedFlockForEfficiency}
                    onChange={(e) => setSelectedFlockForEfficiency(e.target.value)}
                    className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
                  >
                    <option value="">-- Select Flock --</option>
                    {availableFlocks.map(flock => (
                      <option key={flock.id} value={flock.id}>{flock.name} ({flock.flock_type === 'egg_layer' ? 'Layers' : 'Broilers'})</option>
                    ))}
                  </select>
                </div>
                <div className="md:col-span-2 flex items-end">
                  <button
                    onClick={handleGenerateFeedEfficiencyReport}
                    disabled={!selectedFlockForEfficiency || isFetchingEfficiency}
                    className="bg-pink-600 hover:bg-pink-700 text-white font-semibold py-2 px-4 rounded shadow-sm transition-colors duration-150 disabled:opacity-50"
                  >
                    {isFetchingEfficiency ? 'Generating...' : 'Generate Feed Efficiency Report'}
                  </button>
                </div>
              </div>

              {isFetchingEfficiency && <p className="text-gray-600">Loading efficiency data...</p>}
              {feedEfficiencyData && (
                <div className="mt-4 p-4 bg-gray-50 rounded-md shadow">
                  <h4 className="text-md font-semibold text-gray-800 mb-2">Feed Efficiency for: {feedEfficiencyData.flockName}</h4>
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                    <dt className="font-medium text-gray-600">Total Feed Consumed:</dt>
                    <dd className="text-gray-800">{feedEfficiencyData.totalFeedConsumedKg.toFixed(2)} kg</dd>
                    
                    <dt className="font-medium text-gray-600">Total Feed Cost:</dt>
                    <dd className="text-gray-800">€{feedEfficiencyData.totalFeedCost.toFixed(2)}</dd>

                    <dt className="font-medium text-gray-600">Total Other Costs (Medical, etc.):</dt>
                    <dd className="text-gray-800">€{feedEfficiencyData.totalOtherCosts.toFixed(2)}</dd>
                    
                    <dt className="font-medium text-gray-600">Total Revenue (from sales records):</dt>
                    <dd className="text-gray-800">€{feedEfficiencyData.totalRevenue.toFixed(2)}</dd>

                    <dt className={`font-bold ${feedEfficiencyData.profitOrLoss >= 0 ? 'text-green-700' : 'text-red-700'}`}>Profit / Loss:</dt>
                    <dd className={`font-bold ${feedEfficiencyData.profitOrLoss >= 0 ? 'text-green-700' : 'text-red-700'}`}>€{feedEfficiencyData.profitOrLoss.toFixed(2)}</dd>

                    {feedEfficiencyData.flockType === 'egg_layer' && typeof feedEfficiencyData.totalEggsProduced === 'number' && (
                      <>
                        <dt className="font-medium text-gray-600">Total Eggs Produced:</dt>
                        <dd className="text-gray-800">{feedEfficiencyData.totalEggsProduced} eggs</dd>
                        <dt className="font-medium text-gray-600">Feed Cost per Dozen Eggs:</dt>
                        <dd className="text-gray-800">
                          {typeof feedEfficiencyData.feedCostPerDozenEggs === 'number'
                            ? `€${feedEfficiencyData.feedCostPerDozenEggs.toFixed(2)}`
                            : 'N/A (No eggs produced or feed cost zero)'}
                        </dd>
                      </>
                    )}
                    {feedEfficiencyData.flockType === 'broiler' && typeof feedEfficiencyData.totalWeightGainKg === 'number' && (
                       <>
                        <dt className="font-medium text-gray-600">Total Weight Sold/Gained (approx.):</dt>
                        <dd className="text-gray-800">{feedEfficiencyData.totalWeightGainKg.toFixed(2)} kg</dd>
                        <dt className="font-medium text-gray-600">Feed Cost per Kg Meat (approx.):</dt>
                        <dd className="text-gray-800">
                          {typeof feedEfficiencyData.feedCostPerKgMeat === 'number'
                            ? `€${feedEfficiencyData.feedCostPerKgMeat.toFixed(2)}`
                            : 'N/A (No weight recorded or feed cost zero)'}
                        </dd>
                      </>
                    )}
                  </dl>
                </div>
              )}
            </div>

{/* General Expenses Reports */}
            <div className="border-t pt-6">
              <h3 className="text-lg font-medium text-gray-700 mb-2">General Expenses Reports</h3>
              <p className="text-xs text-gray-500 mb-3">View and export general operational expenses. Uses the general Start/End Date filters and specific expense filters on the report page.</p>
              <div className="flex flex-wrap gap-4">
                <Link
                  href="/reports/general-expenses"
                  className="bg-gray-600 hover:bg-gray-700 text-white font-semibold py-2 px-4 rounded shadow-sm transition-colors duration-150"
                >
                  View General Expenses Report Page
                </Link>
              </div>
            </div>
{/* Crop Performance Report */}
            <div className="border-t pt-6">
              <h3 className="text-lg font-medium text-gray-700 mb-2">Crop Performance Report</h3>
              <p className="text-xs text-gray-500 mb-3">View total planted, production, sales, and difference for each crop within a selected period.</p>
              <div className="flex flex-wrap gap-4">
                <Link
                  href="/reports/crop-performance"
                  className="bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2 px-4 rounded shadow-sm transition-colors duration-150"
                >
                  View Crop Performance Report
                </Link>
              </div>
            </div>

            {/* Planting Log Reports */}
            <div className="border-t pt-6">
              <h3 className="text-lg font-medium text-gray-700 mb-2">Planting Log Reports</h3>
              <p className="text-xs text-gray-500 mb-3">Uses the general Start/End Date filters above.</p>
              <div className="flex flex-wrap gap-4">
                <button
                  onClick={() => handleExportWithDateFilters(exportPlantingLogsToCSV)}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 px-4 rounded shadow-sm transition-colors duration-150"
                >
                  Export Planting Logs (CSV)
                </button>
                 <button
                  onClick={() => handleExportWithDateFilters(exportPlantingLogsToPDF)}
                  className="bg-pink-600 hover:bg-pink-700 text-white font-semibold py-2 px-4 rounded shadow-sm transition-colors duration-150"
                >
                  Export Planting Logs (PDF)
                </button>
              </div>
            </div>
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