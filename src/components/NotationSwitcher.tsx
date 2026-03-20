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
    <div className="flex rounded-md border border-gray-300 overflow-hidden" data-testid="notation-switcher">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => setNotation(opt.value)}
          className={`px-3 py-1 text-xs font-medium transition-colors
            ${notation === opt.value
              ? 'bg-blue-600 text-white'
              : 'bg-white text-gray-700 hover:bg-gray-100'
            }`}
          data-testid={`notation-${opt.value}`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
