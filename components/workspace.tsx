"use client";

import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";

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
      <div className="flex border-2 mx-2 mb-2 bg-background p-4 shadow-sm">
        <button type="button" className="px-1 -ml-2">
          <ChevronLeftIcon className="size-4" />
        </button>
        <button type="button" className="px-1 mr-2">
          <ChevronRightIcon className="size-4" />
        </button>
      </div>
    </div>
  );
}
