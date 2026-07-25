const prohibitedLeadTerms = [
  "escort",
  "escorts",
  "prostitute",
  "prostitution",
  "brothel",
  "call girl",
  "call girls",
  "sex worker",
  "sex workers"
];

export function prohibitedLeadTerm(...values: Array<string | null | undefined>) {
  const searchable = values.filter(Boolean).join(" ").toLowerCase();
  return prohibitedLeadTerms.find((term) => searchable.includes(term)) ?? null;
}
