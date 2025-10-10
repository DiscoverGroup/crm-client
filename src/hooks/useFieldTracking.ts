import { useRef, useCallback } from 'react';
import { LogNoteService } from '../services/logNoteService';

interface UseFieldTrackingOptions {
  clientId: string;
  userId: string;
  userName: string;
  onLogAdded?: () => void;
}

export const useFieldTracking = (options: UseFieldTrackingOptions) => {
  const previousValues = useRef<Record<string, unknown>>({});

  const trackField = useCallback(<T>(
    fieldName: string,
    currentValue: T,
    displayName?: string
  ): void => {
    const prevValue = previousValues.current[fieldName];
    
    // Only track changes after initial render and if values are different
    if (prevValue !== undefined && prevValue !== currentValue) {
      const oldValueStr = prevValue === '' ? '(empty)' : String(prevValue);
      const newValueStr = currentValue === '' ? '(empty)' : String(currentValue);
      
      if (oldValueStr !== newValueStr) {
        LogNoteService.logFieldChange(
          options.clientId,
          options.userId,
          options.userName,
          displayName || fieldName,
          oldValueStr,
          newValueStr
        );
        
        options.onLogAdded?.();
      }
    }
    
    previousValues.current[fieldName] = currentValue;
  }, [options]);

  const logAction = useCallback((
    action: string,
    description: string,
    status: 'pending' | 'done' = 'done'
  ) => {
    LogNoteService.logClientAction(
      options.clientId,
      options.userId,
      options.userName,
      action,
      description,
      status
    );
    
    options.onLogAdded?.();
  }, [options]);

  return { trackField, logAction };
};