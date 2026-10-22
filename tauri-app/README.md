# Folio — 빗썸 · 바이낸스 데스크톱 지갑

Tauri 2 + Rust + React로 구현한 거래소별 자산 조회, 차트, 가상자산 입출금 앱입니다.

## 실행

```powershell
cd D:\my_last_pf\tauri-app
npm install
npm run tauri dev
```

다른 프로젝트와 충돌하지 않도록 개발 서버는 `localhost:1437`을 사용합니다.

프로젝트 루트 `D:\my_last_pf\.env`에 다음 변수를 설정합니다. Rust에서만 읽으며 프런트엔드, 로그, 배포 파일에 포함하지 않습니다. 운영체제 환경 변수가 있으면 `.env`보다 우선합니다. 값을 바꾼 뒤에는 앱을 다시 실행합니다.

```dotenv
BINANCE_KEY=
BINANCE_SECRET=
BITHUMB_KEY=
BITHUMB_SECRET=
```

설치본에서는 실행 파일과 같은 폴더의 `.env` 또는 운영체제 환경 변수를 사용하세요. 키 파일은 Git에서 제외됩니다. 프런트엔드용 `VITE_` 변수에 키를 넣지 마세요.

## 기능

- 거래소별 사용 가능 잔고와 잠긴 잔고 조회, 자산 검색.
- 마켓 검색, 1·5·15분 / 1·4시간 / 일봉, 캔들·거래량·마우스 OHLC 조회, 30초 주기 갱신.
- 네트워크와 입출금 상태 조회. 네트워크는 사용자가 명시적으로 선택합니다.
- 가상자산 입금 주소와 태그 조회·복사, 빗썸 입금 주소 생성 요청.
- 등록 출금 주소 선택, 빗썸 개인·법인·화이트리스트·내부 출금 입력.
- 출금 수수료·최소 수량·잔고·정밀도 검토, 최종 확인, 실제 출금 API 연결.
- 빗썸에서 KRW 입력 시 연결된 본인 명의 계좌로 원화 입금·출금 요청. 카카오 2차 인증, 원화 잔고 검토, 원화 전용 내역 조회.
- 입출금 내역 50건 단위 페이지 조회. 바이낸스는 최근 89일 범위입니다.

바이낸스의 자산과 출금은 **현물 지갑** 기준입니다. 다른 지갑 간 내부 이체, 주문 실행은 포함하지 않습니다. 원화 은행 입출금은 빗썸에서 지원합니다. 가상자산 입금은 외부 지갑에서 발급된 주소로 전송하는 방식입니다.

원화는 입출금 화면에서 `KRW`를 입력하거나 자산 목록의 KRW 입출금 버튼으로 진입합니다. 금액을 1원 단위로 입력하고 검토 및 최종 확인 후 요청합니다. 계좌번호를 직접 지정하지 않으며 빗썸에 연결된 계좌를 사용합니다. API 키에 해당 권한이 있어야 하고, 요청 후 카카오 인증을 완료해야 합니다. 원화 출금 검토에서는 사용 가능 잔고를 확인합니다. 원화는 코인용 출금 가능 정보 API의 조회 대상이 아니므로 수수료·한도를 추정하지 않고 사전 조회 불가로 표시합니다. 은행 잔고·수수료·이체 한도는 거래소에서 최종 판정합니다. 접수는 완료를 의미하지 않으므로 최종 상태를 원화 내역에서 확인하세요.

## 출금 계약

검토는 실제 송금이 아닙니다. Rust가 확정 요청을 보관하고 60초 동안 유효한 일회용 티켓을 발급합니다. 입력 변경 시 화면 검토가 무효화되며, 실행은 수량이나 주소를 다시 받지 않고 해당 거래소의 티켓만 소비합니다. 검토는 거래소의 최종 접수·처리 완료를 보장하지 않습니다.

통신 단절, 읽을 수 없는 실행 응답, 거래소 타임아웃은 `uncertain`으로 반환합니다. 이런 결과는 일반적인 미실행으로 표시하지 않으며 화면에서 동일 요청의 재실행을 막고 해당 자산의 출금 내역을 안내합니다. 접수 성공도 처리 완료와 구분합니다. 티켓과 화면 결과는 메모리 상태이므로 앱을 종료한 뒤에는 거래소 내역으로 결과를 확인하세요.

## 구조

`src-tauri/src/commands.rs`는 IPC 입력 검증과 거래소 선택을 담당합니다. `contracts.rs`는 공통 계약, `review.rs`는 일회성·만료 규칙, `transport.rs`는 통신 오류 의미를 관리합니다.

`exchanges/bithumb/`, `exchanges/binance/`는 각각 `auth.rs`, `market.rs`, `wallet.rs`, `withdrawals.rs`로 인증, 시세, 지갑 조회, 출금을 소유합니다. 빗썸 수취인 공개 계약은 `bithumb/contracts.rs`에서만 정의하고 공통 요청이 그 타입을 묶습니다.

빗썸 원화 요청 계약도 `bithumb/contracts.rs`에 두고 `bithumb/krw.rs`가 원화 API와 응답 의미를 소유합니다. 원화와 가상자산 티켓은 별도로 보관하고 일회성·60초 만료 규칙만 공유합니다. 원화 화면은 `src/features/bithumb/KrwTransfer.tsx`에 있으며 결과와 내역 확인은 실행 당시 입출금 종류와 금액을 사용합니다.

프런트엔드에서는 자산, 차트, 입출금 입력, 출금 검토·실행 결과, 내역 조회를 분리합니다. 조회 조건이 바뀌거나 화면이 닫히면 이전 응답을 버립니다. 실행 결과는 현재 입력값 대신 실행 당시 요청을 표시합니다.

입출금 화면은 `src/features/transfers/registry.ts`에서 거래소별 연결 정의를 선택합니다. 각 거래소의 `transfers.tsx`가 주소 생성 지원, 지원하지 않는 통화, 출금 폼, 은행 입출금 폼을 선언합니다. 공통 `Transfers.tsx`는 거래소 이름이나 인증 수단을 판정하지 않습니다. 거래소 추가 시 연결 정의를 명시해야 하며, 기존 거래소의 연결 정의나 전용 폼을 수정할 필요가 없습니다.

빗썸 수취인 타입과 유형 전환 시 초기화는 `bithumb/withdrawal_contracts.ts`, 입력 UI는 `bithumb/RecipientFields.tsx`가 소유합니다. 공통 요청의 `Target`은 전용 공개 타입만 참조합니다. 공통 금융 요청의 검토·확인·만료·일회 실행·불확실성 잠금은 `transfers/reviewed_operation.ts`가 관련 상태와 함께 소유하고 React 연결은 `useReviewedOperation.ts`가 담당합니다. 원화와 코인 화면은 각각의 API 호출과 복구 안내를 전달합니다.

## 검증 및 빌드

```powershell
npm run build
npm test
cd src-tauri
cargo test --lib
cargo clippy --all-targets -- -D warnings
# 실제 키를 사용하는 선택적 읽기 테스트. 출금과 주소 생성은 호출하지 않습니다.
cargo test --lib -- --include-ignored
cd ..
npm exec -- tauri build
```

`npm test`는 프런트엔드 금융 상태 전이의 만료·중복 실행·늦은 검토·명시적 거절·IPC 불확실성·실행 당시 요청 보존을 검증합니다. 개발 서버의 `/tests/transfers.html`은 실제 화면에 모의 Tauri IPC만 연결한 수동 회귀 검증 페이지입니다. 등록 주소의 이름·태그 자동 입력, 빗썸·바이낸스 코인 출금, 빗썸 원화 입출금 및 IPC 인자를 확인할 수 있습니다. `?outcome=uncertain`, `?outcome=rejected`, `?expired=1`로 오류·만료를 재현합니다. 이 페이지는 별도 진입점이며 운영 빌드에 포함되지 않습니다.

실행 파일: `src-tauri/target/release/tauri-app.exe`.
설치 파일: `src-tauri/target/release/bundle/nsis/`, `bundle/msi/`.

개발 중 실제 두 거래소의 자산·마켓·캔들·네트워크·입출금 내역·등록 주소를 읽어 검증했습니다. 실제 출금과 주소 생성의 운영 성공 여부는 테스트하지 않았습니다. API 키 권한, 등록 IP, 주소 정책, 트래블룰 조건은 각 거래소에서 충족되어야 합니다.

API 계약은 [빗썸 공식 문서](https://apidocs.bithumb.com/reference/api-레퍼런스), [바이낸스 현물 문서](https://developers.binance.com/en/docs/catalog/core-trading-spot-trading/api/rest-api/market), [바이낸스 지갑 문서](https://developers.binance.com/en/docs/catalog/core-trading-wallet/api/rest-api/capital)를 기준으로 구현했습니다.
