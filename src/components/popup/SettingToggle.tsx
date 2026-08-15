import React from 'react';
import { LucideIcon } from 'lucide-react';

interface SettingToggleProps {
  title: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  icon?: LucideIcon;
  iconColorClass?: string;
  variant?: 'detailed' | 'simple';
}

export const SettingToggle: React.FC<SettingToggleProps> = ({
  title,
  description,
  checked,
  onChange,
  icon: Icon,
  iconColorClass,
  variant = 'detailed',
}) => {
  if (variant === 'simple') {
    return (
      <div className="p-2.5 rounded-lg bg-faceit-card border border-faceit-border flex items-center justify-between">
        <span className="text-xs font-semibold text-zinc-200">{title}</span>
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="w-4 h-4 accent-faceit-orange cursor-pointer"
        />
      </div>
    );
  }

  return (
    <div className="p-3 rounded-xl bg-faceit-card border border-faceit-border flex items-center justify-between">
      <div className="flex items-center gap-2.5">
        {Icon && <Icon className={`w-4 h-4 ${iconColorClass || 'text-zinc-400'}`} />}
        <div>
          <div className="text-xs font-bold text-zinc-100">{title}</div>
          {description && <div className="text-[11px] text-faceit-muted">{description}</div>}
        </div>
      </div>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="w-4 h-4 accent-faceit-orange cursor-pointer"
      />
    </div>
  );
};
