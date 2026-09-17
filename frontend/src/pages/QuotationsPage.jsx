import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import StatusBadge from '../components/StatusBadge';
import { Plus, Search, Eye, CheckCircle, XCircle, ArrowRight, FileText, X } from 'lucide-react';

const QuotationsPage = () => {
  const [quotations, setQuotations] = useState([]);
  const [enquiries, setEnquiries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [selectedQuotation, setSelectedQuotation] = useState(null);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const [searchParams] = useSearchParams();
  const preselectedEnquiryId = searchParams.get('enquiry_id');
  const { user } = useAuth();
  const navigate = useNavigate();

  // Quotation form state
  const [formData, setFormData] = useState({
    enquiry_id: '',
    valid_until: '',
    notes: '',
    items: [],
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [quoRes, enqRes] = await Promise.all([
        api.get('/quotations', { params: { search, status: statusFilter } }),
        api.get('/enquiries'),
      ]);
      setQuotations(quoRes.data.data || []);
      setEnquiries(enqRes.data.data || []);
    } catch (err) {
      setError('Failed to load quotations from server.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [search, statusFilter]);

  // If navigated with ?enquiry_id=123, open the quotation modal pre-filled!
  useEffect(() => {
    if (preselectedEnquiryId) {
      handleSelectEnquiry(preselectedEnquiryId);
      setShowModal(true);
    }
  }, [preselectedEnquiryId]);

  const handleSelectEnquiry = async (enquiryId) => {
    if (!enquiryId) return;
    try {
      const res = await api.get(`/enquiries/${enquiryId}`);
      const enq = res.data.data;
      // Populate items from enquiry
      const date30Days = new Date();
      date30Days.setDate(date30Days.getDate() + 30);

      setFormData({
        enquiry_id: enquiryId,
        valid_until: date30Days.toISOString().slice(0, 10),
        notes: `Quotation prepared against Enquiry ${enq.enquiry_number}`,
        items: enq.items.map((item) => ({
          product_id: item.product_id,
          product_name: item.product_name,
          product_code: item.product_code,
          quantity: item.quantity,
          unit_price: parseFloat(item.base_price) || 0,
          discount_percent: 0,
          gst_percent: 18,
        })),
      });
    } catch (err) {
      alert('Failed to load enquiry details');
    }
  };

  const handleItemFieldChange = (index, field, value) => {
    const updated = [...formData.items];
    updated[index][field] = parseFloat(value) || 0;
    setFormData({ ...formData, items: updated });
  };

  // Client preview calculation
  const calculatePreviewGrandTotal = () => {
    return formData.items.reduce((sum, item) => {
      const base = item.quantity * item.unit_price;
      const disc = (base * (item.discount_percent || 0)) / 100;
      const taxable = base - disc;
      const gst = (taxable * (item.gst_percent || 0)) / 100;
      return sum + (taxable + gst);
    }, 0);
  };

  const handleCreateQuotation = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    try {
      const payload = {
        enquiry_id: parseInt(formData.enquiry_id, 10),
        valid_until: formData.valid_until,
        notes: formData.notes,
        items: formData.items.map((i) => ({
          product_id: parseInt(i.product_id, 10),
          quantity: parseInt(i.quantity, 10),
          unit_price: parseFloat(i.unit_price),
          discount_percent: parseFloat(i.discount_percent) || 0,
          gst_percent: parseFloat(i.gst_percent) || 18,
        })),
      };

      const res = await api.post('/quotations', payload);
      if (res.data.success) {
        setSuccessMsg(`Quotation ${res.data.data.quotation_number} created successfully! Grand Total: ₹${res.data.data.grand_total}`);
        setShowModal(false);
        fetchData();
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create quotation');
    }
  };

  const handleUpdateStatus = async (id, newStatus) => {
    try {
      const res = await api.patch(`/quotations/${id}/status`, { status: newStatus });
      if (res.data.success) {
        setSuccessMsg(`Quotation status updated to ${newStatus}`);
        fetchData();
        if (selectedQuotation && selectedQuotation.id === id) {
          viewDetails(id);
        }
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update quotation status');
    }
  };

  const handleConvertToOrder = async (id) => {
    if (!window.confirm('Convert this accepted quotation into an official Sales Order?')) return;
    try {
      const res = await api.post(`/quotations/${id}/convert`);
      if (res.data.success) {
        alert(`Sales Order ${res.data.data.order_number} generated successfully!`);
        navigate('/sales-orders');
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Conversion failed');
    }
  };

  const viewDetails = async (id) => {
    try {
      const res = await api.get(`/quotations/${id}`);
      setSelectedQuotation(res.data.data);
    } catch (err) {
      alert('Failed to load quotation details');
    }
  };

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Quotations</h1>
          <p className="page-subtitle">Commercial price quotes with multi-tier tax and discount calculations.</p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn btn-primary">
          <Plus className="w-4 h-4" />
          <span>New Quotation</span>
        </button>
      </div>

      {/* Messages */}
      {successMsg && <div className="alert alert-success">{successMsg}</div>}
      {error && <div className="alert alert-error">{error}</div>}

      {/* Filters */}
      <div className="filter-bar">
        <div className="search-input-wrapper">
          <Search className="search-icon" />
          <input
            type="text"
            className="filter-input"
            placeholder="Search by quotation number, customer, enquiry..."
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
          <option value="DRAFT">DRAFT</option>
          <option value="SENT">SENT</option>
          <option value="ACCEPTED">ACCEPTED</option>
          <option value="REJECTED">REJECTED</option>
        </select>
      </div>

      {/* Quotations Table */}
      <div className="table-card">
        {loading ? (
          <div className="table-loading">Loading quotations...</div>
        ) : quotations.length === 0 ? (
          <div className="table-empty">
            <FileText className="w-10 h-10 text-gray-400 mb-2" />
            <p>No quotations found. Select an Enquiry to create a Quotation.</p>
          </div>
        ) : (
          <table className="erp-table">
            <thead>
              <tr>
                <th>Quotation No.</th>
                <th>Customer</th>
                <th>Enquiry Ref</th>
                <th>Valid Until</th>
                <th>Grand Total (₹)</th>
                <th>Status</th>
                <th>Sales Order</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {quotations.map((q) => (
                <tr key={q.id}>
                  <td className="font-semibold text-blue-600">{q.quotation_number}</td>
                  <td>
                    <div className="font-medium text-gray-900">{q.company_name}</div>
                    <div className="text-xs text-gray-500">{q.city}</div>
                  </td>
                  <td>
                    <span className="text-sm font-mono text-gray-600">{q.enquiry_number}</span>
                  </td>
                  <td>{new Date(q.valid_until).toLocaleDateString()}</td>
                  <td className="font-bold text-gray-900">₹{parseFloat(q.grand_total).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                  <td>
                    <StatusBadge status={q.status} />
                  </td>
                  <td>
                    {q.sales_order_number ? (
                      <span className="badge-pill bg-purple-100 text-purple-800 border-purple-200">
                        {q.sales_order_number}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-400">Not converted</span>
                    )}
                  </td>
                  <td>
                    <div className="table-actions">
                      <button
                        onClick={() => viewDetails(q.id)}
                        className="btn-icon"
                        title="View Detailed Calculation Breakdown"
                      >
                        <Eye className="w-4 h-4" />
                      </button>

                      {q.status === 'DRAFT' && (
                        <button
                          onClick={() => handleUpdateStatus(q.id, 'SENT')}
                          className="btn-sm btn-outline text-blue-600"
                          title="Mark as Sent to Customer"
                        >
                          Send
                        </button>
                      )}

                      {q.status === 'SENT' && (
                        <>
                          <button
                            onClick={() => handleUpdateStatus(q.id, 'ACCEPTED')}
                            className="btn-icon text-emerald-600 hover:bg-emerald-50"
                            title="Mark as Accepted by Customer"
                          >
                            <CheckCircle className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleUpdateStatus(q.id, 'REJECTED')}
                            className="btn-icon text-rose-600 hover:bg-rose-50"
                            title="Mark as Rejected"
                          >
                            <XCircle className="w-4 h-4" />
                          </button>
                        </>
                      )}

                      {/* Convert to Sales Order - ONLY if ACCEPTED and not already converted! */}
                      {q.status === 'ACCEPTED' && !q.sales_order_id && (
                        <button
                          onClick={() => handleConvertToOrder(q.id)}
                          className="btn-sm btn-primary"
                          title="Convert Accepted Quotation to Official Sales Order"
                        >
                          <span>Convert to Order</span>
                          <ArrowRight className="w-3 h-3 ml-1" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* New Quotation Modal */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content modal-xl">
            <div className="modal-header">
              <h2 className="modal-title">Generate Commercial Quotation</h2>
              <button onClick={() => setShowModal(false)} className="btn-close">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateQuotation} className="modal-body">
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="form-label">Select Customer Enquiry *</label>
                  <select
                    className="form-input"
                    value={formData.enquiry_id}
                    onChange={(e) => handleSelectEnquiry(e.target.value)}
                    required
                  >
                    <option value="">-- Choose an Enquiry --</option>
                    {enquiries.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.enquiry_number} - {e.company_name} ({e.status})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="form-label">Valid Until *</label>
                  <input
                    type="date"
                    className="form-input"
                    value={formData.valid_until}
                    onChange={(e) => setFormData({ ...formData, valid_until: e.target.value })}
                    required
                  />
                </div>
              </div>

              {/* Items Breakdown Table */}
              <div className="items-section mb-4">
                <h3 className="section-subtitle mb-2">Quotation Pricing Breakdown</h3>
                <div className="items-table-wrapper">
                  <table className="items-table text-xs">
                    <thead>
                      <tr>
                        <th>Product</th>
                        <th style={{ width: '80px' }}>Qty</th>
                        <th style={{ width: '110px' }}>Unit Price (₹)</th>
                        <th style={{ width: '90px' }}>Disc %</th>
                        <th style={{ width: '90px' }}>GST %</th>
                        <th style={{ width: '120px' }}>Estimated Line Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {formData.items.length === 0 ? (
                        <tr>
                          <td colSpan="6" className="text-center py-4 text-gray-400">
                            Select an enquiry above to automatically load items.
                          </td>
                        </tr>
                      ) : (
                        formData.items.map((item, idx) => {
                          const base = item.quantity * item.unit_price;
                          const disc = (base * (item.discount_percent || 0)) / 100;
                          const taxable = base - disc;
                          const gst = (taxable * (item.gst_percent || 0)) / 100;
                          const lineTot = taxable + gst;

                          return (
                            <tr key={idx}>
                              <td>
                                <div className="font-semibold text-gray-900">{item.product_name}</div>
                                <div className="text-gray-500">{item.product_code}</div>
                              </td>
                              <td className="font-bold">{item.quantity}</td>
                              <td>
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  className="form-input text-xs py-1"
                                  value={item.unit_price}
                                  onChange={(e) => handleItemFieldChange(idx, 'unit_price', e.target.value)}
                                  required
                                />
                              </td>
                              <td>
                                <input
                                  type="number"
                                  step="0.1"
                                  min="0"
                                  max="100"
                                  className="form-input text-xs py-1"
                                  value={item.discount_percent}
                                  onChange={(e) => handleItemFieldChange(idx, 'discount_percent', e.target.value)}
                                />
                              </td>
                              <td>
                                <input
                                  type="number"
                                  step="0.1"
                                  min="0"
                                  max="100"
                                  className="form-input text-xs py-1"
                                  value={item.gst_percent}
                                  onChange={(e) => handleItemFieldChange(idx, 'gst_percent', e.target.value)}
                                />
                              </td>
                              <td className="font-bold text-gray-900">
                                ₹{lineTot.toFixed(2)}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                {formData.items.length > 0 && (
                  <div className="bg-gray-50 p-3 rounded border mt-3 flex justify-between items-center">
                    <span className="text-xs text-gray-500 italic">
                      * All line amounts and grand totals are verified and recalculated server-side.
                    </span>
                    <div className="text-right">
                      <span className="text-xs text-gray-500 block">Estimated Grand Total</span>
                      <span className="text-lg font-bold text-blue-600">
                        ₹{calculatePreviewGrandTotal().toFixed(2)}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              <div className="mb-4">
                <label className="form-label">Quotation Terms / Notes</label>
                <textarea
                  className="form-input"
                  rows={2}
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                />
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="btn btn-outline"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={formData.items.length === 0}
                >
                  Create Quotation (Draft)
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Detailed Quotation View Modal */}
      {selectedQuotation && (
        <div className="modal-overlay">
          <div className="modal-content modal-xl">
            <div className="modal-header">
              <div>
                <h2 className="modal-title font-bold text-lg">{selectedQuotation.quotation_number}</h2>
                <p className="text-xs text-gray-500">Commercial Quotation Details & Itemized Calculation</p>
              </div>
              <button onClick={() => setSelectedQuotation(null)} className="btn-close">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="modal-body space-y-4">
              <div className="grid grid-cols-4 gap-3 bg-gray-50 p-3 rounded border text-sm">
                <div>
                  <span className="text-xs text-gray-500 block">Customer</span>
                  <span className="font-semibold text-gray-800">{selectedQuotation.company_name}</span>
                </div>
                <div>
                  <span className="text-xs text-gray-500 block">Enquiry Number</span>
                  <span className="font-semibold font-mono text-gray-800">{selectedQuotation.enquiry_number}</span>
                </div>
                <div>
                  <span className="text-xs text-gray-500 block">Valid Until</span>
                  <span className="font-semibold text-gray-800">{new Date(selectedQuotation.valid_until).toLocaleDateString()}</span>
                </div>
                <div>
                  <span className="text-xs text-gray-500 block">Status</span>
                  <StatusBadge status={selectedQuotation.status} />
                </div>
              </div>

              <h3 className="font-semibold text-gray-800 mt-2">Itemized Financial Breakdown</h3>
              <div className="items-table-wrapper">
                <table className="items-table text-xs">
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>Qty</th>
                      <th>Unit Price</th>
                      <th>Base Amount</th>
                      <th>Discount</th>
                      <th>Taxable</th>
                      <th>GST (18%)</th>
                      <th>Line Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedQuotation.items?.map((item) => (
                      <tr key={item.id}>
                        <td>
                          <div className="font-semibold">{item.product_name}</div>
                          <div className="text-gray-400">{item.product_code}</div>
                        </td>
                        <td className="font-bold">{item.quantity} {item.unit}</td>
                        <td>₹{parseFloat(item.unit_price).toFixed(2)}</td>
                        <td>₹{parseFloat(item.base_amount).toFixed(2)}</td>
                        <td>₹{parseFloat(item.discount_amount).toFixed(2)} ({item.discount_percent}%)</td>
                        <td>₹{parseFloat(item.taxable_amount).toFixed(2)}</td>
                        <td>₹{parseFloat(item.gst_amount).toFixed(2)} ({item.gst_percent}%)</td>
                        <td className="font-bold text-gray-900">₹{parseFloat(item.line_total).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-gray-50 font-bold">
                      <td colSpan="3" className="text-right py-2">Totals:</td>
                      <td>₹{parseFloat(selectedQuotation.subtotal_amount).toFixed(2)}</td>
                      <td>₹{parseFloat(selectedQuotation.discount_total).toFixed(2)}</td>
                      <td>₹{parseFloat(selectedQuotation.taxable_total).toFixed(2)}</td>
                      <td>₹{parseFloat(selectedQuotation.gst_total).toFixed(2)}</td>
                      <td className="text-blue-700 text-sm font-extrabold">
                        ₹{parseFloat(selectedQuotation.grand_total).toFixed(2)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {selectedQuotation.sales_order_number && (
                <div className="p-3 bg-purple-50 border border-purple-200 rounded text-sm text-purple-900 flex items-center justify-between">
                  <span><strong>Associated Sales Order:</strong> {selectedQuotation.sales_order_number} ({selectedQuotation.sales_order_status})</span>
                  <button
                    onClick={() => {
                      setSelectedQuotation(null);
                      navigate('/sales-orders');
                    }}
                    className="btn-sm btn-outline"
                  >
                    View in Sales Orders
                  </button>
                </div>
              )}
            </div>

            <div className="modal-footer">
              {selectedQuotation.status === 'ACCEPTED' && !selectedQuotation.sales_order_id && (
                <button
                  onClick={() => {
                    const id = selectedQuotation.id;
                    setSelectedQuotation(null);
                    handleConvertToOrder(id);
                  }}
                  className="btn btn-primary"
                >
                  Convert to Sales Order
                </button>
              )}
              <button
                onClick={() => setSelectedQuotation(null)}
                className="btn btn-outline"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default QuotationsPage;
