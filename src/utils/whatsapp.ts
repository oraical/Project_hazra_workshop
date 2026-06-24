import { formatCurrency, type Customer } from "../db";

export function normalizeIndianPhone(phone?: string): string {
  const digits = (phone ?? "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length === 10) return "91" + digits;
  if (digits.length === 11 && digits.startsWith("0")) return "91" + digits.slice(1);
  return digits;
}

export function reminderText(customer: Customer, balance: number): string {
  return `Dear ${customer.name}, your pending balance is *${formatCurrency(
    balance
  )}*. Please clear it soon.\n\nHazra Workshop, Kolkata\n\n প্রিয় ${customer.name}, আপনার বাকি টাকা ${formatCurrency(
    balance
  )}. দয়া করে এটি শীঘ্রই পরিশোধ করুন।\n\n হাজরা ওয়ার্কশপ, কলকাতা`;
}


export function whatsappReminderUrl(customer: Customer, balance: number): string {
  const text = encodeURIComponent(reminderText(customer, balance));
  const phone = normalizeIndianPhone(customer.phone);
  return phone ? `https://wa.me/${phone}?text=${text}` : `https://wa.me/?text=${text}`;
}

export function openWhatsAppReminder(customer: Customer, balance: number): void {
  window.open(whatsappReminderUrl(customer, balance), "_blank", "noopener,noreferrer");
}

/**
 * Opens WhatsApp with a pre-filled message inviting the customer to
 * download the freshly-generated PDF statement from the device's
 * Downloads folder. Browsers cannot attach a file to wa.me directly,
 * so we instruct the user to attach the just-saved PDF manually.
 */
export function openWhatsAppStatementLink(
  customer: Customer,
  fileName: string,
  balance: number
): void {
  const text = encodeURIComponent(
    `Hi ${customer.name}, here is the full debit/credit statement of your account.\n\n` +
      `Pending balance: ${formatCurrency(balance)}\n` +
      `PDF file: ${fileName}\n\n` +
      `Please open the PDF from your Downloads folder and attach it to this chat. ` +
      `Thank you!`
  );
  const phone = normalizeIndianPhone(customer.phone);
  const url = phone ? `https://wa.me/${phone}?text=${text}` : `https://wa.me/?text=${text}`;
  window.open(url, "_blank", "noopener,noreferrer");
}