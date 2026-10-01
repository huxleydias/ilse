interface ButtonProps {
  label: string;
  onClick: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
}

export function Button({ label, onClick, variant = 'primary' }: ButtonProps) {
  const colors = {
    primary: 'bg-primary text-white',
    secondary: 'bg-secondary text-white',
    danger: 'bg-destructive text-white',
  };

  return (
    <button className={`${colors[variant]} px-4 py-2 rounded-md`} onClick={onClick}>
      {label}
    </button>
  );
}
