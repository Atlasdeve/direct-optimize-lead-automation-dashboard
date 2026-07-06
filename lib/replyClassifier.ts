export type ReplyClassification = "interested" | "not_interested" | "unsubscribe" | "bounce" | "auto_reply" | "needs_human_reply";

const patterns: Record<ReplyClassification, RegExp[]> = {
  interested: [/interested/i, /tell me more/i, /need more (information|details)/i, /more (information|details)/i, /send (me )?(details|info)/i, /book|schedule|meeting|call/i],
  not_interested: [/not interested/i, /no thanks/i, /not looking/i, /already have/i],
  unsubscribe: [/unsubscribe/i, /remove me/i, /stop emailing/i, /do not contact/i],
  bounce: [/undeliver/i, /delivery failed/i, /mailbox unavailable/i, /address not found/i],
  auto_reply: [/out of office/i, /automatic reply/i, /auto[- ]?reply/i, /vacation/i],
  needs_human_reply: []
};

export function replyTextWithoutQuotedHistory(body = "") {
  const normalized = body.replace(/\r\n/g, "\n");
  const quoteMarkers = [
    /^On [^\n]*(?:\n[^\n]*){0,2}wrote:\s*$/im,
    /^-{2,}\s*Original Message\s*-{2,}\s*$/im,
    /^From:\s.+$/im,
    /^_{5,}\s*$/m
  ];
  let cutoff = normalized.length;
  for (const marker of quoteMarkers) {
    const match = marker.exec(normalized);
    if (match?.index !== undefined) cutoff = Math.min(cutoff, match.index);
  }

  return normalized
    .slice(0, cutoff)
    .split("\n")
    .filter((line) => !/^\s*>/.test(line))
    .join("\n")
    .replace(/To opt out of future messages, reply with Unsubscribe\.?/gi, "")
    .trim();
}

export function classifyReply(subject = "", body = ""): ReplyClassification {
  const text = `${subject}\n${replyTextWithoutQuotedHistory(body)}`;
  for (const label of ["bounce", "auto_reply", "unsubscribe", "not_interested", "interested"] as ReplyClassification[]) {
    if (patterns[label].some((pattern) => pattern.test(text))) return label;
  }
  return "needs_human_reply";
}

export function replyClassificationLabel(classification: ReplyClassification) {
  return classification.replaceAll("_", " ");
}
