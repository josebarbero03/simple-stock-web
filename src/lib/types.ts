// Tablas existentes de SInPLe Stock en Supabase (las mismas que usa la app Android).

export type Role = "owner" | "manager" | "operator" | "viewer";
export type Sex = "H" | "M";

export type Establishment = { id: string; name: string; producer_name: string | null; inventory_date: string; created_by: string | null; updated_at: string };
export type Membership = { establishment_id: string; role: Role; created_at: string };
export type Member = { user_id: string; email: string | null; display_name: string | null; role: Role };

export type Category = { id: string; establishment_id: string; name: string; technical_group: string | null; sort_order: number; active: boolean; updated_at: string };
export type InitialStock = { id: string; establishment_id: string; category_id: string; sexo: Sex; cantidad: number; inventory_date: string; updated_at: string };

export type MovementType = "Nacimiento" | "Compra" | "Traslado interno" | "Venta" | "Muerte" | "Descarte" | "Ingreso ajuste" | "Egreso ajuste";
export type Movement = {
  id: string;
  establishment_id: string;
  origin_category_id: string | null;
  destination_category_id: string | null;
  fecha: string;
  hora: string | null;
  tipo: MovementType;
  origen: string | null;
  destino: string | null;
  sexo: Sex;
  cantidad: number;
  rp: string | null;
  causa: string | null;
  responsable: string | null;
  observacion: string | null;
  updated_at: string;
  deleted_at: string | null;
};

export type AgeRange = { id?: string; establishment_id?: string; label: string; min_days: number; max_days: number | null; sort_order: number; active: boolean };

export type Animal = {
  id: string;
  establishment_id: string;
  tag: string;
  electronic_tag: string | null;
  sexo: Sex;
  birth_date: string;
  mother_tag: string | null;
  father_tag: string | null;
  origin: string;
  current_category_id: string | null;
  lot: string | null;
  status: string;
  birth_weight: number | null;
  notes: string | null;
  created_by: string | null;
  updated_at: string;
  deleted_at: string | null;
};
export type AnimalEvent = {
  id: string;
  animal_id: string;
  establishment_id: string;
  event_date: string;
  event_time: string | null;
  event_type: string;
  category_from_id: string | null;
  category_to_id: string | null;
  weight: number | null;
  cause: string | null;
  responsible: string | null;
  notes: string | null;
  movement_id: string | null;
  created_by: string | null;
  updated_at: string;
  deleted_at: string | null;
};
