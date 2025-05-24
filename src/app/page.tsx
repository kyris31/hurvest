'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { db, Reminder, Flock } from '@/lib/db'; // Keep existing db imports
import { XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts';
import Link from 'next/link';
import { calculateDashboardMetrics, DashboardMetrics, DateRangeFilters } from '@/lib/reportUtils'; // Import new function and types

interface MetricCardProps {
  title: string;
  value: string | number;
  description?: string;
}

const MetricCard: React.FC<MetricCardProps> = ({ title, value, description }) => (
  <div className="overflow-hidden rounded-lg bg-white px-4 py-5 shadow sm:p-6">
    <dt className="truncate text-sm font-medium text-gray-500">{title}</dt>
    <dd className="mt-1 text-3xl font-semibold tracking-tight text-gray-900">{value}</dd>
    {description && <p className="mt-1 text-xs text-gray-500">{description}</p>}
  </div>
);

interface ChartData { // Keep for monthly chart if still used separately
  name: string;
  revenue?: number;
  costs?: number;
  profit?: number;
}

interface EnrichedPoultryReminder extends Reminder {
  flockName?: string;
}

export default function DashboardPage() {
  const [dashboardData, setDashboardData] = useState<DashboardMetrics | null>(null);
  const [revenueByMonth, setRevenueByMonth] = useState<ChartData[]>([]); // Keep for now if chart logic is separate
  
  const [upcomingPoultryReminders, setUpcomingPoultryReminders] = useState<EnrichedPoultryReminder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [filterStartDate, setFilterStartDate] = useState<string>('');
  const [filterEndDate, setFilterEndDate] = useState<string>('');

  const fetchData = useCallback(async (startDate?: string | null, endDate?: string | null) => {
    setIsLoading(true);
    setError(null);
    try {
      const metrics = await calculateDashboardMetrics({ startDate, endDate });
      setDashboardData(metrics);

      // Fetch Upcoming Poultry Reminders (existing logic)
      const today = new Date();
      today.setHours(0,0,0,0);
      const allFlocks = await db.flocks.filter(f => f.is_deleted !== 1).toArray();
      const poultryReminders = await db.reminders
        .where('is_deleted').notEqual(1)
        .and(r => r.is_completed === 0 && !!r.flock_id && new Date(r.reminder_date) >= today)
        .sortBy('reminder_date');
      
      const enrichedPoultryReminders: EnrichedPoultryReminder[] = poultryReminders.slice(0, 5).map(reminder => {
        const flock = allFlocks.find(f => f.id === reminder.flock_id);
        return { ...reminder, flockName: flock?.name || 'Unknown Flock' };
      });
      setUpcomingPoultryReminders(enrichedPoultryReminders);

      // TODO: Re-evaluate monthly chart data generation.
      // For now, it might become out of sync or needs its own data fetching based on sales.
      // The old logic for monthlyRevenueAndCogs can be adapted or moved into calculateDashboardMetrics if needed.
      // For simplicity, let's clear it or use a simplified version if dashboardData has enough.
      // This part needs to be revisited if the monthly chart is critical with the new metrics structure.
      // For now, let's assume the monthly chart might need separate data or be simplified.
      // The old COGS calculation for the chart was specific to harvested goods.
      
      // Example: If you want to keep the monthly chart based on sales (without detailed COGS from new function yet)
      let salesQuery = db.sales.filter(s => s.is_deleted !== 1);
      if (startDate) salesQuery = salesQuery.and(s => s.sale_date >= new Date(startDate).toISOString().split('T')[0]);
      if (endDate) salesQuery = salesQuery.and(s => s.sale_date <= new Date(endDate).toISOString().split('T')[0]);
      const salesForChart = await salesQuery.toArray();
      const saleItemsForChart = await db.saleItems.where('sale_id').anyOf(salesForChart.map(s=>s.id)).and(si => si.is_deleted !== 1).toArray();
      
      const monthlyRevenue: { [key: string]: { revenue: number } } = {};
      salesForChart.forEach(sale => {
        const itemsForSale = saleItemsForChart.filter(si => si.sale_id === sale.id);
        let currentSaleRevenue = 0;
        itemsForSale.forEach(item => {
            let itemRevenue = item.quantity_sold * item.price_per_unit;
            if (item.discount_type && item.discount_value != null) {
                if (item.discount_type === 'Amount') itemRevenue -= item.discount_value;
                else if (item.discount_type === 'Percentage') itemRevenue *= (1 - item.discount_value / 100);
            }
            currentSaleRevenue += Math.max(0, itemRevenue);
        });
        const month = new Date(sale.sale_date).toLocaleString('default', { month: 'short', year: 'numeric' });
        if (!monthlyRevenue[month]) monthlyRevenue[month] = { revenue: 0 };
        monthlyRevenue[month].revenue += currentSaleRevenue;
      });

      const sortedMonths = Object.keys(monthlyRevenue).sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
      const chartData = sortedMonths.map(month => ({
        name: month,
        revenue: monthlyRevenue[month].revenue,
        // costs: 0, // COGS for chart would need separate calculation or come from dashboardData if aggregated monthly
        // profit: monthlyRevenue[month].revenue,
      }));
      setRevenueByMonth(chartData);


    } catch (err) {
      console.error("Failed to fetch dashboard data:", err);
      setError("Failed to load dashboard data. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData(filterStartDate, filterEndDate);
  }, [fetchData, filterStartDate, filterEndDate]);

  if (isLoading) {
    return (
      <div className="p-6">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900 mb-6">Dashboard</h1>
        <p>Loading dashboard data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900 mb-6">Dashboard</h1>
        <p className="text-red-500">{error}</p>
      </div>
    );
  }

  return (
    <div>
      <header className="bg-white shadow">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Dashboard</h1>
        </div>
      </header>
      <div className="mx-auto max-w-7xl py-6 sm:px-6 lg:px-8">
        <div className="mb-6 p-4 bg-white shadow rounded-lg">
          <h2 className="text-lg font-medium text-gray-900 mb-2">Filter by Date Range</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="filterStartDate" className="block text-sm font-medium text-gray-700">Start Date</label>
              <input
                type="date"
                id="filterStartDate"
                name="filterStartDate"
                value={filterStartDate}
                onChange={(e) => setFilterStartDate(e.target.value)}
                className="mt-1 block w-full py-2 px-3 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
              />
            </div>
            <div>
              <label htmlFor="filterEndDate" className="block text-sm font-medium text-gray-700">End Date</label>
              <input
                type="date"
                id="filterEndDate"
                name="filterEndDate"
                value={filterEndDate}
                onChange={(e) => setFilterEndDate(e.target.value)}
                className="mt-1 block w-full py-2 px-3 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 mb-6">
          <MetricCard title="Total Revenue" value={dashboardData ? `€${dashboardData.totalRevenue.toFixed(2)}` : '€0.00'} />
          <MetricCard title="No. of Sales" value={dashboardData ? dashboardData.numberOfSales : 0} />
          <MetricCard title="Avg. Sale Value" value={dashboardData ? `€${dashboardData.avgSaleValue.toFixed(2)}` : '€0.00'} />
          <MetricCard
            title="Top Customer"
            value={dashboardData?.topCustomer ? `${dashboardData.topCustomer.name} (€${dashboardData.topCustomer.totalValue.toFixed(2)})` : 'N/A (€0.00)'}
            description="By total sales value"
          />
        </div>
        
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-2 mb-6">
          <MetricCard title="COGS (Sold Items)" value={dashboardData ? `€${dashboardData.totalCOGS.toFixed(2)}` : '€0.00'} description="Input costs for sold products" />
          <MetricCard title="Gross Profit" value={dashboardData ? `€${dashboardData.grossProfit.toFixed(2)}` : '€0.00'} description="Revenue - COGS for Sold Items" />
        </div>

        <div className="mt-8 bg-white shadow rounded-lg p-4 sm:p-6">
          <h2 className="text-lg font-medium leading-6 text-gray-900 mb-4">Monthly Trends (Revenue)</h2> {/* Adjusted title as COGS for chart is simplified */}
          {revenueByMonth.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={revenueByMonth} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis yAxisId="left" tickFormatter={(value) => `€${value.toFixed(0)}`} />
                <YAxis yAxisId="right" orientation="right" tickFormatter={(value) => `€${value.toFixed(0)}`} />
                <Tooltip formatter={(value: number, name: string) => [`€${value.toFixed(2)}`, name.charAt(0).toUpperCase() + name.slice(1)]} />
                <Legend />
                <Line yAxisId="left" type="monotone" dataKey="revenue" stroke="#10B981" strokeWidth={2} activeDot={{ r: 6 }} name="Revenue" />
                <Line yAxisId="right" type="monotone" dataKey="costs" stroke="#EF4444" strokeWidth={2} activeDot={{ r: 6 }} name="Est. COGS" />
                 <Line yAxisId="left" type="monotone" dataKey="profit" stroke="#3B82F6" strokeWidth={2} activeDot={{ r: 6 }} name="Est. Profit" />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-center text-gray-500">No sales data available to display revenue trend.</p>
          )}
        </div>
        
        {/* Upcoming Poultry Reminders Section */}
        <div className="mt-8 bg-white shadow rounded-lg p-4 sm:p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-medium leading-6 text-gray-900">Upcoming Poultry Reminders</h2>
            <Link href="/reminders" className="text-sm text-green-600 hover:text-green-800">
              View All Reminders &rarr;
            </Link>
          </div>
          {isLoading && upcomingPoultryReminders.length === 0 && <p>Loading reminders...</p>}
          {!isLoading && upcomingPoultryReminders.length === 0 && (
            <p className="text-center text-gray-500">No upcoming poultry reminders.</p>
          )}
          {upcomingPoultryReminders.length > 0 && (
            <ul className="divide-y divide-gray-200">
              {upcomingPoultryReminders.map(reminder => (
                <li key={reminder.id} className="py-3">
                  <div className="flex items-center space-x-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{reminder.activity_type}</p>
                      <p className="text-sm text-gray-500 truncate">
                        Flock: {reminder.flockName} - Due: {new Date(reminder.reminder_date).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="mt-8">
            <p className="text-gray-600">Further financial details and more charts will be added here. Inventory Value report is available under "Reports & Exports".</p>
        </div>

      </div>
    </div>
  );
}
