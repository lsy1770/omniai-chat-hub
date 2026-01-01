import { Cpu } from 'lucide-react';
import { OpenAI, Claude, Gemini, Meta } from '@lobehub/icons';

interface Props {
  modelId: string;
  className?: string;
}

export const ModelIcon: React.FC<Props> = ({ modelId, className = "w-5 h-5" }) => {
  const id = modelId.toLowerCase();

  // OpenAI (gpt, dall-e, o1, text-embedding)
  if (id.includes('gpt') || id.includes('o1-') || id.includes('dall-e') || id.includes('whisper')) {
    return <OpenAI size={16} className={className} />;
  }

  // Anthropic (Claude)
  if (id.includes('claude') || id.includes('anthropic')) {
    return <Claude.Color size={16} className={className} />;
  }

  // Google (Gemini)
  if (id.includes('gemini') || id.includes('google')) {
    return <Gemini.Color size={16} className={className} />;
  }

  // Meta (Llama)
  if (id.includes('llama') || id.includes('meta')) {
    return <Meta.Color size={16} className={className} />;
  }

  // Default Generic
  return <Cpu className={className} size={16} />;
};