/**
 * Expenses Page Component
 * Lists all expenses with filtering, pagination, and CRUD operations
 */

import { useEffect, useState, useMemo } from 'react';
import { useAppDispatch, useAppSelector } from '../store/hooks/useRedux';
import { 
  fetchExpenses, 
  createExpense, 
  updateExpense, 
  deleteExpense 
} from '../store/slices/expenseSlice';
import { EXPENSE_CATEGORIES } from '../types';
import { 
  Plus, 
  Search, 
  Filter, 
  Edit2, 
  Trash2, 
  X,
  ChevronLeft,
  ChevronRight,
  Download
} from 'lucide-react';
import LoadingSpinner from '../components/LoadingSpinner';

/**
 * Debug logger
 */
const DEBUG_LOG = (message: string, data?: unknown) => {
  if (import.meta.env.DEV) {
    console.log(`[DEBUG] ${new Date().toISOString()} - ExpensesPage: ${message}`, data ?? '');
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
 * Expense form data type
 */
interface ExpenseFormData {
  amount: string;
  category: string;
  description: string;
  date: string;
  paymentMethod: string;
  isRecurring: boolean;
}

/**
 * Initial form state
 */
const initialFormState: ExpenseFormData = {
  amount: '',
  category: 'Food & Dining',
  description: '',
  date: new Date().toISOString().split('T')[0],
  paymentMethod: 'Other',
  isRecurring: false,
};

/**
 * Expenses Page Component
 */
const Expenses = () => {
  const dispatch = useAppDispatch();
  const { items, isLoading, pagination, error } = useAppSelector((state) => state.expenses);

  // State
  const [showModal, setShowModal] = useState(false);
  const [editingExpense, setEditingExpense] = useState<string | null>(null);
  const [formData, setFormData] = useState<ExpenseFormData>(initialFormState);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [page, setPage] = useState(1);

  /**
   * Fetch expenses on mount and when filters change
   */
  useEffect(() => {
    DEBUG_LOG('Fetching expenses', { page, categoryFilter, searchTerm });
    dispatch(fetchExpenses({
      page,
      limit: 10,
      category: categoryFilter || undefined,
    }));
  }, [dispatch, page, categoryFilter]);

  /**
   * Filtered expenses
   */
  const filteredExpenses = useMemo(() => {
    if (!searchTerm) return items;
    const term = searchTerm.toLowerCase();
    return items.filter(
      (expense) =>
        expense.category.toLowerCase().includes(term) ||
        expense.description.toLowerCase().includes(term)
    );
  }, [items, searchTerm]);

  /**
   * Handle form submit
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    DEBUG_LOG('Submitting expense form', { editingExpense, formData });

    const expenseData = {
      amount: parseFloat(formData.amount),
      category: formData.category,
      description: formData.description,
      date: formData.date,
      paymentMethod: formData.paymentMethod,
      isRecurring: formData.isRecurring,
    };

    if (editingExpense) {
      await dispatch(updateExpense({ id: editingExpense, data: expenseData }));
    } else {
      await dispatch(createExpense(expenseData));
    }

    handleCloseModal();
    dispatch(fetchExpenses({ page, limit: 10, category: categoryFilter || undefined }));
  };

  /**
   * Handle delete
   */
  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this expense?')) {
      DEBUG_LOG('Deleting expense', { id });
      await dispatch(deleteExpense(id));
      dispatch(fetchExpenses({ page, limit: 10, category: categoryFilter || undefined }));
    }
  };

  /**
   * Open modal for editing
   */
  const handleEdit = (expense: typeof items[0]) => {
    DEBUG_LOG('Opening edit modal', { id: expense._id });
    setEditingExpense(expense._id);
    setFormData({
      amount: expense.amount.toString(),
      category: expense.category,
      description: expense.description,
      date: new Date(expense.date).toISOString().split('T')[0],
      paymentMethod: expense.paymentMethod,
      isRecurring: expense.isRecurring,
    });
    setShowModal(true);
  };

  /**
   * Close modal
   */
  const handleCloseModal = () => {
    setShowModal(false);
    setEditingExpense(null);
    setFormData(initialFormState);
    DEBUG_LOG('Modal closed');
  };

  /**
   * Export to CSV
   */
  const handleExport = () => {
    DEBUG_LOG('Exporting to CSV');
    const headers = ['Date', 'Category', 'Description', 'Amount', 'Payment Method'];
    const rows = items.map((e) => [
      new Date(e.date).toLocaleDateString(),
      e.category,
      e.description,
      e.amount.toString(),
      e.paymentMethod,
    ]);

    const csv = [headers, ...rows].map((row) => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `expenses-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Expenses</h1>
          <p className="text-gray-600 mt-1">Manage your expense records</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleExport}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-colors flex items-center gap-2"
          >
            <Download className="w-5 h-5" />
            Export
          </button>
          <button
            onClick={() => setShowModal(true)}
            className="px-4 py-2 bg-primary-600 text-white rounded-xl hover:bg-primary-700 transition-colors flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Add Expense
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search expenses..."
            className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20"
          />
        </div>

        {/* Category Filter */}
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <select
            value={categoryFilter}
            onChange={(e) => {
              setCategoryFilter(e.target.value);
              setPage(1);
            }}
            className="pl-10 pr-8 py-3 bg-white border border-gray-200 rounded-xl focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 appearance-none cursor-pointer"
          >
            <option value="">All Categories</option>
            {EXPENSE_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl">
          {error}
        </div>
      )}

      {/* Expenses List */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {isLoading ? (
          <div className="p-12 flex items-center justify-center">
            <LoadingSpinner size="lg" />
          </div>
        ) : filteredExpenses.length > 0 ? (
          <div className="divide-y divide-gray-100">
            {filteredExpenses.map((expense) => (
              <div
                key={expense._id}
                className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center">
                    <span className="text-red-600 font-semibold">
                      {expense.category.charAt(0)}
                    </span>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{expense.category}</p>
                    <p className="text-sm text-gray-500">
                      {new Date(expense.date).toLocaleDateString()}
                      {expense.description && ` • ${expense.description}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <p className="font-semibold text-red-600">
                    -{formatCurrency(expense.amount)}
                  </p>
                  <div className="flex gap-1">
                    <button
                      onClick={() => handleEdit(expense)}
                      className="p-2 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(expense._id)}
                      className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-12 text-center text-gray-500">
            <p>No expenses found</p>
          </div>
        )}
      </div>

      {/* Pagination */}
      {pagination && pagination.pages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">
            Showing {(pagination.page - 1) * pagination.limit + 1} to{' '}
            {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
            {pagination.total} results
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1}
              className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            {Array.from({ length: pagination.pages }, (_, i) => i + 1)
              .filter((p) => p === 1 || p === pagination.pages || Math.abs(p - page) <= 1)
              .map((p, idx, arr) => (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={`w-10 h-10 rounded-lg font-medium transition-colors ${
                    p === page
                      ? 'bg-primary-600 text-white'
                      : 'border border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  {p}
                </button>
              ))}
            <button
              onClick={() => setPage(Math.min(pagination.pages, page + 1))}
              disabled={page === pagination.pages}
              className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 animate-slide-up">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900">
                {editingExpense ? 'Edit Expense' : 'Add Expense'}
              </h2>
              <button
                onClick={handleCloseModal}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Amount */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Amount
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:border-primary-500"
                  placeholder="0.00"
                  required
                />
              </div>

              {/* Category */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Category
                </label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:border-primary-500"
                >
                  {EXPENSE_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              {/* Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Date
                </label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:border-primary-500"
                  required
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description (Optional)
                </label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:border-primary-500"
                  placeholder="Add a note..."
                />
              </div>

              {/* Payment Method */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Payment Method
                </label>
                <select
                  value={formData.paymentMethod}
                  onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value })}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:border-primary-500"
                >
                  <option value="Cash">Cash</option>
                  <option value="Credit Card">Credit Card</option>
                  <option value="Debit Card">Debit Card</option>
                  <option value="Bank Transfer">Bank Transfer</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              {/* Recurring */}
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.isRecurring}
                  onChange={(e) => setFormData({ ...formData, isRecurring: e.target.checked })}
                  className="w-5 h-5 text-primary-600 rounded focus:ring-primary-500"
                />
                <span className="text-sm text-gray-700">Recurring expense</span>
              </label>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 bg-primary-600 text-white font-semibold rounded-xl hover:bg-primary-700 transition-colors disabled:opacity-70"
              >
                {isLoading ? (
                  <LoadingSpinner size="sm" className="mx-auto text-white" />
                ) : editingExpense ? (
                  'Update Expense'
                ) : (
                  'Add Expense'
                )}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Expenses;
