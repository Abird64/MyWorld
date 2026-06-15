import { useState, useCallback } from 'react';
import { useAppTheme, withAlpha } from '@/stores/themeStore';
import { useSettingStore } from '@/stores/settingStore';
import { useUIStore } from '@/stores/uiStore';
import * as inspirationService from '@/services/inspirationService';
import type { BilibiliVideoInfo, SubtitleContent } from '@/services/inspirationService';
import {
  Search, Loader2, AlertCircle, FileText, Lightbulb,
  Bookmark, ChevronRight, MessageCircle,
} from 'lucide-react';

interface VideoParserProps {
  onParsed: (title: string, content: string, sourceUrl: string, videoInfo: BilibiliVideoInfo) => void;
  onBack: () => void;
}

export function VideoParser({ onParsed, onBack: _onBack }: VideoParserProps) {
  const appTheme = useAppTheme();
  const txt = appTheme.ink;
  const txtMid = withAlpha(txt, 0.5);
  const txtMeta = withAlpha(txt, 0.4);

  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [statusText, setStatusText] = useState('');
  const [error, setError] = useState('');
  const [videoInfo, setVideoInfo] = useState<BilibiliVideoInfo | null>(null);
  const [subtitle, setSubtitle] = useState<SubtitleContent | null>(null);

  const formatDuration = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  const formatViews = (n: number) => n >= 10000 ? (n / 10000).toFixed(1) + '万' : n.toLocaleString();

  const handleAnalyze = useCallback(async () => {
    if (!url.trim()) { setError('请输入视频链接'); return; }
    setLoading(true); setError(''); setVideoInfo(null); setSubtitle(null);
    try {
      const settings = useSettingStore.getState();
      const sessdata = settings.get('inspiration.bilibili_sessdata', '');
      setStatusText('正在获取视频信息...');
      const info = await inspirationService.fetchBilibiliVideoInfo(url.trim(), sessdata || undefined);
      setVideoInfo(info);
      let subtitleText = '';
      if (info.subtitles.length > 0) {
        setStatusText('正在下载字幕...');
        const zhSub = info.subtitles.find(s => s.lang.includes('中') || s.lang.includes('zh'));
        const sub = zhSub || info.subtitles[0];
        const subData = await inspirationService.fetchBilibiliSubtitle(sub.url);
        setSubtitle(subData);
        subtitleText = subData.fullText;
      } else {
        subtitleText = `视频标题：${info.title}\n视频简介：${info.desc}`;
        setSubtitle({ fullText: subtitleText, segments: [] });
      }
      setStatusText('');
    } catch (err: unknown) { setError(err instanceof Error ? err.message : String(err)); }
    setLoading(false);
  }, [url]);

  const handleSaveAsNote = () => {
    if (!videoInfo || !subtitle) return;
    onParsed(videoInfo.title, subtitle.fullText, url, videoInfo);
  };

  // ── 与提灯讨论：跳转到 AI 对话，字幕作为引用上下文 ──
  const handleDiscussWithAI = () => {
    if (!videoInfo || !subtitle) return;

    const uiStore = useUIStore.getState();
    uiStore.setChatContext({
      label: `📺 ${videoInfo.title}`,
      content: subtitle.fullText.slice(0, 6000),
      sourceUrl: url,
    });
    uiStore.setActiveTab('chat');
  };

  return (
    <div className="flex-1 overflow-y-auto px-4 sm:px-8 pt-6 pb-8">
      <div className="max-w-[1000px] mx-auto space-y-5">

        {/* 输入区 */}
        <div className="rounded-[18px] p-4" style={{ backgroundColor: appTheme.canvas, border: `0.5px solid ${appTheme.hairline}` }}>
          <div className="flex items-center gap-2 mb-3">
            <Search size={16} style={{ color: txtMid }} />
            <span className="text-sm font-medium" style={{ color: txt }}>B 站视频链接</span>
          </div>
          <div className="flex gap-2">
            <input
              type="text" value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !loading && handleAnalyze()}
              placeholder="粘贴视频链接..."
              className="flex-1 px-4 py-2.5 rounded-full text-sm outline-none"
              style={{ backgroundColor: withAlpha(txt, 0.04), color: txt, border: `1px solid ${appTheme.hairline}` }}
            />
            <button
              onClick={handleAnalyze} disabled={loading || !url.trim()}
              className="px-5 py-2.5 rounded-full text-sm font-medium text-white flex items-center gap-1.5 transition-opacity"
              style={{ backgroundColor: appTheme.primary, opacity: loading || !url.trim() ? 0.5 : 1 }}
            >
              {loading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}解析
            </button>
          </div>
        </div>

        {/* 状态/错误 */}
        {statusText && (
          <div className="flex items-center gap-2 px-4 py-3 rounded-[18px] text-sm"
            style={{ backgroundColor: withAlpha(appTheme.primary, 0.08), color: appTheme.primary }}>
            <Loader2 size={14} className="animate-spin" />{statusText}
          </div>
        )}
        {error && (
          <div className="flex items-center gap-2 px-4 py-3 rounded-[18px] text-sm"
            style={{ backgroundColor: withAlpha(appTheme.danger, 0.08), color: appTheme.danger }}>
            <AlertCircle size={14} />{error}
          </div>
        )}

        {/* 视频信息 */}
        {videoInfo && (
          <div className="rounded-[18px] p-4" style={{ backgroundColor: appTheme.canvas, border: `0.5px solid ${appTheme.hairline}` }}>
            <div className="flex items-center gap-2 mb-2">
              <Lightbulb size={14} style={{ color: '#FF9800' }} />
              <span className="text-sm font-medium" style={{ color: txt }}>{videoInfo.title}</span>
            </div>
            <div className="text-xs" style={{ color: txtMeta }}>@{videoInfo.author} · {formatViews(videoInfo.view)} 播放 · {formatDuration(videoInfo.duration)}</div>
            <div className="mt-2">
              {videoInfo.subtitles.length > 0 ? (
                <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: withAlpha(appTheme.success, 0.12), color: appTheme.success }}>
                  发现 {videoInfo.subtitles.length} 个字幕
                </span>
              ) : (
                <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: withAlpha(appTheme.warning, 0.12), color: appTheme.warning }}>
                  无字幕，将用标题和简介
                </span>
              )}
            </div>
          </div>
        )}

        {/* 字幕预览 */}
        {subtitle && (
          <div className="rounded-[18px] p-4" style={{ backgroundColor: appTheme.canvas, border: `0.5px solid ${appTheme.hairline}` }}>
            <div className="flex items-center gap-2 mb-2">
              <FileText size={14} style={{ color: txtMid }} />
              <span className="text-sm font-medium" style={{ color: txt }}>
                字幕内容 <span className="font-normal" style={{ color: txtMeta }}>{subtitle.fullText.length} 字</span>
              </span>
            </div>
            <div className="text-sm leading-relaxed max-h-[120px] overflow-y-auto rounded-xl p-3"
              style={{ backgroundColor: withAlpha(txt, 0.03), color: txtMid }}>
              {subtitle.fullText.slice(0, 800)}{subtitle.fullText.length > 800 && '...'}
            </div>
          </div>
        )}

        {/* ── 操作按钮：保存为笔记 + 与启灯讨论 ── */}
        {videoInfo && subtitle && (
          <div className="flex gap-3">
            <button onClick={handleSaveAsNote}
              className="flex-1 py-3 rounded-full text-sm font-medium flex items-center justify-center gap-2"
              style={{ backgroundColor: withAlpha(appTheme.primary, 0.1), color: appTheme.primary, border: `1px solid ${withAlpha(appTheme.primary, 0.2)}` }}>
              <Bookmark size={16} />保存字幕为笔记
            </button>
            <button onClick={handleDiscussWithAI}
              className="flex-1 py-3 rounded-full text-sm font-medium text-white flex items-center justify-center gap-2"
              style={{ backgroundColor: '#5856d6' }}>
              <MessageCircle size={16} />与提灯讨论
              <ChevronRight size={14} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
