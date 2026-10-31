import { supabase } from "./supabase";
import type { AgeRange, Animal, AnimalEvent, Category, Establishment, InitialStock, Member, Membership, Movement, Role } from "./types";

// Mismas consultas y funciones que usa la app Android, para trabajar sobre los mismos datos.

const PAGE = 1000;
async function all<T>(query: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>) {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await query(from, from + PAGE - 1);
    if (error) throw error;
    out.push(...(data ?? []));
    if (!data || data.length < PAGE) return out;
  }
}

export async function loadEstablishments() {
  const { data: memberships, error } = await supabase.from("simple_stock_establishment_users").select("establishment_id,role,created_at").order("created_at");
  if (error) throw error;
  const ids = (memberships ?? []).map((m) => m.establishment_id);
  if (!ids.length) return { establishments: [] as Establishment[], roles: {} as Record<string, Role> };
  const { data, error: e2 } = await supabase.from("simple_stock_establishments").select("id,name,producer_name,inventory_date,created_by,updated_at").in("id", ids);
  if (e2) throw e2;
  return {
    establishments: ((data ?? []) as Establishment[]).sort((a, b) => a.name.localeCompare(b.name)),
    roles: Object.fromEntries((memberships as Membership[]).map((m) => [m.establishment_id, m.role])) as Record<string, Role>,
  };
}

export async function loadStockData(id: string) {
  const [cats, initial, ranges] = await Promise.all([
    supabase.from("simple_stock_categories").select("id,establishment_id,name,technical_group,sort_order,active,updated_at").eq("establishment_id", id).order("sort_order"),
    supabase.from("simple_stock_initial_stock").select("id,establishment_id,category_id,sexo,cantidad,inventory_date,updated_at").eq("establishment_id", id),
    supabase.from("simple_stock_animal_age_ranges").select("id,establishment_id,label,min_days,max_days,sort_order,active").eq("establishment_id", id).order("sort_order"),
  ]);
  const error = cats.error ?? initial.error;
  if (error) throw error;
  const movements = await all<Movement>((from, to) => supabase.from("simple_stock_movements")
    .select("id,establishment_id,origin_category_id,destination_category_id,fecha,hora,tipo,origen,destino,sexo,cantidad,rp,causa,responsable,observacion,updated_at,deleted_at")
    .eq("establishment_id", id).is("deleted_at", null).order("fecha").order("id").range(from, to));
  return {
    categories: (cats.data ?? []) as Category[],
    initial: ((initial.data ?? []) as InitialStock[]).map((r) => ({ ...r, cantidad: Number(r.cantidad) || 0 })),
    ageRanges: (ranges.error ? [] : ranges.data ?? []) as AgeRange[],
    movements: movements.map((m) => ({ ...m, cantidad: Number(m.cantidad) || 0 })),
  };
}

export async function upsertMovements(rows: Movement[]) {
  for (let i = 0; i < rows.length; i += 100) {
    const { error } = await supabase.from("simple_stock_movements").upsert(rows.slice(i, i + 100).map((m) => ({ ...m, cantidad: Math.round(m.cantidad) })), { onConflict: "id" });
    if (error) throw error;
  }
}

export async function createEstablishment(name: string, producer: string, inventoryDate: string, categories: { name: string; technical_group: string | null; sort_order: number; h: number; m: number }[]) {
  const { data, error } = await supabase.rpc("simple_stock_create_establishment", { p_name: name, p_producer_name: producer || null, p_inventory_date: inventoryDate, p_categories: categories });
  if (error) throw error;
  return data as string | { id: string } | null;
}

export async function updateEstablishment(id: string, values: { name: string; producer_name: string | null; inventory_date: string }) {
  const now = new Date().toISOString();
  const { error } = await supabase.from("simple_stock_establishments").update({ ...values, updated_at: now }).eq("id", id);
  if (error) throw error;
  const { error: e2 } = await supabase.from("simple_stock_initial_stock").update({ inventory_date: values.inventory_date, updated_at: now }).eq("establishment_id", id);
  if (e2) throw e2;
}

export async function addCategory(establishmentId: string, name: string, group: string | null, order: number) {
  const { error } = await supabase.rpc("simple_stock_add_category", { p_establishment_id: establishmentId, p_name: name, p_technical_group: group, p_sort_order: order });
  if (error) throw error;
}
export async function updateCategory(id: string, values: Pick<Category, "name" | "technical_group" | "sort_order" | "active">) {
  const { error } = await supabase.from("simple_stock_categories").update({ ...values, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) throw error;
}
export async function setInitialStock(establishmentId: string, categoryId: string, h: number, m: number, inventoryDate: string) {
  const { error } = await supabase.rpc("simple_stock_set_initial_stock", { p_establishment_id: establishmentId, p_category_id: categoryId, p_h: Math.round(h), p_m: Math.round(m), p_inventory_date: inventoryDate });
  if (error) throw error;
}
export async function replaceAgeRanges(establishmentId: string, ranges: AgeRange[]) {
  const payload = ranges.map((r, i) => ({ label: r.label, min_days: r.min_days, max_days: r.max_days, sort_order: i + 1, active: r.active }));
  const { error } = await supabase.rpc("simple_stock_replace_age_ranges", { p_establishment_id: establishmentId, p_ranges: payload });
  if (error) throw error;
}

export async function listMembers(establishmentId: string) {
  const { data, error } = await supabase.rpc("simple_stock_list_members", { p_establishment_id: establishmentId });
  if (error) throw error;
  return (data ?? []) as Member[];
}
export async function addMember(establishmentId: string, email: string, role: Role) {
  const { error } = await supabase.rpc("simple_stock_add_member_by_email", { p_establishment_id: establishmentId, p_email: email, p_role: role });
  if (error) throw error;
}
export async function removeMember(establishmentId: string, userId: string) {
  const { error } = await supabase.rpc("simple_stock_remove_member", { p_establishment_id: establishmentId, p_user_id: userId });
  if (error) throw error;
}

export async function loadAnimals(establishmentId: string) {
  const [animals, events] = await Promise.all([
    all<Animal>((from, to) => supabase.from("simple_stock_animals").select("id,establishment_id,tag,electronic_tag,sexo,birth_date,mother_tag,father_tag,origin,current_category_id,lot,status,birth_weight,notes,created_by,updated_at,deleted_at").eq("establishment_id", establishmentId).is("deleted_at", null).order("tag").range(from, to)),
    all<AnimalEvent>((from, to) => supabase.from("simple_stock_animal_events").select("id,animal_id,establishment_id,event_date,event_time,event_type,category_from_id,category_to_id,weight,cause,responsible,notes,movement_id,created_by,updated_at,deleted_at").eq("establishment_id", establishmentId).is("deleted_at", null).order("event_date", { ascending: false }).range(from, to)),
  ]);
  return { animals, events };
}
export async function upsertAnimal(a: Animal) {
  const { error } = await supabase.from("simple_stock_animals").upsert(a, { onConflict: "id" });
  if (error) throw error;
}
export async function upsertAnimalEvent(e: AnimalEvent) {
  const { error } = await supabase.from("simple_stock_animal_events").upsert(e, { onConflict: "id" });
  if (error) throw error;
}
