import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createServer } from './server.mjs';
import { createInbox } from './inbox.mjs';
import { createChatbot, askCodex } from './chatbot.mjs';

async function callDiscord(client, name, args) {
  const result = await client.callTool({ name, arguments: args });
  if (result.isError) throw new Error(result.content?.[0]?.text ?? 'Discord MCP 오류');
  return JSON.parse(result.content[0].text);
}

function discordTools(client) {
  return {
    next: timeout_ms => callDiscord(client, 'discord_wait_message', { timeout_ms }),
    typing: () => callDiscord(client, 'discord_send_typing', {}),
    send: (content, reply_to) => callDiscord(client, 'discord_send_message', { content, reply_to }),
  };
}

test('Discord input crosses MCP, CLI replies return to the original message, same session continues', async () => {
  const inbox = createInbox();
  const posts = [];
  let typingCount = 0;
  const server = createServer({ DISCORD_BOT_TOKEN: 'fake', DISCORD_CHANNEL_ID: '123456789012345678' }, async (url, options) => {
    assert.equal(options.method, 'POST');
    if (url.endsWith('/typing')) {
      assert.equal(url, 'https://discord.com/api/v10/channels/123456789012345678/typing');
      assert.equal(options.body, undefined);
      assert.equal(options.headers.Authorization, 'Bot fake');
      typingCount++;
      return new Response(null, { status: 204 });
    }
    assert.equal(url, 'https://discord.com/api/v10/channels/123456789012345678/messages');
    posts.push(JSON.parse(options.body));
    return new Response(JSON.stringify({ id: 'reply' }));
  }, inbox);
  const client = new Client({ name: 'test', version: '1' });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await server.connect(b); await client.connect(a);
  const sessions = [];
  const receive = createChatbot(discordTools(client), async (content, session) => {
    assert.equal(typingCount, sessions.length + 1);
    sessions.push(session);
    return `CLI 답변: ${content}`;
  });
  try {
    assert.deepEqual((await client.listTools()).tools.map(t => t.name), ['discord_send_message', 'discord_send_typing', 'discord_wait_message']);
    inbox.push({ id: '123456789012345679', content: '안녕' }); await receive();
    inbox.push({ id: '123456789012345680', content: '다음 질문' }); await receive();
    assert.equal(sessions[0], sessions[1]);
    assert.equal(posts[0].content, 'CLI 답변: 안녕');
    assert.equal(posts[1].content, 'CLI 답변: 다음 질문');
    assert.equal(posts[0].message_reference.message_id, '123456789012345679');
    assert.deepEqual(posts[0].allowed_mentions, { parse: [], replied_user: false });
    assert.equal((await client.callTool({ name: 'discord_send_message', arguments: { content: ' ' } })).isError, true);
    assert.equal(posts.length, 2);
  } finally { await client.close(); await server.close(); }
});

test('typing repeats while CLI is pending and stops after success or failure', async t => {
  t.mock.timers.enable({ apis: ['setInterval'] });
  for (const fails of [false, true]) {
    const calls = [];
    let finish;
    const answer = new Promise((resolve, reject) => {
      finish = () => fails ? reject(new Error('CLI failed')) : resolve('reply');
    });
    const client = { async callTool({ name }) {
      calls.push(name);
      return { content: [{ type: 'text', text: JSON.stringify(
        name === 'discord_wait_message' ? { id: '123456789012345679', content: 'hello' } : null,
      ) }] };
    } };
    const receiving = createChatbot(discordTools(client), () => answer)();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(calls.filter(name => name === 'discord_send_typing').length, 1);
    t.mock.timers.tick(8000);
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(calls.filter(name => name === 'discord_send_typing').length, 2);
    finish();
    if (fails) await assert.rejects(receiving, /CLI failed/);
    else await receiving;
    const completedCalls = calls.length;
    t.mock.timers.tick(16000);
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(calls.length, completedCalls);
    assert.equal(calls.includes('discord_send_message'), !fails);
  }
});

test('typing API failure does not prevent a CLI reply', async t => {
  t.mock.method(console, 'error', () => {});
  const calls = [];
  const client = { async callTool({ name }) {
    calls.push(name);
    if (name === 'discord_send_typing') return { isError: true, content: [{ type: 'text', text: 'Discord HTTP 403' }] };
    return { content: [{ type: 'text', text: JSON.stringify(
      name === 'discord_wait_message' ? { id: '123456789012345679', content: 'hello' } : null,
    ) }] };
  } };
  await createChatbot(discordTools(client), async () => 'reply')();
  assert.deepEqual(calls, ['discord_wait_message', 'discord_send_typing', 'discord_send_message']);
  assert.equal(console.error.mock.calls.filter(call => call.arguments[0].startsWith('Discord 입력 중 표시 실패:')).length, 1);
});

test('Windows CLI starts/resumes with stdin input and no Discord credentials',
  { skip: process.platform !== 'win32' }, async () => {
    const directory = await mkdtemp(join(tmpdir(), 'discord-fake-cli-'));
    const previousPath = process.env.PATH;
    const previousToken = process.env.DISCORD_BOT_TOKEN;
    const id = '11111111-2222-3333-4444-555555555555';
    try {
      await writeFile(join(directory, 'codex.cmd'), `@echo off\r\n"${process.execPath}" "%~dp0fake.cjs" %*\r\n`);
      await writeFile(join(directory, 'fake.cjs'), `
        const assert = require('node:assert/strict');
        assert.equal(process.env.DISCORD_BOT_TOKEN, undefined);
        assert.ok(process.argv.includes('sandbox_mode=read-only'));
        let input = '';
        process.stdin.setEncoding('utf8');
        process.stdin.on('data', part => input += part);
        process.stdin.on('end', () => {
          const content = JSON.parse(input.slice(input.indexOf('\\n') + 1)).content;
          if (content === 'second') {
            assert.ok(process.argv.includes('resume'));
            assert.ok(process.argv.includes('${id}'));
          } else assert.ok(!process.argv.includes('resume'));
          console.log(JSON.stringify({type:'thread.started',thread_id:'${id}'}));
          require('node:fs').writeFileSync('reply.txt', content);
        });
      `);
      process.env.PATH = `${directory};${previousPath}`;
      process.env.DISCORD_BOT_TOKEN = 'do-not-pass';
      const session = {};
      assert.equal(await askCodex('한국어 & echo injected', session), '한국어 & echo injected');
      assert.equal(session.id, id);
      assert.equal(await askCodex('second', session), 'second');
      await assert.rejects(askCodex('test', { id: '& echo injected' }), /세션 ID/);
    } finally {
      process.env.PATH = previousPath;
      if (previousToken === undefined) delete process.env.DISCORD_BOT_TOKEN;
      else process.env.DISCORD_BOT_TOKEN = previousToken;
      await rm(directory, { recursive: true, force: true });
    }
  });
