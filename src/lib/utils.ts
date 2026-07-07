export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(amount);
}

export function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Intl.DateTimeFormat("es-MX", { day: "2-digit", month: "long", year: "numeric" }).format(
    new Date(y, m - 1, d)
  );
}

export function formatTime(timeStr: string): string {
  const [h, m] = timeStr.split(":").map(Number);
  const date = new Date();
  date.setHours(h, m, 0);
  return new Intl.DateTimeFormat("es-MX", { hour: "numeric", minute: "2-digit", hour12: true }).format(date);
}

export const COMMENT_MAX_LENGTH = 300;
export const NAME_MAX_LENGTH = 120;

// ---------- Horario de atención del consultorio ----------
// Lunes a sábado, 9:00 a.m. a 6:00 p.m., citas cada hora en punto. Cerrado domingo.
export const BUSINESS_OPEN_HOUR = 9;
export const BUSINESS_CLOSE_HOUR = 18;
export const CLOSED_WEEKDAYS = [0]; // 0 = domingo (Date.getDay())

export function isClosedDay(dateStr: string): boolean {
  const [y, m, d] = dateStr.split("-").map(Number);
  if (!y || !m || !d) return false;
  const day = new Date(y, m - 1, d).getDay();
  return CLOSED_WEEKDAYS.includes(day);
}

export function getBusinessSlots(): string[] {
  const slots: string[] = [];
  for (let h = BUSINESS_OPEN_HOUR; h < BUSINESS_CLOSE_HOUR; h++) {
    slots.push(`${String(h).padStart(2, "0")}:00`);
  }
  return slots;
}

export function sanitizePlainText(input: string, maxLength: number): string {
  // Elimina caracteres de control y recorta longitud. La validación "real"
  // contra inyección ocurre porque siempre usamos consultas parametrizadas
  // (nunca se concatena SQL), esto es una capa extra de higiene de entrada.
  return input.replace(/[<>;]/g, "").slice(0, maxLength);
}

export function isValidPhone(phone: string): boolean {
  return /^[0-9+ ()-]{7,20}$/.test(phone);
}
