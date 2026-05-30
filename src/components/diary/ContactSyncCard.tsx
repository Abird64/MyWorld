import { useState } from 'react';
import { Check, Plus, X } from 'lucide-react';
import { useAppTheme } from '@/stores/themeStore';
import type { ExtractedContact } from '@/types/journal';
import * as contactService from '@/services/contactService';

interface ContactSyncCardProps {
  contact: ExtractedContact;
  onSync: (name: string) => void;
  onIgnore: (name: string) => void;
}

export function ContactSyncCard({ contact, onSync, onIgnore }: ContactSyncCardProps) {
  const appTheme = useAppTheme();
  const [syncing, setSyncing] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [createNotes, setCreateNotes] = useState(contact.event_summary);
  const [creating, setCreating] = useState(false);
  const [done, setDone] = useState(false);

  if (done) return null;

  const handleSync = async () => {
    if (!contact.existing_contact_id) return;
    setSyncing(true);
    try {
      await contactService.updateContact(contact.existing_contact_id, {
        notes: `[${new Date().toISOString().slice(0, 10)}] ${contact.event_summary}`,
      });
      setDone(true);
      onSync(contact.name);
    } catch {
      setSyncing(false);
    }
  };

  const handleCreate = async () => {
    setCreating(true);
    try {
      await contactService.createContact({
        name: contact.name,
        notes: createNotes || contact.event_summary,
      });
      setDone(true);
      onSync(contact.name);
    } catch {
      setCreating(false);
    }
  };

  const matched = !!contact.existing_contact_id;

  const TXT = appTheme.ink;
  const TXT_DIM = appTheme.inkMuted80;
  const TXT_MUTED = appTheme.inkMuted48;
  const SURFACE = appTheme.canvasParchment;
  const INPUT_BG = appTheme.canvas;
  const HOVER_BG = appTheme.divider;
  const BTN_IGNORE = appTheme.inkMuted48;

  return (
    <div className="rounded-xl p-4 flex flex-col gap-3" style={{ backgroundColor: SURFACE }}>
      {/* 头部：姓名 + 事件 */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-base" style={{ color: TXT }}>
              {contact.name}
            </span>
            {matched && contact.existing_contact_name && contact.existing_contact_name !== contact.name && (
              <span className="text-xs" style={{ color: TXT_DIM }}>
                → {contact.existing_contact_name}
              </span>
            )}
            {matched ? (
              <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400">
                已存在
              </span>
            ) : (
              <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400">
                新联系人
              </span>
            )}
          </div>
          <p className="text-sm mt-1" style={{ color: TXT_DIM }}>
            {contact.event_summary}
          </p>
        </div>
      </div>

      {/* 操作按钮 */}
      <div className="flex items-center gap-2">
        {matched ? (
          <button
            onClick={handleSync}
            disabled={syncing}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 text-sm transition-colors disabled:opacity-50"
          >
            <Check size={14} />
            {syncing ? '同步中...' : '同步备注'}
          </button>
        ) : showCreate ? (
          <div className="flex-1 flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <input
                className="flex-1 rounded-lg px-3 py-1.5 text-sm focus:outline-none"
                style={{
                  backgroundColor: INPUT_BG,
                  color: TXT,
                }}
                value={createNotes}
                onChange={(e) => setCreateNotes(e.target.value)}
                placeholder="备注..."
              />
              <button
                onClick={handleCreate}
                disabled={creating}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-400 text-sm transition-colors disabled:opacity-50 whitespace-nowrap"
              >
                <Plus size={14} />
                {creating ? '创建中...' : '创建'}
              </button>
              <button
                onClick={() => setShowCreate(false)}
                className="p-1.5 rounded-lg transition-colors"
                style={{ color: TXT_MUTED }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = HOVER_BG)}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                <X size={14} />
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-400 text-sm transition-colors"
          >
            <Plus size={14} />
            手动创建
          </button>
        )}

        <button
          onClick={() => { setDone(true); onIgnore(contact.name); }}
          className="px-3 py-1.5 rounded-lg text-sm transition-colors"
          style={{ color: BTN_IGNORE }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = HOVER_BG)}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
        >
          忽略
        </button>
      </div>
    </div>
  );
}
