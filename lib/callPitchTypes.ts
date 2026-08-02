export type LeadCallPitchPoint = {
  finding: string;
  implication: string;
  conversationalLine: string;
};

export type LeadCallPitchObjection = {
  objection: string;
  response: string;
};

export type LeadCallPitch = {
  generatedAt: string;
  auditFingerprint: string;
  generationMode: "ai" | "audit_fallback";
  opening: string;
  contextBridge: string;
  valueStatement: string;
  discoveryQuestions: string[];
  talkingPoints: LeadCallPitchPoint[];
  objectionResponses: LeadCallPitchObjection[];
  nextStep: string;
};
