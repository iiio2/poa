import { useEffect, useRef } from "react";

type Props = {
  length?: number;
  value: string;
  onChange: (value: string) => void;
  onComplete?: (value: string) => void;
  disabled?: boolean;
  invalid?: boolean;
  errorId?: string;
  /** Focus the first box on mount and whenever `focusSignal` changes. */
  autoFocus?: boolean;
  focusSignal?: number;
};

// Auto-advancing OTP boxes: typing moves forward, Backspace moves back,
// and paste distributes digits across the boxes.
export default function OtpInput({
  length = 6,
  value,
  onChange,
  onComplete,
  disabled,
  invalid,
  errorId,
  autoFocus,
  focusSignal = 0,
}: Props) {
  const inputs = useRef<Array<HTMLInputElement | null>>([]);

  const digits = Array.from({ length }, (_, i) => value[i] ?? "");

  useEffect(() => {
    // focusSignal is in deps intentionally: bumping it re-focuses the first box.
    if (autoFocus) inputs.current[0]?.focus();
    // oxlint-disable-next-line react/exhaustive-effect-dependencies
  }, [autoFocus, focusSignal]);

  function setDigit(index: number, digit: string) {
    const next = value.split("");
    next[index] = digit;
    const joined = next.join("").slice(0, length);
    onChange(joined);
    if (joined.length === length && !joined.includes("") && onComplete) {
      onComplete(joined);
    }
  }

  function handleChange(index: number, raw: string) {
    const digit = raw.replace(/\D/g, "").slice(-1);
    if (!digit) return;
    setDigit(index, digit);
    if (index < length - 1) inputs.current[index + 1]?.focus();
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace") {
      e.preventDefault();
      if (digits[index]) {
        setDigit(index, "");
      } else if (index > 0) {
        inputs.current[index - 1]?.focus();
        setDigit(index - 1, "");
      }
    } else if (e.key === "ArrowLeft" && index > 0) {
      inputs.current[index - 1]?.focus();
    } else if (e.key === "ArrowRight" && index < length - 1) {
      inputs.current[index + 1]?.focus();
    }
  }

  function handlePaste(e: React.ClipboardEvent<HTMLInputElement>) {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, length);
    if (!pasted) return;
    onChange(pasted);
    const focusIndex = Math.min(pasted.length, length - 1);
    inputs.current[focusIndex]?.focus();
    if (pasted.length === length && onComplete) onComplete(pasted);
  }

  return (
    <div
      className="flex justify-between gap-2"
      role="group"
      aria-label="One-time code"
      aria-invalid={invalid || undefined}
      aria-describedby={invalid && errorId ? errorId : undefined}
    >
      {digits.map((digit, i) => (
        <input
          key={i}
          ref={(el) => {
            inputs.current[i] = el;
          }}
          type="text"
          inputMode="numeric"
          autoComplete={i === 0 ? "one-time-code" : "off"}
          maxLength={1}
          value={digit}
          disabled={disabled}
          aria-label={`Digit ${i + 1}`}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onPaste={handlePaste}
          className={`h-12 w-11 rounded-xl border bg-transparent text-center text-lg font-semibold text-black outline-none transition-colors focus:ring-2 focus:ring-indigo-500/30 disabled:opacity-50 dark:text-zinc-50 ${
            invalid
              ? "border-red-400 focus:border-red-500"
              : "border-black/[.12] focus:border-indigo-500 dark:border-white/[.16]"
          }`}
        />
      ))}
    </div>
  );
}
