import React, { useMemo, useState } from 'react';

interface TourStep {
  title: string;
  description: string;
  bullets: string[];
}

interface NewUiTourModalProps {
  isOpen: boolean;
  onFinish: () => void;
  releaseLabel?: string;
}

const NewUiTourModal: React.FC<NewUiTourModalProps> = ({ isOpen, onFinish, releaseLabel }) => {
  const [stepIndex, setStepIndex] = useState(0);

  const steps: TourStep[] = useMemo(
    () => [
      {
        title: 'Step 1: New Navigation Sidebar',
        description:
          'The sidebar is now cleaner and card-based, so pages are easier to find and switch.',
        bullets: [
          'Use compact icon mode for more workspace.',
          'Expanded mode shows clearer page labels.',
          'Admin and restore actions are grouped at the bottom.',
        ],
      },
      {
        title: 'Step 2: Smart Header Toolbar',
        description:
          'The top section is redesigned into a compact action strip for faster workflows.',
        bullets: [
          'Create records quickly with primary actions.',
          'Use quick chips for total records and paging context.',
          'Everything is grouped for less visual noise.',
        ],
      },
      {
        title: 'Step 3: Cleaner Data Area',
        description:
          'Cards, filters, tables, and spacing were refreshed for readability and scanning speed.',
        bullets: [
          'Search and filters are easier to read and use.',
          'Table headers and rows have better hierarchy.',
          'Pagination and status badges are more consistent.',
        ],
      },
      {
        title: 'Step 4: Test Records Controls',
        description:
          'Test records are now separated and organized so production records stay focused.',
        bullets: [
          'Open and close the Test Records section on demand.',
          'Test records stay outside the main client count.',
          'Admin-only visibility keeps regular views clean.',
        ],
      },
    ],
    []
  );

  if (!isOpen) return null;

  const current = steps[stepIndex];
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === steps.length - 1;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(2, 6, 23, 0.55)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 11000,
        padding: '16px',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onFinish();
        }
      }}
    >
      <div
        style={{
          width: 'min(700px, 96vw)',
          background: '#ffffff',
          border: '1px solid #dbe4f0',
          borderRadius: '18px',
          boxShadow: '0 20px 45px rgba(15, 23, 42, 0.28)',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            background: 'linear-gradient(135deg, #eff6ff 0%, #f8fafc 100%)',
            borderBottom: '1px solid #dbe4f0',
            padding: '18px 22px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          <div>
            <div
              style={{
                fontSize: '12px',
                fontWeight: 700,
                color: '#475569',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                marginBottom: '6px',
              }}
            >
              {releaseLabel ? `What's New • ${releaseLabel}` : 'New UI Guided Tour'}
            </div>
            <h3 style={{ margin: 0, fontSize: '22px', color: '#0f172a', letterSpacing: '-0.02em' }}>
              {current.title}
            </h3>
          </div>
          <button
            type="button"
            onClick={onFinish}
            style={{
              border: '1px solid #cbd5e1',
              background: '#ffffff',
              color: '#334155',
              borderRadius: '10px',
              padding: '8px 12px',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '12px',
            }}
          >
            Skip Tour
          </button>
        </div>

        <div style={{ padding: '20px 24px' }}>
          <p style={{ margin: '0 0 14px 0', color: '#475569', fontSize: '15px', lineHeight: 1.65 }}>{current.description}</p>
          <ul style={{ margin: 0, paddingLeft: '20px', color: '#334155', fontSize: '14px', lineHeight: 1.7 }}>
            {current.bullets.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>

        <div
          style={{
            borderTop: '1px solid #e2e8f0',
            padding: '14px 20px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            {steps.map((_, idx) => (
              <span
                key={idx}
                style={{
                  width: idx === stepIndex ? '22px' : '8px',
                  height: '8px',
                  borderRadius: '999px',
                  background: idx === stepIndex ? '#2563eb' : '#cbd5e1',
                  transition: 'all 0.2s ease',
                }}
              />
            ))}
          </div>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => setStepIndex((prev) => Math.max(prev - 1, 0))}
              disabled={isFirst}
              style={{
                border: '1px solid #cbd5e1',
                background: isFirst ? '#f8fafc' : '#ffffff',
                color: isFirst ? '#94a3b8' : '#334155',
                borderRadius: '10px',
                padding: '9px 14px',
                cursor: isFirst ? 'not-allowed' : 'pointer',
                fontWeight: 600,
                fontSize: '13px',
              }}
            >
              Back
            </button>
            {!isLast ? (
              <button
                type="button"
                onClick={() => setStepIndex((prev) => Math.min(prev + 1, steps.length - 1))}
                style={{
                  border: '1px solid #2563eb',
                  background: '#2563eb',
                  color: '#ffffff',
                  borderRadius: '10px',
                  padding: '9px 14px',
                  cursor: 'pointer',
                  fontWeight: 700,
                  fontSize: '13px',
                }}
              >
                Next
              </button>
            ) : (
              <button
                type="button"
                onClick={onFinish}
                style={{
                  border: '1px solid #2563eb',
                  background: '#2563eb',
                  color: '#ffffff',
                  borderRadius: '10px',
                  padding: '9px 14px',
                  cursor: 'pointer',
                  fontWeight: 700,
                  fontSize: '13px',
                }}
              >
                Finish Tour
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default NewUiTourModal;
