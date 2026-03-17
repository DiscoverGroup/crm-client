import { useRef, useCallback } from 'react';
import { LogNoteService } from '../services/logNoteService';
import { authHeaders } from '../utils/authToken';

interface UseSectionTrackingOptions {
  clientId: string;
  userId: string;
  userName: string;
  onLogAdded?: () => void;
}

interface SectionChange {
  fieldName: string;
  displayName: string;
  oldValue: string;
  newValue: string;
}

// Helper to save log note to MongoDB (fire-and-forget with localStorage fallback already done by caller)
const saveLogNoteToMongoDB = async (
  clientId: string,
  userId: string,
  userName: string,
  action: string,
  description: string,
  status: 'pending' | 'done' | 'on hold' = 'done',
  fieldChanged?: string,
  oldValue?: string,
  newValue?: string
) => {
  try {
    await fetch('/.netlify/functions/save-log-note', {
      method: 'POST',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clientId,
        userId,
        userName,
        type: 'auto',
        action,
        description,
        status,
        fieldChanged: fieldChanged || null,
        oldValue: oldValue || null,
        newValue: newValue || null
      })
    });
  } catch {
    // Silently fail — localStorage fallback already saved by LogNoteService
  }
};

export const useSectionTracking = (options: UseSectionTrackingOptions) => {
  const sectionChanges = useRef<Map<string, SectionChange[]>>(new Map());
  const previousValues = useRef<Record<string, unknown>>({});

  // Track field changes within a section
  const trackSectionField = useCallback(<T>(
    sectionName: string,
    fieldName: string,
    currentValue: T,
    displayName?: string
  ): void => {
    const fieldKey = `${sectionName}.${fieldName}`;
    const prevValue = previousValues.current[fieldKey];
    
    // Only track changes after initial render and if values are different
    if (prevValue !== undefined && prevValue !== currentValue) {
      const oldValueStr = prevValue === '' ? '(empty)' : String(prevValue);
      const newValueStr = currentValue === '' ? '(empty)' : String(currentValue);
      
      if (oldValueStr !== newValueStr) {
        // Store the change for this section
        const changes = sectionChanges.current.get(sectionName) || [];
        
        // Update existing change or add new one
        const existingIndex = changes.findIndex(c => c.fieldName === fieldName);
        const change: SectionChange = {
          fieldName,
          displayName: displayName || fieldName,
          oldValue: oldValueStr,
          newValue: newValueStr
        };
        
        if (existingIndex >= 0) {
          changes[existingIndex] = change;
        } else {
          changes.push(change);
        }
        
        sectionChanges.current.set(sectionName, changes);
      }
    }
    
    previousValues.current[fieldKey] = currentValue;
  }, []);

  // Save all changes for a section and create a log entry
  const saveSection = useCallback((
    sectionName: string,
    sectionDisplayName?: string
  ) => {
    const changes = sectionChanges.current.get(sectionName) || [];
    
    if (changes.length > 0) {
      // Create detailed description of all changes
      const changeDescriptions = changes.map(change => 
        `• ${change.displayName}: "${change.oldValue}" → "${change.newValue}"`
      ).join('\n');
      
      const description = `Updated ${sectionDisplayName || sectionName}:\n${changeDescriptions}`;
      
      // Create the log entry in localStorage
      LogNoteService.logSectionUpdate(
        options.clientId,
        options.userId,
        options.userName,
        sectionDisplayName || sectionName,
        description
      );

      // Also persist to MongoDB
      saveLogNoteToMongoDB(
        options.clientId,
        options.userId,
        options.userName,
        `Section Updated: ${sectionDisplayName || sectionName}`,
        description
      );
      
      // Clear the changes for this section
      sectionChanges.current.delete(sectionName);
      
      // Notify that a log was added
      options.onLogAdded?.();
    }
  }, [options]);

  // Log a file attachment action
  const logAttachment = useCallback((
    sectionName: string,
    action: 'uploaded' | 'deleted' | 'updated',
    fileName: string,
    attachmentType?: string
  ) => {
    const description = `${action.charAt(0).toUpperCase() + action.slice(1)} ${attachmentType || 'attachment'}: ${fileName}`;
    
    LogNoteService.logSectionUpdate(
      options.clientId,
      options.userId,
      options.userName,
      sectionName,
      description
    );

    // Also persist to MongoDB
    saveLogNoteToMongoDB(
      options.clientId,
      options.userId,
      options.userName,
      `Section Updated: ${sectionName}`,
      description
    );
    
    options.onLogAdded?.();
  }, [options]);

  // Log general section action
  const logSectionAction = useCallback((
    sectionName: string,
    action: string,
    description: string,
    status: 'pending' | 'done' = 'done'
  ) => {
    LogNoteService.logSectionUpdate(
      options.clientId,
      options.userId,
      options.userName,
      sectionName,
      `${action}: ${description}`,
      status
    );

    // Also persist to MongoDB
    saveLogNoteToMongoDB(
      options.clientId,
      options.userId,
      options.userName,
      `Section Updated: ${sectionName}`,
      `${action}: ${description}`,
      status
    );
    
    options.onLogAdded?.();
  }, [options]);

  return { 
    trackSectionField, 
    saveSection, 
    logAttachment, 
    logSectionAction 
  };
};