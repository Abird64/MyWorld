import { useState, useCallback } from 'react';
import { NavBar } from '@/components/ui';
import { PageContainer } from '@/components/layout';
import { useUIStore } from '@/stores/uiStore';
import { useInspirationStore } from '@/stores/inspirationStore';
import type { BilibiliVideoInfo } from '@/services/inspirationService';
import type { InspirationNote } from '@/types/inspiration';
import { NotesList } from './NotesList';
import { NoteEditor } from './NoteEditor';
import { NoteDetail } from './NoteDetail';
import { VideoParser } from './VideoParser';
import { SettingsSection } from './SettingsSection';

// ─── 视图状态 ───

type ViewMode = 'list' | 'detail' | 'editor' | 'video-parse' | 'settings';

interface ViewState {
  mode: ViewMode;
  noteId?: string;
  prefill?: Partial<InspirationNote>;
}

export function InspirationPage() {
  const goBack = useUIStore((s) => s.goBack);

  // 使用共享的 inspirationStore
  const notes = useInspirationStore((s) => s.notes);
  const addNote = useInspirationStore((s) => s.addNote);
  const updateNote = useInspirationStore((s) => s.updateNote);
  const deleteNote = useInspirationStore((s) => s.deleteNote);

  const [viewStack, setViewStack] = useState<ViewState[]>([{ mode: 'list' }]);
  const currentView = viewStack[viewStack.length - 1];

  const pushView = useCallback((view: ViewState) => {
    setViewStack((prev) => [...prev, view]);
  }, []);

  const popView = useCallback(() => {
    setViewStack((prev) => (prev.length > 1 ? prev.slice(0, -1) : prev));
  }, []);

  // ─── 导航 ───

  const handleOpenNote = useCallback((id: string) => pushView({ mode: 'detail', noteId: id }), [pushView]);
  const handleEditNote = useCallback((id?: string, prefill?: Partial<InspirationNote>) => pushView({ mode: 'editor', noteId: id, prefill }), [pushView]);
  const handleOpenVideoParse = useCallback(() => pushView({ mode: 'video-parse' }), [pushView]);
  const handleOpenSettings = useCallback(() => pushView({ mode: 'settings' }), [pushView]);

  const handleVideoParsed = useCallback((
    title: string, content: string, sourceUrl: string, videoInfo: BilibiliVideoInfo,
  ) => {
    pushView({ mode: 'editor', prefill: { title, content, categoryId: 'zhishi', sourceUrl, sourceTitle: videoInfo.title, tags: ['视频笔记'] } });
  }, [pushView]);

  const handleBack = useCallback(() => {
    if (viewStack.length > 1) popView();
    else goBack();
  }, [viewStack.length, popView, goBack]);

  // ─── 渲染 ───

  const renderContent = () => {
    switch (currentView.mode) {
      case 'list':
        return (
          <NotesList
            notes={notes}
            onOpenNote={handleOpenNote}
            onCreateManual={() => handleEditNote()}
            onCreateVideo={handleOpenVideoParse}
            onOpenSettings={handleOpenSettings}
            onDeleteNote={deleteNote}
            onTogglePin={(id) => {
              const note = notes.find((n) => n.id === id);
              if (note) updateNote(id, { pinned: !note.pinned });
            }}
          />
        );
      case 'detail':
        return (
          <NoteDetail
            note={notes.find((n) => n.id === currentView.noteId)!}
            onEdit={() => handleEditNote(currentView.noteId)}
            onDelete={() => { deleteNote(currentView.noteId!); popView(); }}
            onTogglePin={() => {
              const note = notes.find((n) => n.id === currentView.noteId);
              if (note) updateNote(currentView.noteId!, { pinned: !note.pinned });
            }}
          />
        );
      case 'editor':
        return (
          <NoteEditor
            note={currentView.noteId ? notes.find((n) => n.id === currentView.noteId) : undefined}
            prefill={currentView.prefill}
            onSave={(data) => {
              if (currentView.noteId) {
                updateNote(currentView.noteId, data);
                popView();
              } else {
                const newNote = addNote(data);
                setViewStack((prev) => [...prev.slice(0, -1), { mode: 'detail', noteId: newNote.id }]);
              }
            }}
            onCancel={popView}
          />
        );
      case 'video-parse':
        return <VideoParser onParsed={handleVideoParsed} onBack={popView} />;
      case 'settings':
        return <SettingsSection onBack={popView} />;
    }
  };

  return (
    <PageContainer className="relative">
      <NavBar title="灵感笔记" onBack={handleBack} />
      {renderContent()}
    </PageContainer>
  );
}
