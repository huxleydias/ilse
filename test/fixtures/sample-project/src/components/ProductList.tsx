interface Product {
  id: string;
  name: string;
  price: number;
  image: string;
}

export function ProductList({ products }: { products: Product[] }) {
  return (
    <div className="grid grid-cols-3 gap-6">
      {products.map((product) => (
        <div
          key={product.id}
          className="border rounded-lg overflow-hidden"
          style={{ padding: '18px', backgroundColor: '#f9fafb' }}
        >
          <img src={product.image} />
          <h3 className="font-semibold mt-2">{product.name}</h3>
          <p className="text-[#22c55e]">${product.price}</p>
        </div>
      ))}
    </div>
  );
}
