'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

interface StoreItem {
  id: string;
  school_id: string;
  name: string;
  category: 'stationery' | 'cleaning' | 'furniture' | 'electronics' | 'other';
  unit: string;
  quantity: number;
  low_stock_threshold: number;
  added_by: string;
  created_at: string;
  deleted_at: string | null;
}

interface StoreTransaction {
  id: string;
  school_id: string;
  item_id: string;
  txn_type: 'stock_in' | 'stock_out' | 'adjustment';
  quantity: number;
  reference: string;
  issued_to: string | null;
  notes: string | null;
  created_by: string;
  created_at: string;
  deleted_at: string | null;
}

interface ResourceRequest {
  id: string;
  school_id: string;
  requester_id: string;
  item_name: string;
  quantity: number;
  urgency: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  deleted_at: string | null;
}

export default function StoreTab() {
  const [items, setItems] = useState<StoreItem[]>([]);
  const [transactions, setTransactions] = useState<StoreTransaction[]>([]);
  const [requests, setRequests] = useState<ResourceRequest[]>([]);
  const [schoolId, setSchoolId] = useState<string>('');
  const [userId, setUserId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showTxnSheet, setShowTxnSheet] = useState(false);
  const [selectedItem, setSelectedItem] = useState<StoreItem | null>(null);
  const [txnType, setTxnType] = useState<'stock_in' | 'stock_out'>('stock_in');
  const [formData, setFormData] = useState({
    name: '',
    category: 'stationery' as const,
    unit: '',
    quantity: 0,
    low_stock_threshold: 0,
  });
  const [txnData, setTxnData] = useState({
    quantity: 0,
    reference: '',
    issued_to: '',
    notes: '',
  });

  useEffect(() => {
    initializeUser();
  }, []);

  const initializeUser = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      setUserId(user.id);

      const { data: profile } = await supabase
        .from('profiles')
        .select('school_id')
        .eq('id', user.id)
        .single();

      if (profile?.school_id) {
        setSchoolId(profile.school_id);
        await fetchAllData(profile.school_id);
      }
    } catch (error) {
      console.error('Error initializing user:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAllData = async (sid: string) => {
    try {
      const [itemsRes, txnsRes, reqsRes] = await Promise.all([
        supabase
          .from('store_items')
          .select('*')
          .eq('school_id', sid)
          .is('deleted_at', null)
          .order('created_at', { ascending: false }),
        supabase
          .from('store_transactions')
          .select('*')
          .eq('school_id', sid)
          .is('deleted_at', null)
          .order('created_at', { ascending: false }),
        supabase
          .from('resource_requests')
          .select('*')
          .eq('school_id', sid)
          .eq('status', 'pending')
          .is('deleted_at', null)
          .order('created_at', { ascending: false }),
      ]);

      if (itemsRes.data) setItems(itemsRes.data);
      if (txnsRes.data) setTransactions(txnsRes.data);
      if (reqsRes.data) setRequests(reqsRes.data);
    } catch (error) {
      console.error('Error fetching data:', error);
    }
  };

  const handleAddItem = async () => {
    if (!formData.name || !formData.unit || formData.quantity < 0) {
      alert('Please fill in all fields');
      return;
    }

    try {
      const { error } = await supabase.from('store_items').insert({
        school_id: schoolId,
        name: formData.name,
        category: formData.category,
        unit: formData.unit,
        quantity: formData.quantity,
        low_stock_threshold: formData.low_stock_threshold,
        added_by: userId,
        created_at: new Date().toISOString(),
        deleted_at: null,
      });

      if (error) throw error;

      setShowAddModal(false);
      setFormData({
        name: '',
        category: 'stationery',
        unit: '',
        quantity: 0,
        low_stock_threshold: 0,
      });
      await fetchAllData(schoolId);
    } catch (error) {
      console.error('Error adding item:', error);
      alert('Failed to add item');
    }
  };

  const handleTransaction = async () => {
    if (!selectedItem || txnData.quantity <= 0) {
      alert('Please enter valid quantity');
      return;
    }

    try {
      const newQuantity =
        txnType === 'stock_in'
          ? selectedItem.quantity + txnData.quantity
          : selectedItem.quantity - txnData.quantity;

      if (newQuantity < 0) {
        alert('Insufficient stock');
        return;
      }

      await Promise.all([
        supabase.from('store_items').update({ quantity: newQuantity }).eq('id', selectedItem.id),
        supabase.from('store_transactions').insert({
          school_id: schoolId,
          item_id: selectedItem.id,
          txn_type: txnType,
          quantity: txnData.quantity,
          reference: txnData.reference,
          issued_to: txnData.issued_to || null,
          notes: txnData.notes || null,
          created_by: userId,
          created_at: new Date().toISOString(),
          deleted_at: null,
        }),
      ]);

      setShowTxnSheet(false);
      setTxnData({ quantity: 0, reference: '', issued_to: '', notes: '' });
      setSelectedItem(null);
      await fetchAllData(schoolId);
    } catch (error) {
      console.error('Error processing transaction:', error);
      alert('Failed to process transaction');
    }
  };

  const handleSoftDelete = async (itemId: string) => {
    if (!confirm('Delete this item?')) return;

    try {
      const { error } = await supabase
        .from('store_items')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', itemId);

      if (error) throw error;
      await fetchAllData(schoolId);
    } catch (error) {
      console.error('Error deleting item:', error);
      alert('Failed to delete item');
    }
  };

  const handleApproveRequest = async (requestId: string) => {
    try {
      const { error } = await supabase
        .from('resource_requests')
        .update({ status: 'approved' })
        .eq('id', requestId);

      if (error) throw error;
      await fetchAllData(schoolId);
    } catch (error) {
      console.error('Error approving request:', error);
      alert('Failed to approve request');
    }
  };

  const handleRejectRequest = async (requestId: string) => {
    try {
      const { error } = await supabase
        .from('resource_requests')
        .update({ status: 'rejected' })
        .eq('id', requestId);

      if (error) throw error;
      await fetchAllData(schoolId);
    } catch (error) {
      console.error('Error rejecting request:', error);
      alert('Failed to reject request');
    }
  };

  const filteredItems = items.filter((item) => {
    const matchSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchCategory = selectedCategory === 'all' || item.category === selectedCategory;
    return matchSearch && matchCategory;
  });

  const lowStockCount = items.filter((item) => item.quantity <= item.low_stock_threshold).length;
  const totalTransactions = transactions.length;

  if (loading) {
    return (
      <div style={{ padding: '20px', textAlign: 'center', color: '#64748b' }}>
        Loading...
      </div>
    );
  }

  return (
    <div style={{ padding: '20px 0', paddingBottom: '120px' }}>
      {/* Stats Row */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '12px',
          padding: '0 20px',
          marginBottom: '24px',
        }}
      >
        <div
          style={{
            backgroundColor: '#ffffff',
            borderRadius: '12px',
            padding: '16px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
          }}
        >
          <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '6px' }}>
            Total Items
          </div>
          <div style={{ fontSize: '24px', fontWeight: '700', color: '#0f172a' }}>
            {items.length}
          </div>
        </div>
        <div
          style={{
            backgroundColor: '#ffffff',
            borderRadius: '12px',
            padding: '16px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
          }}
        >
          <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '6px' }}>
            Low Stock
          </div>
          <div style={{ fontSize: '24px', fontWeight: '700', color: '#dc2626' }}>
            {lowStockCount}
          </div>
        </div>
        <div
          style={{
            backgroundColor: '#ffffff',
            borderRadius: '12px',
            padding: '16px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
          }}
        >
          <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '6px' }}>
            Transactions
          </div>
          <div style={{ fontSize: '24px', fontWeight: '700', color: '#0f172a' }}>
            {totalTransactions}
          </div>
        </div>
      </div>

      {/* Search & Filter */}
      <div
        style={{
          display: 'flex',
          gap: '12px',
          padding: '0 20px',
          marginBottom: '20px',
        }}
      >
        <input
          type="text"
          placeholder="Search items..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            flex: 1,
            padding: '10px 14px',
            borderRadius: '8px',
            border: '1px solid #e2e8f0',
            fontSize: '14px',
            fontFamily: 'inherit',
          }}
        />
        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          style={{
            padding: '10px 12px',
            borderRadius: '8px',
            border: '1px solid #e2e8f0',
            fontSize: '14px',
            fontFamily: 'inherit',
            minWidth: '120px',
          }}
        >
          <option value="all">All Categories</option>
          <option value="stationery">Stationery</option>
          <option value="cleaning">Cleaning</option>
          <option value="furniture">Furniture</option>
          <option value="electronics">Electronics</option>
          <option value="other">Other</option>
        </select>
      </div>

      {/* Items List */}
      <div style={{ padding: '0 20px', marginBottom: '20px' }}>
        {filteredItems.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#64748b', padding: '20px' }}>
            No items found
          </div>
        ) : (
          filteredItems.map((item) => {
            const isLowStock = item.quantity <= item.low_stock_threshold;
            return (
              <div
                key={item.id}
                style={{
                  backgroundColor: '#ffffff',
                  borderRadius: '16px',
                  padding: '16px',
                  marginBottom: '12px',
                  border: '1px solid #e2e8f0',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'start',
                    marginBottom: '12px',
                  }}
                >
                  <div>
                    <h3 style={{ margin: '0 0 6px 0', fontSize: '16px', fontWeight: '600', color: '#0f172a' }}>
                      {item.name}
                    </h3>
                    <div
                      style={{
                        display: 'flex',
                        gap: '8px',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                      }}
                    >
                      <span
                        style={{
                          fontSize: '12px',
                          fontWeight: '600',
                          backgroundColor: '#d1fae5',
                          color: '#059669',
                          padding: '4px 8px',
                          borderRadius: '6px',
                          textTransform: 'capitalize',
                        }}
                      >
                        {item.category}
                      </span>
                      <span style={{ fontSize: '12px', color: '#64748b' }}>
                        {item.unit}
                      </span>
                      {isLowStock && (
                        <span
                          style={{
                            fontSize: '12px',
                            fontWeight: '600',
                            backgroundColor: '#fee2e2',
                            color: '#dc2626',
                            padding: '4px 8px',
                            borderRadius: '6px',
                          }}
                        >
                          Low Stock
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => handleSoftDelete(item.id)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#64748b',
                      cursor: 'pointer',
                      fontSize: '18px',
                      padding: '4px',
                    }}
                  >
                    ✕
                  </button>
                </div>

                <div
                  style={{
                    backgroundColor: '#f0f4f8',
                    padding: '12px',
                    borderRadius: '8px',
                    marginBottom: '12px',
                    fontSize: '14px',
                    color: '#0f172a',
                  }}
                >
                  Quantity: <strong>{item.quantity}</strong> {item.unit} (Threshold:{' '}
                  {item.low_stock_threshold})
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => {
                      setSelectedItem(item);
                      setTxnType('stock_in');
                      setShowTxnSheet(true);
                    }}
                    style={{
                      flex: 1,
                      padding: '10px 12px',
                      backgroundColor: '#10b981',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '8px',
                      fontSize: '13px',
                      fontWeight: '600',
                      cursor: 'pointer',
                    }}
                  >
                    Stock In
                  </button>
                  <button
                    onClick={() => {
                      setSelectedItem(item);
                      setTxnType('stock_out');
                      setShowTxnSheet(true);
                    }}
                    style={{
                      flex: 1,
                      padding: '10px 12px',
                      backgroundColor: '#f59e0b',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '8px',
                      fontSize: '13px',
                      fontWeight: '600',
                      cursor: 'pointer',
                    }}
                  >
                    Stock Out
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Resource Requests */}
      {requests.length > 0 && (
        <div style={{ padding: '0 20px', marginBottom: '20px' }}>
          <h3
            style={{
              fontSize: '16px',
              fontWeight: '600',
              color: '#0f172a',
              marginBottom: '12px',
            }}
          >
            Pending Requests ({requests.length})
          </h3>
          {requests.map((request) => (
            <div
              key={request.id}
              style={{
                backgroundColor: '#ffffff',
                borderRadius: '16px',
                padding: '16px',
                marginBottom: '12px',
                border: '1px solid #e2e8f0',
                boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
              }}
            >
              <div style={{ marginBottom: '12px' }}>
                <h4 style={{ margin: '0 0 6px 0', fontSize: '14px', fontWeight: '600', color: '#0f172a' }}>
                  {request.item_name}
                </h4>
                <div style={{ fontSize: '13px', color: '#64748b' }}>
                  Qty: {request.quantity} | Urgency:{' '}
                  <span style={{ fontWeight: '600', textTransform: 'capitalize' }}>
                    {request.urgency}
                  </span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => handleApproveRequest(request.id)}
                  style={{
                    flex: 1,
                    padding: '10px 12px',
                    backgroundColor: '#10b981',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: '600',
                    cursor: 'pointer',
                  }}
                >
                  Approve
                </button>
                <button
                  onClick={() => handleRejectRequest(request.id)}
                  style={{
                    flex: 1,
                    padding: '10px 12px',
                    backgroundColor: '#ef4444',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: '600',
                    cursor: 'pointer',
                  }}
                >
                  Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* FAB - Add Item */}
      <button
        onClick={() => setShowAddModal(true)}
        style={{
          position: 'fixed',
          bottom: '90px',
          right: '20px',
          width: '56px',
          height: '56px',
          borderRadius: '20px',
          backgroundColor: '#10b981',
          color: '#ffffff',
          border: 'none',
          fontSize: '24px',
          cursor: 'pointer',
          boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)',
        }}
      >
        +
      </button>

      {/* Add Item Modal */}
      {showAddModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'flex-end',
            zIndex: 1000,
          }}
          onClick={() => setShowAddModal(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              backgroundColor: '#ffffff',
              borderRadius: '20px 20px 0 0',
              padding: '24px 20px 32px',
              maxHeight: '90vh',
              overflow: 'auto',
            }}
          >
            <h2
              style={{
                margin: '0 0 20px 0',
                fontSize: '18px',
                fontWeight: '700',
                color: '#0f172a',
              }}
            >
              Add New Item
            </h2>

            <div style={{ marginBottom: '16px' }}>
              <label
                style={{
                  display: 'block',
                  fontSize: '13px',
                  fontWeight: '600',
                  color: '#0f172a',
                  marginBottom: '6px',
                }}
              >
                Item Name
              </label>
              <input
                type="text"
                placeholder="e.g., Exercise Books"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  border: '1px solid #e2e8f0',
                  fontSize: '14px',
                  fontFamily: 'inherit',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label
                style={{
                  display: 'block',
                  fontSize: '13px',
                  fontWeight: '600',
                  color: '#0f172a',
                  marginBottom: '6px',
                }}
              >
                Category
              </label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value as any })}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  border: '1px solid #e2e8f0',
                  fontSize: '14px',
                  fontFamily: 'inherit',
                  boxSizing: 'border-box',
                }}
              >
                <option value="stationery">Stationery</option>
                <option value="cleaning">Cleaning</option>
                <option value="furniture">Furniture</option>
                <option value="electronics">Electronics</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label
                style={{
                  display: 'block',
                  fontSize: '13px',
                  fontWeight: '600',
                  color: '#0f172a',
                  marginBottom: '6px',
                }}
              >
                Unit (e.g., pieces, boxes)
              </label>
              <input
                type="text"
                placeholder="e.g., boxes"
                value={formData.unit}
                onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  border: '1px solid #e2e8f0',
                  fontSize: '14px',
                  fontFamily: 'inherit',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '13px',
                    fontWeight: '600',
                    color: '#0f172a',
                    marginBottom: '6px',
                  }}
                >
                  Quantity
                </label>
                <input
                  type="number"
                  min="0"
                  value={formData.quantity}
                  onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) || 0 })}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid #e2e8f0',
                    fontSize: '14px',
                    fontFamily: 'inherit',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '13px',
                    fontWeight: '600',
                    color: '#0f172a',
                    marginBottom: '6px',
                  }}
                >
                  Low Stock Threshold
                </label>
                <input
                  type="number"
                  min="0"
                  value={formData.low_stock_threshold}
                  onChange={(e) => setFormData({ ...formData, low_stock_threshold: parseInt(e.target.value) || 0 })}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid #e2e8f0',
                    fontSize: '14px',
                    fontFamily: 'inherit',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            </div>

            <button
              onClick={handleAddItem}
              style={{
                width: '100%',
                padding: '12px',
                backgroundColor: '#10b981',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer',
                marginBottom: '12px',
              }}
            >
              Add Item
            </button>
            <button
              onClick={() => setShowAddModal(false)}
              style={{
                width: '100%',
                padding: '12px',
                backgroundColor: '#f0f4f8',
                color: '#0f172a',
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Transaction Bottom Sheet */}
      {showTxnSheet && selectedItem && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'flex-end',
            zIndex: 1000,
          }}
          onClick={() => setShowTxnSheet(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              backgroundColor: '#ffffff',
              borderRadius: '20px 20px 0 0',
              padding: '24px 20px 32px',
              maxHeight: '90vh',
              overflow: 'auto',
            }}
          >
            <h2
              style={{
                margin: '0 0 20px 0',
                fontSize: '18px',
                fontWeight: '700',
                color: '#0f172a',
              }}
            >
              {txnType === 'stock_in' ? 'Stock In' : 'Stock Out'} - {selectedItem.name}
            </h2>

            <div style={{ marginBottom: '16px' }}>
              <label
                style={{
                  display: 'block',
                  fontSize: '13px',
                  fontWeight: '600',
                  color: '#0f172a',
                  marginBottom: '6px',
                }}
              >
                Quantity
              </label>
              <input
                type="number"
                min="1"
                value={txnData.quantity}
                onChange={(e) => setTxnData({ ...txnData, quantity: parseInt(e.target.value) || 0 })}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  border: '1px solid #e2e8f0',
                  fontSize: '14px',
                  fontFamily: 'inherit',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label
                style={{
                  display: 'block',
                  fontSize: '13px',
                  fontWeight: '600',
                  color: '#0f172a',
                  marginBottom: '6px',
                }}
              >
                Reference (e.g., Invoice #, PO #)
              </label>
              <input
                type="text"
                placeholder="Reference number"
                value={txnData.reference}
                onChange={(e) => setTxnData({ ...txnData, reference: e.target.value })}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  border: '1px solid #e2e8f0',
                  fontSize: '14px',
                  fontFamily: 'inherit',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            {txnType === 'stock_out' && (
              <div style={{ marginBottom: '16px' }}>
                <label
                  style={{
                    display: 'block',
                    fontSize: '13px',
                    fontWeight: '600',
                    color: '#0f172a',
                    marginBottom: '6px',
                  }}
                >
                  Issued To (optional)
                </label>
                <input
                  type="text"
                  placeholder="Teacher name or dept"
                  value={txnData.issued_to}
                  onChange={(e) => setTxnData({ ...txnData, issued_to: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid #e2e8f0',
                    fontSize: '14px',
                    fontFamily: 'inherit',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            )}

            <div style={{ marginBottom: '16px' }}>
              <label
                style={{
                  display: 'block',
                  fontSize: '13px',
                  fontWeight: '600',
                  color: '#0f172a',
                  marginBottom: '6px',
                }}
              >
                Notes (optional)
              </label>
              <textarea
                placeholder="Additional details..."
                value={txnData.notes}
                onChange={(e) => setTxnData({ ...txnData, notes: e.target.value })}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  border: '1px solid #e2e8f0',
                  fontSize: '14px',
                  fontFamily: 'inherit',
                  boxSizing: 'border-box',
                  minHeight: '80px',
                  resize: 'vertical',
                }}
              />
            </div>

            <button
              onClick={handleTransaction}
              style={{
                width: '100%',
                padding: '12px',
                backgroundColor: '#10b981',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer',
                marginBottom: '12px',
              }}
            >
              {txnType === 'stock_in' ? 'Stock In' : 'Stock Out'}
            </button>
            <button
              onClick={() => setShowTxnSheet(false)}
              style={{
                width: '100%',
                padding: '12px',
                backgroundColor: '#f0f4f8',
                color: '#0f172a',
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
