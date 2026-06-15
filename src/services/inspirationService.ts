/**
 * 灵感捕手服务 - 封装 B 站视频解析相关的 Tauri 命令调用
 */
import { tauriInvoke } from './tauri';

export interface SubtitleEntry {
  lang: string;
  url: string;
}

export interface BilibiliVideoInfo {
  bvid: string;
  cid: number;
  title: string;
  author: string;
  desc: string;
  duration: number;
  view: number;
  subtitles: SubtitleEntry[];
}

export interface SubtitleSegment {
  text: string;
  from: number;
  to: number;
}

export interface SubtitleContent {
  fullText: string;
  segments: SubtitleSegment[];
}

/** 获取 B 站视频信息和字幕列表 */
export async function fetchBilibiliVideoInfo(url: string, sessdata?: string): Promise<BilibiliVideoInfo> {
  return tauriInvoke<BilibiliVideoInfo>('fetch_bilibili_video_info', { url, sessdata: sessdata || null });
}

/** 下载字幕内容 */
export async function fetchBilibiliSubtitle(subtitleUrl: string): Promise<SubtitleContent> {
  return tauriInvoke<SubtitleContent>('fetch_bilibili_subtitle', { subtitleUrl });
}

/** B 站扫码登录 — 获取二维码 URL */
export async function bilibiliQrcodeUrl(): Promise<{ url: string; qrcode_key: string }> {
  return tauriInvoke<{ url: string; qrcode_key: string }>('bilibili_qrcode_url');
}

/** B 站扫码登录 — 轮询登录状态 */
export async function bilibiliPollQrcode(qrcodeKey: string): Promise<{ code: number; message: string; data?: { code: number; message: string; url?: string; refresh_token?: string }; sessdata?: string }> {
  return tauriInvoke('bilibili_poll_qrcode', { qrcodeKey });
}

/** 打开 B 站登录窗口（WebView 方式，支持短信/密码/扫码） */
export async function bilibiliOpenLoginWindow(): Promise<void> {
  return tauriInvoke<void>('bilibili_open_login_window');
}

/** 初始化验证码，获取极验参数 */
export async function bilibiliCaptchaInit(): Promise<{ geetest: { gt: string; challenge: string }; captcha_id: string; token: string }> {
  return tauriInvoke('bilibili_captcha_init');
}

/** 发送短信验证码 */
export async function bilibiliSendSms(params: {
  tel: string; cid: string; token: string;
  gt: string; challenge: string; validate: string; seccode: string;
}): Promise<{ code: number; message: string }> {
  return tauriInvoke('bilibili_send_sms', params);
}

/** 短信验证码登录 */
export async function bilibiliSmsLogin(params: {
  cid: string; token: string; sms_code: string;
}): Promise<{ code: number; message: string; sessdata?: string }> {
  return tauriInvoke('bilibili_sms_login', params);
}
