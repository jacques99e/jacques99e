"use client";

import { Phone } from "lucide-react";
import {
  PHONE_COUNTRIES,
  countryByDial,
  readStoredDialCode,
  storeDialCode,
} from "@/lib/phone-countries";
import { useEffect, useId, useState } from "react";

interface PhoneCountryInputProps {
  dialCode: string;
  localNumber: string;
  onDialCodeChange: (dial: string) => void;
  onLocalNumberChange: (value: string) => void;
  disabled?: boolean;
}

export function PhoneCountryInput({
  dialCode,
  localNumber,
  onDialCodeChange,
  onLocalNumberChange,
  disabled,
}: PhoneCountryInputProps) {
  const selectId = useId();
  const inputId = useId();
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (initialized) return;
    const stored = readStoredDialCode();
    if (stored !== dialCode) onDialCodeChange(stored);
    setInitialized(true);
  }, [dialCode, initialized, onDialCodeChange]);

  const country = countryByDial(dialCode);

  const handleDialChange = (next: string) => {
    storeDialCode(next);
    onDialCodeChange(next);
  };

  return (
    <div className="mt-2 flex gap-2">
      <div className="relative shrink-0">
        <label htmlFor={selectId} className="sr-only">
          Indicatif pays
        </label>
        <select
          id={selectId}
          value={dialCode}
          onChange={(e) => handleDialChange(e.target.value)}
          disabled={disabled}
          className="h-full min-h-[3.25rem] appearance-none rounded-xl border border-gray-200 bg-gray-50/50 py-3 pl-3 pr-8 text-sm font-semibold text-[#075E54] shadow-sm outline-none focus:border-wazo-green focus:ring-2 focus:ring-wazo-green/15 disabled:opacity-70"
          aria-label="Indicatif pays"
        >
          {PHONE_COUNTRIES.map((c) => (
            <option key={c.iso} value={c.dial}>
              {c.dial} {c.name}
            </option>
          ))}
        </select>
        <span
          className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-gray-400"
          aria-hidden
        >
          ▼
        </span>
      </div>

      <label htmlFor={inputId} className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-gray-200 bg-gray-50/50 px-4 py-3 shadow-sm focus-within:border-wazo-green focus-within:ring-2 focus-within:ring-wazo-green/15">
        <Phone className="h-5 w-5 shrink-0 text-wazo-green" aria-hidden />
        <input
          id={inputId}
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          value={localNumber}
          onChange={(e) => onLocalNumberChange(e.target.value)}
          placeholder={country.example}
          required
          disabled={disabled}
          className="w-full min-w-0 bg-transparent text-lg outline-none disabled:opacity-70"
          aria-describedby={`${inputId}-hint`}
        />
      </label>
      <p id={`${inputId}-hint`} className="sr-only">
        Saisissez votre numéro sans l&apos;indicatif {dialCode}, par exemple {country.example}
      </p>
    </div>
  );
}
