export type VacancyApplication = { href: string; label: string; external: boolean };

/** Only application destinations we can render safely on a public vacancy. */
export function vacancyApplication(value: string | null | undefined): VacancyApplication | null {
  const input = value?.trim();
  if (!input) return null;
  const email = input.replace(/^mailto:/i, "");
  if (/^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(email)) {
    return { href: `mailto:${email}`, label: "Apply by email", external: false };
  }
  const phone = input.replace(/^tel:/i, "");
  if (/^\+?[0-9]{9,15}$/.test(phone)) {
    return { href: `tel:${phone}`, label: "Call school", external: false };
  }
  if (/^https:\/\/[^\s]+$/i.test(input)) {
    try {
      const url = new URL(input);
      if (url.protocol === "https:" && url.hostname && !url.username && !url.password) {
        return { href: input, label: "View application", external: true };
      }
    } catch {
      return null;
    }
  }
  return null;
}
