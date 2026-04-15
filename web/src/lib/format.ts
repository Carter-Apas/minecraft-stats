export function formatDuration(hours: number) {
  if (hours < 1) {
    return `${Math.round(hours * 60)}m`;
  }

  if (hours < 24) {
    return `${hours.toFixed(1)}h`;
  }

  const days = Math.floor(hours / 24);
  const remainder = hours - (days * 24);
  if (remainder < 1) {
    return `${days}d`;
  }
  return `${days}d ${Math.round(remainder)}h`;
}

export function formatDistance(kilometers: number) {
  if (kilometers < 1) {
    return `${Math.round(kilometers * 1000)} m`;
  }
  return `${kilometers.toFixed(1)} km`;
}

export function formatNumber(value: number) {
  return new Intl.NumberFormat("en-NZ", {
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatCompactNumber(value: number) {
  return new Intl.NumberFormat("en-NZ", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

export function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`;
}

export function formatDate(value: string | null) {
  if (!value) {
    return "Unknown";
  }
  return new Intl.DateTimeFormat("en-NZ", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

