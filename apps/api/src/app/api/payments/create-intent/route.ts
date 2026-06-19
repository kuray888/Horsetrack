import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { z } from "zod";
import { db } from "@cheval/db";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

const schema = z.object({
  amount: z.number().int().positive(),
  currency: z.string().default("eur"),
  userId: z.string(),
});

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  const { amount, currency, userId } = parsed.data;

  const paymentIntent = await stripe.paymentIntents.create({
    amount,
    currency,
    payment_method_types: ["card", "apple_pay"],
  });

  await db.payment.create({
    data: {
      userId,
      amount,
      currency: currency.toUpperCase(),
      method: "APPLE_PAY",
      status: "PENDING",
      stripePaymentIntentId: paymentIntent.id,
    },
  });

  return NextResponse.json({ clientSecret: paymentIntent.client_secret });
}
