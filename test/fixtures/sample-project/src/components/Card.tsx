interface CardProps {
  title: string;
  description: string;
  price: string;
}

export function Card({ title, description, price }: CardProps) {
  return (
    <div className="bg-[#ffffff] rounded-lg p-[20px] gap-[13px] flex flex-col">
      <h2 className="text-[#6366f1] font-semibold text-lg">{title}</h2>
      <p className="text-[#6b7280] font-semibold text-sm">{description}</p>
      <div className="flex items-center gap-[10px]">
        <span className="text-[#22c55e] font-bold">{price}</span>
        <button className="bg-[#6366f1] text-white px-4 py-2 rounded">Buy</button>
      </div>
      <img src="/product.jpg" />
    </div>
  );
}
