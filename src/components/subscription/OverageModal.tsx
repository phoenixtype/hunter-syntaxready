import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { CreditCard, CheckCircle2, Calculator, Clock, Info } from 'lucide-react';
import { useSubscription } from '@/hooks/useSubscription';
import { FeatureName, FEATURE_DISPLAY_NAMES, FEATURE_DESCRIPTIONS } from '@/types/subscription';
import { toast } from 'sonner';
import { Alert, AlertDescription } from "@/components/ui/alert";

interface OverageModalProps {
  featureName: FeatureName;
  open: boolean;
  onClose: () => void;
}

const SUGGESTED_QUANTITIES = [5, 10, 25, 50, 100];

export function OverageModal({ featureName, open, onClose }: OverageModalProps) {
  const [quantity, setQuantity] = useState(10);
  const [quote, setQuote] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [purchasing, setPurchasing] = useState(false);

  const { getOverageQuote, purchaseOverage, usageOverview } = useSubscription();

  // Get current feature usage info
  const featureInfo = usageOverview?.features.find(f => f.feature_name === featureName);

  // Calculate quote when quantity changes
  useEffect(() => {
    if (open && quantity > 0) {
      loadQuote();
    }
  }, [quantity, open, featureName]);

  const loadQuote = async () => {
    setLoading(true);
    try {
      const newQuote = await getOverageQuote(featureName, quantity);
      setQuote(newQuote);
    } catch (error: any) {
      console.error('Error getting quote:', error);
      toast.error('Failed to calculate price', {
        description: error.message
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePurchase = async () => {
    if (!quote) return;

    setPurchasing(true);
    try {
      // In a real implementation, you would integrate with Stripe here
      // For now, we'll simulate the payment process

      // Create a mock payment intent ID
      const mockPaymentIntentId = `pi_mock_${Date.now()}`;

      await purchaseOverage({
        featureName,
        quantity,
        paymentIntentId: mockPaymentIntentId
      });

      toast.success(`Successfully purchased ${quantity} ${FEATURE_DISPLAY_NAMES[featureName]} credits!`, {
        description: 'Your credits are now available for use.'
      });

      onClose();
    } catch (error: any) {
      console.error('Error purchasing overage:', error);
      toast.error('Failed to purchase credits', {
        description: error.message
      });
    } finally {
      setPurchasing(false);
    }
  };

  const calculateSavings = (qty: number) => {
    if (!quote) return null;
    const standardCost = qty * quote.unit_price;
    const bulkPrice = qty >= 50 ? quote.unit_price * 0.9 : qty >= 25 ? quote.unit_price * 0.95 : quote.unit_price;
    const bulkCost = qty * bulkPrice;
    const savings = standardCost - bulkCost;
    return savings > 0 ? savings : null;
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(amount);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-blue-600" />
            Purchase {FEATURE_DISPLAY_NAMES[featureName]} Credits
          </DialogTitle>
          <DialogDescription>
            {FEATURE_DESCRIPTIONS[featureName]}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Current Usage Status */}
          {featureInfo && (
            <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Info className="w-4 h-4 text-blue-600" />
                <span className="font-medium text-blue-900 dark:text-blue-100">Current Status</span>
              </div>
              <div className="text-sm text-blue-700 dark:text-blue-200 space-y-1">
                <div>Used: {featureInfo.current_usage} / {featureInfo.limit_amount}</div>
                <div>Remaining: {featureInfo.remaining_amount}</div>
                {featureInfo.overage_credits > 0 && (
                  <div>Overage credits: {featureInfo.overage_credits}</div>
                )}
              </div>
            </div>
          )}

          {/* Quantity Selection */}
          <div className="space-y-3">
            <Label htmlFor="quantity">How many credits do you need?</Label>

            {/* Suggested quantities */}
            <div className="flex flex-wrap gap-2">
              {SUGGESTED_QUANTITIES.map((qty) => (
                <Button
                  key={qty}
                  variant={quantity === qty ? "default" : "outline"}
                  size="sm"
                  onClick={() => setQuantity(qty)}
                >
                  {qty}
                </Button>
              ))}
            </div>

            {/* Custom quantity input */}
            <div className="flex gap-2">
              <Input
                id="quantity"
                type="number"
                min="1"
                max="1000"
                value={quantity}
                onChange={(e) => setQuantity(parseInt(e.target.value) || 0)}
                placeholder="Custom amount"
              />
              <Button variant="outline" size="icon" onClick={loadQuote} disabled={loading}>
                <Calculator className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Price Quote */}
          {quote && (
            <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span>Unit Price:</span>
                  <span>{formatCurrency(quote.unit_price)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Quantity:</span>
                  <span>{quote.quantity} credits</span>
                </div>

                {calculateSavings(quantity) && (
                  <div className="flex justify-between text-green-600">
                    <span>Bulk Discount:</span>
                    <span>-{formatCurrency(calculateSavings(quantity)!)}</span>
                  </div>
                )}

                <Separator />
                <div className="flex justify-between font-medium text-lg">
                  <span>Total:</span>
                  <span>{formatCurrency(quote.total_cost)}</span>
                </div>
              </div>

              {/* Credit expiration info */}
              <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="w-4 h-4" />
                Credits expire in 1 year
              </div>
            </div>
          )}

          {/* Bulk Discount Notice */}
          {quantity >= 25 && (
            <Alert>
              <CheckCircle2 className="h-4 w-4" />
              <AlertDescription>
                {quantity >= 50
                  ? "🎉 10% bulk discount applied!"
                  : "💰 5% bulk discount applied!"
                }
              </AlertDescription>
            </Alert>
          )}

          {/* Usage Tips */}
          <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-3">
            <h4 className="font-medium text-sm mb-2">💡 Smart Usage Tips:</h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• Credits don't expire for 1 year</li>
              <li>• Buy in bulk for better value</li>
              <li>• Consider upgrading your plan for unlimited access</li>
            </ul>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={purchasing}>
            Cancel
          </Button>
          <Button
            onClick={handlePurchase}
            disabled={!quote || quantity <= 0 || loading || purchasing}
          >
            {purchasing ? (
              "Processing..."
            ) : quote ? (
              `Purchase for ${formatCurrency(quote.total_cost)}`
            ) : (
              "Calculate Price"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}