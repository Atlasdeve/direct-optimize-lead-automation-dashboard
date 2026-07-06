"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import CloseIcon from "@mui/icons-material/Close";
import EditIcon from "@mui/icons-material/Edit";
import SaveIcon from "@mui/icons-material/Save";
import type { Lead } from "@/lib/types";

type FormState = {
  companyName: string;
  city: string;
  category: string;
  businessType: string;
  email: string;
  phone: string;
  website: string;
  googleMapsUrl: string;
  ownerName: string;
  ceoName: string;
  managerName: string;
  decisionMakerName: string;
  decisionMakerTitle: string;
  linkedinUrl: string;
};

function initialState(lead: Lead): FormState {
  return {
    companyName: lead.company_name,
    city: lead.city || "",
    category: lead.category || "",
    businessType: lead.business_type || "",
    email: lead.email || "",
    phone: lead.phone || "",
    website: lead.website || "",
    googleMapsUrl: lead.google_maps_url || "",
    ownerName: lead.owner_name || "",
    ceoName: lead.ceo_name || "",
    managerName: lead.manager_name || "",
    decisionMakerName: lead.decision_maker_name || "",
    decisionMakerTitle: lead.decision_maker_title || "",
    linkedinUrl: lead.linkedin_url || ""
  };
}

const fields: Array<{ key: keyof FormState; label: string; type?: "email" | "tel" | "url"; section: "Business" | "Contact" | "People" }> = [
  { key: "companyName", label: "Company name", section: "Business" },
  { key: "city", label: "City", section: "Business" },
  { key: "category", label: "Category", section: "Business" },
  { key: "businessType", label: "Business type", section: "Business" },
  { key: "email", label: "Email address", type: "email", section: "Contact" },
  { key: "phone", label: "Phone number", type: "tel", section: "Contact" },
  { key: "website", label: "Website URL", type: "url", section: "Contact" },
  { key: "googleMapsUrl", label: "Google Maps URL", type: "url", section: "Contact" },
  { key: "ownerName", label: "Owner name", section: "People" },
  { key: "ceoName", label: "CEO name", section: "People" },
  { key: "managerName", label: "Manager name", section: "People" },
  { key: "decisionMakerName", label: "Decision-maker name", section: "People" },
  { key: "decisionMakerTitle", label: "Decision-maker title", section: "People" },
  { key: "linkedinUrl", label: "LinkedIn URL", type: "url", section: "People" }
];

export function EditLeadDetailsButton({ lead }: { lead: Lead }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState<FormState>(() => initialState(lead));

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !saving) setOpen(false);
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open, saving]);

  function showEditor() {
    setForm(initialState(lead));
    setError("");
    setOpen(true);
  }

  async function saveDetails(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const response = await fetch(`/api/leads/${lead.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form)
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Lead details could not be updated.");
      setOpen(false);
      router.refresh();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Lead details could not be updated.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button type="button" onClick={showEditor} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-white/7 px-4 text-sm font-semibold text-slate-100 transition soft-border hover:bg-white/12">
        <EditIcon fontSize="small" />
        Edit lead
      </button>

      {open && createPortal(
        <div className="fixed inset-0 z-[80] flex items-center justify-center overflow-y-auto bg-black/75 p-4 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) setOpen(false); }}>
          <form onSubmit={saveDetails} className="glass max-h-[calc(100dvh-2rem)] w-full max-w-3xl overflow-y-auto overscroll-contain rounded-xl p-5 shadow-2xl" aria-label="Edit lead details">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-white">Edit lead details</h2>
                <p className="mt-1 text-sm text-slate-400">Correct contact and business information before outreach.</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} disabled={saving} aria-label="Close edit lead dialog" className="grid h-10 w-10 shrink-0 place-items-center rounded-lg text-slate-300 hover:bg-white/8 hover:text-white disabled:opacity-50">
                <CloseIcon />
              </button>
            </div>

            {(["Business", "Contact", "People"] as const).map((section) => (
              <fieldset key={section} className="mt-5">
                <legend className="mb-3 text-sm font-semibold text-sky-200">{section}</legend>
                <div className="grid gap-3 md:grid-cols-2">
                  {fields.filter((field) => field.section === section).map((field) => (
                    <label key={field.key} className="text-sm text-slate-300">
                      {field.label}
                      <input
                        type={field.type || "text"}
                        value={form[field.key]}
                        required={field.key === "companyName"}
                        onChange={(event) => setForm((current) => ({ ...current, [field.key]: event.target.value }))}
                        className="mt-2 h-11 w-full rounded-lg border border-line bg-black/25 px-3 text-white outline-none focus:border-sky-300"
                      />
                    </label>
                  ))}
                </div>
              </fieldset>
            ))}

            {error && <p className="mt-4 rounded-lg bg-rose-400/10 p-3 text-sm text-rose-100 soft-border" role="alert">{error}</p>}
            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button type="button" onClick={() => setOpen(false)} disabled={saving} className="h-10 rounded-lg bg-white/7 px-4 text-sm font-semibold text-slate-200 soft-border hover:bg-white/12 disabled:opacity-50">Cancel</button>
              <button type="submit" disabled={saving} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-sky-400 px-4 text-sm font-semibold text-slate-950 hover:bg-sky-300 disabled:opacity-60">
                <SaveIcon fontSize="small" />
                {saving ? "Saving..." : "Save changes"}
              </button>
            </div>
          </form>
        </div>,
        document.body
      )}
    </>
  );
}
