"use client";

import React, { useEffect, useId, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { ApiError, apiPost, siteUrl, type LeadCreated, type LeadIn, type Loaded, type Region } from "@/api/http";
import { fill } from "@/lib/i18n";
import { ButtonLink, Section, SectionTitle, buttonClass } from "./ui";

type Role = LeadIn["role"];
const ROLES: Role[] = ["seller", "buyer", "both"];

/** Keeps the user's digits and shows them as "+998 90 123 45 67". */
function formatPhone(raw: string): string {
  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("998")) digits = digits.slice(3);
  digits = digits.slice(0, 9);
  const parts = [digits.slice(0, 2), digits.slice(2, 5), digits.slice(5, 7), digits.slice(7, 9)].filter(Boolean);
  return `+998 ${parts.join(" ")}`.trimEnd();
}

const phoneDigits = (value: string) => value.replace(/\D/g, "").length;

const inputClass =
  "w-full min-h-touch rounded-xl border border-line bg-surface px-4 text-[17px] text-ink placeholder:text-ink-muted focus:border-brand";

export const ContactForm: React.FC<{ regions: Loaded<Region[]> }> = ({ regions }) => {
  const { t, tr } = useLanguage();
  const ids = useId();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("+998 ");
  const [region, setRegion] = useState("");
  const [role, setRole] = useState<Role | "">("");
  const [message, setMessage] = useState("");
  const [utm, setUtm] = useState("");
  const [errors, setErrors] = useState<Partial<Record<"name" | "phone" | "role", string>>>({});
  const [submitError, setSubmitError] = useState("");
  const [pending, setPending] = useState(false);
  const [sentName, setSentName] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setUtm([params.get("utm_source"), params.get("utm_campaign")].filter(Boolean).join("/").slice(0, 64));
  }, []);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const next: typeof errors = {};
    if (name.trim().length < 2) next.name = t.contact.nameError;
    if (phoneDigits(phone) !== 12) next.phone = t.contact.phoneError;
    if (!role) next.role = t.contact.roleError;
    setErrors(next);
    setSubmitError("");
    if (Object.keys(next).length > 0 || !role) return;

    setPending(true);
    try {
      const body: LeadIn = {
        name: name.trim(),
        phone,
        role,
        region: region ? Number(region) : null,
        message: message.trim(),
        utm,
      };
      await apiPost<LeadCreated>("/leads", body);
      setSentName(name.trim());
    } catch (error) {
      // Backend messages are Uzbek Latin; show them in the chosen script.
      setSubmitError(error instanceof ApiError && error.message ? tr(error.message) : t.contact.networkError);
    } finally {
      setPending(false);
    }
  }

  function reset() {
    setName("");
    setPhone("+998 ");
    setRegion("");
    setRole("");
    setMessage("");
    setSentName(null);
  }

  return (
    <Section id="contact" labelledBy="contact-title">
      <div className="grid gap-10 lg:grid-cols-[1fr_1.2fr]">
        <SectionTitle id="contact-title" subtitle={t.contact.subtitle}>
          {t.contact.title}
        </SectionTitle>

        <div className="rounded-2xl border border-line bg-surface p-5 sm:p-8">
          {sentName !== null ? (
            <div role="status" className="text-center">
              <CheckCircle2 className="mx-auto h-12 w-12 text-success" aria-hidden="true" />
              <p className="mt-4 font-display text-[32px] leading-tight">{fill(t.contact.successTitle, { name: sentName })}</p>
              <p className="mt-3 text-[17px] text-ink-muted">{t.contact.successText}</p>
              <div className="mt-6 flex flex-wrap justify-center gap-3">
                <ButtonLink href={siteUrl()}>{t.nav.openSite}</ButtonLink>
                <button type="button" onClick={reset} className={buttonClass("ghost")}>
                  {t.contact.again}
                </button>
              </div>
            </div>
          ) : (
            <form noValidate onSubmit={submit} className="space-y-5">
              <div>
                <label htmlFor={`${ids}-name`} className="mb-1.5 block text-[15px] font-semibold">
                  {t.contact.name}
                </label>
                <input
                  id={`${ids}-name`}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t.contact.namePlaceholder}
                  autoComplete="given-name"
                  maxLength={80}
                  aria-invalid={!!errors.name}
                  aria-describedby={errors.name ? `${ids}-name-error` : undefined}
                  className={inputClass}
                />
                {errors.name && (
                  <p id={`${ids}-name-error`} className="mt-1.5 text-[13px] text-danger">
                    {errors.name}
                  </p>
                )}
              </div>

              <div>
                <label htmlFor={`${ids}-phone`} className="mb-1.5 block text-[15px] font-semibold">
                  {t.contact.phone}
                </label>
                <input
                  id={`${ids}-phone`}
                  value={phone}
                  onChange={(e) => setPhone(formatPhone(e.target.value))}
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  aria-invalid={!!errors.phone}
                  aria-describedby={errors.phone ? `${ids}-phone-error` : undefined}
                  className={`${inputClass} tabular-nums`}
                />
                {errors.phone && (
                  <p id={`${ids}-phone-error`} className="mt-1.5 text-[13px] text-danger">
                    {errors.phone}
                  </p>
                )}
              </div>

              <fieldset aria-describedby={errors.role ? `${ids}-role-error` : undefined}>
                <legend className="mb-1.5 text-[15px] font-semibold">{t.contact.role}</legend>
                <div className="flex flex-wrap gap-2">
                  {ROLES.map((r) => (
                    <label
                      key={r}
                      className={`inline-flex min-h-touch cursor-pointer items-center rounded-full border px-4 text-[15px] font-medium has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-brand ${
                        role === r ? "border-brand bg-brand-soft text-ink" : "border-line bg-surface text-ink-muted"
                      }`}
                    >
                      <input
                        type="radio"
                        name={`${ids}-role`}
                        value={r}
                        checked={role === r}
                        onChange={() => setRole(r)}
                        className="sr-only"
                      />
                      {t.contact.roles[r]}
                    </label>
                  ))}
                </div>
                {errors.role && (
                  <p id={`${ids}-role-error`} className="mt-1.5 text-[13px] text-danger">
                    {errors.role}
                  </p>
                )}
              </fieldset>

              <div>
                <label htmlFor={`${ids}-region`} className="mb-1.5 block text-[15px] font-semibold">
                  {t.contact.region}
                </label>
                <select
                  id={`${ids}-region`}
                  value={region}
                  onChange={(e) => setRegion(e.target.value)}
                  disabled={!regions.ok}
                  className={`${inputClass} disabled:opacity-60`}
                >
                  <option value="">{t.contact.regionPlaceholder}</option>
                  {regions.ok &&
                    regions.data.map((r) => (
                      <option key={r.id} value={r.id}>
                        {tr(r.name)}
                      </option>
                    ))}
                </select>
                {!regions.ok && <p className="mt-1.5 text-[13px] text-ink-muted">{t.contact.regionsError}</p>}
              </div>

              <div>
                <label htmlFor={`${ids}-message`} className="mb-1.5 block text-[15px] font-semibold">
                  {t.contact.message}
                </label>
                <textarea
                  id={`${ids}-message`}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder={t.contact.messagePlaceholder}
                  rows={3}
                  maxLength={1000}
                  className={`${inputClass} py-3`}
                />
              </div>

              {submitError && (
                <p role="alert" className="rounded-xl bg-danger-soft p-3 text-[15px] text-danger">
                  {submitError}
                </p>
              )}

              <button type="submit" disabled={pending} className={buttonClass("primary", "w-full disabled:opacity-60")}>
                {pending ? t.contact.submitting : t.contact.submit}
              </button>
              <p className="text-[13px] text-ink-muted">{t.contact.privacy}</p>
            </form>
          )}
        </div>
      </div>
    </Section>
  );
};
