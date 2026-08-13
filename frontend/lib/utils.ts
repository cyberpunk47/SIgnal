import { format, isToday, isYesterday, formatDistanceToNow } from "date-fns";

function parseBackendTimestamp(timestamp: string): Date {
  const hasTimezone = /([zZ]|[+-]\d\d:\d\d)$/.test(timestamp);
  return new Date(hasTimezone ? timestamp : `${timestamp}Z`);
}

/**
 * Format a timestamp for the conversation list (Signal-style):
 * - Today: "3:45 PM"
 * - Yesterday: "Yesterday"
 * - This week: "Mon"
 * - Older: "12/25/24"
 */
export function formatConversationTime(timestamp: string | null): string {
  if (!timestamp) return "";
  const date = parseBackendTimestamp(timestamp);
  if (isNaN(date.getTime())) return "";

  if (isToday(date)) return format(date, "h:mm a");
  if (isYesterday(date)) return "Yesterday";

  const daysDiff = (Date.now() - date.getTime()) / (1000 * 60 * 60 * 24);
  if (daysDiff < 7) return format(date, "EEE");

  return format(date, "M/d/yy");
}

/**
 * Format a timestamp for inside a chat bubble:
 * "3:45 PM"
 */
export function formatMessageTime(timestamp: string): string {
  const date = parseBackendTimestamp(timestamp);
  return format(date, "h:mm a");
}

/**
 * Format a date separator inside a chat:
 * "Today", "Yesterday", "December 25, 2024"
 */
export function formatDateSeparator(timestamp: string): string {
  const date = parseBackendTimestamp(timestamp);
  if (isToday(date)) return "Today";
  if (isYesterday(date)) return "Yesterday";
  return format(date, "MMMM d, yyyy");
}

/**
 * Format last seen time in a human-readable way
 */
export function formatLastSeen(lastSeenAt: string | null): string {
  if (!lastSeenAt) return "last seen a while ago";
  const date = parseBackendTimestamp(lastSeenAt);
  if (isToday(date)) return `last seen today at ${format(date, "h:mm a")}`;
  if (isYesterday(date)) return `last seen yesterday at ${format(date, "h:mm a")}`;
  return `last seen ${formatDistanceToNow(date, { addSuffix: true })}`;
}

/**
 * Generate a unique client_temp_id for optimistic messaging
 */
export function generateTempId(): string {
  return `temp_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

/**
 * Get initials from a display name for avatar fallback
 */
export function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

/**
 * Generate a consistent color for a user based on their ID
 */
const AVATAR_COLORS = [
  "#3a76f0", "#e17055", "#6c5ce7", "#00b894",
  "#fd79a8", "#fdcb6e", "#74b9ff", "#a29bfe",
  "#55efc4", "#fab1a0",
];

export function getAvatarColor(userId: number): string {
  return AVATAR_COLORS[userId % AVATAR_COLORS.length];
}

/**
 * Check if two dates are on the same day (for date separators)
 */
export function isSameDay(a: string, b: string): boolean {
  const da = new Date(a);
  const db = new Date(b);
  return (
    da.getFullYear() === db.getFullYear() &&
    da.getMonth() === db.getMonth() &&
    da.getDate() === db.getDate()
  );
}

/**
 * Truncate a string with ellipsis
 */
export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 1) + "…";
}

/** Default country code for Indian phone numbers */
export const DEFAULT_COUNTRY_CODE = "+91";

/** Strip non-digits and limit to 10 digits (local part) */
export function parseLocalPhoneDigits(value: string): string {
  return value.replace(/\D/g, "").slice(0, 10);
}

/** Format local digits as "XXXXX XXXXX" */
export function formatLocalPhoneDisplay(digits: string): string {
  const cleaned = parseLocalPhoneDigits(digits);
  if (cleaned.length <= 5) return cleaned;
  return `${cleaned.slice(0, 5)} ${cleaned.slice(5)}`;
}

/** Build full E.164-style phone number with +91 prefix */
export function buildFullPhoneNumber(localDigits: string): string {
  const cleaned = parseLocalPhoneDigits(localDigits);
  return `${DEFAULT_COUNTRY_CODE}${cleaned}`;
}

/** Check if local phone has enough digits to submit */
export function isValidLocalPhone(digits: string): boolean {
  return parseLocalPhoneDigits(digits).length >= 10;
}
