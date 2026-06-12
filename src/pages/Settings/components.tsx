import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { usePluginStore } from '@/stores/pluginStore';
import { useSettingStore } from '@/stores/settingStore';

export interface SettingsStyles {
  card: string;
  cardBorder: string;
  text: string;
  textSub: string;
  accent: string;
  accentDim: string;
  danger: string;
  dangerDim: string;
  inputBg: string;
  inputBorder: string;
  overlay: (opacity: number) => string;
}

export function Section({ sectionKey: _sectionKey, title, children, styles, expanded, onToggle }: {
  sectionKey: string;
  title: string;
  children: React.ReactNode;
  styles: SettingsStyles;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <Card
      className="w-full p-5"
      style={{ backgroundColor: styles.card, border: `0.5px solid ${styles.cardBorder}` }}
    >
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between mb-4 text-left"
        aria-expanded={expanded}
      >
        <h3 className="text-xl font-medium" style={{ color: styles.text }}>
          {title}
        </h3>
        <ChevronDown
          size={18}
          style={{
            color: styles.textSub,
            transform: expanded ? 'rotate(180deg)' : 'none',
            transition: 'transform 0.2s ease',
          }}
        />
      </button>
      {expanded && (
        <div className="space-y-4">
          {children}
        </div>
      )}
    </Card>
  );
}

export function ToggleRow({ label, checked, onChange, styles, disabled = false }: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  styles: SettingsStyles;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-base" style={{ color: styles.textSub }}>{label}</span>
      <button
        onClick={() => !disabled && onChange(!checked)}
        role="switch"
        aria-checked={checked}
        aria-label={label}
        className="relative w-11 h-6 rounded-full transition-colors"
        style={{
          backgroundColor: checked ? styles.accent : styles.overlay(0.2),
          opacity: disabled ? 0.5 : 1,
          cursor: disabled ? 'not-allowed' : 'pointer',
        }}
      >
        <div
          className="absolute top-0.5 w-5 h-5 bg-white rounded-full transition-transform"
          style={{ left: checked ? '22px' : '2px' }}
        />
      </button>
    </div>
  );
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

export function InputRow({ label, value, onChange, styles, type = 'text', placeholder = '' }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  styles: SettingsStyles;
  type?: string;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="text-sm mb-1.5 block" style={{ color: styles.textSub }}>{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 rounded-lg text-sm outline-none"
        style={{ backgroundColor: styles.inputBg, border: `1px solid ${styles.inputBorder}`, color: styles.text }}
      />
    </div>
  );
}

export function SelectRow({ label, value, options, onChange, styles }: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
  styles: SettingsStyles;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = options.find(o => o.value === value);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <label className="text-sm mb-1.5 block" style={{ color: styles.textSub }}>{label}</label>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full px-3 py-2 rounded-lg text-sm text-left flex items-center justify-between"
        style={{ backgroundColor: styles.inputBg, border: `1px solid ${styles.inputBorder}`, color: styles.text }}
      >
        <span>{selected?.label ?? value}</span>
        <ChevronDown size={14} style={{ color: styles.textSub, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
      </button>
      {open && (
        <div
          className="absolute z-50 w-full mt-1 rounded-lg overflow-hidden shadow-lg"
          style={{ backgroundColor: styles.card, border: `1px solid ${styles.inputBorder}` }}
        >
          {options.map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => { onChange(opt.value); setOpen(false); }}
              className="w-full px-3 py-2 text-sm text-left transition-colors"
              style={{
                color: opt.value === value ? styles.accent : styles.text,
                backgroundColor: opt.value === value ? styles.accentDim : 'transparent',
              }}
              onMouseEnter={e => { if (opt.value !== value) (e.currentTarget.style.backgroundColor = styles.overlay(0.06)); }}
              onMouseLeave={e => { if (opt.value !== value) (e.currentTarget.style.backgroundColor = 'transparent'); }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** 插件管理区块：列出所有已注册插件，支持启用/禁用 */
export function PluginSection({ styles }: { styles: SettingsStyles }) {
  const plugins = usePluginStore((s) => s.plugins);
  const settings = useSettingStore();
  const pluginList = Object.values(plugins);

  if (pluginList.length === 0) {
    return (
      <p className="text-sm" style={{ color: styles.textSub }}>暂无可用插件</p>
    );
  }

  return (
    <div className="space-y-3">
      {pluginList.map((p) => {
        const enabled = settings.get(`plugin.${p.id}.enabled`, 'true') !== 'false';
        const Icon = p.icon;
        return (
          <div
            key={p.id}
            className="flex items-center gap-3 p-3 rounded-xl"
            style={{ backgroundColor: styles.overlay(0.04) }}
          >
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: p.iconBg }}
            >
              <Icon size={18} style={{ color: p.iconColor }} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[15px] font-medium" style={{ color: styles.text }}>{p.name}</div>
              <div className="text-xs truncate" style={{ color: styles.textSub }}>{p.description}</div>
            </div>
            <ToggleRow
              label=""
              checked={enabled}
              onChange={(v) => settings.set(`plugin.${p.id}.enabled`, String(v))}
              styles={styles}
            />
          </div>
        );
      })}
    </div>
  );
}
