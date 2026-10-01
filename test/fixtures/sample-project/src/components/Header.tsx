export function Header() {
  return (
    <header className="bg-[#1a1a2e] text-white p-[18px] flex items-center justify-between">
      <h1 className="text-xl font-bold">My Store</h1>
      <nav className="flex gap-[10px]">
        <div onClick={() => window.location.href = '/home'}>Home</div>
        <div onClick={() => window.location.href = '/about'}>About</div>
      </nav>
    </header>
  );
}
