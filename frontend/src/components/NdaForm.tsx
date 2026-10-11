"use client";

import { useId, type ReactNode } from "react";
import type { NdaFormData, PartyInfo } from "@/lib/nda/types";

// Width is set per use: Tailwind can't reliably override one width utility with another in the same class list.
const inputClass =
  "rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-sky-700 focus:ring-2 focus:ring-sky-700 focus:outline-none disabled:bg-slate-100 disabled:text-slate-400";

interface TextFieldProps {
  label: string;
  hint?: string;
  value: string;
  onChange: (value: string) => void;
  /** Renders a multi-line textarea with this many rows. */
  rows?: number;
  type?: "text" | "date";
}

/** A labelled text input, or a textarea when `rows` is given. */
function TextField({ label, hint, value, onChange, rows, type = "text" }: TextFieldProps) {
  const id = useId();
  const props = {
    id,
    value,
    onChange: (e: { target: { value: string } }) => onChange(e.target.value),
    "aria-describedby": hint ? `${id}-hint` : undefined,
    className: `${inputClass} w-full`,
  };
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-sm font-medium text-slate-800">
        {label}
      </label>
      {rows ? <textarea rows={rows} {...props} /> : <input type={type} {...props} />}
      {hint && (
        <p id={`${id}-hint`} className="text-xs text-slate-500">
          {hint}
        </p>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="space-y-4 border-t border-slate-200 pt-5">
      <legend className="pr-2 text-xs font-semibold tracking-wide text-slate-500 uppercase">{title}</legend>
      {children}
    </fieldset>
  );
}

interface TermChoiceProps {
  name: string;
  /** Whether the "fixed number of years" option is selected. */
  isYears: boolean;
  onSelectYears: () => void;
  years: string;
  onYearsChange: (years: string) => void;
  /** Text before and after the years input, e.g. "Expires" / "year(s) from Effective Date". */
  yearsPrefix?: string;
  yearsSuffix: string;
  otherLabel: string;
  onSelectOther: () => void;
}

/** A pair of radio options: "N year(s)" (with a number input) or an open-ended alternative. */
function TermChoice(props: TermChoiceProps) {
  const radioClass = "flex items-center gap-2 text-sm text-slate-800";
  return (
    <div className="space-y-2">
      <label className={radioClass}>
        <input
          type="radio"
          name={props.name}
          checked={props.isYears}
          onChange={props.onSelectYears}
          className="accent-sky-600"
        />
        {props.yearsPrefix}
        <input
          type="number"
          min={1}
          step={1}
          inputMode="numeric"
          aria-label={`${props.name} in years`}
          value={props.years}
          disabled={!props.isYears}
          onChange={(e) => props.onYearsChange(e.target.value)}
          className={`${inputClass} w-20`}
        />
        {props.yearsSuffix}
      </label>
      <label className={radioClass}>
        <input
          type="radio"
          name={props.name}
          checked={!props.isYears}
          onChange={props.onSelectOther}
          className="accent-sky-600"
        />
        {props.otherLabel}
      </label>
    </div>
  );
}

const PARTY_FIELDS: { key: keyof PartyInfo; label: string; hint?: string; rows?: number }[] = [
  { key: "name", label: "Print Name" },
  { key: "title", label: "Title" },
  { key: "company", label: "Company" },
  { key: "noticeAddress", label: "Notice Address", hint: "Email or postal address", rows: 2 },
];

interface NdaFormProps {
  data: NdaFormData;
  onChange: (data: NdaFormData) => void;
}

export function NdaForm({ data, onChange }: NdaFormProps) {
  const set = <K extends keyof NdaFormData>(key: K, value: NdaFormData[K]) => onChange({ ...data, [key]: value });

  const setParty = (index: 0 | 1, key: keyof PartyInfo, value: string) => {
    const parties: NdaFormData["parties"] = [...data.parties];
    parties[index] = { ...parties[index], [key]: value };
    set("parties", parties);
  };

  return (
    <form className="space-y-6" onSubmit={(e) => e.preventDefault()}>
      <Section title="Agreement">
        <TextField
          label="Purpose"
          hint="How Confidential Information may be used"
          rows={3}
          value={data.purpose}
          onChange={(v) => set("purpose", v)}
        />
        <TextField
          label="Effective Date"
          type="date"
          value={data.effectiveDate}
          onChange={(v) => set("effectiveDate", v)}
        />
      </Section>

      <Section title="MNDA Term">
        <TermChoice
          name="MNDA term"
          isYears={data.mndaTermType === "expires"}
          onSelectYears={() => set("mndaTermType", "expires")}
          years={data.mndaTermYears}
          onYearsChange={(v) => set("mndaTermYears", v)}
          yearsPrefix="Expires"
          yearsSuffix="year(s) from Effective Date"
          otherLabel="Continues until terminated"
          onSelectOther={() => set("mndaTermType", "untilTerminated")}
        />
      </Section>

      <Section title="Term of Confidentiality">
        <TermChoice
          name="Confidentiality term"
          isYears={data.confidentialityType === "years"}
          onSelectYears={() => set("confidentialityType", "years")}
          years={data.confidentialityYears}
          onYearsChange={(v) => set("confidentialityYears", v)}
          yearsSuffix="year(s) from Effective Date"
          otherLabel="In perpetuity"
          onSelectOther={() => set("confidentialityType", "perpetual")}
        />
      </Section>

      <Section title="Governing Law & Jurisdiction">
        <TextField
          label="Governing Law"
          hint="State, e.g. Delaware"
          value={data.governingLaw}
          onChange={(v) => set("governingLaw", v)}
        />
        <TextField
          label="Jurisdiction"
          hint="City or county and state, e.g. courts located in New Castle, DE"
          value={data.jurisdiction}
          onChange={(v) => set("jurisdiction", v)}
        />
      </Section>

      <Section title="MNDA Modifications">
        <TextField
          label="Modifications"
          hint="Optional. Leave blank if none."
          rows={3}
          value={data.modifications}
          onChange={(v) => set("modifications", v)}
        />
      </Section>

      {([0, 1] as const).map((index) => (
        <Section key={index} title={`Party ${index + 1}`}>
          {PARTY_FIELDS.map(({ key, ...field }) => (
            <TextField
              key={key}
              {...field}
              value={data.parties[index][key]}
              onChange={(v) => setParty(index, key, v)}
            />
          ))}
        </Section>
      ))}
    </form>
  );
}
