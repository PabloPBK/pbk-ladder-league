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
  if (email.length > contactLimits.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("Enter a valid email address.");
  }
  if (!topic) throw new Error("Choose a topic.");
  if (!message || message.length > contactLimits.message) throw new Error("Enter a message of up to 3,000 characters.");

  return { name, email, topic, message };
}

export function contactDraftUrl(recipient: string, input: unknown) {
  const inquiry = readContactInquiry(input);
  const subject = encodeURIComponent("ZZ2 Pickleball · " + inquiry.topic);
  const message = inquiry.message.replace(/\r?\n/g, "\r\n");
  const body = encodeURIComponent(`Name: ${inquiry.name}\r\nReply email: ${inquiry.email}\r\n\r\n${message}`);
  const draft = `mailto:${recipient}?subject=${subject}&body=${body}`;
  if (draft.length > 2000) throw new Error("This message is too long for an email draft. Copy it and use the direct email link.");
  return draft;
}
