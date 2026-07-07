export type UserRole = "admin" | "dentist";
export type AppointmentStatus = "confirmed" | "completed" | "cancelled";
export type AppointmentSource = "online" | "walk_in";

export interface Profile {
  id: string;
  full_name: string;
  email: string;
  role: UserRole;
  active: boolean;
  created_at: string;
}

export interface Service {
  id: string;
  name: string;
  description: string | null;
  price: number;
  active: boolean;
  created_at: string;
}

export interface Appointment {
  id: string;
  client_name: string;
  client_phone: string;
  appointment_date: string;
  appointment_time: string;
  comment: string | null;
  status: AppointmentStatus;
  source: AppointmentSource;
  dentist_id: string | null;
  created_at: string;
  appointment_services?: { service_id: string; price_at_booking: number; services?: Service }[];
}

export interface TicketItem {
  service_id: string;
  name: string;
  price: number;
}

export interface Ticket {
  id: string;
  appointment_id: string | null;
  dentist_id: string;
  client_name: string;
  items: TicketItem[];
  total: number;
  amount_paid: number;
  change_given: number;
  created_at: string;
}

// Tipo mínimo requerido por @supabase/ssr genérico. No se detallan todas las
// tablas a nivel de tipos generados por simplicidad/ligereza del proyecto.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Database = any;
