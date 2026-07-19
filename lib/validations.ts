import { z } from "zod";

// POST /api/meds — log today's dose for a medication.
export const medLogSchema = z.object({
  medication_id: z.string().uuid(),
  amount_taken: z.number().min(0).max(50),
  log_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

// POST /api/weight — upsert today's weight.
export const weightSchema = z.object({
  weight_kg: z.number().positive().max(500),
  log_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

// POST /api/finance — upsert this month's entry for an account.
export const financeSchema = z.object({
  account_id: z.string().uuid(),
  month: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  balance: z.number().nullable().optional(),
  price_per_unit: z.number().nullable().optional(),
});

// POST /api/providers — upsert provider info for a medication.
export const providerSchema = z.object({
  medication_id: z.string().uuid(),
  prescriber: z.string().max(200).nullable().optional(),
  pharmacy: z.string().max(200).nullable().optional(),
  contact: z.string().max(200).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
});

// POST /api/orders — log a reorder.
export const orderSchema = z.object({
  medication_id: z.string().uuid(),
  date_ordered: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  quantity: z.number().min(0).nullable().optional(),
  cost: z.number().min(0).nullable().optional(),
  pharmacy: z.string().max(200).nullable().optional(),
  date_collected: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
});

// POST /api/push/subscribe — store a push subscription.
export const pushSubscribeSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string(),
    auth: z.string(),
  }),
});
