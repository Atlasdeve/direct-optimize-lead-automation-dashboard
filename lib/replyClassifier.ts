export type ReplyClassification = "interested" | "not_interested" | "unsubscribe" | "bounce" | "auto_reply" | "needs_human_reply";

const patterns: Record<ReplyClassification, RegExp[]> = {
  interested: [/interested/i, /tell me more/i, /send (me )?(details|info)/i, /book|schedule|meeting|call/i],
  not_interested: [/not interested/i, /no thanks/i, /not looking/i, /already have/i],
  unsubscribe: [/unsubscribe/i, /remove me/i, /stop emailing/i, /do not contact/i],
  bounce: [/undeliver/i, /delivery failed/i, /mailbox unavailable/i, /address not found/i],
  auto_reply: [/out of office/i, /automatic reply/i, /auto[- ]?reply/i, /vacation/i],
  needs_human_reply: []
};

export function classifyReply(subject = "", body = ""): ReplyClassification {
  const text = `${subject}\n${body}`;
  for (const label of ["unsubscribe", "bounce", "interested", "not_interested", "auto_reply"] as ReplyClassification[]) {
    if (patterns[label].some((pattern) => pattern.test(text))) return label;
  }
  return "needs_human_reply";
}

export function replyClassificationLabel(classification: ReplyClassification) {
  return classification.replaceAll("_", " ");
}
