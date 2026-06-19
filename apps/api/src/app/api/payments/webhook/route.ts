import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { db } from "@cheval/db";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature")!;

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch {
    return NextResponse.json({ error: "Webhook signature invalid" }, { status: 400 });
  }

  if (event.type === "payment_intent.succeeded") {
    const pi = event.data.object as Stripe.PaymentIntent;
    await db.payment.updateMany({
      where: { stripePaymentIntentId: pi.id },
      data: { status: "COMPLETED" },
    });
  }

  if (event.type === "payment_intent.payment_failed") {
    const pi = event.data.object as Stripe.PaymentIntent;
    await db.payment.updateMany({
      where: { stripePaymentIntentId: pi.id },
      data: { status: "FAILED" },
    });
  }

  return NextResponse.json({ received: true });
}
