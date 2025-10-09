import React, { useState, useEffect } from 'react';
import { FileService, type FileAttachment } from '../services/fileService';
import FileAttachmentList from './FileAttachmentList';

interface ClientAttachmentsProps {
  clientId: string;
  clientName: string;
  onBack: () => void;
}

const ClientAttachments: React.FC<ClientAttachmentsProps> = ({ clientId, clientName, onBack }) => {
  const [attachments, setAttachments] = useState<FileAttachment[]>([]);
  const [filteredAttachments, setFilteredAttachments] = useState<FileAttachment[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Search and filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [paymentTypeFilter, setPaymentTypeFilter] = useState<string>('');
  const [fileSizeFilter, setFileSizeFilter] = useState<string>('');
  const [dateFilter, setDateFilter] = useState<string>('');
  const [fileTypeFilter, setFileTypeFilter] = useState<string>('');

  useEffect(() => {
    loadClientAttachments();
  }, [clientId]);

  useEffect(() => {
    applyFilters();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attachments, searchQuery, categoryFilter, paymentTypeFilter, fileSizeFilter, dateFilter, fileTypeFilter]);

  const loadClientAttachments = () => {
    setLoading(true);
    try {
      // Get all file attachments
      const allAttachments = FileService.getAllFileAttachments();
      
      // Get payment file IDs for this client (if we had client-specific payment data)
      // For now, we'll show all attachments since we don't have client-specific linking yet
      setAttachments(allAttachments);
    } catch (error) {
      console.error('Error loading client attachments:', error);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...attachments];

    // Search by filename
    if (searchQuery) {
      filtered = filtered.filter(att => 
        att.file.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Filter by category
    if (categoryFilter) {
      filtered = filtered.filter(att => att.category === categoryFilter);
    }

    // Filter by payment type
    if (paymentTypeFilter) {
      filtered = filtered.filter(att => att.paymentType === paymentTypeFilter);
    }

    // Filter by file size
    if (fileSizeFilter) {
      filtered = filtered.filter(att => {
        const sizeInMB = att.file.size / (1024 * 1024);
        switch (fileSizeFilter) {
          case 'small': return sizeInMB < 1;
          case 'medium': return sizeInMB >= 1 && sizeInMB < 5;
          case 'large': return sizeInMB >= 5;
          default: return true;
        }
      });
    }

    // Filter by upload date
    if (dateFilter) {
      const now = new Date();
      filtered = filtered.filter(att => {
        const uploadDate = new Date(att.file.uploadDate);
        const daysDiff = Math.floor((now.getTime() - uploadDate.getTime()) / (1000 * 60 * 60 * 24));
        
        switch (dateFilter) {
          case 'today': return daysDiff === 0;
          case 'week': return daysDiff <= 7;
          case 'month': return daysDiff <= 30;
          case 'older': return daysDiff > 30;
          default: return true;
        }
      });
    }

    // Filter by file type
    if (fileTypeFilter) {
      filtered = filtered.filter(att => {
        switch (fileTypeFilter) {
          case 'image': return att.file.type.startsWith('image/');
          case 'pdf': return att.file.type === 'application/pdf';
          case 'other': return !att.file.type.startsWith('image/') && att.file.type !== 'application/pdf';
          default: return true;
        }
      });
    }

    setFilteredAttachments(filtered);
  };

  const handleFileDeleted = (fileId: string) => {
    setAttachments(prev => prev.filter(att => att.file.id !== fileId));
  };

  // Get unique values for filter options
  const getFilterOptions = () => {
    const categories = [...new Set(attachments.map(att => att.category))];
    const paymentTypes = [...new Set(attachments.map(att => att.paymentType).filter(Boolean))];
    const fileTypes = [...new Set(attachments.map(att => {
      if (att.file.type.startsWith('image/')) return 'image';
      if (att.file.type === 'application/pdf') return 'pdf';
      return 'other';
    }))];

    return { categories, paymentTypes, fileTypes };
  };

  const filterOptions = getFilterOptions();

  const groupedAttachments = {
    depositSlips: filteredAttachments.filter(att => att.category === 'deposit-slip'),
    receipts: filteredAttachments.filter(att => att.category === 'receipt'),
    other: filteredAttachments.filter(att => att.category === 'other')
  };

  return (
    <div style={{
      padding: '20px',
      maxWidth: '1200px',
      margin: '0 auto',
      backgroundColor: '#f5f5f5'
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '30px',
        backgroundColor: 'white',
        padding: '20px',
        borderRadius: '10px',
        boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
      }}>
        <div>
          <h1 style={{ 
            margin: '0 0 10px 0',
            color: '#2c3e50',
            fontSize: '28px'
          }}>
            Payment Attachments
          </h1>
          <p style={{ 
            margin: 0,
            color: '#7f8c8d',
            fontSize: '16px'
          }}>
            Client: <strong>{clientName}</strong>
          </p>
        </div>
        <button
          onClick={onBack}
          style={{
            padding: '12px 24px',
            backgroundColor: '#3498db',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '500',
            transition: 'background-color 0.3s ease'
          }}
          onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#2980b9'}
          onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#3498db'}
        >
          ← Back to Records
        </button>
      </div>

      {/* Search and Filters Section */}
      <div style={{
        backgroundColor: 'white',
        padding: '20px',
        borderRadius: '10px',
        marginBottom: '20px',
        boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
      }}>
        <h3 style={{ margin: '0 0 16px 0', color: '#2c3e50' }}>
          Search & Filters
        </h3>
        
        {/* Search Bar */}
        <div style={{ marginBottom: '16px' }}>
          <input
            type="text"
            placeholder="Search by filename..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '12px 16px',
              border: '2px solid #e9ecef',
              borderRadius: '8px',
              fontSize: '14px',
              transition: 'border-color 0.3s ease'
            }}
            onFocus={(e) => e.target.style.borderColor = '#3498db'}
            onBlur={(e) => e.target.style.borderColor = '#e9ecef'}
          />
        </div>

        {/* Filter Controls */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: '12px'
        }}>
          {/* Category Filter */}
          <div>
            <label style={{
              display: 'block',
              marginBottom: '4px',
              fontSize: '12px',
              fontWeight: '500',
              color: '#6c757d'
            }}>
              Category
            </label>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              style={{
                width: '100%',
                padding: '8px',
                border: '1px solid #e9ecef',
                borderRadius: '4px',
                fontSize: '14px',
                backgroundColor: 'white'
              }}
            >
              <option value="">All Categories</option>
              {filterOptions.categories.map(cat => (
                <option key={cat} value={cat}>
                  {cat.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                </option>
              ))}
            </select>
          </div>

          {/* Payment Type Filter */}
          <div>
            <label style={{
              display: 'block',
              marginBottom: '4px',
              fontSize: '12px',
              fontWeight: '500',
              color: '#6c757d'
            }}>
              Payment Type
            </label>
            <select
              value={paymentTypeFilter}
              onChange={(e) => setPaymentTypeFilter(e.target.value)}
              style={{
                width: '100%',
                padding: '8px',
                border: '1px solid #e9ecef',
                borderRadius: '4px',
                fontSize: '14px',
                backgroundColor: 'white'
              }}
            >
              <option value="">All Payments</option>
              {filterOptions.paymentTypes.map(type => (
                <option key={type} value={type}>
                  {type ? type.charAt(0).toUpperCase() + type.slice(1) : 'Unknown'} Payment
                </option>
              ))}
            </select>
          </div>

          {/* File Type Filter */}
          <div>
            <label style={{
              display: 'block',
              marginBottom: '4px',
              fontSize: '12px',
              fontWeight: '500',
              color: '#6c757d'
            }}>
              File Type
            </label>
            <select
              value={fileTypeFilter}
              onChange={(e) => setFileTypeFilter(e.target.value)}
              style={{
                width: '100%',
                padding: '8px',
                border: '1px solid #e9ecef',
                borderRadius: '4px',
                fontSize: '14px',
                backgroundColor: 'white'
              }}
            >
              <option value="">All Types</option>
              {filterOptions.fileTypes.map(type => (
                <option key={type} value={type}>
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </option>
              ))}
            </select>
          </div>

          {/* File Size Filter */}
          <div>
            <label style={{
              display: 'block',
              marginBottom: '4px',
              fontSize: '12px',
              fontWeight: '500',
              color: '#6c757d'
            }}>
              File Size
            </label>
            <select
              value={fileSizeFilter}
              onChange={(e) => setFileSizeFilter(e.target.value)}
              style={{
                width: '100%',
                padding: '8px',
                border: '1px solid #e9ecef',
                borderRadius: '4px',
                fontSize: '14px',
                backgroundColor: 'white'
              }}
            >
              <option value="">All Sizes</option>
              <option value="small">Small (&lt; 1MB)</option>
              <option value="medium">Medium (1-5MB)</option>
              <option value="large">Large (&gt; 5MB)</option>
            </select>
          </div>

          {/* Date Filter */}
          <div>
            <label style={{
              display: 'block',
              marginBottom: '4px',
              fontSize: '12px',
              fontWeight: '500',
              color: '#6c757d'
            }}>
              Upload Date
            </label>
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              style={{
                width: '100%',
                padding: '8px',
                border: '1px solid #e9ecef',
                borderRadius: '4px',
                fontSize: '14px',
                backgroundColor: 'white'
              }}
            >
              <option value="">All Dates</option>
              <option value="today">Today</option>
              <option value="week">This Week</option>
              <option value="month">This Month</option>
              <option value="older">Older</option>
            </select>
          </div>

          {/* Clear Filters Button */}
          <div style={{ display: 'flex', alignItems: 'end' }}>
            <button
              onClick={() => {
                setSearchQuery('');
                setCategoryFilter('');
                setPaymentTypeFilter('');
                setFileSizeFilter('');
                setDateFilter('');
                setFileTypeFilter('');
              }}
              style={{
                width: '100%',
                padding: '8px 12px',
                backgroundColor: '#6c757d',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                fontSize: '12px',
                cursor: 'pointer',
                fontWeight: '500'
              }}
              onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#5a6268'}
              onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#6c757d'}
            >
              Clear All
            </button>
          </div>
        </div>

        {/* Filter Results Summary */}
        <div style={{
          marginTop: '12px',
          padding: '8px 12px',
          backgroundColor: '#f8f9fa',
          borderRadius: '4px',
          fontSize: '12px',
          color: '#6c757d'
        }}>
          Showing {filteredAttachments.length} of {attachments.length} files
          {(searchQuery || categoryFilter || paymentTypeFilter || fileSizeFilter || dateFilter || fileTypeFilter) && (
            <span style={{ marginLeft: '8px', fontWeight: '500' }}>
              (filtered)
            </span>
          )}
        </div>
      </div>

      {loading ? (
        <div style={{
          textAlign: 'center',
          padding: '40px',
          backgroundColor: 'white',
          borderRadius: '10px',
          boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
        }}>
          <div style={{ fontSize: '24px', marginBottom: '16px' }}>⏳</div>
          <p>Loading attachments...</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Summary */}
          <div style={{
            backgroundColor: 'white',
            padding: '20px',
            borderRadius: '10px',
            boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
          }}>
            <h3 style={{ margin: '0 0 16px 0', color: '#2c3e50' }}>
              Attachment Summary
            </h3>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '16px'
            }}>
              <div style={{
                textAlign: 'center',
                padding: '16px',
                backgroundColor: '#f8f9fa',
                borderRadius: '8px',
                border: '2px solid #28a745'
              }}>
                <div style={{ fontSize: '24px', color: '#28a745', marginBottom: '8px' }}>
                  🧾
                </div>
                <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#28a745' }}>
                  {groupedAttachments.depositSlips.length}
                </div>
                <div style={{ fontSize: '14px', color: '#6c757d' }}>
                  Deposit Slips
                </div>
              </div>
              <div style={{
                textAlign: 'center',
                padding: '16px',
                backgroundColor: '#f8f9fa',
                borderRadius: '8px',
                border: '2px solid #007bff'
              }}>
                <div style={{ fontSize: '24px', color: '#007bff', marginBottom: '8px' }}>
                  📄
                </div>
                <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#007bff' }}>
                  {groupedAttachments.receipts.length}
                </div>
                <div style={{ fontSize: '14px', color: '#6c757d' }}>
                  Receipts
                </div>
              </div>
              <div style={{
                textAlign: 'center',
                padding: '16px',
                backgroundColor: '#f8f9fa',
                borderRadius: '8px',
                border: '2px solid #6c757d'
              }}>
                <div style={{ fontSize: '24px', color: '#6c757d', marginBottom: '8px' }}>
                  📎
                </div>
                <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#6c757d' }}>
                  {groupedAttachments.other.length}
                </div>
                <div style={{ fontSize: '14px', color: '#6c757d' }}>
                  Other Files
                </div>
              </div>
              <div style={{
                textAlign: 'center',
                padding: '16px',
                backgroundColor: '#f8f9fa',
                borderRadius: '8px',
                border: '2px solid #17a2b8'
              }}>
                <div style={{ fontSize: '24px', color: '#17a2b8', marginBottom: '8px' }}>
                  📊
                </div>
                <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#17a2b8' }}>
                  {filteredAttachments.length}
                </div>
                <div style={{ fontSize: '14px', color: '#6c757d' }}>
                  Total Filtered
                </div>
              </div>
            </div>
          </div>

          {/* Deposit Slips */}
          {groupedAttachments.depositSlips.length > 0 && (
            <div style={{
              backgroundColor: 'white',
              padding: '20px',
              borderRadius: '10px',
              boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
            }}>
              <FileAttachmentList
                attachments={groupedAttachments.depositSlips}
                title="Deposit Slips"
                showCategory={false}
                allowDelete={true}
                onFileDeleted={handleFileDeleted}
              />
            </div>
          )}

          {/* Receipts */}
          {groupedAttachments.receipts.length > 0 && (
            <div style={{
              backgroundColor: 'white',
              padding: '20px',
              borderRadius: '10px',
              boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
            }}>
              <FileAttachmentList
                attachments={groupedAttachments.receipts}
                title="Receipts"
                showCategory={false}
                allowDelete={true}
                onFileDeleted={handleFileDeleted}
              />
            </div>
          )}

          {/* Other Files */}
          {groupedAttachments.other.length > 0 && (
            <div style={{
              backgroundColor: 'white',
              padding: '20px',
              borderRadius: '10px',
              boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
            }}>
              <FileAttachmentList
                attachments={groupedAttachments.other}
                title="Other Attachments"
                showCategory={false}
                allowDelete={true}
                onFileDeleted={handleFileDeleted}
              />
            </div>
          )}

          {/* No attachments message */}
          {filteredAttachments.length === 0 && (
            <div style={{
              backgroundColor: 'white',
              padding: '40px',
              borderRadius: '10px',
              boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '48px', marginBottom: '16px', opacity: 0.5 }}>
                {attachments.length === 0 ? '📎' : '🔍'}
              </div>
              <h3 style={{ color: '#6c757d', margin: '0 0 8px 0' }}>
                {attachments.length === 0 ? 'No Attachments Found' : 'No Files Match Your Filters'}
              </h3>
              <p style={{ color: '#adb5bd', margin: 0 }}>
                {attachments.length === 0 
                  ? "This client doesn't have any uploaded payment attachments yet."
                  : "Try adjusting your search query or filters to find what you're looking for."
                }
              </p>
              {attachments.length > 0 && filteredAttachments.length === 0 && (
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setCategoryFilter('');
                    setPaymentTypeFilter('');
                    setFileSizeFilter('');
                    setDateFilter('');
                    setFileTypeFilter('');
                  }}
                  style={{
                    marginTop: '16px',
                    padding: '8px 16px',
                    backgroundColor: '#17a2b8',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '14px'
                  }}
                >
                  Clear All Filters
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ClientAttachments;