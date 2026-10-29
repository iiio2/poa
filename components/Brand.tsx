// Placeholder brand for the demo wallet app. Replace with your own.
export default function Brand({ size = "md" }: { size?: "md" | "lg" }) {
  const text = size === "lg" ? "text-2xl" : "text-lg";
  const dot = size === "lg" ? "h-7 w-7" : "h-5 w-5";
  return (
    <div className="flex items-center gap-2">
      <span
        className={`${dot} inline-flex items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 text-xs font-bold text-white`}
        aria-hidden
      >
        P
      </span>
      <span className={`${text} font-semibold tracking-tight text-black dark:text-zinc-50`}>
        Pay<span className="text-indigo-500">Mock</span>
      </span>
    </div>
  );
}
