"use client";

import { Phone } from "lucide-react";
import {
  DEFAULT_COUNTRY_CODE,
  formatLocalPhoneDisplay,
  parseLocalPhoneDigits,
} from "@/lib/utils";

type Props = {
  id?: string;
  value: string;
  onChange: (localDigits: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  disabled?: boolean;
};

export default function PhoneInput({
  id,
  value,
  onChange,
  placeholder = "98765 43210",
  autoFocus = false,
  disabled = false,
}: Props) {
  function handleChange(raw: string) {
    onChange(parseLocalPhoneDigits(raw));
  }

  return (
    <div className="phone-input-wrap">
      <Phone size={16} className="phone-input-icon" />
      <span className="phone-input-prefix">{DEFAULT_COUNTRY_CODE}</span>
      <input
        id={id}
        type="tel"
        inputMode="numeric"
        placeholder={placeholder}
        value={formatLocalPhoneDisplay(value)}
        onChange={(e) => handleChange(e.target.value)}
        required
        autoFocus={autoFocus}
        disabled={disabled}
        className="phone-input-field"
        aria-label="Phone number"
      />
    </div>
  );
}
