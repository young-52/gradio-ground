"use client";

import Image from "next/image";
import Link from "next/link";
import { useSyncExternalStore } from "react";
import {
  Menubar,
  MenubarContent,
  MenubarItem,
  MenubarMenu,
  MenubarTrigger,
} from "@/components/ui/menubar";

export default function NavBar() {
  const mounted = useSyncExternalStore(
    () => () => {}, // nothing to subscribe to
    () => true, // true on the client
    () => false, // false on the server
  );

  return (
    <div className="relative border-b-2">
      <div className="relative z-20 flex items-center justify-between px-3 py-2">
        <div className="flex gap-7">
          <Link href="/">
            <div className="h-10 flex items-center gap-0">
              <Image
                src="/gradio-text.svg"
                alt="gradio"
                width={60}
                height={60}
              />
              <span className="font-mono font-light text-[19px] relative -top-[1px]">
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
                  <MenubarItem>준비 중...</MenubarItem>
                </MenubarContent>
              </MenubarMenu>
              <MenubarMenu>
                <MenubarTrigger className="text-md font-normal">
                  편집
                </MenubarTrigger>
                <MenubarContent>
                  <MenubarItem>준비 중...</MenubarItem>
                </MenubarContent>
              </MenubarMenu>
            </Menubar>
          )}
        </div>
      </div>
    </div>
  );
}
