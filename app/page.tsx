import NavBar from "@/components/nav-bar";
import Workspace from "@/components/workspace";

export default function Home() {
  return (
    <div className="flex h-screen w-screen flex-col">
      <NavBar />
      <Workspace />
    </div>
  );
}
