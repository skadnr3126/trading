import { useState } from "react";
import { Withdraw, type CoinWithdrawalProps } from "../Withdraw";
import type { TransferDefinition } from "../transfers/definition";
import { RecipientFields } from "./RecipientFields";
import { emptyRecipient } from "./withdrawal_contracts";
import { KrwTransfer } from "./KrwTransfer";

function BithumbWithdraw(props: CoinWithdrawalProps) {
  const [details, setDetails] = useState(() => emptyRecipient("whitelist"));
  return <Withdraw {...props} target={{ exchange: "bithumb", details }}
    onChooseAddress={(address) => {
      if (address.target?.exchange === "bithumb") setDetails(address.target.details);
    }}
    renderDetails={(invalidate) => <RecipientFields details={details} onChange={(next) => {
      invalidate();
      setDetails(next);
    }} />} />;
}

export const bithumbTransfers: TransferDefinition = {
  canGenerateDepositAddress: true,
  excludedCurrencies: [],
  Withdraw: BithumbWithdraw,
  bank: {
    currency: "KRW",
    title: "원화 입출금",
    description: "빗썸에 연결된 은행 계좌로 입출금합니다.",
    footnote: "원화 입출금은 연결 계좌를 사용합니다. 요청 접수 후 카카오 인증과 최종 처리 내역을 확인하세요.",
    Form: KrwTransfer,
  },
};
