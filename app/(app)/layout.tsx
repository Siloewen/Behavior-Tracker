import Nav from "@/components/ui/Nav";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="max-w-lg mx-auto px-4 pt-8 pb-24">
      {children}
      <Nav />
    </div>
  );
}
