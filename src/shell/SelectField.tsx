import { Listbox, ListboxButton, ListboxOption, ListboxOptions } from '@headlessui/react';
import { Check, ChevronsUpDown } from 'lucide-react';
import './selectField.css';

export type SelectOption = { value: string; label: string; disabled?: boolean; className?: string };

type Props = {
  label: string;
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
};

const METHOD_TEXT: Record<string, string> = {
  'method-get': 'text-[#6fbf8f]',
  'method-post': 'text-[#dfa73d]',
  'method-put': 'text-[#5aa9e6]',
  'method-patch': 'text-[#b085f5]',
  'method-delete': 'text-[#e57373]',
  'method-head': 'text-[#9aa0a6]',
  'method-options': 'text-[#9aa0a6]',
};

const METHOD_VALUES: Record<string, string> = {
  GET: 'text-[#6fbf8f]',
  POST: 'text-[#dfa73d]',
  PUT: 'text-[#5aa9e6]',
  PATCH: 'text-[#b085f5]',
  DELETE: 'text-[#e57373]',
  HEAD: 'text-[#9aa0a6]',
  OPTIONS: 'text-[#9aa0a6]',
};

function methodText(className?: string, value?: string) {
  if (className) {
    for (const key of Object.keys(METHOD_TEXT)) {
      if (className.includes(key)) return METHOD_TEXT[key];
    }
  }
  if (value) {
    const hit = METHOD_VALUES[value.toUpperCase()];
    if (hit) return hit;
  }
  return '';
}

export function SelectField({ label, value, options, onChange, disabled, className = '' }: Props) {
  const selected = options.find(option => option.value === value);
  const isMethod = className.includes('method-select');
  // Legacy `method-select` / `method-*` tokens only switch layout mode; they are
  // never rendered to the DOM so old `.method-select` CSS (request-compose box,
  // responsive bordered box) cannot restyle the HeadlessUI markup.
  const passthrough = className.split(' ').filter(token => token && !token.startsWith('method-')).join(' ');
  const selectedMethod = methodText(selected?.className, selected?.value);

  return (
    <Listbox value={value} onChange={onChange} disabled={disabled}>
      <div className={`relative w-max max-w-full ${isMethod ? 'req-method flex-none self-stretch' : ''} ${passthrough}`}>
        <ListboxButton
          aria-label={label}
          className={[
            'grid cursor-pointer grid-cols-[1fr_auto] items-center gap-2 text-left focus:outline-none disabled:cursor-not-allowed disabled:opacity-50',
            isMethod
              ? 'h-full min-h-[44px] w-[112px] flex-none self-stretch rounded-none! border-0 bg-transparent px-3 font-mono text-[11px] font-bold tracking-wide [box-shadow:inset_-1px_0_0_0_#424242]'
              : 'w-full min-w-0 max-w-[260px] rounded-md border border-[#3a3b40] bg-[#1e1f22] px-3 py-2 text-sm focus-visible:ring-1 focus-visible:ring-[#f59e0b]/60 data-[open]:border-[#f59e0b]/60',
            selectedMethod || (isMethod ? 'text-[#9cccdf]' : 'text-[#e6e6e6]'),
          ].join(' ')}
        >
          <span className="min-w-0 flex-1 truncate font-medium">{selected?.label ?? value}</span>
          <ChevronsUpDown size={16} aria-hidden="true" className="h-4 w-4 flex-none text-[#9a9aa0]" />
        </ListboxButton>

        <ListboxOptions
          anchor={{ to: 'bottom start', gap: 4 }}
          aria-label={label}
          className="reqable-select-options z-[1000] max-h-[280px] min-w-[160px] overflow-auto rounded-md border border-[#3a3b40] bg-[#26272b] p-1 text-sm text-[#e6e6e6] shadow-xl focus:outline-none"
        >
          {options.map(option => (
            <ListboxOption
              key={option.value}
              value={option.value}
              disabled={option.disabled}
              className={`group flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 focus:outline-none data-[disabled]:cursor-not-allowed data-[disabled]:opacity-40 data-[focus]:bg-[#f59e0b]/10 data-[selected]:text-[#f59e0b] ${methodText(option.className, option.value)}`}
            >
              <Check size={16} aria-hidden="true" className="invisible h-4 w-4 flex-none text-[#f59e0b] group-data-[selected]:visible" />
              <span className="min-w-0 flex-1 truncate">{option.label}</span>
            </ListboxOption>
          ))}
        </ListboxOptions>
      </div>
    </Listbox>
  );
}
