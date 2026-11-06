"use client";

import { useId, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";

type Props = {
  value: string;
  onChange: (value: string) => void;
  options: readonly string[];
  label: string;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  style?: CSSProperties;
};

/** Shared accessible autocomplete for canonical reference-data choices. */
export default function SearchableSelect({ value, onChange, options, label, placeholder = "Search or select…", disabled = false, required = false, style }: Props) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const choices = useMemo(() => {
    const unique = [...new Set([...options, ...(value && !options.includes(value) ? [value] : [])])];
    const key = query.trim().toLocaleLowerCase();
    return (key ? unique.filter(item => item.toLocaleLowerCase().includes(key)) : unique).slice(0, 30);
  }, [options, query, value]);

  function select(next: string) {
    onChange(next);
    setQuery("");
    setOpen(false);
    setActive(0);
  }
  function keyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") { setOpen(false); setQuery(""); return; }
    if (event.key === "ArrowDown") { event.preventDefault(); setOpen(true); setActive(i => Math.min(i + 1, choices.length - 1)); }
    if (event.key === "ArrowUp") { event.preventDefault(); setOpen(true); setActive(i => Math.max(0, i - 1)); }
    if (event.key === "Enter" && open && choices.length) { event.preventDefault(); select(choices[Math.max(0, active)]); }
  }
  return (
    <div style={{ position: "relative", width: "100%", minWidth: 0 }} onBlur={event => {
      if (!event.currentTarget.contains(event.relatedTarget)) { setOpen(false); setQuery(""); }
    }}>
      <input
        ref={input}
        role="combobox"
        aria-label={label}
        aria-expanded={open}
        aria-controls={id}
        aria-autocomplete="list"
        aria-activedescendant={open && choices.length ? `${id}-option-${active}` : undefined}
        autoComplete="off"
        disabled={disabled}
        required={required}
        value={open ? query : value}
        placeholder={value || placeholder}
        onFocus={() => { setQuery(""); setActive(0); setOpen(true); }}
        onClick={() => { if (!disabled) setOpen(true); }}
        onChange={event => { setQuery(event.target.value); setActive(0); setOpen(true); }}
        onKeyDown={keyDown}
        style={{ width: "100%", boxSizing: "border-box", minHeight: 42, border: "1px solid #b8c3d0", borderRadius: 9, padding: "10px 34px 10px 12px", fontSize: 15, background: "#fff", color: "#182230", ...style }}
      />
      <button type="button" aria-label={open ? "Close suggestions" : "Show choices"} disabled={disabled} onMouseDown={event => event.preventDefault()} onClick={() => { if (open) { setOpen(false); input.current?.blur(); } else { input.current?.focus(); } }} style={{ position: "absolute", top: 2, right: 2, height: 36, width: 31, border: 0, background: "transparent", color: "#475467", cursor: "pointer" }}>⌄</button>
      {open && !disabled && (
        <div id={id} role="listbox" aria-label={`${label} options`} style={{ position: "absolute", zIndex: 100, top: "calc(100% + 4px)", left: 0, right: 0, maxHeight: 240, overflowY: "auto", border: "1px solid #cbd5e1", borderRadius: 10, boxShadow: "0 8px 22px rgba(0,0,0,.14)", background: "#fff" }}>
          {!choices.length && <div style={{ padding: 12, color: "#667085" }}>No matching results</div>}
          {choices.map((choice, index) => (
            <button type="button" id={`${id}-option-${index}`} role="option" aria-selected={choice === value} key={choice} onMouseEnter={() => setActive(index)} onMouseDown={event => event.preventDefault()} onClick={() => select(choice)} style={{ display: "block", width: "100%", textAlign: "left", padding: "11px 12px", border: 0, borderBottom: "1px solid #f2f4f7", background: index === active ? "#eef4ff" : "#fff", color: "#182230", cursor: "pointer", fontSize: 14 }}>{choice}</button>
          ))}
        </div>
      )}
    </div>
  );
}
