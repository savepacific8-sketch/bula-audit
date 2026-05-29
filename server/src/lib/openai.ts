import OpenAI from 'openai';
import { env } from '../env.js';

export const isOpenAIConfigured = Boolean(env.OPENAI_API_KEY);

export const openai = isOpenAIConfigured
  ? new OpenAI({ apiKey: env.OPENAI_API_KEY })
  : null;
