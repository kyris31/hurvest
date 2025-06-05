'use client';

import React, { useState, useEffect } from 'react';
import {
  getCropPerformanceReportData,
  CropPerformanceReportItem,
  CropPerformanceReportFilters,
  exportCropPerformanceReportToCSV,
  exportCropPerformanceReportToPDF
} from '@/lib/reportUtils';
import { formatDateToYYYYMMDD } from '@/lib/dateUtils';

export default function CropPerformanceReportPage() {
  const [reportData, setReportData] = useState<CropPerformanceReportItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [filters, setFilters] = useState<CropPerformanceReportFilters>({
    startDate: '',
    endDate: '',
  });

  const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  const fetchReportData = async () => {
    setIsLoading(true);
    try {
      // Ensure dates are passed or are null/undefined
      const effectiveFilters: CropPerformanceReportFilters = {
        startDate: filters.startDate || undefined,
        endDate: filters.endDate || undefined,
      };
      const data = await getCropPerformanceReportData(effectiveFilters);
      setReportData(data);
    } catch (error) {
      console.error("Error fetching crop performance report:", error);
      alert("Failed to fetch report data. See console for details.");
      setReportData([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmitFilters = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    fetchReportData();
  };

  return (
    <div>
      <header className="bg-white shadow mb-6">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Crop Performance Report</h1>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <form onSubmit={handleSubmitFilters} className="p-6 bg-white shadow-lg rounded-lg mb-8 space-y-4">
          <h3 className="text-xl font-semibold text-gray-700 mb-4">Report Filters</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="startDate" className="block text-sm font-medium text-gray-700">Start Date</label>
              <input
                type="date"
                name="startDate"
                id="startDate"
                value={filters.startDate || ''}
                onChange={handleFilterChange}
                className="mt-1 block w-full py-2 px-3 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              />
            </div>
            <div>
              <label htmlFor="endDate" className="block text-sm font-medium text-gray-700">End Date</label>
              <input
                type="date"
                name="endDate"
                id="endDate"
                value={filters.endDate || ''}
                onChange={handleFilterChange}
                className="mt-1 block w-full py-2 px-3 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              />
            </div>
          </div>
          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="submit"
              disabled={isLoading}
              className="px-6 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            >
              {isLoading ? 'Generating...' : 'Generate Report'}
            </button>
            <button
              type="button"
              onClick={() => exportCropPerformanceReportToCSV(filters)}
              disabled={isLoading || reportData.length === 0}
              className="px-6 py-2 text-sm font-medium text-white bg-green-600 border border-transparent rounded-md shadow-sm hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
            >
              Export CSV
            </button>
            <button
              type="button"
              onClick={() => exportCropPerformanceReportToPDF(filters)}
              disabled={isLoading || reportData.length === 0}
              className="px-6 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-md shadow-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50"
            >
              Export PDF
            </button>
          </div>
        </form>

        {isLoading && <p className="text-center py-4">Loading report data...</p>}
        {!isLoading && reportData.length > 0 && (
          <div className="mt-6">
            <div className="overflow-x-auto shadow-md rounded-lg">
              <table className="min-w-full bg-white">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="text-left py-3 px-4 uppercase font-semibold text-sm text-gray-600">Crop Name</th>
                    <th className="text-right py-3 px-4 uppercase font-semibold text-sm text-gray-600">Total Planted</th>
                    <th className="text-right py-3 px-4 uppercase font-semibold text-sm text-gray-600">Total Production</th>
                    <th className="text-right py-3 px-4 uppercase font-semibold text-sm text-gray-600">Total Sales</th>
                    <th className="text-right py-3 px-4 uppercase font-semibold text-sm text-gray-600">Difference (Prod - Sales)</th>
                  </tr>
                </thead>
                <tbody className="text-gray-700">
                  {reportData.map((item) => (
                    <tr key={item.cropId} className="border-b border-gray-200 hover:bg-gray-50">
                      <td className="py-2 px-4">{item.cropName}</td>
                      <td className="py-2 px-4 text-right">{item.totalPlanted}</td>
                      <td className="py-2 px-4 text-right">{item.totalProduction}</td>
                      <td className="py-2 px-4 text-right">{item.totalSales}</td>
                      <td className="py-2 px-4 text-right">{item.difference}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        {!isLoading && reportData.length === 0 && (
          <p className="text-center py-4 text-gray-500">No data available for the selected filters. Please generate a report.</p>
        )}
      </div>
    </div>
  );
}