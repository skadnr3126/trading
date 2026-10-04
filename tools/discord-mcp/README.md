# Discord → Codex CLI → Discord / MCP

기능은 지정한 채널의 새 텍스트 메시지를 받고 Codex CLI 답변을 해당 메시지에 답장하는 것뿐입니다. 봇·웹훅 메시지는 무시해 응답이 반복되는 것을 막습니다.

## 실행

Node.js 22.12 이상과 로그인된 Codex CLI를 사용합니다. Discord Bot의 Message Content Intent를 켜고 대상 채널에 View Channels와 Send Messages 권한을 주세요.

`.env.example`을 `.env`로 복사하고 DISCORD_BOT_TOKEN과 DISCORD_CHANNEL_ID를 입력합니다. 기존 `.env`가 있으면 그대로 사용합니다.

```powershell
cd D:\trading\tools\discord-mcp
npm.cmd install
codex.cmd login
node server.mjs
```

`server.mjs` 하나가 MCP 도구와 자동 답장을 함께 실행합니다. `npm.cmd start`와 `npm.cmd run chat`도 같은 파일을 실행합니다. 지정한 채널에 메시지를 보내면 답장하며, CLI 응답을 기다리는 동안 입력 중 표시를 8초마다 갱신합니다. 메시지마다 Codex 사용량이 발생합니다.

Codex의 MCP 설정에서 실행 명령을 `node`, 인수를 `D:/trading/tools/discord-mcp/server.mjs`로 지정하면 Codex가 서버를 실행합니다. MCP 연결 또는 stdin이 닫히면 Gateway와 대기 중인 CLI 응답도 정리합니다. 터미널에서 직접 실행하면 Ctrl+C로 종료합니다. Codex 대화 창을 닫아도 MCP 연결이 유지되는 경우 서버는 계속 실행됩니다.

기존에 따로 실행한 `chatbot.mjs`는 종료한 뒤 서버를 재시작하세요. 서버는 한 번에 하나만 실행합니다. 로그는 stderr에만 출력하고 stdout은 MCP 통신에 사용합니다.

## 백그라운드 서비스 (Linux/Unix)

계속 켜둘 봇은 Supervisor 서비스로 실행합니다. Node.js 24.5 이상(환경 프록시 플래그 지원), Python 3와 pip, 로그인된 Codex CLI가 필요합니다. 위의 `.env` 또는 주입된 환경변수로 Discord 토큰·채널 ID를 준비하세요. 토큰과 Codex 인증 파일은 Git에 넣지 않습니다.

```bash
cd tools/discord-mcp
npm ci
npm run service:install
npm run service:start
npm run service:status
npm run service:logs
```

`service:start`는 독립적인 Supervisor 데몬을 시작하고 종료됩니다. 데몬은 MCP 클라이언트인 `service/runtime.mjs`를 관리하며, 이 클라이언트가 `server.mjs`의 stdin/MCP 연결을 유지합니다. 터미널이나 Codex 대화 창이 닫혀도 실행을 유지하며, 서버·클라이언트가 종료되면 다시 시작합니다. `service:start`를 여러 번 실행해도 같은 서비스를 재사용합니다. 기존에 직접 띄운 서버는 먼저 종료해 중복 답장을 방지하세요.

```bash
npm run service:restart   # 봇 재시작
npm run service:stop      # 봇을 의도적으로 중지
npm run service:start     # 중지한 봇 다시 시작
npm run service:shutdown  # 관리 데몬까지 중지
```

기본 상태 디렉터리는 Git에서 제외된 `.service/`입니다. Supervisor 패키지, Unix 제어 소켓, PID, 생성된 설정과 회전 로그가 들어갑니다. `DISCORD_SERVICE_STATE_DIR`로 별도의 쓰기 가능한 위치를 지정할 수 있습니다. 설치와 모든 관리 명령에서 같은 위치를 사용하세요. 서비스 설정에는 경로만 저장하며, 토큰은 프로세스 환경으로 전달합니다. 환경변수를 바꿨다면 `service:shutdown` 후 새로운 환경에서 `service:start`를 실행해야 데몬도 새 값을 받습니다.

`service:status`의 RUNNING 표시와 함께 `.service/logs/bot.log`에서 현재 서버의 `MCP initialized` 및 `Discord Gateway READY: bot online`을 확인하세요. MCP 초기화만으로는 Discord 로그인 성공을 보장하지 않습니다. 클라이언트는 30초마다 MCP ping을 확인하고, 10초간 응답이 없거나 초기 Gateway READY가 60초간 없으면 종료해 재시작을 요청합니다. 연결된 Discord Gateway의 재접속은 discord.js가 처리합니다.

종료·신호·재시작 기록은 `.service/logs/supervisor.log`, 운영 상태는 `bot.log`에 남습니다. 각각 5MB에서 회전하고 백업 3개를 유지합니다. 로그에는 메시지 내용이나 인증 값을 기록하지 않습니다. 서버 재시작 시 기존 구현대로 메모리 수신함과 대화 세션은 새로 시작합니다.

프록시 환경에서는 `--use-env-proxy`와 `service/proxy.cjs`가 REST와 Gateway WebSocket에 환경 프록시를 적용합니다. TLS 검증은 유지합니다. `CODEX_SQLITE_HOME`은 별도 지정이 없으면 `.service/codex-state`를 사용하고, Codex 로그인 저장소는 그대로 사용합니다. 클라우드에서 인증/세션 저장 경로에 쓰기 권한이 없다면 플랫폼의 지원되는 권한 흐름이 필요합니다.

이 서비스는 **호스트가 살아 있는 동안** 프로세스를 유지합니다. 머신 전체가 종료·교체되면 봇도 멈춥니다. 머신 부팅 자동 실행이 필요하면 해당 호스트의 서비스 관리자나 배포 시작 절차에 `npm run service:start`를 등록하세요. 상시 가동을 보장하지 않는 임시 클라우드 머신만으로 24시간 가용성을 보장하지는 않습니다.

## 코드 읽는 순서

1. `gateway.mjs`: Discord의 `messageCreate` 이벤트에서 메시지 ID와 내용을 받습니다.
2. `server.mjs`와 `inbox.mjs`: 자동 답장용 수신함과 MCP 관찰용 수신함에 각각 메시지를 넣습니다.
3. `chatbot.mjs`의 `createChatbot`: 자동 답장용 메시지를 받아 `askCodex`에 전달합니다. 이 파일은 서버에서 불러오는 모듈입니다.
4. `askCodex`: 첫 입력은 `codex exec`, 다음 입력은 같은 세션 ID의 `codex exec resume`으로 전달하고 최종 답변을 읽습니다.
5. `createChatbot`: 답변과 원래 메시지 ID를 서버의 전송 함수에 전달합니다.
6. `server.mjs`: Discord API로 원래 메시지에 답장을 보냅니다.

MCP 도구는 수신, 전송, 입력 중 표시 세 개입니다. 과거 메시지 조회, 의견 분류, 자료 저장, 명령어, Cloud 작업, PR 제출 기능은 없습니다.

자동 응답 주체는 브리지가 관리하는 별도 Codex CLI 세션입니다. 현재 열려 있는 다른 CLI 대화에 직접 입력을 넣지 않습니다. 채널 메시지는 하나의 대화를 공유하고 브리지를 재시작하면 새 CLI 세션으로 시작합니다. CLI는 대화만 하도록 파일·셸·플러그인 기능을 끄며 Discord 토큰을 전달하지 않습니다.

수신함은 각각 메모리에 최대 100개를 보관합니다. MCP 관찰용 수신함은 최근 100개를 유지하며, 자동 답장 대기열이 가득 차면 오류를 기록하고 새 메시지를 받지 않습니다. `discord_wait_message`로 받은 메시지는 자동 답장 대상이기도 하므로 추가 답장을 보내면 답장이 중복될 수 있습니다. 실행 전 또는 종료 중 메시지는 수신하지 않습니다. 긴 답변은 나눠 전송하고, 전송 실패는 중복 방지를 위해 자동 재전송하지 않습니다.

## 검사

```powershell
npm.cmd test
```

자동 검사는 가짜 Discord/CLI 응답과 실제 MCP 프로토콜을 사용합니다. 서비스 검사에서는 실제 자식 프로세스의 종료, MCP ping 무응답, READY 시간 초과, 정상 종료 및 로그의 민감값 제외를 검증합니다. 실제 AI 답변의 품질을 검증하거나 Discord에 테스트 메시지를 보내지는 않습니다.
