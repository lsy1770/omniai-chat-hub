import React, { useEffect, useImperativeHandle, useRef, useState } from 'react';
import {
  Brush,
  Download,
  Eraser,
  Image as ImageIcon,
  Loader2,
  RefreshCw,
  Sparkles,
  Upload,
  X,
} from 'lucide-react';
import { editOpenAIImage, generateOpenAIImage, type OpenAIImageResult } from '../../lib/api';
import { useChatStore } from '../../store/useChatStore';
import { useSettingsStore } from '../../store/useSettingsStore';
import { useToastStore } from '../../store/useToastStore';

type ImageMode = 'generate' | 'edit';
type OutputFormat = 'png' | 'jpeg' | 'webp';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onImageClick?: (src: string) => void;
}

interface LastRun {
  prompt: string;
  model: string;
  size: string;
  count: number;
  quality: string;
  background: string;
  outputFormat: OutputFormat;
}

interface MaskEditorHandle {
  exportMaskFile: () => Promise<File | null>;
  clearSelection: () => void;
  hasSelection: () => boolean;
}

const neuBtn = 'flex items-center justify-center rounded-2xl transition-all active:scale-95 text-gray-500 dark:text-gray-400 shadow-neu-light dark:shadow-neu-dark hover:text-blue-500 dark:hover:text-blue-400';
const neuInput = 'w-full bg-light dark:bg-dark rounded-2xl px-4 py-3 outline-none text-gray-700 dark:text-gray-200 shadow-neu-pressed-light dark:shadow-neu-pressed-dark placeholder-gray-400 transition-all focus:ring-2 focus:ring-blue-500/20';
const optionClass = 'bg-light dark:bg-dark text-gray-700 dark:text-gray-200';

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error('Failed to export canvas'));
      }
    }, 'image/png');
  });
}

const MaskEditor = React.forwardRef<MaskEditorHandle, { imageSrc: string; brushSize: number }>(
  ({ imageSrc, brushSize }, ref) => {
    const imageCanvasRef = useRef<HTMLCanvasElement>(null);
    const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
    const drawingRef = useRef(false);
    const hasSelectionRef = useRef(false);
    const [canvasReady, setCanvasReady] = useState(false);

    useEffect(() => {
      const img = new Image();
      img.onload = () => {
        const imageCanvas = imageCanvasRef.current;
        const overlayCanvas = overlayCanvasRef.current;
        if (!imageCanvas || !overlayCanvas) return;

        imageCanvas.width = img.naturalWidth;
        imageCanvas.height = img.naturalHeight;
        overlayCanvas.width = img.naturalWidth;
        overlayCanvas.height = img.naturalHeight;

        const imageCtx = imageCanvas.getContext('2d');
        const overlayCtx = overlayCanvas.getContext('2d');
        if (!imageCtx || !overlayCtx) return;

        imageCtx.clearRect(0, 0, imageCanvas.width, imageCanvas.height);
        imageCtx.drawImage(img, 0, 0, imageCanvas.width, imageCanvas.height);
        overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
        hasSelectionRef.current = false;
        setCanvasReady(true);
      };
      img.src = imageSrc;
    }, [imageSrc]);

    const drawAt = (event: React.PointerEvent<HTMLCanvasElement>) => {
      const canvas = overlayCanvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (!canvas || !ctx) return;

      const rect = canvas.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / rect.width) * canvas.width;
      const y = ((event.clientY - rect.top) / rect.height) * canvas.height;

      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = 'rgba(59, 130, 246, 0.52)';
      ctx.beginPath();
      ctx.arc(x, y, brushSize, 0, Math.PI * 2);
      ctx.fill();
      hasSelectionRef.current = true;
    };

    const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
      drawingRef.current = true;
      event.currentTarget.setPointerCapture(event.pointerId);
      drawAt(event);
    };

    const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
      if (!drawingRef.current) return;
      drawAt(event);
    };

    const stopDrawing = (event: React.PointerEvent<HTMLCanvasElement>) => {
      drawingRef.current = false;
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    };

    useImperativeHandle(ref, () => ({
      async exportMaskFile() {
        const overlay = overlayCanvasRef.current;
        if (!overlay || !hasSelectionRef.current) return null;

        const overlayCtx = overlay.getContext('2d');
        if (!overlayCtx) return null;

        const mask = document.createElement('canvas');
        mask.width = overlay.width;
        mask.height = overlay.height;
        const maskCtx = mask.getContext('2d');
        if (!maskCtx) return null;

        maskCtx.fillStyle = 'rgba(0, 0, 0, 1)';
        maskCtx.fillRect(0, 0, mask.width, mask.height);

        const overlayPixels = overlayCtx.getImageData(0, 0, overlay.width, overlay.height);
        const maskPixels = maskCtx.getImageData(0, 0, mask.width, mask.height);
        for (let i = 3; i < overlayPixels.data.length; i += 4) {
          if (overlayPixels.data[i] > 0) {
            maskPixels.data[i] = 0;
          }
        }
        maskCtx.putImageData(maskPixels, 0, 0);

        const blob = await canvasToBlob(mask);
        return new File([blob], `mask-${Date.now()}.png`, { type: 'image/png' });
      },
      clearSelection() {
        const overlay = overlayCanvasRef.current;
        const ctx = overlay?.getContext('2d');
        if (!overlay || !ctx) return;
        ctx.clearRect(0, 0, overlay.width, overlay.height);
        hasSelectionRef.current = false;
      },
      hasSelection() {
        return hasSelectionRef.current;
      },
    }));

    return (
      <div className="rounded-3xl shadow-neu-pressed-light dark:shadow-neu-pressed-dark p-3 bg-light dark:bg-dark">
        <div className="relative overflow-hidden rounded-2xl border border-gray-200/60 dark:border-gray-700/60 bg-gray-100 dark:bg-gray-900">
          {!canvasReady && (
            <div className="absolute inset-0 flex items-center justify-center text-gray-400">
              <Loader2 className="animate-spin" size={22} />
            </div>
          )}
          <canvas ref={imageCanvasRef} className="block w-full max-h-[360px] object-contain" />
          <canvas
            ref={overlayCanvasRef}
            className="absolute inset-0 h-full w-full touch-none cursor-crosshair"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={stopDrawing}
            onPointerCancel={stopDrawing}
            onPointerLeave={(event) => {
              if (drawingRef.current) stopDrawing(event);
            }}
          />
        </div>
      </div>
    );
  },
);

MaskEditor.displayName = 'MaskEditor';

function resultToMarkdown(results: OpenAIImageResult[]) {
  return results
    .map((item, index) => {
      const revised = item.revisedPrompt ? `\n\nRevised prompt: ${item.revisedPrompt}` : '';
      return `![Image ${index + 1}](${item.src})${revised}`;
    })
    .join('\n\n');
}

async function downloadImage(src: string, index: number) {
  const link = document.createElement('a');
  link.download = `openai-image-${Date.now()}-${index + 1}.png`;

  if (src.startsWith('data:')) {
    link.href = src;
    link.click();
    return;
  }

  const response = await fetch(src);
  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  link.href = objectUrl;
  link.click();
  URL.revokeObjectURL(objectUrl);
}

export const ImageStudio: React.FC<Props> = ({ isOpen, onClose, onImageClick }) => {
  const [mode, setMode] = useState<ImageMode>('generate');
  const [prompt, setPrompt] = useState('');
  const [model, setModel] = useState('gpt-image-2');
  const [size, setSize] = useState('1024x1024');
  const [count, setCount] = useState(1);
  const [quality, setQuality] = useState('');
  const [background, setBackground] = useState('');
  const [outputFormat, setOutputFormat] = useState<OutputFormat>('png');
  const [brushSize, setBrushSize] = useState(36);
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [sourcePreview, setSourcePreview] = useState<string | null>(null);
  const [results, setResults] = useState<OpenAIImageResult[]>([]);
  const [lastRun, setLastRun] = useState<LastRun | null>(null);
  const [isWorking, setIsWorking] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const maskEditorRef = useRef<MaskEditorHandle>(null);
  const { currentSessionId, addMessage } = useChatStore();
  const { proxyUrl, apiKeys } = useSettingsStore();
  const { addToast } = useToastStore();

  if (!isOpen) return null;

  const ensureReady = (usedPrompt: string) => {
    if (!currentSessionId) {
      addToast('Please create or select a chat first.', 'warning', 3000);
      return false;
    }
    if (!apiKeys.openai) {
      addToast('Please configure the OpenAI API key in settings.', 'error', 4000);
      return false;
    }
    if (!usedPrompt.trim()) {
      addToast('Please enter an image prompt.', 'warning', 3000);
      return false;
    }
    return true;
  };

  const appendResultToChat = async (kind: ImageMode, usedPrompt: string, usedModel: string, images: OpenAIImageResult[]) => {
    if (!currentSessionId) return;

    await addMessage(currentSessionId, {
      role: 'user',
      content: kind === 'edit' ? `Edit selected image area:\n\n${usedPrompt}` : `Generate image:\n\n${usedPrompt}`,
      attachments: kind === 'edit' && sourcePreview ? [sourcePreview] : undefined,
    });

    await addMessage(currentSessionId, {
      role: 'assistant',
      content: resultToMarkdown(images),
      modelUsed: usedModel,
    });
  };

  const runGeneration = async (reuseLast = false) => {
    const run = reuseLast && lastRun ? lastRun : {
      prompt: prompt.trim(),
      model,
      size,
      count,
      quality,
      background,
      outputFormat,
    };

    if (!ensureReady(run.prompt)) return;

    setIsWorking(true);
    try {
      const images = await generateOpenAIImage({
        url: proxyUrl,
        apiKey: apiKeys.openai,
        model: run.model,
        prompt: run.prompt,
        n: run.count,
        size: run.size,
        quality: run.quality || undefined,
        background: run.background || undefined,
        output_format: run.outputFormat,
      });

      setResults((prev) => [...images, ...prev]);
      setLastRun(run);
      await appendResultToChat('generate', run.prompt, run.model, images);
      addToast('Image generated successfully.', 'success', 2500);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      addToast(`Image generation failed: ${message}`, 'error', 5000);
    } finally {
      setIsWorking(false);
    }
  };

  const runEdit = async () => {
    if (!ensureReady(prompt.trim())) return;
    if (!sourceFile || !sourcePreview) {
      addToast('Please upload an image to edit.', 'warning', 3000);
      return;
    }
    if (!maskEditorRef.current?.hasSelection()) {
      addToast('Please brush over the area you want to edit.', 'warning', 3000);
      return;
    }

    setIsWorking(true);
    try {
      const mask = await maskEditorRef.current.exportMaskFile();
      if (!mask) {
        throw new Error('Failed to create selection mask');
      }

      const images = await editOpenAIImage({
        url: proxyUrl,
        apiKey: apiKeys.openai,
        model,
        prompt: prompt.trim(),
        image: sourceFile,
        mask,
        n: count,
        size,
        quality: quality || undefined,
        background: background || undefined,
        output_format: outputFormat,
      });

      setResults((prev) => [...images, ...prev]);
      await appendResultToChat('edit', prompt.trim(), model, images);
      addToast('Image edited successfully.', 'success', 2500);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      addToast(`Image edit failed: ${message}`, 'error', 5000);
    } finally {
      setIsWorking(false);
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      addToast('Please choose an image file.', 'warning', 3000);
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setSourceFile(file);
      setSourcePreview(reader.result as string);
    };
    reader.onerror = () => addToast('Failed to read the image file.', 'error', 3000);
    reader.readAsDataURL(file);
    event.target.value = '';
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-light/80 dark:bg-dark/80 backdrop-blur-md p-3 md:p-6">
      <div className="w-full max-w-6xl max-h-[92vh] overflow-hidden rounded-3xl bg-light dark:bg-dark shadow-neu-light dark:shadow-neu-dark flex flex-col">
        <header className="flex items-center justify-between gap-4 px-5 md:px-7 py-5 border-b border-gray-200/60 dark:border-gray-700/60">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-2xl shadow-neu-pressed-light dark:shadow-neu-pressed-dark flex items-center justify-center text-blue-500">
              <ImageIcon size={22} />
            </div>
            <div className="min-w-0">
              <h3 className="text-lg font-bold text-gray-700 dark:text-gray-100">OpenAI Image Studio</h3>
              <p className="text-xs text-gray-400 truncate">Generate, download, repeat, or edit selected image regions.</p>
            </div>
          </div>
          <button onClick={onClose} className={`${neuBtn} w-10 h-10 rounded-full`} aria-label="Close image studio">
            <X size={20} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-7 grid grid-cols-1 lg:grid-cols-[420px_1fr] gap-6">
          <section className="space-y-5">
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setMode('generate')}
                className={`${neuBtn} h-12 font-bold ${mode === 'generate' ? 'text-blue-500 shadow-neu-pressed-light dark:shadow-neu-pressed-dark' : ''}`}
              >
                <Sparkles size={18} className="mr-2" /> Generate
              </button>
              <button
                onClick={() => setMode('edit')}
                className={`${neuBtn} h-12 font-bold ${mode === 'edit' ? 'text-blue-500 shadow-neu-pressed-light dark:shadow-neu-pressed-dark' : ''}`}
              >
                <Brush size={18} className="mr-2" /> Edit
              </button>
            </div>

            <textarea
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              placeholder={mode === 'edit' ? 'Describe how the selected area should change...' : 'Describe the image you want to generate...'}
              className={`${neuInput} min-h-32 resize-none`}
            />

            <div className="grid grid-cols-2 gap-3">
              <label className="space-y-2 text-xs font-bold text-gray-400">
                Model
                <select value={model} onChange={(event) => setModel(event.target.value)} className={neuInput}>
                  <option className={optionClass} value="gpt-image-2">gpt-image-2</option>
                  <option className={optionClass} value="gpt-image-1">gpt-image-1</option>
                </select>
              </label>

              <label className="space-y-2 text-xs font-bold text-gray-400">
                Size
                <select value={size} onChange={(event) => setSize(event.target.value)} className={neuInput}>
                  <option className={optionClass} value="1024x1024">1024x1024</option>
                  <option className={optionClass} value="1024x1536">1024x1536</option>
                  <option className={optionClass} value="1536x1024">1536x1024</option>
                  <option className={optionClass} value="auto">auto</option>
                </select>
              </label>

              <label className="space-y-2 text-xs font-bold text-gray-400">
                Count
                <select value={count} onChange={(event) => setCount(Number(event.target.value))} className={neuInput}>
                  <option className={optionClass} value={1}>1</option>
                  <option className={optionClass} value={2}>2</option>
                  <option className={optionClass} value={4}>4</option>
                </select>
              </label>

              <label className="space-y-2 text-xs font-bold text-gray-400">
                Format
                <select value={outputFormat} onChange={(event) => setOutputFormat(event.target.value as OutputFormat)} className={neuInput}>
                  <option className={optionClass} value="png">png</option>
                  <option className={optionClass} value="jpeg">jpeg</option>
                  <option className={optionClass} value="webp">webp</option>
                </select>
              </label>

              <label className="space-y-2 text-xs font-bold text-gray-400">
                Quality
                <select value={quality} onChange={(event) => setQuality(event.target.value)} className={neuInput}>
                  <option className={optionClass} value="">default</option>
                  <option className={optionClass} value="low">low</option>
                  <option className={optionClass} value="medium">medium</option>
                  <option className={optionClass} value="high">high</option>
                </select>
              </label>

              <label className="space-y-2 text-xs font-bold text-gray-400">
                Background
                <select value={background} onChange={(event) => setBackground(event.target.value)} className={neuInput}>
                  <option className={optionClass} value="">default</option>
                  <option className={optionClass} value="auto">auto</option>
                  <option className={optionClass} value="transparent">transparent</option>
                  <option className={optionClass} value="opaque">opaque</option>
                </select>
              </label>
            </div>

            {mode === 'edit' && (
              <div className="space-y-3">
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
                <button onClick={() => fileInputRef.current?.click()} className={`${neuBtn} w-full h-12 font-bold`}>
                  <Upload size={18} className="mr-2" /> Upload image to edit
                </button>

                {sourcePreview && (
                  <>
                    <div className="flex items-center justify-between gap-3">
                      <label className="flex-1 space-y-2 text-xs font-bold text-gray-400">
                        Brush size
                        <input
                          type="range"
                          min={8}
                          max={96}
                          value={brushSize}
                          onChange={(event) => setBrushSize(Number(event.target.value))}
                          className="w-full accent-blue-500"
                        />
                      </label>
                      <button
                        onClick={() => maskEditorRef.current?.clearSelection()}
                        className={`${neuBtn} h-11 px-4 rounded-xl`}
                        title="Clear selection"
                      >
                        <Eraser size={17} />
                      </button>
                    </div>
                    <MaskEditor ref={maskEditorRef} imageSrc={sourcePreview} brushSize={brushSize} />
                    <p className="text-xs text-gray-400 leading-5">
                      Brush over the part you want to replace. The selected pixels are exported as a transparent mask for the ACS Gateway edits endpoint.
                    </p>
                  </>
                )}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                onClick={() => mode === 'edit' ? runEdit() : runGeneration(false)}
                disabled={isWorking}
                className={`${neuBtn} h-14 py-4 rounded-2xl font-bold text-blue-500 disabled:opacity-60 disabled:cursor-not-allowed`}
              >
                {isWorking ? <Loader2 size={18} className="mr-2 animate-spin" /> : <Sparkles size={18} className="mr-2" />}
                {mode === 'edit' ? 'Edit Image' : 'Generate'}
              </button>
              <button
                onClick={() => runGeneration(true)}
                disabled={isWorking || !lastRun}
                className={`${neuBtn} h-14 py-4 rounded-2xl font-bold disabled:opacity-50 disabled:cursor-not-allowed`}
                title="Generate again with the previous generation settings"
              >
                <RefreshCw size={18} className="mr-2" /> Generate Again
              </button>
            </div>
          </section>

          <section className="min-h-[360px] rounded-3xl shadow-neu-pressed-light dark:shadow-neu-pressed-dark p-4 bg-light dark:bg-dark">
            {results.length === 0 ? (
              <div className="h-full min-h-[360px] flex flex-col items-center justify-center text-center text-gray-400">
                <ImageIcon size={54} className="mb-4 opacity-60" />
                <p className="font-bold">Generated and edited images will appear here.</p>
                <p className="text-xs mt-2 max-w-sm">Each result is also appended to the current chat so you can preview and download later.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {results.map((item, index) => (
                  <div key={`${item.src.slice(0, 40)}-${index}`} className="group relative rounded-2xl overflow-hidden shadow-neu-light dark:shadow-neu-dark bg-light dark:bg-dark">
                    <img
                      src={item.src}
                      alt={`Generated result ${index + 1}`}
                      onClick={() => onImageClick?.(item.src)}
                      className="w-full aspect-square object-cover cursor-zoom-in"
                    />
                    <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex justify-end">
                      <button
                        onClick={() => downloadImage(item.src, index)}
                        className="px-3 py-2 rounded-full bg-white/20 text-white hover:bg-white/40 backdrop-blur-md flex items-center gap-2 text-sm font-bold"
                      >
                        <Download size={16} /> Download
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};
