// Toast notification utility
export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastMessage {
  type: ToastType;
  message: string;
}

/**
 * Show a toast notification
 * Uses the custom event system to trigger toasts
 */
export const showToast = (message: string, type: ToastType = 'info') => {
  window.dispatchEvent(
    new CustomEvent('showToast', {
      detail: { type, message }
    })
  );
};

/**
 * Show a success toast
 */
export const showSuccessToast = (message: string) => {
  showToast(message, 'success');
};

/**
 * Show an error toast
 */
export const showErrorToast = (message: string) => {
  showToast(message, 'error');
};

/**
 * Show a warning toast
 */
export const showWarningToast = (message: string) => {
  showToast(message, 'warning');
};

/**
 * Show an info toast
 */
export const showInfoToast = (message: string) => {
  showToast(message, 'info');
};

/**
 * Show a confirmation modal
 * Returns a Promise that resolves to true if confirmed, false if cancelled
 */
export const showConfirmDialog = (
  title: string,
  message: string,
  type: 'warning' | 'error' | 'info' = 'warning'
): Promise<boolean> => {
  return new Promise((resolve) => {
    window.dispatchEvent(
      new CustomEvent('showConfirmModal', {
        detail: {
          title,
          message,
          type,
          onConfirm: () => resolve(true),
          onCancel: () => resolve(false)
        }
      })
    );
  });
};
