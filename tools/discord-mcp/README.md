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

자동 검사는 가짜 Discord/CLI 응답과 실제 MCP 프로토콜을 사용합니다. 실제 AI 답변의 품질을 검증하거나 Discord에 테스트 메시지를 보내지는 않습니다.
