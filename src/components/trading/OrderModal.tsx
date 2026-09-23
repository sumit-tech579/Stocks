import React, { useState, useEffect } from 'react';
import { StockQuote } from '../../types/stock';
import { OrderSide, OrderType, OrderRequest } from '../../types/trading';
import { useTrading } from '../../context/TradingContext';
import { formatINR } from '../../utils/formatters';
import { round2 } from '../../utils/math';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { Input } from '../common/Input';
import { ShieldCheck, Info, AlertCircle } from 'lucide-react';

interface OrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  stock: StockQuote;
  initialSide?: OrderSide;
}

export const OrderModal: React.FC<OrderModalProps> = ({
  isOpen,
  onClose,
  stock,
  initialSide = 'BUY',
}) => {
  const { accountSummary, holdings, placeOrder } = useTrading();

  const [side, setSide] = useState<OrderSide>(initialSide);
  const [orderType, setOrderType] = useState<OrderType>('MARKET');
  const [quantity, setQuantity] = useState<number>(1);
  const [limitPrice, setLimitPrice] = useState<number>(stock.price);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [step, setStep] = useState<'form' | 'confirm'>('form');

  useEffect(() => {
    if (isOpen) {
      setSide(initialSide);
      setOrderType('MARKET');
      setQuantity(1);
      setLimitPrice(stock.price);
      setStep('form');
      setIsSubmitting(false);
    }
  }, [isOpen, initialSide, stock.price]);

  // Holding info for this stock
  const currentHolding = holdings.find(h => h.symbol === stock.symbol);
  const sellableShares = currentHolding ? currentHolding.availableQuantity : 0;
  const availableCash = accountSummary?.availableCash || 0;

  const effectivePrice = orderType === 'LIMIT' ? limitPrice : stock.price;
  const estimatedTotal = round2(quantity * effectivePrice);

  // Validation
  let validationError = '';
  if (!Number.isInteger(quantity) || quantity <= 0) {
    validationError = 'Please enter a valid whole share quantity (minimum 1).';
  } else if (orderType === 'LIMIT' && (!limitPrice || limitPrice <= 0)) {
    validationError = 'Please enter a valid limit price.';
  } else if (side === 'BUY' && estimatedTotal > availableCash) {
    validationError = `Insufficient virtual cash. Needed: ${formatINR(estimatedTotal)}, Available: ${formatINR(availableCash)}`;
  } else if (side === 'SELL' && quantity > sellableShares) {
    validationError = `Insufficient sellable shares. You hold ${sellableShares} available shares.`;
  }

  const handleReview = (e: React.FormEvent) => {
    e.preventDefault();
    if (validationError) return;
    setStep('confirm');
  };

  const handleFinalSubmit = async () => {
    if (isSubmitting) return; // Prevent duplicate execution
    setIsSubmitting(true);

    try {
      const request: OrderRequest = {
        symbol: stock.symbol,
        side,
        orderType,
        quantity,
        limitPrice: orderType === 'LIMIT' ? limitPrice : undefined,
      };

      const result = await placeOrder(request);
      if (result.success) {
        onClose();
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`${stock.symbol} • Paper Trade`}
      description="Simulated Indian stock order with virtual money"
      maxWidth="md"
    >
      {step === 'form' ? (
        <form onSubmit={handleReview} className="space-y-5">
          {/* Side Selector Tabs (Buy / Sell) */}
          <div className="grid grid-cols-2 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl">
            <button
              type="button"
              onClick={() => {
                setSide('BUY');
                setStep('form');
              }}
              className={`py-2 text-sm font-bold rounded-lg transition-all ${
                side === 'BUY'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              BUY
            </button>
            <button
              type="button"
              onClick={() => {
                setSide('SELL');
                setStep('form');
              }}
              className={`py-2 text-sm font-bold rounded-lg transition-all ${
                side === 'SELL'
                  ? 'bg-rose-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              SELL
            </button>
          </div>

          {/* Order Type Toggle */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Order Type
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setOrderType('MARKET')}
                className={`py-2 px-3 text-xs sm:text-sm font-medium rounded-xl border text-center transition-all ${
                  orderType === 'MARKET'
                    ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 font-semibold'
                    : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                Market (Instant)
              </button>
              <button
                type="button"
                onClick={() => setOrderType('LIMIT')}
                className={`py-2 px-3 text-xs sm:text-sm font-medium rounded-xl border text-center transition-all ${
                  orderType === 'LIMIT'
                    ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 font-semibold'
                    : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                Limit (Target Price)
              </button>
            </div>
          </div>

          {/* Quantity & Price */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Input
                label="Quantity (Shares)"
                type="number"
                min="1"
                step="1"
                value={quantity}
                onChange={e => setQuantity(parseInt(e.target.value) || 0)}
                placeholder="1"
                required
              />
              <p className="text-[11px] text-slate-400 mt-1">Whole shares only</p>
            </div>

            <div>
              <Input
                label={orderType === 'LIMIT' ? 'Limit Price (₹)' : 'Market Price (₹)'}
                type="number"
                step="0.05"
                min="0.05"
                disabled={orderType === 'MARKET'}
                value={orderType === 'LIMIT' ? limitPrice : stock.price}
                onChange={e => setLimitPrice(parseFloat(e.target.value) || 0)}
                required
              />
              <p className="text-[11px] text-slate-400 mt-1 font-mono-numeric">
                Quote: {formatINR(stock.price)}
              </p>
            </div>
          </div>

          {/* Balance Context */}
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 space-y-1.5 text-xs">
            <div className="flex justify-between items-center text-slate-500 dark:text-slate-400">
              <span>{side === 'BUY' ? 'Available Virtual Cash:' : 'Sellable Shares:'}</span>
              <span className="font-mono-numeric font-semibold text-slate-900 dark:text-slate-100">
                {side === 'BUY' ? formatINR(availableCash) : `${sellableShares} shares`}
              </span>
            </div>

            <div className="flex justify-between items-center text-slate-500 dark:text-slate-400">
              <span>Estimated Order Value:</span>
              <span className="font-mono-numeric font-bold text-slate-900 dark:text-slate-100">
                {formatINR(estimatedTotal)}
              </span>
            </div>

            <div className="flex justify-between items-center text-[11px] text-slate-400 pt-1 border-t border-slate-200/60 dark:border-slate-800">
              <span>Brokerage & Taxes:</span>
              <span className="text-emerald-600 dark:text-emerald-400 font-medium">₹0.00 (Simulation Free)</span>
            </div>
          </div>

          {/* Validation Error Message */}
          {validationError && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 flex items-start gap-2 text-xs text-rose-700 dark:text-rose-300">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-500" />
              <span>{validationError}</span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <Button type="button" variant="outline" size="md" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant={side === 'BUY' ? 'primary' : 'danger'}
              size="md"
              disabled={Boolean(validationError)}
            >
              Review {side} Order
            </Button>
          </div>
        </form>
      ) : (
        /* Confirmation Screen */
        <div className="space-y-5 animate-in fade-in">
          <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50 space-y-3">
            <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 font-bold text-sm">
              <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              <span>Confirm Virtual-Money Trade</span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              This order will execute within the <strong>TradeNest Paper Trading simulation</strong>.
              No actual money or real exchange orders are involved.
            </p>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
            <div className="py-2.5 flex justify-between">
              <span className="text-slate-500 dark:text-slate-400">Stock</span>
              <span className="font-semibold text-slate-900 dark:text-slate-100">{stock.name} ({stock.symbol})</span>
            </div>
            <div className="py-2.5 flex justify-between">
              <span className="text-slate-500 dark:text-slate-400">Action</span>
              <span className={`font-bold ${side === 'BUY' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                {side} ({orderType})
              </span>
            </div>
            <div className="py-2.5 flex justify-between">
              <span className="text-slate-500 dark:text-slate-400">Quantity</span>
              <span className="font-mono-numeric font-semibold text-slate-900 dark:text-slate-100">{quantity} Shares</span>
            </div>
            <div className="py-2.5 flex justify-between">
              <span className="text-slate-500 dark:text-slate-400">
                {orderType === 'LIMIT' ? 'Limit Trigger Price' : 'Execution Price'}
              </span>
              <span className="font-mono-numeric font-semibold text-slate-900 dark:text-slate-100">{formatINR(effectivePrice)}</span>
            </div>
            <div className="py-2.5 flex justify-between">
              <span className="text-slate-500 dark:text-slate-400">Total Virtual Value</span>
              <span className="font-mono-numeric font-bold text-slate-900 dark:text-slate-100">{formatINR(estimatedTotal)}</span>
            </div>
          </div>

          {orderType === 'LIMIT' && (
            <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2">
              <Info className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                {side === 'BUY'
                  ? `₹${estimatedTotal.toLocaleString('en-IN')} will be reserved from your available cash until the price reaches ₹${effectivePrice}.`
                  : `${quantity} shares will be reserved until the price reaches ₹${effectivePrice}.`
                } Processing occurs while app is open.
              </span>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-3">
            <Button
              type="button"
              variant="outline"
              size="md"
              onClick={() => setStep('form')}
              disabled={isSubmitting}
            >
              Back
            </Button>
            <Button
              type="button"
              variant={side === 'BUY' ? 'primary' : 'danger'}
              size="md"
              isLoading={isSubmitting}
              onClick={handleFinalSubmit}
            >
              Confirm Virtual {side}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
};
