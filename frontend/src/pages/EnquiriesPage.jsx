import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import StatusBadge from '../components/StatusBadge';
import { Plus, Search, Eye, FileText, Calendar, Building, X } from 'lucide-react';

const EnquiriesPage = () => {
  const [enquiries, setEnquiries] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [selectedEnquiry, setSelectedEnquiry] = useState(null);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // New Enquiry Form State
  const [formData, setFormData] = useState({
    customer_id: '',
    required_date: '',
    notes: '',
    items: [{ product_id: '', quantity: 1 }],
  });

  // Quick Customer Creation Form
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [newCustomer, setNewCustomer] = useState({
    company_name: '',
    contact_person: '',
    mobile: '',
    email: '',
    city: '',
  });

  const { user } = useAuth();
  const navigate = useNavigate();

  const fetchData = async () => {
    setLoading(true);
    try {
      const [enqRes, custRes, prodRes] = await Promise.all([
        api.get('/enquiries', { params: { search, status: statusFilter } }),
        api.get('/customers'),
        api.get('/products'),
      ]);
      setEnquiries(enqRes.data.data || []);
      setCustomers(custRes.data.data || []);
      setProducts(prodRes.data.data || []);
    } catch (err) {
      setError('Failed to load data from server.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [search, statusFilter]);

  const handleAddItem = () => {
    setFormData({
      ...formData,
      items: [...formData.items, { product_id: '', quantity: 1 }],
    });
  };

  const handleRemoveItem = (index) => {
    if (formData.items.length === 1) return;
    const newItems = formData.items.filter((_, i) => i !== index);
    setFormData({ ...formData, items: newItems });
  };

  const handleItemChange = (index, field, value) => {
    const newItems = [...formData.items];
    newItems[index][field] = field === 'quantity' ? parseInt(value, 10) || 1 : value;
    setFormData({ ...formData, items: newItems });
  };

  const handleCreateEnquiry = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    try {
      const payload = {
        customer_id: parseInt(formData.customer_id, 10),
        required_date: formData.required_date,
        notes: formData.notes,
        items: formData.items.map((i) => ({
          product_id: parseInt(i.product_id, 10),
          quantity: parseInt(i.quantity, 10),
        })),
      };

      const res = await api.post('/enquiries', payload);
      if (res.data.success) {
        setSuccessMsg(`Enquiry ${res.data.data.enquiry_number} created successfully!`);
        setShowModal(false);
        setFormData({
          customer_id: '',
          required_date: '',
          notes: '',
          items: [{ product_id: '', quantity: 1 }],
        });
        fetchData();
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create enquiry');
    }
  };

  const handleCreateCustomer = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post('/customers', newCustomer);
      if (res.data.success) {
        setCustomers([...customers, res.data.data]);
        setFormData({ ...formData, customer_id: res.data.data.id });
        setShowCustomerModal(false);
        setNewCustomer({ company_name: '', contact_person: '', mobile: '', email: '', city: '' });
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to create customer');
    }
  };

  const viewDetails = async (id) => {
    try {
      const res = await api.get(`/enquiries/${id}`);
      setSelectedEnquiry(res.data.data);
    } catch (err) {
      alert('Failed to load enquiry details');
    }
  };

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Customer Enquiries</h1>
          <p className="page-subtitle">Track inbound enquiries, manage customer requirements, and quote products.</p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn btn-primary">
          <Plus className="w-4 h-4" />
          <span>New Enquiry</span>
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
            placeholder="Search by enquiry number or customer name..."
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
          <option value="NEW">NEW</option>
          <option value="QUOTED">QUOTED</option>
          <option value="WON">WON</option>
          <option value="LOST">LOST</option>
        </select>
      </div>

      {/* Enquiries Table */}
      <div className="table-card">
        {loading ? (
          <div className="table-loading">Loading enquiries...</div>
        ) : enquiries.length === 0 ? (
          <div className="table-empty">
            <FileText className="w-10 h-10 text-gray-400 mb-2" />
            <p>No enquiries found. Click "New Enquiry" to create one.</p>
          </div>
        ) : (
          <table className="erp-table">
            <thead>
              <tr>
                <th>Enquiry Number</th>
                <th>Customer</th>
                <th>Enquiry Date</th>
                <th>Required Date</th>
                <th>Items / Qty</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {enquiries.map((enq) => (
                <tr key={enq.id}>
                  <td className="font-semibold text-blue-600">{enq.enquiry_number}</td>
                  <td>
                    <div className="font-medium text-gray-900">{enq.company_name}</div>
                    <div className="text-xs text-gray-500">{enq.contact_person} • {enq.city}</div>
                  </td>
                  <td>{new Date(enq.enquiry_date).toLocaleDateString()}</td>
                  <td>{new Date(enq.required_date).toLocaleDateString()}</td>
                  <td>
                    <span className="badge-pill">{enq.total_items} items ({enq.total_quantity} units)</span>
                  </td>
                  <td>
                    <StatusBadge status={enq.status} />
                  </td>
                  <td>
                    <div className="table-actions">
                      <button
                        onClick={() => viewDetails(enq.id)}
                        className="btn-icon"
                        title="View Enquiry Details"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => navigate(`/quotations?enquiry_id=${enq.id}`)}
                        className="btn-sm btn-outline"
                        title="Create Quotation against this Enquiry"
                      >
                        Quote
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* New Enquiry Modal */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content modal-lg">
            <div className="modal-header">
              <h2 className="modal-title">Create Customer Enquiry</h2>
              <button onClick={() => setShowModal(false)} className="btn-close">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateEnquiry} className="modal-body">
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="form-label mb-0">Customer *</label>
                    <button
                      type="button"
                      onClick={() => setShowCustomerModal(true)}
                      className="text-xs text-blue-600 hover:underline"
                    >
                      + Add New Customer
                    </button>
                  </div>
                  <select
                    className="form-input"
                    value={formData.customer_id}
                    onChange={(e) => setFormData({ ...formData, customer_id: e.target.value })}
                    required
                  >
                    <option value="">Select Customer</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.company_name} ({c.city})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="form-label">Required Delivery Date *</label>
                  <input
                    type="date"
                    className="form-input"
                    value={formData.required_date}
                    onChange={(e) => setFormData({ ...formData, required_date: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="mb-4">
                <label className="form-label">Enquiry Notes / Requirements</label>
                <textarea
                  className="form-input"
                  rows={2}
                  placeholder="Additional commercial notes, technical specifications, etc."
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                />
              </div>

              {/* Multi-Product Line Items */}
              <div className="items-section">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="section-subtitle">Requested Products & Quantities</h3>
                  <button
                    type="button"
                    onClick={handleAddItem}
                    className="btn btn-outline btn-sm"
                  >
                    + Add Product
                  </button>
                </div>

                <div className="items-table-wrapper">
                  <table className="items-table">
                    <thead>
                      <tr>
                        <th>Product *</th>
                        <th style={{ width: '130px' }}>Available Stock</th>
                        <th style={{ width: '120px' }}>Quantity *</th>
                        <th style={{ width: '60px' }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {formData.items.map((item, idx) => {
                        const selectedProd = products.find((p) => String(p.id) === String(item.product_id));
                        return (
                          <tr key={idx}>
                            <td>
                              <select
                                className="form-input text-sm"
                                value={item.product_id}
                                onChange={(e) => handleItemChange(idx, 'product_id', e.target.value)}
                                required
                              >
                                <option value="">Select Product</option>
                                {products.map((p) => (
                                  <option key={p.id} value={p.id}>
                                    {p.product_code} - {p.product_name} (Base: ₹{p.base_price})
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td>
                              {selectedProd ? (
                                <span className={`stock-pill ${selectedProd.available_quantity > 0 ? 'stock-ok' : 'stock-low'}`}>
                                  {selectedProd.available_quantity} {selectedProd.unit}
                                </span>
                              ) : (
                                <span className="text-gray-400 text-xs">—</span>
                              )}
                            </td>
                            <td>
                              <input
                                type="number"
                                min="1"
                                className="form-input text-sm"
                                value={item.quantity}
                                onChange={(e) => handleItemChange(idx, 'quantity', e.target.value)}
                                required
                              />
                            </td>
                            <td>
                              {formData.items.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => handleRemoveItem(idx)}
                                  className="text-red-500 hover:text-red-700"
                                >
                                  ×
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="modal-footer mt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="btn btn-outline"
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save Enquiry
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Quick Customer Modal */}
      {showCustomerModal && (
        <div className="modal-overlay">
          <div className="modal-content modal-md">
            <div className="modal-header">
              <h2 className="modal-title">Add New Customer</h2>
              <button onClick={() => setShowCustomerModal(false)} className="btn-close">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreateCustomer} className="modal-body">
              <div className="form-group">
                <label className="form-label">Company Name *</label>
                <input
                  type="text"
                  className="form-input"
                  value={newCustomer.company_name}
                  onChange={(e) => setNewCustomer({ ...newCustomer, company_name: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Contact Person *</label>
                <input
                  type="text"
                  className="form-input"
                  value={newCustomer.contact_person}
                  onChange={(e) => setNewCustomer({ ...newCustomer, contact_person: e.target.value })}
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="form-group">
                  <label className="form-label">Mobile *</label>
                  <input
                    type="text"
                    className="form-input"
                    value={newCustomer.mobile}
                    onChange={(e) => setNewCustomer({ ...newCustomer, mobile: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">City *</label>
                  <input
                    type="text"
                    className="form-input"
                    value={newCustomer.city}
                    onChange={(e) => setNewCustomer({ ...newCustomer, city: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Email *</label>
                <input
                  type="email"
                  className="form-input"
                  value={newCustomer.email}
                  onChange={(e) => setNewCustomer({ ...newCustomer, email: e.target.value })}
                  required
                />
              </div>
              <div className="modal-footer">
                <button type="button" onClick={() => setShowCustomerModal(false)} className="btn btn-outline">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save Customer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Enquiry Detail Modal */}
      {selectedEnquiry && (
        <div className="modal-overlay">
          <div className="modal-content modal-lg">
            <div className="modal-header">
              <div>
                <h2 className="modal-title font-bold text-lg">{selectedEnquiry.enquiry_number}</h2>
                <p className="text-xs text-gray-500">Customer Enquiry Details</p>
              </div>
              <button onClick={() => setSelectedEnquiry(null)} className="btn-close">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="modal-body space-y-4">
              <div className="grid grid-cols-3 gap-3 bg-gray-50 p-3 rounded border">
                <div>
                  <span className="text-xs text-gray-500 block">Customer</span>
                  <span className="font-semibold text-gray-800">{selectedEnquiry.company_name}</span>
                </div>
                <div>
                  <span className="text-xs text-gray-500 block">Contact Person</span>
                  <span className="font-semibold text-gray-800">{selectedEnquiry.contact_person} ({selectedEnquiry.mobile})</span>
                </div>
                <div>
                  <span className="text-xs text-gray-500 block">Status</span>
                  <StatusBadge status={selectedEnquiry.status} />
                </div>
              </div>

              <h3 className="font-semibold text-gray-800 mt-3">Relational Products Requested</h3>
              <table className="items-table">
                <thead>
                  <tr>
                    <th>Product Code</th>
                    <th>Product Name</th>
                    <th>Quantity</th>
                    <th>Available Stock</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedEnquiry.items?.map((item) => (
                    <tr key={item.item_id}>
                      <td className="font-semibold">{item.product_code}</td>
                      <td>{item.product_name}</td>
                      <td className="font-bold">{item.quantity} {item.unit}</td>
                      <td>
                        <span className={`stock-pill ${item.available_quantity >= item.quantity ? 'stock-ok' : 'stock-low'}`}>
                          {item.available_quantity} available
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {selectedEnquiry.notes && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded text-sm text-blue-900">
                  <strong>Notes:</strong> {selectedEnquiry.notes}
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button
                onClick={() => {
                  const id = selectedEnquiry.id;
                  setSelectedEnquiry(null);
                  navigate(`/quotations?enquiry_id=${id}`);
                }}
                className="btn btn-primary"
              >
                Create Quotation for this Enquiry
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EnquiriesPage;
