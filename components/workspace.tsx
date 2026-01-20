"use client";

import CodePane from "@/components/code-pane";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import VizPane from "@/components/viz-pane";

export default function Workspace() {
  return (
    <div className="flex flex-1 flex-col min-h-0">
      <ResizablePanelGroup direction="horizontal" className="flex-1">
        <ResizablePanel defaultSize={30}>
          <CodePane />
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel defaultSize={40}>
          <VizPane />
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
