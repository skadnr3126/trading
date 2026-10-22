// Bithumb public request contract. Only fields belonging to the selected kind travel over IPC.
export type BithumbWithdrawalDetails =
  | { type: "internal" }
  | { type: "whitelist"; exchange: string }
  | { type: "personal"; exchange: string; korean: string; english: string }
  | { type: "corporation"; exchange: string; korean: string; english: string; corpKorean: string; corpEnglish: string };

export function emptyRecipient(type: BithumbWithdrawalDetails["type"]): BithumbWithdrawalDetails {
  switch (type) {
    case "internal": return { type };
    case "whitelist": return { type, exchange: "" };
    case "personal": return { type, exchange: "", korean: "", english: "" };
    case "corporation": return { type, exchange: "", korean: "", english: "", corpKorean: "", corpEnglish: "" };
  }
}
