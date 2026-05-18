/**
 * AddUserModal — admin form to create a new user account directly.
 * Calls UserService.addUser(payload).
 */
import React, { useState } from 'react';
import Button from './ui/Button';
import { UserService, type AddUserPayload, type UserRecord } from '../services/userService';

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: (user: UserRecord) => void;
}

const DEPARTMENTS = ['Management', 'Sales', 'Marketing', 'Operations', 'Finance', 'IT', 'HR', 'Intern'];

function genPassword(): string {
  const upper = 'ABCDEFGHJKMNPQRSTUVWXYZ';
  const lower = 'abcdefghjkmnpqrstuvwxyz';
  const digit = '23456789';
  const special = '!@#$%^&*';
  const all = upper + lower + digit + special;
  let pw =
    upper[Math.floor(Math.random() * upper.length)] +
    lower[Math.floor(Math.random() * lower.length)] +
    digit[Math.floor(Math.random() * digit.length)] +
    special[Math.floor(Math.random() * special.length)];
  for (let i = 0; i < 12; i++) pw += all[Math.floor(Math.random() * all.length)];
  return pw.split('').sort(() => Math.random() - 0.5).join('');
}

const AddUserModal: React.FC<Props> = ({ open, onClose, onCreated }) => {
  const [form, setForm] = useState<AddUserPayload>({
    username: '',
    email: '',
    password: '',
    fullName: '',
    department: 'Sales',
    position: '',
    role: 'user',
    autoApprove: true,
    autoVerify: true,
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  if (!open) return null;

  const update = <K extends keyof AddUserPayload>(key: K, value: AddUserPayload[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const handleGenerate = () => {
    update('password', genPassword());
    setShowPassword(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const user = await UserService.addUser(form);
      onCreated(user);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create user');
    } finally {
      setSubmitting(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 12px',
    borderRadius: '8px',
    border: '1px solid var(--border)',
    fontFamily: 'var(--font-sans)',
    fontSize: '14px',
    boxSizing: 'border-box',
  };
  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: '12px',
    fontWeight: 600,
    color: 'var(--muted-foreground)',
    marginBottom: '4px',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '16px',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'white',
          padding: '24px',
          borderRadius: '16px',
          maxWidth: '560px',
          width: '100%',
          maxHeight: '90vh',
          overflowY: 'auto',
          boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ margin: '0 0 4px 0', fontSize: '20px', fontWeight: 700, color: 'var(--brand-navy)' }}>
          Add New User
        </h3>
        <p style={{ margin: '0 0 20px 0', color: 'var(--muted-foreground)', fontSize: '13px' }}>
          Create a user account directly. The user can log in immediately with the provided password.
        </p>

        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
            <div>
              <label style={labelStyle}>Full Name *</label>
              <input
                style={inputStyle}
                type="text"
                required
                maxLength={120}
                value={form.fullName}
                onChange={(e) => update('fullName', e.target.value)}
              />
            </div>
            <div>
              <label style={labelStyle}>Username *</label>
              <input
                style={inputStyle}
                type="text"
                required
                pattern="[a-zA-Z0-9_.\-]{3,32}"
                title="3-32 chars, letters/numbers/._-"
                value={form.username}
                onChange={(e) => update('username', e.target.value)}
              />
            </div>
          </div>

          <div style={{ marginBottom: '12px' }}>
            <label style={labelStyle}>Email *</label>
            <input
              style={inputStyle}
              type="email"
              required
              value={form.email}
              onChange={(e) => update('email', e.target.value)}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
            <div>
              <label style={labelStyle}>Department *</label>
              <select
                style={inputStyle}
                required
                value={form.department}
                onChange={(e) => update('department', e.target.value)}
              >
                {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Position *</label>
              <input
                style={inputStyle}
                type="text"
                required
                maxLength={60}
                value={form.position}
                onChange={(e) => update('position', e.target.value)}
              />
            </div>
          </div>

          <div style={{ marginBottom: '12px' }}>
            <label style={labelStyle}>Role *</label>
            <select
              style={inputStyle}
              value={form.role}
              onChange={(e) => update('role', e.target.value as AddUserPayload['role'])}
            >
              <option value="user">User</option>
              <option value="intern">Intern</option>
              <option value="admin">Admin</option>
            </select>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={labelStyle}>Password * (min 12 chars, mixed case + digit + symbol)</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                style={{ ...inputStyle, flex: 1 }}
                type={showPassword ? 'text' : 'password'}
                required
                minLength={12}
                maxLength={128}
                value={form.password}
                onChange={(e) => update('password', e.target.value)}
              />
              <Button type="button" variant="secondary" size="sm" onClick={() => setShowPassword((s) => !s)}>
                {showPassword ? 'Hide' : 'Show'}
              </Button>
              <Button type="button" variant="secondary" size="sm" onClick={handleGenerate}>
                Generate
              </Button>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '16px', marginBottom: '20px', fontSize: '13px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={!!form.autoApprove}
                onChange={(e) => update('autoApprove', e.target.checked)}
              />
              Auto-approve
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={!!form.autoVerify}
                onChange={(e) => update('autoVerify', e.target.checked)}
              />
              Mark verified
            </label>
          </div>

          {error && (
            <div
              role="alert"
              style={{
                background: 'rgba(220, 38, 38, 0.08)',
                color: '#b91c1c',
                border: '1px solid rgba(220,38,38,0.2)',
                padding: '10px 12px',
                borderRadius: '8px',
                fontSize: '13px',
                marginBottom: '16px',
              }}
            >
              {error}
            </div>
          )}

          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
            <Button type="button" variant="secondary" size="md" onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="md" disabled={submitting}>
              {submitting ? 'Creating...' : 'Create User'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddUserModal;
