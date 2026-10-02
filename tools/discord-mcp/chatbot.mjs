import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, spawnSync } from 'node:child_process';
import { createInterface } from 'node:readline';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

export async function askCodex(message, session = {}, signal) {
  signal?.throwIfAborted();
  const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
  if (session.id && !uuid.test(session.id)) throw new Error('잘못된 CLI 세션 ID');
  const directory = await mkdtemp(join(tmpdir(), 'discord-chat-'));
  const args = ['exec', ...(session.id ? ['resume', session.id] : []),
    '--ignore-user-config', '--ignore-rules', '--skip-git-repo-check', '--json',
    '-c', 'sandbox_mode=read-only', '-c', 'web_search=disabled', '-o', 'reply.txt'];
  for (const feature of ['shell_tool', 'unified_exec', 'apps', 'plugins', 'multi_agent',
    'browser_use', 'computer_use', 'image_generation', 'code_mode_host', 'memories']) {
    args.push('--disable', feature);
  }
  args.push('-');
  const env = { ...process.env };
  for (const key of Object.keys(env)) if (key.startsWith('DISCORD_')) delete env[key];
  try {
    await new Promise((resolveRun, reject) => {
      // Only fixed CLI arguments reach cmd.exe. Chat text goes through stdin.
      const child = process.platform === 'win32'
        ? spawn(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', `codex.cmd ${args.join(' ')}`],
          { cwd: directory, env, windowsHide: true, stdio: ['pipe', 'pipe', 'ignore'] })
        : spawn('codex', args, { cwd: directory, env, stdio: ['pipe', 'pipe', 'ignore'] });
      const terminate = () => {
        if (process.platform === 'win32') {
          spawn('taskkill', ['/pid', String(child.pid), '/t', '/f'], { windowsHide: true, stdio: 'ignore' });
        } else child.kill('SIGKILL');
      };
      const abort = () => { terminate(); reject(new Error('CLI 실행 취소')); };
      signal?.addEventListener('abort', abort, { once: true });
      const lines = createInterface({ input: child.stdout });
      lines.on('line', line => {
        try {
          const event = JSON.parse(line);
          if (event.type === 'thread.started' && uuid.test(event.thread_id ?? '')) session.id = event.thread_id;
        } catch { /* CLI diagnostics are not conversation output. */ }
      });
      const timer = setTimeout(() => {
        terminate();
        reject(new Error('AI 응답 시간 초과'));
      }, 180_000);
      child.once('error', () => { clearTimeout(timer); reject(new Error('Codex 실행 실패. CLI 설치를 확인하세요.')); });
      child.once('close', code => {
        clearTimeout(timer);
        signal?.removeEventListener('abort', abort);
        lines.close();
        code === 0 ? resolveRun() : reject(new Error(`Codex 종료 코드 ${code}. 로그인 및 사용 한도를 확인하세요.`));
      });
      child.stdin.on('error', () => {});
      child.stdin.end('Discord 대화에 한국어로 답하세요. 도구나 파일을 사용하지 마세요.\n'
        + JSON.stringify({ content: message }));
    });
    const reply = (await readFile(join(directory, 'reply.txt'), 'utf8')).trim();
    if (!reply) throw new Error('AI 응답이 비어 있습니다.');
    if (!session.id) throw new Error('CLI 세션 ID를 받지 못했습니다.');
    return reply;
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

export async function callDiscord(client, name, args) {
  const result = await client.callTool({ name, arguments: args });
  if (result.isError) throw new Error(result.content?.[0]?.text ?? 'Discord MCP 오류');
  return JSON.parse(result.content[0].text);
}

export function createChatbot(client, ask = askCodex, signal) {
  const session = {};
  return async function receive() {
    const message = await callDiscord(client, 'discord_wait_message', { timeout_ms: 25000 });
    if (!message || signal?.aborted) return;
    console.log(`Discord 수신: ${message.id} → CLI`);
    const reply = await ask(message.content, session, signal);
    // No automatic POST retry: a timeout may mean the reply was already delivered.
    for (let start = 0; start < reply.length;) {
      let end = Math.min(start + 1900, reply.length);
      if (end < reply.length && /[\uD800-\uDBFF]/.test(reply[end - 1])) end--;
      await callDiscord(client, 'discord_send_message', { content: reply.slice(start, end), reply_to: message.id });
      start = end;
    }
    console.log(`CLI ${session.id} → Discord 답장: ${message.id}`);
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  {
    const login = process.platform === 'win32'
      ? spawnSync(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', 'codex.cmd login status'], { windowsHide: true, stdio: 'ignore', timeout: 15_000 })
      : spawnSync('codex', ['login', 'status'], { stdio: 'ignore', timeout: 15_000 });
    if (login.status !== 0) {
      console.error('Codex 로그인이 필요합니다. codex.cmd login 실행 후 다시 시작하세요.');
      process.exit(1);
    }
  }
  const client = new Client({ name: 'discord-cli-bridge', version: '0.1.0' });
  const transport = new StdioClientTransport({ command: process.execPath,
    args: [fileURLToPath(new URL('server.mjs', import.meta.url))], env: { ...process.env }, stderr: 'inherit' });
  const controller = new AbortController();
  let stopping = false;
  const shutdown = async () => { stopping = true; controller.abort(); await client.close(); };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
  try {
    await client.connect(transport);
    await client.listTools();
    console.log('Discord → MCP → Codex CLI → Discord 준비 완료. 종료: Ctrl+C');
    const receive = createChatbot(client, askCodex, controller.signal);
    while (!stopping) {
      try { await receive(); }
      catch (error) {
        if (stopping) break;
        console.error(error.message);
        if (!client.transport) break;
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  } catch (error) {
    if (!stopping) { console.error(error.message); process.exitCode = 1; }
  } finally {
    await client.close();
  }
}
