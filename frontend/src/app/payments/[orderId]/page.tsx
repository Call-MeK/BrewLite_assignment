import { PaymentCheckout } from '@/components/payments/PaymentCheckout';

export default async function PaymentPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  return <PaymentCheckout orderId={orderId} />;
}
