/**
 * ProfileCustomizer
 * Dynamic form that renders a profile's custom fields based on their type definitions.
 */

import React from 'react';
import type { IntelligenceProfile, CustomFieldDef } from '../../intelligence/types';

interface ProfileCustomizerProps {
  profile: IntelligenceProfile;
  values: Record<string, any>;
  onChange: (values: Record<string, any>) => void;
  showValidation?: boolean;
}

export const ProfileCustomizer: React.FC<ProfileCustomizerProps> = ({
  profile,
  values,
  onChange,
  showValidation = false,
}) => {
  const updateField = (key: string, value: any) => {
    onChange({ ...values, [key]: value });
  };

  return (
    <div>
      <p className="font-mono text-xs uppercase tracking-wider mb-3" style={{ color: 'var(--text-tertiary)' }}>
        Profile Configuration
      </p>
      <div className="space-y-4">
        {profile.customFields.map(field => (
          <FieldRenderer
            key={field.key}
            field={field}
            value={values[field.key] ?? field.defaultValue ?? ''}
            onChange={val => updateField(field.key, val)}
            showError={showValidation && field.required && !values[field.key]}
          />
        ))}
      </div>
    </div>
  );
};

// ==================== FIELD RENDERERS ====================

interface FieldRendererProps {
  field: CustomFieldDef;
  value: any;
  onChange: (value: any) => void;
  showError?: boolean;
}

const FieldRenderer: React.FC<FieldRendererProps> = ({ field, value, onChange, showError }) => {
  const inputStyle: React.CSSProperties = {
    background: 'var(--bg-surface, #fff)',
    borderColor: showError ? 'var(--semantic-error, #ef4444)' : 'var(--border-subtle, rgba(0,0,0,0.06))',
    color: 'var(--text-primary)',
  };

  return (
    <div>
      <label className="flex items-center gap-1.5 mb-1.5">
        <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
          {field.label}
        </span>
        {field.required && (
          <span style={{ color: 'var(--accent-primary, #FF2D6B)' }}>*</span>
        )}
        {field.helpText && (
          <span
            className="text-xs cursor-help"
            style={{ color: 'var(--text-tertiary)' }}
            title={field.helpText}
          >
            ?
          </span>
        )}
      </label>

      {field.type === 'text' && (
        <input
          type="text"
          value={value || ''}
          onChange={e => onChange(e.target.value)}
          placeholder={field.placeholder}
          className="w-full px-3 py-2 rounded-lg border text-sm transition-colors focus:outline-none focus:ring-1"
          style={inputStyle}
        />
      )}

      {field.type === 'textarea' && (
        <textarea
          value={value || ''}
          onChange={e => onChange(e.target.value)}
          placeholder={field.placeholder}
          rows={3}
          className="w-full px-3 py-2 rounded-lg border text-sm transition-colors focus:outline-none focus:ring-1 resize-y"
          style={inputStyle}
        />
      )}

      {field.type === 'select' && (
        <select
          value={value || ''}
          onChange={e => onChange(e.target.value)}
          className="w-full px-3 py-2 rounded-lg border text-sm transition-colors focus:outline-none focus:ring-1"
          style={inputStyle}
        >
          <option value="">Select...</option>
          {(field.options || []).map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      )}

      {field.type === 'multiselect' && (
        <div className="flex flex-wrap gap-2">
          {(field.options || []).map(opt => {
            const selected = Array.isArray(value) && value.includes(opt.value);
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  const current = Array.isArray(value) ? value : [];
                  onChange(selected ? current.filter((v: string) => v !== opt.value) : [...current, opt.value]);
                }}
                className="px-3 py-1 rounded-full text-sm border transition-all duration-200"
                style={{
                  background: selected ? 'var(--accent-primary-dim)' : 'var(--bg-surface)',
                  borderColor: selected ? 'var(--accent-primary)' : 'var(--border-subtle)',
                  color: selected ? 'var(--accent-primary)' : 'var(--text-secondary)',
                }}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      )}

      {field.type === 'date' && (
        <input
          type="date"
          value={value || ''}
          onChange={e => onChange(e.target.value)}
          className="w-full px-3 py-2 rounded-lg border text-sm transition-colors focus:outline-none focus:ring-1"
          style={inputStyle}
        />
      )}

      {field.type === 'number' && (
        <input
          type="number"
          value={value ?? ''}
          onChange={e => onChange(e.target.value ? Number(e.target.value) : '')}
          placeholder={field.placeholder}
          className="w-full px-3 py-2 rounded-lg border text-sm transition-colors focus:outline-none focus:ring-1"
          style={inputStyle}
        />
      )}

      {field.type === 'toggle' && (
        <button
          type="button"
          onClick={() => onChange(!value)}
          className="relative w-11 h-6 rounded-full transition-colors duration-200"
          style={{
            background: value ? 'var(--accent-primary, #FF2D6B)' : 'var(--border-subtle, #ccc)',
          }}
        >
          <span
            className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200"
            style={{ transform: value ? 'translateX(20px)' : 'translateX(0)' }}
          />
        </button>
      )}

      {showError && (
        <p className="text-xs mt-1" style={{ color: 'var(--semantic-error, #ef4444)' }}>
          This field is required
        </p>
      )}
    </div>
  );
};
