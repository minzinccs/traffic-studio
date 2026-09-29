import { Search, X } from 'lucide-react';
import './searchField.css';

export function SearchField({ label, placeholder, value, onChange, className = '' }: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  return <div className={`search-field ${className}`} role="search">
    <Search size={16} aria-hidden="true" />
    <input type="search" aria-label={label} placeholder={placeholder} value={value} onChange={event => onChange(event.target.value)} />
    {value && <button type="button" aria-label={`Clear ${label.toLowerCase()}`} onClick={() => onChange('')}><X size={15} aria-hidden="true" /></button>}
  </div>;
}
