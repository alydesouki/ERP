const dateTimeFormatter = new Intl.DateTimeFormat("ar-EG", {
  year: "numeric",
  month: "long",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const dateFormatter = new Intl.DateTimeFormat("ar-EG", {
  year: "numeric",
  month: "long",
  day: "numeric",
});

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return dateTimeFormatter.format(date);
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return dateFormatter.format(date);
}
