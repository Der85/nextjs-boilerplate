// Shared domain types mirroring the Supabase schema.

export type Frequency = "daily" | "weekly";
export type AccountType = "cash" | "investment" | "stock";
export type ReminderType = "meds" | "weight" | "finance";

export interface Medication {
  id: string;
  user_id: string;
  name: string;
  frequency: Frequency;
  dose_unit: string | null;
  days_per_unit: number;
  active: boolean;
  sort_order: number;
  created_at: string;
}

export interface MedicationProvider {
  id: string;
  user_id: string;
  medication_id: string;
  prescriber: string | null;
  pharmacy: string | null;
  contact: string | null;
  notes: string | null;
}

export interface MedicationOrder {
  id: string;
  user_id: string;
  medication_id: string;
  date_ordered: string | null;
  quantity: number | null;
  cost: number | null;
  pharmacy: string | null;
  date_collected: string | null;
  notes: string | null;
  created_at: string;
}

export interface MedicationLog {
  id: string;
  user_id: string;
  medication_id: string;
  log_date: string;
  amount_taken: number;
}

export interface WeightLog {
  id: string;
  user_id: string;
  log_date: string;
  weight_kg: number | null;
}

export interface FinanceAccount {
  id: string;
  user_id: string;
  name: string;
  account_type: AccountType;
  sort_order: number;
  active: boolean;
}

export interface FinanceMonthlyEntry {
  id: string;
  user_id: string;
  account_id: string;
  month: string;
  balance: number | null;
  price_per_unit: number | null;
}

// A medication enriched with derived stock info + today's log, for the meds UI.
export interface MedicationWithStock extends Medication {
  currentStock: number;
  avgPerDay: number;
  daysLeft: number | null;
  stockRunsOut: string | null;
  takenToday: number;
}
