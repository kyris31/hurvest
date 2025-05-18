'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { db } from '@/lib/db'; // Removed unused imports: Sale, SaleItem, CultivationLog, InputInventory, HarvestLog, PlantingLog
import { XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts'; // Removed unused BarChart, Bar

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

interface ChartData {
  name: string;
  revenue?: number;
  costs?: number;
  profit?: number;
}

// InventoryValueItem interface is no longer needed here as report is moved

export default function DashboardPage() {
  const [totalRevenue, setTotalRevenue] = useState<number>(0);
  // KPIs for Sales Performance
  const [numberOfSales, setNumberOfSales] = useState<number>(0);
  const [averageSaleValue, setAverageSaleValue] = useState<number>(0);
  const [topCustomerName, setTopCustomerName] = useState<string>('N/A');
  const [topCustomerValue, setTopCustomerValue] = useState<number>(0);

  // const [totalInputCosts, setTotalInputCosts] = useState<number>(0); // Removed unused state
  const [calculatedCogs, setCalculatedCogs] = useState<number>(0);
  const [revenueByMonth, setRevenueByMonth] = useState<ChartData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Date filter states
  const [filterStartDate, setFilterStartDate] = useState<string>('');
  const [filterEndDate, setFilterEndDate] = useState<string>('');

  const fetchData = useCallback(async (startDate?: string | null, endDate?: string | null) => {
    setIsLoading(true);
    setError(null);
    try {
      // Base queries
      let salesQuery = db.sales.filter(s => s.is_deleted !== 1);
      let cultivationLogsQuery = db.cultivationLogs.filter(cl => cl.is_deleted !== 1);
      let harvestLogsQuery = db.harvestLogs.filter(h => h.is_deleted !== 1);

      // Apply date filters
      if (startDate) {
        const sDate = new Date(startDate).toISOString().split('T')[0];
        salesQuery = salesQuery.and(s => s.sale_date >= sDate);
        cultivationLogsQuery = cultivationLogsQuery.and(cl => cl.activity_date >= sDate);
        harvestLogsQuery = harvestLogsQuery.and(h => h.harvest_date >= sDate);
      }
      if (endDate) {
        const eDate = new Date(endDate).toISOString().split('T')[0];
        salesQuery = salesQuery.and(s => s.sale_date <= eDate);
        cultivationLogsQuery = cultivationLogsQuery.and(cl => cl.activity_date <= eDate);
        harvestLogsQuery = harvestLogsQuery.and(h => h.harvest_date <= eDate);
      }

      const sales = await salesQuery.toArray();
      const cultivationLogs = await cultivationLogsQuery.toArray();
      const harvestLogs = await harvestLogsQuery.toArray();
      
      // These might not need direct date filtering for current dashboard logic,
      // but fetch them as they are used in calculations based on the filtered logs.
      const saleItems = await db.saleItems.filter(si => si.is_deleted !== 1).toArray();
      const inputInventory = await db.inputInventory.filter(ii => ii.is_deleted !== 1).toArray();
      const plantingLogs = await db.plantingLogs.filter(p => p.is_deleted !== 1).toArray();


      // Calculate Total Revenue & other sales KPIs
      let currentTotalRevenue = 0;
      const salesByCustomer: Record<string, number> = {};
      const customers = await db.customers.filter(c => c.is_deleted !== 1).toArray(); // Fetch customers

      sales.forEach(sale => {
        const itemsForSale = saleItems.filter(si => si.sale_id === sale.id);
        let currentSaleValue = 0;
        itemsForSale.forEach(item => {
          // Using pre-discount value for revenue consistency with previous logic
          const itemValue = item.quantity_sold * item.price_per_unit;
          currentTotalRevenue += itemValue;
          currentSaleValue += itemValue;
        });
        if (sale.customer_id) {
            salesByCustomer[sale.customer_id] = (salesByCustomer[sale.customer_id] || 0) + currentSaleValue;
        }
      });
      setTotalRevenue(currentTotalRevenue);
      setNumberOfSales(sales.length);
      setAverageSaleValue(sales.length > 0 ? currentTotalRevenue / sales.length : 0);

      let maxSales = 0;
      let topCustomerId: string | null = null;
      for (const customerId in salesByCustomer) {
        if (salesByCustomer[customerId] > maxSales) {
          maxSales = salesByCustomer[customerId];
          topCustomerId = customerId;
        }
      }

      if (topCustomerId) {
        const topCust = customers.find(c => c.id === topCustomerId);
        setTopCustomerName(topCust?.name || 'Unknown Customer');
        setTopCustomerValue(maxSales);
      } else {
        setTopCustomerName('N/A');
        setTopCustomerValue(0);
      }

      // --- Improved COGS Calculation ---
      // 1. Pre-calculate total costs and harvested quantities for each planting log
      const plantingLogSummaries: Map<string, { totalCosts: number; totalHarvested: number }> = new Map();

      for (const pLog of plantingLogs) {
        if (!pLog.id) continue;
        let costsForThisPlanting = 0;
        const relevantCultivationLogs = cultivationLogs.filter(cl => cl.planting_log_id === pLog.id);
        relevantCultivationLogs.forEach(log => {
          if (log.input_inventory_id && log.input_quantity_used) {
            const input = inputInventory.find(inv => inv.id === log.input_inventory_id);
            if (input && input.total_purchase_cost !== undefined && input.initial_quantity !== undefined && input.initial_quantity > 0) {
              const costPerUnit = input.total_purchase_cost / input.initial_quantity;
              costsForThisPlanting += log.input_quantity_used * costPerUnit;
            }
          }
        });

        const totalHarvestedFromThisPlanting = harvestLogs
          .filter(h => h.planting_log_id === pLog.id)
          .reduce((sum, h) => sum + h.quantity_harvested, 0);
        
        plantingLogSummaries.set(pLog.id, {
          totalCosts: costsForThisPlanting,
          totalHarvested: totalHarvestedFromThisPlanting,
        });
      }

      // 2. Calculate COGS for sold items proportionally
      let proportionalCogs = 0;
      const monthlyRevenueAndCogs: { [key: string]: { revenue: number, cogs: number } } = {};

      for (const sale of sales) { // 'sales' is already filtered by date
        const itemsForThisSale = saleItems.filter(si => si.sale_id === sale.id);
        let saleMonthCogs = 0;
        let saleMonthRevenue = 0;

        for (const saleItem of itemsForThisSale) {
          saleMonthRevenue += saleItem.quantity_sold * saleItem.price_per_unit;

          if (saleItem.harvest_log_id) {
            const harvest = harvestLogs.find(h => h.id === saleItem.harvest_log_id); // 'harvestLogs' is filtered
            if (harvest && harvest.planting_log_id) {
              const summary = plantingLogSummaries.get(harvest.planting_log_id);
              if (summary && summary.totalHarvested > 0) {
                const costPerUnitOfHarvest = summary.totalCosts / summary.totalHarvested;
                const cogsForItem = costPerUnitOfHarvest * saleItem.quantity_sold;
                proportionalCogs += cogsForItem;
                saleMonthCogs += cogsForItem;
              }
            }
          }
        }
        // Aggregate for monthly chart
        const month = new Date(sale.sale_date).toLocaleString('default', { month: 'short', year: 'numeric' });
        if (!monthlyRevenueAndCogs[month]) {
            monthlyRevenueAndCogs[month] = { revenue: 0, cogs: 0 };
        }
        monthlyRevenueAndCogs[month].revenue += saleMonthRevenue;
        monthlyRevenueAndCogs[month].cogs += saleMonthCogs;
      }
      setCalculatedCogs(proportionalCogs);

      // Calculate Total Input Costs for the filtered period (based on filtered cultivationLogs)
      let periodInputCosts = 0;
      cultivationLogs.forEach(log => { // 'cultivationLogs' is already filtered by date
        if (log.input_inventory_id && log.input_quantity_used) {
          const inputItem = inputInventory.find(inv => inv.id === log.input_inventory_id);
          if (inputItem && inputItem.total_purchase_cost !== undefined && inputItem.initial_quantity !== undefined && inputItem.initial_quantity > 0) {
            const costPerUnit = inputItem.total_purchase_cost / inputItem.initial_quantity;
            periodInputCosts += log.input_quantity_used * costPerUnit;
          }
        }
      });
      // setTotalInputCosts(periodInputCosts); // Corresponds to removed unused state
      
      // Prepare Revenue by Month Data using pre-aggregated monthlyRevenueAndCogs
      const sortedMonths = Object.keys(monthlyRevenueAndCogs).sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
      const chartData = sortedMonths.map(month => ({
        name: month,
        revenue: monthlyRevenueAndCogs[month].revenue,
        costs: monthlyRevenueAndCogs[month].cogs,
        profit: monthlyRevenueAndCogs[month].revenue - monthlyRevenueAndCogs[month].cogs,
      }));
      // The above 'chartData' (derived from monthlyRevenueAndCogs) is the correct one.
      // The following block that re-calculates sortedMonths and chartData from an undefined 'monthlyRevenueData'
      // was the source of the error and is now removed.
      setRevenueByMonth(chartData);

    } catch (err) {
      console.error("Failed to fetch dashboard data:", err);
      setError("Failed to load dashboard data. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // Pass current filter states to fetchData
    fetchData(filterStartDate, filterEndDate);
  }, [fetchData, filterStartDate, filterEndDate]); // Re-fetch when dates change

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
        {/* Date Filter Inputs */}
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

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 mb-6"> {/* Adjusted to 4 columns for new KPIs */}
          <MetricCard title="Total Revenue" value={`€${totalRevenue.toFixed(2)}`} />
          <MetricCard title="No. of Sales" value={numberOfSales} />
          <MetricCard title="Avg. Sale Value" value={`€${averageSaleValue.toFixed(2)}`} />
          <MetricCard title="Top Customer" value={`${topCustomerName} (€${topCustomerValue.toFixed(2)})`} description="By total sales value" />
        </div>
        
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-2 mb-6"> {/* For COGS and Profit */}
          <MetricCard title="COGS (Sold Items)" value={`€${calculatedCogs.toFixed(2)}`} description="Input costs for sold products" />
          <MetricCard title="Gross Profit" value={`€${(totalRevenue - calculatedCogs).toFixed(2)}`} description="Revenue - COGS for Sold Items" />
        </div>


        <div className="mt-8 bg-white shadow rounded-lg p-4 sm:p-6">
          <h2 className="text-lg font-medium leading-6 text-gray-900 mb-4">Monthly Trends (Revenue & Est. COGS)</h2>
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
        
        {/* Placeholder for more charts/data - Inventory Value Report section removed */}
        <div className="mt-8">
            <p className="text-gray-600">Further financial details and more charts will be added here. Inventory Value report is available under &quot;Reports &amp; Exports&quot;.</p>
        </div>

      </div>
    </div>
  );
}
