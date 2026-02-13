/**
 * Dashboard Page Component
 * Shows expense overview, charts, and recent transactions
 */

import { useEffect, useState } from 'react';
import { useAppDispatch, useAppSelector } from '../store/hooks/useRedux';
import { fetchExpenseStats, fetchExpenses } from '../store/slices/expenseSlice';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Calendar,
  ArrowRight
} from 'lucide-react';
import { Link } from 'react-router-dom';
import LoadingSpinner from '../components/LoadingSpinner';

/**
 * Debug logger
 */
const DEBUG_LOG = (message: string, data?: unknown) => {
  if (import.meta.env.DEV) {
    console.log(`[DEBUG] ${new Date().toISOString()} - Dashboard: ${message}`, data ?? '');
  }
};

/**
 * Format currency
 */
const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
};

/**
 * Get month name
 */
const getMonthName = (month: number): string => {
  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
  ];
  return months[month - 1];
};

/**
 * Dashboard Page Component
 */
const Dashboard = () => {
  const dispatch = useAppDispatch();
  const { user } = useAppSelector((state) => state.auth);
  const { stats, items, isLoading } = useAppSelector((state) => state.expenses);
  const [period, setPeriod] = useState<'week' | 'month' | 'year'>('month');

  /**
   * Fetch dashboard data on mount
   */
  useEffect(() => {
    DEBUG_LOG('Fetching dashboard data', { period });
    dispatch(fetchExpenseStats(period));
    dispatch(fetchExpenses({ limit: 5, sortBy: 'date', sortOrder: 'desc' }));
  }, [dispatch, period]);

  /**
   * Calculate totals from stats
   */
  const totalExpenses = stats?.statistics?.overall?.totalAmount || 0;
  const todayTotal = stats?.todayTotal || 0;
  const monthlyTotals = stats?.monthlyTotals || [];

  /**
   * Get top categories
   */
  const topCategories = stats?.statistics?.byCategory?.slice(0, 5) || [];

  /**
   * Handle period change
   */
  const handlePeriodChange = (newPeriod: 'week' | 'month' | 'year') => {
    DEBUG_LOG('Changing period', { from: period, to: newPeriod });
    setPeriod(newPeriod);
  };

  if (isLoading && !stats) {
    return (
      <div className="flex items-center justify-center h-96">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
            Welcome back, {user?.name?.split(' ')[0]}!
          </h1>
          <p className="text-gray-600 mt-1">Here's your expense overview</p>
        </div>
        
        {/* Period Selector */}
        <div className="flex bg-gray-100 rounded-xl p-1">
          {(['week', 'month', 'year'] as const).map((p) => (
            <button
              key={p}
              onClick={() => handlePeriodChange(p)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                period === p
                  ? 'bg-white text-primary-700 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {p.charAt(0).toUpperCase() + p.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
        {/* Total Expenses */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total Expenses</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {formatCurrency(totalExpenses)}
              </p>
            </div>
            <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-red-600" />
            </div>
          </div>
          <p className="text-sm text-gray-500 mt-3 capitalize">This {period}</p>
        </div>

        {/* Today's Spending */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Today's Spending</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {formatCurrency(todayTotal)}
              </p>
            </div>
            <div className="w-12 h-12 bg-primary-100 rounded-xl flex items-center justify-center">
              <Calendar className="w-6 h-6 text-primary-600" />
            </div>
          </div>
          <p className="text-sm text-gray-500 mt-3">{new Date().toLocaleDateString()}</p>
        </div>

        {/* Average */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Average</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {formatCurrency(stats?.statistics?.overall?.avgAmount || 0)}
              </p>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
              <DollarSign className="w-6 h-6 text-green-600" />
            </div>
          </div>
          <p className="text-sm text-gray-500 mt-3">Per transaction</p>
        </div>
      </div>

      {/* Charts and Lists */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Trend */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Monthly Trend</h3>
          {monthlyTotals.length > 0 ? (
            <div className="flex items-end justify-between h-48 gap-2">
              {monthlyTotals.map((item, index) => {
                const maxAmount = Math.max(...monthlyTotals.map(m => m.total));
                const height = maxAmount > 0 ? (item.total / maxAmount) * 100 : 0;
                return (
                  <div key={index} className="flex-1 flex flex-col items-center gap-2">
                    <div className="w-full bg-primary-100 rounded-t-lg relative flex-1 flex items-end">
                      <div
                        className="w-full bg-gradient-to-t from-primary-500 to-primary-400 rounded-t-lg transition-all duration-500"
                        style={{ height: `${height}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-500">
                      {getMonthName(item._id.month)}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="h-48 flex items-center justify-center text-gray-500">
              No data available
            </div>
          )}
        </div>

        {/* Top Categories */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Categories</h3>
          {topCategories.length > 0 ? (
            <div className="space-y-4">
              {topCategories.map((category, index) => (
                <div key={index} className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center text-sm font-medium text-gray-600">
                    {index + 1}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{category._id}</p>
                    <p className="text-sm text-gray-500">{category.count} transactions</p>
                  </div>
                  <p className="font-semibold text-gray-900">
                    {formatCurrency(category.total)}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div className="h-48 flex items-center justify-center text-gray-500">
              No categories yet
            </div>
          )}
        </div>
      </div>

      {/* Recent Transactions */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Recent Transactions</h3>
          <Link
            to="/expenses"
            className="text-primary-600 hover:text-primary-700 text-sm font-medium flex items-center gap-1"
          >
            View All <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
        
        {items.length > 0 ? (
          <div className="space-y-3">
            {items.map((expense) => (
              <div
                key={expense._id}
                className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-xl transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                    <TrendingDown className="w-5 h-5 text-red-600" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{expense.category}</p>
                    <p className="text-sm text-gray-500">
                      {new Date(expense.date).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <p className="font-semibold text-red-600">
                  -{formatCurrency(expense.amount)}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <p>No transactions yet</p>
            <Link to="/expenses" className="text-primary-600 hover:text-primary-700 text-sm font-medium">
              Add your first expense
            </Link>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
