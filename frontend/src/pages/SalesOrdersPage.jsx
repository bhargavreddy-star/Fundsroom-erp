import React, { useState, useEffect } from 'react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import StatusBadge from '../components/StatusBadge';
import { Search, Eye, CheckCircle2, Truck, AlertTriangle, Layers, X, ShieldAlert } from 'lucide-react';

const SalesOrdersPage = () => {
  const [orders, setOrders] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // Dispatch modal state
  const [showDispatchModal, setShowDispatchModal] = useState(false);
  const [dispatchData, setDispatchData] = useState({
    vehicle_number: '',
    driver_name: '',
    notes: '',
  });

  const { user, isAdmin } = useAuth();

  const fetchData = async () => {
    setLoading(true);
    try {
      const [orderRes, invRes] = await Promise.all([
        api.get('/sales-orders', { params: { search, status: statusFilter } }),
        api.get('/inventory'),
      ]);
      setOrders(orderRes.data.data || []);
      setInventory(invRes.data.data || []);
    } catch (err) {
      setError('Failed to fetch orders or inventory.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [search, statusFilter]);

  const handleConfirmOrder = async (id) => {
    if (!window.confirm('Confirm this Sales Order and atomically reserve stock in inventory?')) return;
    setError('');
    setSuccessMsg('');
    setActionLoading(true);

    try {
      const res = await api.post(`/sales-orders/${id}/confirm`);
      if (res.data.success) {
        setSuccessMsg(`Sales Order confirmed successfully! Inventory has been atomically reserved.`);
        fetchData();
        if (selectedOrder && selectedOrder.id === id) {
          viewDetails(id);
        }
      }
    } catch (err) {
      const errMsg = err.response?.data?.message || 'Failed to confirm order';
      const details = err.response?.data?.details;
      if (details && Array.isArray(details)) {
        const errorList = details.map((d) => `• ${d.product_name}: Required ${d.required_quantity}, Available ${d.available_quantity} (Deficit: ${d.deficit})`).join('\n');
        setError(`${errMsg}\n${errorList}`);
      } else {
        setError(errMsg);
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleOpenDispatchModal = (order) => {
    setSelectedOrder(order);
    setDispatchData({
      vehicle_number: '',
      driver_name: '',
      notes: `Dispatched against ${order.order_number}`,
    });
    setShowDispatchModal(true);
  };

  const handleDispatchOrder = async (e) => {
    e.preventDefault();
    if (!selectedOrder) return;
    setError('');
    setSuccessMsg('');
    setActionLoading(true);

    try {
      const res = await api.post(`/sales-orders/${selectedOrder.id}/dispatch`, dispatchData);
      if (res.data.success) {
        setSuccessMsg(`Sales Order dispatched successfully! Dispatch No: ${res.data.data.dispatch_number}. Physical & Reserved stock decreased.`);
        setShowDispatchModal(false);
        fetchData();
        viewDetails(selectedOrder.id);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to dispatch order');
    } finally {
      setActionLoading(false);
    }
  };

  const viewDetails = async (id) => {
    try {
      const res = await api.get(`/sales-orders/${id}`);
      setSelectedOrder(res.data.data);
    } catch (err) {
      alert('Failed to load order details');
    }
  };

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Sales Orders & Inventory</h1>
          <p className="page-subtitle">Track orders, manage atomic stock reservations, and process dispatches.</p>
        </div>
      </div>

      {/* Messages */}
      {successMsg && <div className="alert alert-success">{successMsg}</div>}
      {error && (
        <div className="alert alert-error whitespace-pre-line">
          <ShieldAlert className="w-5 h-5 mr-2 inline flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Inventory Availability Widget (Embedded in Sales Order Screen) */}
      <div className="inventory-card mb-6">
        <div className="inventory-header">
          <div className="flex items-center space-x-2">
            <Layers className="w-5 h-5 text-blue-600" />
            <h2 className="font-bold text-gray-900 text-sm">Real-Time Inventory Stock Master</h2>
          </div>
          <span className="text-xs text-gray-500 font-mono">Available = Physical − Reserved</span>
        </div>
        <div className="inventory-grid">
          {inventory.map((item) => {
            const avail = item.available_quantity;
            const isLow = avail < 20;
            return (
              <div key={item.product_id} className={`inv-stat-box ${isLow ? 'inv-box-warning' : ''}`}>
                <div className="inv-product-title font-medium text-gray-900 text-xs truncate" title={item.product_name}>
                  {item.product_name}
                </div>
                <div className="text-gray-400 text-xxs font-mono">{item.product_code}</div>
                <div className="inv-numbers-row mt-2">
                  <div className="text-center">
                    <span className="text-xxs text-gray-500 block">Physical</span>
                    <span className="font-semibold text-xs text-gray-800">{item.physical_quantity}</span>
                  </div>
                  <div className="text-center">
                    <span className="text-xxs text-amber-600 block">Reserved</span>
                    <span className="font-semibold text-xs text-amber-700">{item.reserved_quantity}</span>
                  </div>
                  <div className="text-center">
                    <span className="text-xxs text-emerald-600 block font-bold">Available</span>
                    <span className={`font-bold text-xs ${avail <= 0 ? 'text-red-600' : 'text-emerald-700'}`}>
                      {avail} {item.unit}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Filters */}
      <div className="filter-bar">
        <div className="search-input-wrapper">
          <Search className="search-icon" />
          <input
            type="text"
            className="filter-input"
            placeholder="Search by order number, customer, quotation..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <select
          className="filter-select"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">All Statuses</option>
          <option value="PENDING">PENDING (Awaiting Confirmation)</option>
          <option value="CONFIRMED">CONFIRMED (Stock Reserved)</option>
          <option value="DISPATCHED">DISPATCHED (Stock Fulfilled)</option>
          <option value="CANCELLED">CANCELLED</option>
        </select>
      </div>

      {/* Orders Table */}
      <div className="table-card">
        {loading ? (
          <div className="table-loading">Loading sales orders...</div>
        ) : orders.length === 0 ? (
          <div className="table-empty">
            <p>No sales orders found.</p>
          </div>
        ) : (
          <table className="erp-table">
            <thead>
              <tr>
                <th>Order Number</th>
                <th>Customer</th>
                <th>Quotation Ref</th>
                <th>Order Date</th>
                <th>Total (₹)</th>
                <th>Status</th>
                <th>Dispatch Info</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((so) => (
                <tr key={so.id}>
                  <td className="font-semibold text-blue-600">{so.order_number}</td>
                  <td>
                    <div className="font-medium text-gray-900">{so.company_name}</div>
                    <div className="text-xs text-gray-500">{so.city}</div>
                  </td>
                  <td>
                    <span className="font-mono text-xs text-gray-600">{so.quotation_number}</span>
                  </td>
                  <td>{new Date(so.order_date).toLocaleDateString()}</td>
                  <td className="font-bold text-gray-900">₹{parseFloat(so.total_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                  <td>
                    <StatusBadge status={so.status} />
                  </td>
                  <td>
                    {so.dispatch_number ? (
                      <div>
                        <span className="font-semibold text-teal-700 font-mono text-xs">{so.dispatch_number}</span>
                        <div className="text-xxs text-gray-500">{new Date(so.dispatch_date).toLocaleDateString()}</div>
                      </div>
                    ) : (
                      <span className="text-xs text-gray-400">—</span>
                    )}
                  </td>
                  <td>
                    <div className="table-actions">
                      <button
                        onClick={() => viewDetails(so.id)}
                        className="btn-icon"
                        title="View Order Details & Line Items"
                      >
                        <Eye className="w-4 h-4" />
                      </button>

                      {/* Admin Confirmation & Stock Reservation */}
                      {so.status === 'PENDING' && isAdmin && (
                        <button
                          onClick={() => handleConfirmOrder(so.id)}
                          disabled={actionLoading}
                          className="btn-sm btn-primary"
                          title="Lock Inventory & Reserve Stock"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                          <span>Confirm & Reserve</span>
                        </button>
                      )}

                      {/* Admin Dispatch Processing */}
                      {so.status === 'CONFIRMED' && isAdmin && (
                        <button
                          onClick={() => handleOpenDispatchModal(so)}
                          disabled={actionLoading}
                          className="btn-sm btn-success"
                          title="Process Physical Dispatch"
                        >
                          <Truck className="w-3.5 h-3.5 mr-1" />
                          <span>Dispatch</span>
                        </button>
                      )}

                      {so.status === 'DISPATCHED' && (
                        <span className="text-xs font-semibold text-teal-600 flex items-center">
                          ✓ Dispatched
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Order Details Modal */}
      {selectedOrder && !showDispatchModal && (
        <div className="modal-overlay">
          <div className="modal-content modal-lg">
            <div className="modal-header">
              <div>
                <h2 className="modal-title font-bold text-lg">{selectedOrder.order_number}</h2>
                <p className="text-xs text-gray-500">Sales Order Details & Item Stock Check</p>
              </div>
              <button onClick={() => setSelectedOrder(null)} className="btn-close">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="modal-body space-y-4">
              <div className="grid grid-cols-4 gap-3 bg-gray-50 p-3 rounded border text-sm">
                <div>
                  <span className="text-xs text-gray-500 block">Customer</span>
                  <span className="font-semibold text-gray-800">{selectedOrder.company_name}</span>
                </div>
                <div>
                  <span className="text-xs text-gray-500 block">Quotation Reference</span>
                  <span className="font-semibold font-mono text-gray-800">{selectedOrder.quotation_number}</span>
                </div>
                <div>
                  <span className="text-xs text-gray-500 block">Total Order Amount</span>
                  <span className="font-bold text-blue-700">₹{parseFloat(selectedOrder.total_amount).toFixed(2)}</span>
                </div>
                <div>
                  <span className="text-xs text-gray-500 block">Current Status</span>
                  <StatusBadge status={selectedOrder.status} />
                </div>
              </div>

              <h3 className="font-semibold text-gray-800 mt-2">Ordered Products & Current Stock Comparison</h3>
              <table className="items-table text-xs">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Ordered Qty</th>
                    <th>Unit Price</th>
                    <th>Line Total</th>
                    <th>Physical Stock</th>
                    <th>Reserved Stock</th>
                    <th>Available Stock</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedOrder.items?.map((item) => {
                    const avail = item.available_quantity;
                    const canFulfill = avail >= item.quantity;
                    return (
                      <tr key={item.id}>
                        <td>
                          <div className="font-semibold">{item.product_name}</div>
                          <div className="text-gray-400">{item.product_code}</div>
                        </td>
                        <td className="font-bold">{item.quantity} {item.unit}</td>
                        <td>₹{parseFloat(item.unit_price).toFixed(2)}</td>
                        <td>₹{parseFloat(item.line_total).toFixed(2)}</td>
                        <td>{item.physical_quantity}</td>
                        <td className="text-amber-700">{item.reserved_quantity}</td>
                        <td>
                          <span className={`stock-pill ${canFulfill ? 'stock-ok' : 'stock-low'}`}>
                            {avail} available
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {selectedOrder.dispatch_number && (
                <div className="p-3 bg-teal-50 border border-teal-200 rounded text-sm text-teal-900">
                  <div className="font-bold flex items-center mb-1">
                    <Truck className="w-4 h-4 mr-1 text-teal-700" />
                    Dispatch Record: {selectedOrder.dispatch_number}
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div>Vehicle: <strong>{selectedOrder.vehicle_number}</strong></div>
                    <div>Driver: <strong>{selectedOrder.driver_name}</strong></div>
                    <div>Date: <strong>{new Date(selectedOrder.dispatch_date).toLocaleDateString()}</strong></div>
                  </div>
                </div>
              )}
            </div>

            <div className="modal-footer">
              {selectedOrder.status === 'PENDING' && isAdmin && (
                <button
                  onClick={() => handleConfirmOrder(selectedOrder.id)}
                  disabled={actionLoading}
                  className="btn btn-primary"
                >
                  <CheckCircle2 className="w-4 h-4 mr-1" />
                  Confirm & Reserve Stock
                </button>
              )}

              {selectedOrder.status === 'CONFIRMED' && isAdmin && (
                <button
                  onClick={() => handleOpenDispatchModal(selectedOrder)}
                  disabled={actionLoading}
                  className="btn btn-success"
                >
                  <Truck className="w-4 h-4 mr-1" />
                  Dispatch Order
                </button>
              )}

              <button
                onClick={() => setSelectedOrder(null)}
                className="btn btn-outline"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dispatch Processing Modal */}
      {showDispatchModal && selectedOrder && (
        <div className="modal-overlay">
          <div className="modal-content modal-md">
            <div className="modal-header">
              <div className="flex items-center space-x-2">
                <Truck className="w-5 h-5 text-teal-600" />
                <h2 className="modal-title font-bold">Process Dispatch: {selectedOrder.order_number}</h2>
              </div>
              <button onClick={() => setShowDispatchModal(false)} className="btn-close">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleDispatchOrder} className="modal-body space-y-4">
              <div className="p-3 bg-blue-50 border border-blue-200 rounded text-xs text-blue-800">
                <strong>Dispatch Business Rule:</strong>
                <p>Dispatch will atomically decrease <strong>Physical Stock</strong> AND <strong>Reserved Stock</strong> in PostgreSQL.</p>
              </div>

              <div className="form-group">
                <label className="form-label">Vehicle Registration Number *</label>
                <input
                  type="text"
                  placeholder="e.g. MH-12-AB-9876"
                  className="form-input"
                  value={dispatchData.vehicle_number}
                  onChange={(e) => setDispatchData({ ...dispatchData, vehicle_number: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Driver Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Ramesh Kumar"
                  className="form-input"
                  value={dispatchData.driver_name}
                  onChange={(e) => setDispatchData({ ...dispatchData, driver_name: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Dispatch Notes</label>
                <textarea
                  className="form-input"
                  rows={2}
                  placeholder="Gate pass number, carrier remarks, etc."
                  value={dispatchData.notes}
                  onChange={(e) => setDispatchData({ ...dispatchData, notes: e.target.value })}
                />
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  onClick={() => setShowDispatchModal(false)}
                  className="btn btn-outline"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="btn btn-success"
                >
                  {actionLoading ? 'Dispatching...' : 'Confirm Dispatch & Update Stock'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default SalesOrdersPage;
