import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { useTrading } from '../../context/TradingContext';
import { RotateCcw, AlertTriangle } from 'lucide-react';

interface ResetAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ResetAccountModal: React.FC<ResetAccountModalProps> = ({ isOpen, onClose }) => {
  const { resetAccount } = useTrading();
  const [isLoading, setIsLoading] = useState(false);

  const handleReset = async () => {
    setIsLoading(true);
    try {
      await resetAccount();
      onClose();
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Reset Demo Account"
      description="Restore default ₹1,00,000 virtual balance"
      maxWidth="sm"
    >
      <div className="space-y-4">
        <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
            This action will reset your virtual cash back to <strong>₹1,00,000</strong> and permanently erase all current holdings, order history, and trade transactions in your demo account.
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          <Button variant="outline" size="md" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button
            variant="danger"
            size="md"
            isLoading={isLoading}
            onClick={handleReset}
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            Reset to ₹1,00,000
          </Button>
        </div>
      </div>
    </Modal>
  );
};
