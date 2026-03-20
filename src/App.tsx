import { ReactFlowProvider } from '@xyflow/react';
import { Toolbar } from './components/Toolbar';
import { Sidebar } from './components/Sidebar';
import { Canvas } from './components/Canvas';
import { PropertiesPanel } from './components/PropertiesPanel';
import { ResizablePanel } from './components/ResizablePanel';

function App() {
  return (
    <ReactFlowProvider>
      <div className="h-screen w-screen flex flex-col">
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
      </div>
    </ReactFlowProvider>
  );
}

export default App;
