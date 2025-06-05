'use client';

import React, { useState, useEffect } from 'react';
import { db, GeneralExpense } from '@/lib/db'; // Assuming GeneralExpense is available
import { 
  getAllGeneralExpensesForReport, 
  GeneralExpenseReportItem, 
  GeneralExpenseReportFilters,
  exportGeneralExpensesToCSV,
  exportGeneralExpensesToPDF
} from '@/lib/reportUtils';
import { formatDateToYYYYMMDD, formatDateToDDMMYYYY } from '@/lib/dateUtils';

const SERVICE_TYPES_FOR_FILTER = ['ALL', 'WATER', 'ELECTRICITY', 'TELEPHONE', 'FIELD_TAXES', 'INTERNET', 'VEHICLE_MAINTENANCE', 'OTHER'] as const;
const PAYMENT_STATUSES_FOR_FILTER = ['ALL', 'UNPAID', 'PAID', 'PARTIALLY_PAID'] as const;

export default function GeneralExpensesReportPage() {
  const [reportData, setReportData] = useState<GeneralExpenseReportItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [filters, setFilters] = useState<GeneralExpenseReportFilters>({
    startDate: '',
    endDate: '',
    serviceType: 'ALL',
    category: '',
    paymentStatus: 'ALL',
  });

  const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  const fetchReportData = async () => {
    setIsLoading(true);
    try {
      const data = await getAllGeneralExpensesForReport(filters);
      setReportData(data);
    } catch (error) {
      console.error("Error fetching general expenses report:", error);
      alert("Failed to fetch report data. See console for details.");
      setReportData([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Optionally, fetch initial data on load or require user to click "Generate Report"
    // For now, let's not auto-load to avoid fetching everything by default.
    // fetchReportData(); 
  }, []); // Or add dependencies if you want auto-fetch on filter change (e.g. [filters])

  const handleSubmitFilters = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    fetchReportData();
  };
  
  const totalAmount = reportData.reduce((sum, item) => sum + item.amount, 0);

  return (
    <div>
      <header className="bg-white shadow mb-6">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">General Expenses Report</h1>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <form onSubmit={handleSubmitFilters} className="p-6 bg-white shadow-lg rounded-lg mb-8 space-y-4">
          <h3 className="text-xl font-semibold text-gray-700 mb-4">Report Filters</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label htmlFor="startDate" className="block text-sm font-medium text-gray-700">Start Date (Bill Date)</label>
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
              <label htmlFor="endDate" className="block text-sm font-medium text-gray-700">End Date (Bill Date)</label>
              <input
                type="date"
                name="endDate"
                id="endDate"
                value={filters.endDate || ''}
                onChange={handleFilterChange}
                className="mt-1 block w-full py-2 px-3 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              />
            </div>
            <div>
              <label htmlFor="serviceType" className="block text-sm font-medium text-gray-700">Service Type</label>
              <select
                name="serviceType"
                id="serviceType"
                value={filters.serviceType}
                onChange={handleFilterChange}
                className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              >
                {SERVICE_TYPES_FOR_FILTER.map(type => (
                  <option key={type} value={type}>{type === 'ALL' ? 'All Types' : type.replace(/_/g, ' ')}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="category" className="block text-sm font-medium text-gray-700">Category (contains)</label>
              <input
                type="text"
                name="category"
                id="category"
                value={filters.category}
                onChange={handleFilterChange}
                placeholder="e.g., Utilities"
                className="mt-1 block w-full py-2 px-3 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              />
            </div>
            <div>
              <label htmlFor="paymentStatus" className="block text-sm font-medium text-gray-700">Payment Status</label>
              <select
                name="paymentStatus"
                id="paymentStatus"
                value={filters.paymentStatus}
                onChange={handleFilterChange}
                className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              >
                {PAYMENT_STATUSES_FOR_FILTER.map(status => (
                  <option key={status} value={status}>{status === 'ALL' ? 'All Statuses' : status.replace(/_/g, ' ')}</option>
                ))}
              </select>
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
              onClick={() => exportGeneralExpensesToCSV(filters)}
              disabled={isLoading || reportData.length === 0}
              className="px-6 py-2 text-sm font-medium text-white bg-green-600 border border-transparent rounded-md shadow-sm hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
            >
              Export CSV
            </button>
            <button
              type="button"
              onClick={() => exportGeneralExpensesToPDF(filters)}
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
            <div className="mb-4 text-right font-semibold text-lg">
                Total Amount: €{totalAmount.toFixed(2)}
            </div>
            <div className="overflow-x-auto shadow-md rounded-lg">
              <table className="min-w-full bg-white">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="text-left py-3 px-4 uppercase font-semibold text-sm text-gray-600">Bill Date</th>
                    <th className="text-left py-3 px-4 uppercase font-semibold text-sm text-gray-600">Service</th>
                    <th className="text-left py-3 px-4 uppercase font-semibold text-sm text-gray-600">Category</th>
                    <th className="text-left py-3 px-4 uppercase font-semibold text-sm text-gray-600">Provider</th>
                    <th className="text-right py-3 px-4 uppercase font-semibold text-sm text-gray-600">Amount</th>
                    <th className="text-left py-3 px-4 uppercase font-semibold text-sm text-gray-600">Due Date</th>
                    <th className="text-left py-3 px-4 uppercase font-semibold text-sm text-gray-600">Status</th>
                    <th className="text-left py-3 px-4 uppercase font-semibold text-sm text-gray-600">Paid Date</th>
                    <th className="text-right py-3 px-4 uppercase font-semibold text-sm text-gray-600">Paid Amt</th>
                  </tr>
                </thead>
                <tbody className="text-gray-700">
                  {reportData.map((item) => (
                    <tr key={item.id} className="border-b border-gray-200 hover:bg-gray-50">
                      <td className="py-2 px-4">{item.billDate}</td>
                      <td className="py-2 px-4">{item.serviceType}</td>
                      <td className="py-2 px-4">{item.category}</td>
                      <td className="py-2 px-4">{item.provider}</td>
                      <td className="py-2 px-4 text-right">€{item.amount.toFixed(2)}</td>
                      <td className="py-2 px-4">{item.dueDate}</td>
                      <td className="py-2 px-4">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          item.paymentStatus.toUpperCase() === 'PAID' ? 'bg-green-100 text-green-800' :
                          item.paymentStatus.toUpperCase() === 'PARTIALLY PAID' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {item.paymentStatus}
                        </span>
                      </td>
                      <td className="py-2 px-4">{item.paymentDate}</td>
                      <td className="py-2 px-4 text-right">{item.paymentAmount !== undefined ? `€${item.paymentAmount.toFixed(2)}` : 'N/A'}</td>
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