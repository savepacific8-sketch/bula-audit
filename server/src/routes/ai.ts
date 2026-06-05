import { Router } from 'express';
import { z } from 'zod';
import path from 'node:path';
import fs from 'node:fs';
import { prisma } from '../prisma.js';
import { env } from '../env.js';
import { requireAuth } from '../middleware/auth.js';
import { HttpError } from '../middleware/error.js';
import { openai, isOpenAIConfigured } from '../lib/openai.js';
import { getAgentPrompt } from '../lib/agentPrompts.js';
import { buildSpendingContext } from '../lib/spendingContext.js';
import { extractReceiptFromPhotoUrl } from '../lib/receiptExtract.js';

const router = Router();
router.use(requireAuth);

router.get('/status', (_req, res) => {
  res.json({
    configured: true,
    scan_driver: env.RECEIPT_SCAN_DRIVER,
    free_ocr: env.RECEIPT_SCAN_DRIVER === 'ocr',
    openai_available: isOpenAIConfigured,
    model: env.OPENAI_MODEL,
  });
});

function resolveUploadPath(url: string): string | null {
  if (!url.startsWith('/uploads/')) return null;
  const base = path.isAbsolute(env.UPLOAD_DIR)
    ? env.UPLOAD_DIR
    : path.resolve(process.cwd(), env.UPLOAD_DIR);
  const file = path.join(base, url.replace(/^\/uploads\//, ''));
  return fs.existsSync(file) ? file : null;
}

const MIME_BY_EXT: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  jfif: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  heic: 'image/heic',
  heif: 'image/heif',
  bmp: 'image/bmp',
  tiff: 'image/tiff',
  tif: 'image/tiff',
};

function fileToDataUri(filePath: string): string {
  const ext = path.extname(filePath).slice(1).toLowerCase();
  const mime = MIME_BY_EXT[ext] || 'image/jpeg';
  const data = fs.readFileSync(filePath).toString('base64');
  return `data:${mime};base64,${data}`;
}

// ─────────────────────────────────────────────────────────────────────
// POST /api/ai/invoke-llm
// Matches the Base44 InvokeLLM API shape:
//   { prompt, file_urls?, response_json_schema?, model? }
// Returns either the parsed JSON (when response_json_schema is provided)
// or { text } for plain prompts.
// ─────────────────────────────────────────────────────────────────────

const invokeSchema = z.object({
  prompt: z.string().min(1),
  file_urls: z.array(z.string()).optional(),
  response_json_schema: z.unknown().optional(),
  model: z.string().optional(),
});

router.post('/extract-receipt', async (req, res) => {
  const { photo_url } = z.object({ photo_url: z.string().min(1) }).parse(req.body);
  const result = await extractReceiptFromPhotoUrl(photo_url);
  res.json(result);
});

router.post('/invoke-llm', async (req, res) => {
  if (!isOpenAIConfigured || !openai) {
    throw new HttpError(
      503,
      'OPENAI_API_KEY not set. Add it to server/.env and restart.',
    );
  }
  const { prompt, file_urls, response_json_schema, model } = invokeSchema.parse(
    req.body,
  );

  type ContentPart =
    | { type: 'text'; text: string }
    | { type: 'image_url'; image_url: { url: string } };
  const content: ContentPart[] = [{ type: 'text', text: prompt }];

  if (file_urls?.length) {
    let attached = 0;
    for (const url of file_urls) {
      if (/\.pdf(\?|$)/i.test(url.split('?')[0])) continue;
      let imageUrl = url;
      if (url.startsWith('/uploads/')) {
        const localPath = resolveUploadPath(url);
        if (!localPath) {
          console.warn('[ai] upload file not found:', url);
          continue;
        }
        if (path.extname(localPath).toLowerCase() === '.pdf') continue;
        imageUrl = fileToDataUri(localPath);
      }
      content.push({ type: 'image_url', image_url: { url: imageUrl } });
      attached++;
    }
    if (attached === 0) {
      throw new HttpError(
        400,
        'Receipt image not found on server. Re-upload the photo and try again.',
      );
    }
  }

  const wantJson = Boolean(response_json_schema);
  const completion = await openai.chat.completions.create({
    model: model || env.OPENAI_MODEL,
    messages: [
      {
        role: 'user',
        content: wantJson
          ? [{ type: 'text', text: prompt + '\n\nReturn ONLY valid JSON, no markdown.' }, ...content.slice(1)]
          : content,
      },
    ],
    response_format: wantJson ? { type: 'json_object' } : undefined,
  });

  const text = completion.choices[0]?.message?.content || '';
  if (wantJson) {
    try {
      res.json(JSON.parse(text));
    } catch {
      res.json({ raw: text });
    }
    return;
  }
  res.json({ text });
});

// ─────────────────────────────────────────────────────────────────────
// Agent conversations (HTTP polling instead of websockets for simplicity)
// ─────────────────────────────────────────────────────────────────────

const createConversationSchema = z
  .object({
    agent_id: z.string().min(1).optional(),
    agent_name: z.string().min(1).optional(),
    metadata: z.unknown().optional(),
  })
  .refine((b) => Boolean(b.agent_id || b.agent_name), {
    message: 'agent_id or agent_name required',
  });

router.post('/conversations', async (req, res) => {
  const user = req.user!;
  const body = createConversationSchema.parse(req.body);
  const agent_id = body.agent_id ?? body.agent_name!;
  const { metadata } = body;
  const conv = await prisma.conversation.create({
    data: {
      userId: user.id,
      agentId: agent_id,
      metadata: metadata ? JSON.stringify(metadata) : null,
    },
  });
  res.status(201).json({ id: conv.id, agent_id: conv.agentId });
});

router.get('/conversations/:id/messages', async (req, res) => {
  const user = req.user!;
  const conv = await prisma.conversation.findUnique({
    where: { id: req.params.id },
  });
  if (!conv) throw new HttpError(404, 'Conversation not found');
  if (conv.userId !== user.id && user.role !== 'admin') {
    throw new HttpError(403, 'Not your conversation');
  }

  const since = typeof req.query.since === 'string' ? new Date(req.query.since) : null;

  const messages = await prisma.message.findMany({
    where: {
      conversationId: conv.id,
      ...(since && !Number.isNaN(since.getTime()) ? { createdAt: { gt: since } } : {}),
    },
    orderBy: { createdAt: 'asc' },
  });
  res.json({
    messages: messages.map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      created_date: m.createdAt.toISOString(),
    })),
  });
});

const addMessageSchema = z.object({
  role: z.enum(['user', 'assistant', 'system']).default('user'),
  content: z.string().min(1),
});

router.post('/conversations/:id/messages', async (req, res) => {
  const user = req.user!;
  const conv = await prisma.conversation.findUnique({
    where: { id: req.params.id },
    include: { messages: { orderBy: { createdAt: 'asc' } } },
  });
  if (!conv) throw new HttpError(404, 'Conversation not found');
  if (conv.userId !== user.id && user.role !== 'admin') {
    throw new HttpError(403, 'Not your conversation');
  }

  const { role, content } = addMessageSchema.parse(req.body);

  const saved = await prisma.message.create({
    data: { conversationId: conv.id, role, content },
  });

  // If user message, generate an assistant reply via OpenAI (when configured).
  if (role === 'user' && !isOpenAIConfigured) {
    const assistantMessage = await prisma.message.create({
      data: {
        conversationId: conv.id,
        role: 'assistant',
        content:
          'AI is not configured on this server. Add OPENAI_API_KEY to server/.env and restart the backend.',
      },
    });
    res.status(201).json({
      user_message: serializeMessage(saved),
      assistant_message: serializeMessage(assistantMessage),
    });
    return;
  }

  if (role === 'user' && isOpenAIConfigured && openai) {
    try {
      const history = conv.messages.map((m) => ({
        role: m.role as 'user' | 'assistant' | 'system',
        content: m.content,
      }));
      let systemPrompt = getAgentPrompt(conv.agentId);
      if (conv.agentId === 'spending_trends') {
        const ctx = await buildSpendingContext(user.id);
        systemPrompt += `\n\n--- Company receipt data ---\n${ctx}`;
      }
      const completion = await openai.chat.completions.create({
        model: env.OPENAI_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          ...history,
          { role: 'user', content },
        ],
      });
      const reply = completion.choices[0]?.message?.content || '';
      const assistantMessage = await prisma.message.create({
        data: { conversationId: conv.id, role: 'assistant', content: reply },
      });
      res.status(201).json({
        user_message: serializeMessage(saved),
        assistant_message: serializeMessage(assistantMessage),
      });
      return;
    } catch (err) {
      console.error('OpenAI agent error:', err);
      const fallback = await prisma.message.create({
        data: {
          conversationId: conv.id,
          role: 'assistant',
          content:
            'Sorry, the AI assistant is unavailable right now. Please try again later.',
        },
      });
      res.status(201).json({
        user_message: serializeMessage(saved),
        assistant_message: serializeMessage(fallback),
      });
      return;
    }
  }

  res.status(201).json({ user_message: serializeMessage(saved) });
});

function serializeMessage(m: { id: string; role: string; content: string; createdAt: Date }) {
  return {
    id: m.id,
    role: m.role,
    content: m.content,
    created_date: m.createdAt.toISOString(),
  };
}

export default router;
