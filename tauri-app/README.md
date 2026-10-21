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
- 입출금 내역 50건 단위 페이지 조회. 바이낸스는 최근 89일 범위입니다.

바이낸스의 자산과 출금은 **현물 지갑** 기준입니다. 다른 지갑 간 내부 이체, 주문 실행, 원화 은행 입출금은 포함하지 않습니다. 가상자산 입금은 외부 지갑에서 발급된 주소로 전송하는 방식입니다.

## 출금 계약

검토는 실제 송금이 아닙니다. Rust가 확정 요청을 보관하고 60초 동안 유효한 일회용 티켓을 발급합니다. 입력 변경 시 화면 검토가 무효화되며, 실행은 수량이나 주소를 다시 받지 않고 해당 거래소의 티켓만 소비합니다. 검토는 거래소의 최종 접수·처리 완료를 보장하지 않습니다.

통신 단절, 읽을 수 없는 실행 응답, 거래소 타임아웃은 `uncertain`으로 반환합니다. 이런 결과는 일반적인 미실행으로 표시하지 않으며 화면에서 동일 요청의 재실행을 막고 해당 자산의 출금 내역을 안내합니다. 접수 성공도 처리 완료와 구분합니다. 티켓과 화면 결과는 메모리 상태이므로 앱을 종료한 뒤에는 거래소 내역으로 결과를 확인하세요.

## 구조

`src-tauri/src/commands.rs`는 IPC 입력 검증과 거래소 선택을 담당합니다. `contracts.rs`는 공통 계약, `review.rs`는 일회성·만료 규칙, `transport.rs`는 통신 오류 의미를 관리합니다.

`exchanges/bithumb/`, `exchanges/binance/`는 각각 `auth.rs`, `market.rs`, `wallet.rs`, `withdrawals.rs`로 인증, 시세, 지갑 조회, 출금을 소유합니다. 빗썸 수취인 공개 계약은 `bithumb/contracts.rs`에서만 정의하고 공통 요청이 그 타입을 묶습니다.

프런트엔드에서는 자산, 차트, 입출금 입력, 출금 검토·실행 결과, 내역 조회를 분리합니다. 조회 조건이 바뀌거나 화면이 닫히면 이전 응답을 버립니다. 실행 결과는 현재 입력값 대신 실행 당시 요청을 표시합니다.

## 검증 및 빌드

```powershell
npm run build
cd src-tauri
cargo test --lib
cargo clippy --all-targets -- -D warnings
# 실제 키를 사용하는 선택적 읽기 테스트. 출금과 주소 생성은 호출하지 않습니다.
cargo test --lib -- --include-ignored
cd ..
npm exec -- tauri build
```

실행 파일: `src-tauri/target/release/tauri-app.exe`.
설치 파일: `src-tauri/target/release/bundle/nsis/`, `bundle/msi/`.

개발 중 실제 두 거래소의 자산·마켓·캔들·네트워크·입출금 내역·등록 주소를 읽어 검증했습니다. 실제 출금과 주소 생성의 운영 성공 여부는 테스트하지 않았습니다. API 키 권한, 등록 IP, 주소 정책, 트래블룰 조건은 각 거래소에서 충족되어야 합니다.

API 계약은 [빗썸 공식 문서](https://apidocs.bithumb.com/reference/api-레퍼런스), [바이낸스 현물 문서](https://developers.binance.com/en/docs/catalog/core-trading-spot-trading/api/rest-api/market), [바이낸스 지갑 문서](https://developers.binance.com/en/docs/catalog/core-trading-wallet/api/rest-api/capital)를 기준으로 구현했습니다.
