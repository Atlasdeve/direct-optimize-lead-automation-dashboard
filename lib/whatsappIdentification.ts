export function whatsappNumberFromPhone(phone?: string | null) {
  const digits = phone?.replace(/\D/g, "") ?? "";
  return digits.length >= 8 ? digits : null;
}

export function hasWhatsappContactSignal(phone?: string | null) {
  return Boolean(whatsappNumberFromPhone(phone));
}
