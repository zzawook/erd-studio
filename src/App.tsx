import { useEffect, useCallback } from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import { Toolbar } from './components/Toolbar';
import { Sidebar } from './components/Sidebar';
import { Canvas } from './components/Canvas';
import { PropertiesPanel } from './components/PropertiesPanel';
import { ResizablePanel } from './components/ResizablePanel';
import { ToastContainer } from './components/Toast';
import { useERDStore } from './ir/store';

function App() {
  const setSelection = useERDStore((s) => s.setSelection);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Don't intercept when user is typing in an input/textarea/select
    const tag = (e.target as HTMLElement)?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

    // Escape: deselect
    if (e.key === 'Escape') {
      setSelection(null);
    }
  }, [setSelection]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return (
    <ReactFlowProvider>
      <div className="h-screen w-screen flex flex-col bg-gray-100 font-sans antialiased">
        <Toolbar />
        <div className="flex flex-1 overflow-hidden">
          <ResizablePanel defaultWidth={280} minWidth={260} maxWidth={500} side="left">
            <Sidebar />
          </ResizablePanel>
          <Canvas />
          <ResizablePanel defaultWidth={288} minWidth={200} maxWidth={500} side="right">
            <PropertiesPanel />
          </ResizablePanel>
        </div>
        <ToastContainer />
      </div>
    </ReactFlowProvider>
  );
}

export default App;
