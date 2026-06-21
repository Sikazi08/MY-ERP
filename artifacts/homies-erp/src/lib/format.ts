import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";

export function formatFCFA(amount: number | null | undefined): string {
  if (amount == null) return "0 FCFA";
  return new Intl.NumberFormat("fr-FR", {
    style: "decimal",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount) + " FCFA";
}

export function formatDateFr(dateString: string | null | undefined): string {
  if (!dateString) return "";
  try {
    const date = parseISO(dateString);
    return format(date, "dd/MM/yyyy", { locale: fr });
  } catch (e) {
    return dateString;
  }
}

export function formatDateTimeFr(dateString: string | null | undefined, timeString?: string | null | undefined): string {
  const d = formatDateFr(dateString);
  if (!timeString) return d;
  return `${d} à ${timeString.substring(0, 5)}`;
}
