import { useERDStore } from '../ir/store';
import type { NotationType } from '../ir/types';

export function NotationSwitcher() {
  const notation = useERDStore((s) => s.notation);
  const setNotation = useERDStore((s) => s.setNotation);

  const options: { value: NotationType; label: string }[] = [
    { value: 'chen', label: 'Chen' },
    { value: 'crowsfoot', label: "Crow's Foot" },
  ];

  return (
    <div
      className="flex rounded-lg border border-gray-200 overflow-hidden shadow-sm"
      role="radiogroup"
      aria-label="Notation style"
      data-testid="notation-switcher"
    >
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => setNotation(opt.value)}
          role="radio"
          aria-checked={notation === opt.value}
          className={`px-4 py-1.5 text-sm font-medium transition-all duration-200
            ${notation === opt.value
              ? 'bg-primary-600 text-white shadow-inner'
              : 'bg-white text-gray-600 hover:bg-gray-50'
            }`}
          data-testid={`notation-${opt.value}`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
