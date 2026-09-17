import React from 'react';

const statusStyles = {
  // Enquiry
  NEW: 'bg-blue-100 text-blue-800 border-blue-200',
  QUOTED: 'bg-indigo-100 text-indigo-800 border-indigo-200',
  WON: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  LOST: 'bg-rose-100 text-rose-800 border-rose-200',

  // Quotation
  DRAFT: 'bg-gray-100 text-gray-800 border-gray-200',
  SENT: 'bg-cyan-100 text-cyan-800 border-cyan-200',
  ACCEPTED: 'bg-green-100 text-green-800 border-green-200',
  REJECTED: 'bg-red-100 text-red-800 border-red-200',

  // Sales Order
  PENDING: 'bg-amber-100 text-amber-800 border-amber-200',
  CONFIRMED: 'bg-purple-100 text-purple-800 border-purple-200',
  DISPATCHED: 'bg-teal-100 text-teal-800 border-teal-200',
  CANCELLED: 'bg-slate-100 text-slate-800 border-slate-200',
};

const StatusBadge = ({ status }) => {
  const style = statusStyles[status] || 'bg-gray-100 text-gray-800 border-gray-200';

  return (
    <span className={`status-badge ${style}`}>
      {status}
    </span>
  );
};

export default StatusBadge;
