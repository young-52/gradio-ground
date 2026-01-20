"use client";

import Image from "next/image";
import Link from "next/link";
import { useSyncExternalStore } from "react";
import {
  Menubar,
  MenubarContent,
  MenubarItem,
  MenubarMenu,
  MenubarShortcut,
  MenubarTrigger,
} from "@/components/ui/menubar";
import { useAppState } from "@/store/use-app-state";

export default function NavBar() {
  const run = useAppState((s) => s.run);

  const mounted = useSyncExternalStore(
    () => () => {}, // nothing to subscribe to
    () => true, // true on the client
    () => false, // false on the server
  );

  const cKey = mounted ? (navigator.userAgent.includes("Mac") ? "⌘" : "Ctrl+") : "";

  return (
    <div className="relative border-b-2">
      <div className="relative z-20 flex items-center justify-between px-6 py-2">
        <div className="flex gap-7">
          <Link href="/">
            <div className="h-10 flex items-center gap-0">
              {/* Support the dark theme */}
              <Image
                src="/gradio-text.svg"
                alt="gradio"
                width={64}
                height={32}
                preload={true}
                style={{ width: "auto" }}
                className="dark:invert"
              />
              <span className="font-sans font-light text-md relative -top-[1px]">
                ground
              </span>
            </div>
          </Link>
          {mounted && (
            <Menubar className="h-10.5 border-none shadow-none">
              <MenubarMenu>
                <MenubarTrigger className="text-md font-normal">
                  파일
                </MenubarTrigger>
                <MenubarContent>
                <MenubarItem onClick={run}>실행 <MenubarShortcut>{cKey}⏎</MenubarShortcut></MenubarItem>
                  <MenubarItem disabled>저장 <MenubarShortcut>{cKey}S</MenubarShortcut></MenubarItem>
                </MenubarContent>
              </MenubarMenu>
              <MenubarMenu>
                <MenubarTrigger className="text-md font-normal">
                  편집
                </MenubarTrigger>
                <MenubarContent>
                  <MenubarItem disabled>정리</MenubarItem>
                </MenubarContent>
              </MenubarMenu>
            </Menubar>
          )}
        </div>
      </div>
    </div>
  );
}
