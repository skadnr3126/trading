import type { BithumbWithdrawalDetails } from "./withdrawal_contracts";
import { emptyRecipient } from "./withdrawal_contracts";

export function RecipientFields({details, onChange}: {details: BithumbWithdrawalDetails; onChange: (details: BithumbWithdrawalDetails) => void}) {
  function field(key: "exchange" | "korean" | "english" | "corpKorean" | "corpEnglish", value: string) {
    onChange({...details, [key]: value});
  }
  return (
    <div className="bithumb-details">
      <div className="eyebrow">BITHUMB RECIPIENT</div>
      <label>
        수취인 유형
        <select
          value={details.type}
          onChange={(e) => {
            onChange(emptyRecipient(e.target.value as BithumbWithdrawalDetails["type"]));
          }}
        >
          <option value="whitelist">
            화이트리스트 / CODE ID Connect
          </option>
          <option value="personal">CODE 개인</option>
          <option value="corporation">CODE 법인</option>
          <option value="internal">빗썸 내부 출금</option>
        </select>
      </label>
      {details.type !== "internal" && (
        <label>
          받는 거래소 영문명
          <input
            value={details.exchange ?? ""}
            onChange={(e) => field("exchange", e.target.value)}
            placeholder="예: Binance (등록 정보와 동일하게 입력)"
          />
        </label>
      )}
      {(details.type === "personal" ||
        details.type === "corporation") && (
        <div className="form-grid">
          <label>
            수취인 / 대표자 국문명
            <input
              value={details.korean ?? ""}
              onChange={(e) => field("korean", e.target.value)}
            />
          </label>
          <label>
            수취인 / 대표자 영문명
            <input
              value={details.english ?? ""}
              onChange={(e) => field("english", e.target.value)}
            />
          </label>
        </div>
      )}
      {details.type === "corporation" && (
        <div className="form-grid">
          <label>
            법인 국문명
            <input
              value={details.corpKorean ?? ""}
              onChange={(e) => field("corpKorean", e.target.value)}
            />
          </label>
          <label>
            법인 영문명
            <input
              value={details.corpEnglish ?? ""}
              onChange={(e) => field("corpEnglish", e.target.value)}
            />
          </label>
        </div>
      )}
    </div>
  );
}
