export const inquiryEmail = "pablo@zz2pickleball.com";

export const contactTopics = [
  "Tournaments",
  "Leagues",
  "Special events",
  "Facility consulting",
  "Partnerships",
  "Other",
] as const;

export const contactLimits = { name: 100, email: 254, message: 3000 };

export function readContactInquiry(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Fill in the contact form to continue.");
  const input = value as Record<string, unknown>;
  const name = typeof input.name === "string" ? input.name.trim().replace(/\s+/g, " ") : "";
  const email = typeof input.email === "string" ? input.email.trim() : "";
  const message = typeof input.message === "string" ? input.message.trim() : "";
  const topic = contactTopics.find((item) => item === input.topic);

  if (!name || name.length > contactLimits.name) throw new Error("Enter your name.");
  if (email.length > contactLimits.email || !/^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+$/.test(email)) {
    throw new Error("Enter a valid email address.");
  }
  if (!topic) throw new Error("Choose a topic.");
  if (!message || message.length > contactLimits.message) throw new Error("Enter a message of up to 3,000 characters.");

  return { name, email, topic, message };
}

export type ContactInquiry = ReturnType<typeof readContactInquiry>;
