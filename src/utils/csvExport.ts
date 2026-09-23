import { Order, Transaction } from '../types/trading';
import { formatDateTime } from './formatters';

export function exportOrdersToCSV(orders: Order[], filename = 'TradeNest_Orders.csv'): void {
  if (orders.length === 0) {
    alert('No orders to export.');
    return;
  }

  const headers = [
    'Order ID',
    'Date & Time',
    'Symbol',
    'Company Name',
    'Type',
    'Side',
    'Quantity',
    'Requested Price',
    'Execution Price',
    'Total Value',
    'Status',
    'Reason'
  ];

  const rows = orders.map(order => [
    order.id,
    `"${formatDateTime(order.createdAt)}"`,
    order.symbol,
    `"${order.companyName.replace(/"/g, '""')}"`,
    order.orderType,
    order.side,
    order.quantity,
    order.orderType === 'LIMIT' ? order.limitPrice : 'MARKET',
    order.executionPrice ? order.executionPrice.toFixed(2) : 'N/A',
    order.totalAmount.toFixed(2),
    order.status,
    `"${(order.rejectionReason || '').replace(/"/g, '""')}"`
  ]);

  const csvContent = [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
  downloadBlob(csvContent, filename, 'text/csv;charset=utf-8;');
}

export function exportTransactionsToCSV(transactions: Transaction[], filename = 'TradeNest_Transactions.csv'): void {
  if (transactions.length === 0) {
    alert('No transactions to export.');
    return;
  }

  const headers = [
    'Transaction ID',
    'Order ID',
    'Date & Time',
    'Symbol',
    'Company Name',
    'Side',
    'Quantity',
    'Price (INR)',
    'Total Value (INR)',
    'Realized PnL (INR)'
  ];

  const rows = transactions.map(t => [
    t.id,
    t.orderId,
    `"${formatDateTime(t.createdAt)}"`,
    t.symbol,
    `"${t.companyName.replace(/"/g, '""')}"`,
    t.side,
    t.quantity,
    t.price.toFixed(2),
    t.totalValue.toFixed(2),
    t.realizedPnl !== undefined ? t.realizedPnl.toFixed(2) : 'N/A'
  ]);

  const csvContent = [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
  downloadBlob(csvContent, filename, 'text/csv;charset=utf-8;');
}

function downloadBlob(content: string, filename: string, contentType: string): void {
  const blob = new Blob([content], { type: contentType });
  const url = URL.createObjectURL(blob);
  const pom = document.createElement('a');
  pom.href = url;
  pom.setAttribute('download', filename);
  pom.click();
  URL.revokeObjectURL(url);
}
