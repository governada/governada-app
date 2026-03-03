import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getDRepById } from '@/lib/data';
import { getDRepPrimaryName } from '@/utils/display';
import { captureServerEvent } from '@/lib/posthog-server';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://drepscore.io';
const WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET;

async function sendMessage(chatId: number, text: string, parseMode = 'HTML') {
  if (!BOT_TOKEN) return;
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: parseMode,
      disable_web_page_preview: true,
    }),
  });
}

/**
 * POST: Telegram webhook handler
 * Set webhook via: https://api.telegram.org/bot{TOKEN}/setWebhook?url={SITE_URL}/api/telegram/webhook&secret_token={SECRET}
 */
export async function POST(request: NextRequest) {
  if (WEBHOOK_SECRET) {
    const secret = request.headers.get('x-telegram-bot-api-secret-token');
    if (secret !== WEBHOOK_SECRET) {
      return NextResponse.json({ ok: false }, { status: 403 });
    }
  }

  try {
    const update = await request.json();
    const message = update.message;
    if (!message?.text || !message?.chat?.id) {
      return NextResponse.json({ ok: true });
    }

    const chatId = message.chat.id;
    const text = message.text.trim();
    const [command, ...args] = text.split(/\s+/);

    captureServerEvent('telegram_command', { command, chat_id: chatId }, `telegram:${chatId}`);

    switch (command) {
      case '/start':
        await sendMessage(
          chatId,
          `<b>Welcome to DRepScore Bot!</b>\n\n` +
            `Commands:\n` +
            `/connect — Link your wallet to receive alerts\n` +
            `/score &lt;drepId&gt; — Check a DRep's score\n` +
            `/pending &lt;drepId&gt; — See pending proposals\n` +
            `/alerts — Toggle notifications on/off\n` +
            `/help — Show this message`,
        );
        break;

      case '/help':
        await sendMessage(
          chatId,
          `<b>DRepScore Bot Commands:</b>\n\n` +
            `/connect — Get a link to verify your wallet and enable alerts\n` +
            `/score &lt;drepId&gt; — Look up any DRep's current score\n` +
            `/pending &lt;drepId&gt; — Check pending proposals for a DRep\n` +
            `/alerts — Check and toggle your notification status`,
        );
        break;

      case '/connect': {
        const token = generateConnectToken(chatId);
        const supabase = getSupabaseAdmin();
        await supabase.from('user_channels').upsert(
          {
            user_wallet: `telegram:pending:${chatId}`,
            channel: 'telegram_pending',
            channel_identifier: String(chatId),
            config: { token, chatId },
            connected_at: new Date().toISOString(),
          },
          { onConflict: 'user_wallet,channel' },
        );

        await sendMessage(
          chatId,
          `<b>Connect Your Wallet</b>\n\n` +
            `Visit the link below and connect the wallet associated with your DRep:\n\n` +
            `<a href="${SITE_URL}/profile?telegram_connect=${token}">${SITE_URL}/profile</a>\n\n` +
            `This will link your Telegram to your DRepScore account for alerts.`,
        );
        break;
      }

      case '/score': {
        const drepId = args[0];
        if (!drepId) {
          await sendMessage(chatId, 'Usage: /score &lt;drepId&gt;');
          break;
        }
        const drep = await getDRepById(drepId);
        if (!drep) {
          await sendMessage(chatId, 'DRep not found. Check the ID and try again.');
          break;
        }
        const name = getDRepPrimaryName(drep);
        await sendMessage(
          chatId,
          `<b>${escapeHtml(name)}</b>\n\n` +
            `Score: <b>${drep.drepScore}/100</b>\n` +
            `Participation: ${drep.effectiveParticipation}%\n` +
            `Rationale: ${drep.rationaleRate}%\n` +
            `Reliability: ${drep.reliabilityScore}%\n` +
            `Profile: ${drep.profileCompleteness}%\n\n` +
            `<a href="${SITE_URL}/drep/${encodeURIComponent(drepId)}">View on DRepScore</a>`,
        );
        break;
      }

      case '/pending': {
        const drepId = args[0];
        if (!drepId) {
          await sendMessage(chatId, 'Usage: /pending &lt;drepId&gt;');
          break;
        }
        const drep = await getDRepById(drepId);
        if (!drep) {
          await sendMessage(chatId, 'DRep not found.');
          break;
        }
        await sendMessage(
          chatId,
          `Check pending proposals for <b>${escapeHtml(getDRepPrimaryName(drep))}</b>:\n\n` +
            `<a href="${SITE_URL}/dashboard/inbox">Open Governance Inbox</a>`,
        );
        break;
      }

      case '/alerts': {
        const supabase = getSupabaseAdmin();
        const { data: channel } = await supabase
          .from('user_channels')
          .select('user_wallet')
          .eq('channel', 'telegram')
          .eq('channel_identifier', String(chatId))
          .limit(1)
          .single();

        if (!channel) {
          await sendMessage(
            chatId,
            'Your Telegram is not linked to a wallet yet.\n' + 'Use /connect to set up alerts.',
          );
        } else {
          await sendMessage(
            chatId,
            `<b>Alerts Active</b>\n\n` +
              `Your Telegram is linked. Manage alert types at:\n` +
              `<a href="${SITE_URL}/profile">${SITE_URL}/profile</a>`,
          );
        }
        break;
      }

      default:
        if (text.startsWith('/')) {
          await sendMessage(chatId, 'Unknown command. Use /help to see available commands.');
        }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[Telegram Webhook] Error:', err);
    return NextResponse.json({ ok: true });
  }
}

function generateConnectToken(chatId: number): string {
  const payload = `${chatId}:${Date.now()}:${Math.random().toString(36).slice(2)}`;
  return Buffer.from(payload).toString('base64url');
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
