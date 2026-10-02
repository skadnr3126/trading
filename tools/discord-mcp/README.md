# Discord → MCP → Codex CLI → Discord

기능은 지정한 채널의 새 텍스트 메시지를 받고 Codex CLI 답변을 해당 메시지에 답장하는 것뿐입니다. 봇·웹훅 메시지는 무시해 응답이 반복되는 것을 막습니다.

## 실행

Node.js 22.12 이상과 로그인된 Codex CLI를 사용합니다. Discord Bot의 Message Content Intent를 켜고 대상 채널에 View Channels와 Send Messages 권한을 주세요.

`.env.example`을 `.env`로 복사하고 DISCORD_BOT_TOKEN과 DISCORD_CHANNEL_ID를 입력합니다. 기존 `.env`가 있으면 그대로 사용합니다.

```powershell
cd D:\trading\tools\discord-mcp
npm.cmd install
codex.cmd login
npm.cmd run chat
```

이후 지정한 채널에 메시지를 보내면 답장합니다. CLI 응답을 기다리는 동안 봇의 입력 중 표시를 8초마다 갱신합니다. 종료는 Ctrl+C입니다. 한 번에 브리지 하나만 실행합니다. 메시지마다 Codex 사용량이 발생합니다.

## 코드 읽는 순서

1. `gateway.mjs`: Discord의 `messageCreate` 이벤트에서 메시지 ID와 내용을 받습니다.
2. `server.mjs`와 `inbox.mjs`: 메시지를 수신함에 넣고 MCP의 `discord_wait_message` 호출에 반환합니다.
3. `chatbot.mjs`의 `createChatbot`: MCP에서 메시지를 받아 `askCodex`에 전달합니다.
4. `askCodex`: 첫 입력은 `codex exec`, 다음 입력은 같은 세션 ID의 `codex exec resume`으로 전달하고 최종 답변을 읽습니다.
5. `createChatbot`: 답변을 MCP의 `discord_send_message`에 전달합니다.
6. `server.mjs`: Discord API로 원래 메시지에 답장을 보냅니다.

MCP 도구는 수신, 전송, 입력 중 표시 세 개입니다. 과거 메시지 조회, 의견 분류, 자료 저장, 명령어, Cloud 작업, PR 제출 기능은 없습니다.

자동 응답 주체는 브리지가 관리하는 별도 Codex CLI 세션입니다. 현재 열려 있는 다른 CLI 대화에 직접 입력을 넣지 않습니다. 채널 메시지는 하나의 대화를 공유하고 브리지를 재시작하면 새 CLI 세션으로 시작합니다. CLI는 대화만 하도록 파일·셸·플러그인 기능을 끄며 Discord 토큰을 전달하지 않습니다.

수신함은 메모리에 최대 100개를 보관합니다. 실행 전 또는 종료 중 메시지는 수신하지 않습니다. 긴 답변은 나눠 전송하고, 전송 실패는 중복 방지를 위해 자동 재전송하지 않습니다.

## 검사

```powershell
npm.cmd test
```

자동 검사는 가짜 Discord/CLI 응답과 실제 MCP 프로토콜을 사용합니다. 실제 AI 답변의 품질을 검증하거나 Discord에 테스트 메시지를 보내지는 않습니다.
