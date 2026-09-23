import React, { useState, useMemo } from 'react';
import { 
  ClipboardList, 
  Download, 
  XCircle, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  FileSpreadsheet,
  ArrowUpRight
} from 'lucide-react';
import { useTrading } from '../context/TradingContext';
import { OrderStatus } from '../types/trading';
import { formatINR, formatDateTime } from '../utils/formatters';
import { exportOrdersToCSV, exportTransactionsToCSV } from '../utils/csvExport';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { EmptyState } from '../components/common/EmptyState';
import { useNavigate } from 'react-router-dom';

type FilterTab = 'ALL' | 'PENDING' | 'EXECUTED' | 'CANCELLED' | 'REJECTED';

export const OrdersPage: React.FC = () => {
  const { orders, transactions, cancelOrder } = useTrading();
  const [activeFilter, setActiveFilter] = useState<FilterTab>('ALL');
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const navigate = useNavigate();

  const filteredOrders = useMemo(() => {
    if (activeFilter === 'ALL') return orders;
    return orders.filter(o => o.status === activeFilter);
  }, [orders, activeFilter]);

  const counts = useMemo(() => {
    return {
      ALL: orders.length,
      PENDING: orders.filter(o => o.status === 'PENDING').length,
      EXECUTED: orders.filter(o => o.status === 'EXECUTED').length,
      CANCELLED: orders.filter(o => o.status === 'CANCELLED').length,
      REJECTED: orders.filter(o => o.status === 'REJECTED').length,
    };
  }, [orders]);

  const handleCancel = async (orderId: string) => {
    setCancellingId(orderId);
    try {
      await cancelOrder(orderId);
    } finally {
      setCancellingId(null);
    }
  };

  const getStatusBadge = (status: OrderStatus) => {
    switch (status) {
      case 'EXECUTED':
        return <Badge variant="green" size="sm"><CheckCircle2 className="w-3 h-3" /> Executed</Badge>;
      case 'PENDING':
        return <Badge variant="amber" size="sm"><Clock className="w-3 h-3 animate-pulse" /> Pending</Badge>;
      case 'CANCELLED':
        return <Badge variant="neutral" size="sm"><XCircle className="w-3 h-3" /> Cancelled</Badge>;
      case 'REJECTED':
        return <Badge variant="red" size="sm"><AlertCircle className="w-3 h-3" /> Rejected</Badge>;
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white">
            Order Book & History
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Track pending limit orders, execution reports, and paper-trade transactions.
          </p>
        </div>

        {/* CSV Export Actions */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => exportOrdersToCSV(orders)}
            disabled={orders.length === 0}
            className="text-xs"
          >
            <Download className="w-3.5 h-3.5 mr-1.5" />
            Export Orders (CSV)
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => exportTransactionsToCSV(transactions)}
            disabled={transactions.length === 0}
            className="text-xs"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 mr-1.5" />
            Trade History (CSV)
          </Button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2">
        {(['ALL', 'PENDING', 'EXECUTED', 'CANCELLED', 'REJECTED'] as FilterTab[]).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveFilter(tab)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 ${
              activeFilter === tab
                ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 shadow-sm'
                : 'bg-white dark:bg-[#131B2E] text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200/80 dark:border-slate-800'
            }`}
          >
            <span>{tab === 'ALL' ? 'All Orders' : tab.charAt(0) + tab.slice(1).toLowerCase()}</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
              activeFilter === tab
                ? 'bg-white/20 dark:bg-slate-900/20 text-current'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
            }`}>
              {counts[tab]}
            </span>
          </button>
        ))}
      </div>

      {/* Orders List */}
      {filteredOrders.length === 0 ? (
        <EmptyState
          icon={<ClipboardList className="w-7 h-7" />}
          title={`No ${activeFilter.toLowerCase()} orders found`}
          description={
            activeFilter === 'ALL'
              ? 'You have not submitted any simulated market or limit orders yet.'
              : `There are currently no orders with ${activeFilter} status.`
          }
          actionText={activeFilter === 'ALL' ? 'Explore Stocks' : undefined}
          onAction={activeFilter === 'ALL' ? () => navigate('/explore') : undefined}
        />
      ) : (
        <Card className="p-0 overflow-hidden">
          {/* Desktop Table View */}
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 dark:bg-slate-900/60 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-3.5">Time</th>
                  <th className="px-4 py-3.5">Stock</th>
                  <th className="px-4 py-3.5">Side</th>
                  <th className="px-4 py-3.5">Type</th>
                  <th className="px-4 py-3.5 text-right">Qty</th>
                  <th className="px-4 py-3.5 text-right">Requested</th>
                  <th className="px-4 py-3.5 text-right">Execution</th>
                  <th className="px-4 py-3.5 text-right">Total Amount</th>
                  <th className="px-4 py-3.5 text-center">Status</th>
                  <th className="px-6 py-3.5 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredOrders.map(order => {
                  const isBuy = order.side === 'BUY';
                  return (
                    <tr
                      key={order.id}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="px-6 py-4 text-xs text-slate-500 font-mono-numeric whitespace-nowrap">
                        {formatDateTime(order.createdAt)}
                      </td>
                      <td className="px-4 py-4">
                        <div 
                          onClick={() => navigate(`/stocks/${order.symbol}`)}
                          className="font-bold text-slate-900 dark:text-white hover:text-emerald-500 cursor-pointer flex items-center gap-1"
                        >
                          <span>{order.symbol}</span>
                          <ArrowUpRight className="w-3 h-3 text-slate-400" />
                        </div>
                        <div className="text-[11px] text-slate-400 truncate max-w-[130px]">
                          {order.companyName}
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-md ${
                          isBuy 
                            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400' 
                            : 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400'
                        }`}>
                          {order.side}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-xs font-medium text-slate-600 dark:text-slate-300">
                        {order.orderType}
                      </td>
                      <td className="px-4 py-4 text-right font-mono-numeric font-semibold text-slate-900 dark:text-slate-100">
                        {order.quantity}
                      </td>
                      <td className="px-4 py-4 text-right font-mono-numeric text-slate-600 dark:text-slate-400">
                        {order.orderType === 'LIMIT' ? formatINR(order.limitPrice!) : 'MARKET'}
                      </td>
                      <td className="px-4 py-4 text-right font-mono-numeric font-medium text-slate-900 dark:text-white">
                        {order.executionPrice ? formatINR(order.executionPrice) : '—'}
                      </td>
                      <td className="px-4 py-4 text-right font-mono-numeric font-bold text-slate-900 dark:text-white">
                        {formatINR(order.totalAmount)}
                      </td>
                      <td className="px-4 py-4 text-center">
                        {getStatusBadge(order.status)}
                      </td>
                      <td className="px-6 py-4 text-center">
                        {order.status === 'PENDING' ? (
                          <Button
                            variant="danger"
                            size="sm"
                            className="text-xs px-2.5 py-1"
                            isLoading={cancellingId === order.id}
                            onClick={() => handleCancel(order.id)}
                          >
                            Cancel
                          </Button>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Card View */}
          <div className="lg:hidden divide-y divide-slate-100 dark:divide-slate-800">
            {filteredOrders.map(order => {
              const isBuy = order.side === 'BUY';
              return (
                <div key={order.id} className="p-4 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-md ${
                        isBuy 
                          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400' 
                          : 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400'
                      }`}>
                        {order.side}
                      </span>
                      <span 
                        onClick={() => navigate(`/stocks/${order.symbol}`)}
                        className="font-bold text-slate-900 dark:text-white text-sm"
                      >
                        {order.symbol}
                      </span>
                      <span className="text-xs text-slate-400">({order.orderType})</span>
                    </div>

                    <div>
                      {getStatusBadge(order.status)}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs text-slate-500 pt-1">
                    <div>
                      <span>Quantity:</span>{' '}
                      <strong className="text-slate-900 dark:text-slate-200">{order.quantity} shares</strong>
                    </div>
                    <div className="text-right">
                      <span>Total Value:</span>{' '}
                      <strong className="text-slate-900 dark:text-slate-200 font-mono-numeric">{formatINR(order.totalAmount)}</strong>
                    </div>
                    <div>
                      <span>Requested:</span>{' '}
                      <span className="font-mono-numeric text-slate-700 dark:text-slate-300">
                        {order.orderType === 'LIMIT' ? formatINR(order.limitPrice!) : 'MARKET'}
                      </span>
                    </div>
                    <div className="text-right">
                      <span>Filled At:</span>{' '}
                      <span className="font-mono-numeric text-slate-700 dark:text-slate-300">
                        {order.executionPrice ? formatINR(order.executionPrice) : 'N/A'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <span>{formatDateTime(order.createdAt)}</span>
                    {order.status === 'PENDING' && (
                      <button
                        onClick={() => handleCancel(order.id)}
                        disabled={cancellingId === order.id}
                        className="text-xs text-rose-600 dark:text-rose-400 font-semibold hover:underline"
                      >
                        Cancel Order
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
};
