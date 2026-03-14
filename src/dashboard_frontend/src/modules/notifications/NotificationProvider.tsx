import React, { createContext, useContext, useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useApi } from '../api/api';
import { useWs } from '../ws/WebSocketProvider';

type NotificationActionsContextType = {
  showNotification: (message: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
  removeNotification: (id: string) => void;
};

type NotificationStateContextType = {
  notifications: Array<{ id: string; message: string; type: 'info' | 'success' | 'warning' | 'error'; timestamp: number }>;
};

const NotificationActionsContext = createContext<NotificationActionsContextType | undefined>(undefined);
const NotificationStateContext = createContext<NotificationStateContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { approvals, specs, getSpecTasksProgress } = useApi();
  const { subscribe, unsubscribe } = useWs();
  const prevApprovalsRef = useRef<typeof approvals>([]);
  const prevTaskDataRef = useRef<Map<string, any>>(new Map());
  const isInitialApprovalsLoadRef = useRef(true);
  const isInitialTasksLoadRef = useRef(true);
  const [notifications, setNotifications] = useState<Array<{ id: string; message: string; type: 'info' | 'success' | 'warning' | 'error'; timestamp: number }>>([]);
  const showNotification = useCallback((message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info') => {
    const id = Date.now().toString() + Math.random().toString(36).substr(2, 9);
    const notification = { id, message, type, timestamp: Date.now() };

    setNotifications(prev => [...prev, notification]);

    // Auto-remove after 5 seconds
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 5000);
  }, []);

  // Remove notification manually
  const removeNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  // Function to handle task updates
  const handleTaskUpdate = useCallback(async (specName: string, specDisplayName: string) => {
    try {
      // Fetch detailed task progress
      const currentTaskData = await getSpecTasksProgress(specName);
      const prevTaskData = prevTaskDataRef.current.get(specName);

      if (prevTaskData && currentTaskData) {
        // Check for completion changes
        if (currentTaskData.completed > prevTaskData.completed) {
          const newlyCompleted = currentTaskData.completed - prevTaskData.completed;
          const message = newlyCompleted === 1 
            ? `Task completed in ${specDisplayName} (${currentTaskData.completed}/${currentTaskData.total})`
            : `${newlyCompleted} tasks completed in ${specDisplayName} (${currentTaskData.completed}/${currentTaskData.total})`;

          showNotification(message, 'success');
        }

        // Check for in-progress changes
        if (currentTaskData.inProgress !== prevTaskData.inProgress) {
          if (currentTaskData.inProgress && !prevTaskData.inProgress) {
            // Task moved to in-progress
            const taskId = currentTaskData.inProgress;
            const task = currentTaskData.taskList?.find((t: any) => t.id === taskId || t.number === taskId);
            const taskTitle = task?.title || task?.description || `Task ${taskId}`;

            const message = `Task started: ${taskTitle} in ${specDisplayName}`;
            showNotification(message, 'info');
          }
        }
        
        // Check if all tasks are now completed (project finished)
        if (currentTaskData.completed === currentTaskData.total && 
            prevTaskData.completed < currentTaskData.total && 
            currentTaskData.total > 0) {
          const message = `🎉 All tasks completed in ${specDisplayName}!`;
          showNotification(message, 'success');
        }
      }
      
      // Store current data for next comparison
      prevTaskDataRef.current.set(specName, currentTaskData);
      
    } catch (error) {
      console.error('[NotificationProvider] Failed to handle task update:', error);
    }
  }, [getSpecTasksProgress, showNotification]);

  // Detect new approvals
  useEffect(() => {
    if (isInitialApprovalsLoadRef.current) {
      // Skip notification on initial load
      prevApprovalsRef.current = approvals;
      isInitialApprovalsLoadRef.current = false;
      return;
    }

    // Find new approvals by comparing IDs (not just array length)
    const prevIds = new Set(prevApprovalsRef.current.map(a => a.id));
    const newApprovals = approvals.filter(a => !prevIds.has(a.id));
    
    if (newApprovals.length > 0) {
      newApprovals.forEach(approval => {
        const message = `New approval request: ${approval.title}`;
        showNotification(message, 'info');
      });
    }

    prevApprovalsRef.current = approvals;
  }, [approvals, showNotification]);

  // Initialize task data on mount only
  useEffect(() => {
    if (!isInitialTasksLoadRef.current || specs.length === 0) {
      return;
    }

    specs.forEach(spec => {
      handleTaskUpdate(spec.name, spec.displayName);
    });
    isInitialTasksLoadRef.current = false;
  }, [handleTaskUpdate, specs]);

  // Subscribe to task status updates via WebSocket
  useEffect(() => {
    const handleTaskStatusUpdate = (event: any) => {
      const spec = specs.find(s => s.name === event.specName);
      if (!spec) {
        return;
      }

      const specDisplayName = spec.displayName;
      const prevTaskData = prevTaskDataRef.current.get(event.specName);

      // Extract current data from the WebSocket event
      const currentTaskData = {
        total: event.summary.total,
        completed: event.summary.completed,
        inProgress: event.inProgress,
        taskList: event.taskList
      };

      if (!prevTaskData) {
        // First time seeing this spec - just store the data without notification
        prevTaskDataRef.current.set(event.specName, currentTaskData);
        return;
      }

      // We have previous data - check for changes and show notifications

      // Check for completion changes
      if (currentTaskData.completed > prevTaskData.completed) {
        const newlyCompleted = currentTaskData.completed - prevTaskData.completed;
        const message = newlyCompleted === 1
          ? `Task completed in ${specDisplayName} (${currentTaskData.completed}/${currentTaskData.total})`
          : `${newlyCompleted} tasks completed in ${specDisplayName} (${currentTaskData.completed}/${currentTaskData.total})`;

        showNotification(message, 'success');
      }

      // Check for in-progress changes
      if (currentTaskData.inProgress !== prevTaskData.inProgress) {
        if (currentTaskData.inProgress && !prevTaskData.inProgress) {
          // Task moved to in-progress
          const taskId = currentTaskData.inProgress;
          const task = currentTaskData.taskList?.find((t: any) => t.id === taskId || t.number === taskId);
          const taskTitle = task?.title || task?.description || `Task ${taskId}`;

          const message = `Task started: ${taskTitle} in ${specDisplayName}`;
          showNotification(message, 'info');
        }
      }

      // Check if all tasks are now completed (project finished)
      if (currentTaskData.completed === currentTaskData.total &&
          prevTaskData.completed < currentTaskData.total &&
          currentTaskData.total > 0) {
        const message = `🎉 All tasks completed in ${specDisplayName}!`;
        showNotification(message, 'success');
      }

      // Store current data for next comparison
      prevTaskDataRef.current.set(event.specName, currentTaskData);
    };

    subscribe('task-status-update', handleTaskStatusUpdate);

    return () => {
      unsubscribe('task-status-update', handleTaskStatusUpdate);
    };
  }, [specs, subscribe, unsubscribe, showNotification]);

  // Memoize actions context - this should rarely change since functions are stable
  const actionsValue = useMemo(() => ({
    showNotification,
    removeNotification,
  }), [showNotification, removeNotification]);

  // Memoize state context - this changes when notifications/settings change
  const stateValue = useMemo(() => ({
    notifications,
  }), [notifications]);

  return (
    <NotificationActionsContext.Provider value={actionsValue}>
      <NotificationStateContext.Provider value={stateValue}>
        {children}
        <NotificationToasts />
      </NotificationStateContext.Provider>
    </NotificationActionsContext.Provider>
  );
}

// Toast notifications component
function NotificationToasts() {
  const { removeNotification } = useNotifications();
  const { notifications } = useNotificationState();

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2 max-w-sm">
      {notifications.map(notification => (
        <div
          key={notification.id}
          className={`rounded-lg p-4 shadow-lg border transition-all duration-300 ease-in-out ${
            notification.type === 'error' 
              ? 'bg-red-50 border-red-200 text-red-800 dark:bg-red-900/20 dark:border-red-800 dark:text-red-200'
              : notification.type === 'warning'
              ? 'bg-yellow-50 border-yellow-200 text-yellow-800 dark:bg-yellow-900/20 dark:border-yellow-800 dark:text-yellow-200'  
              : notification.type === 'success'
              ? 'bg-green-50 border-green-200 text-green-800 dark:bg-green-900/20 dark:border-green-800 dark:text-green-200'
              : 'bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-200'
          }`}
        >
          <div className="flex items-start justify-between">
            <div className="flex items-start space-x-2">
              <svg 
                className={`w-5 h-5 mt-0.5 flex-shrink-0 ${
                  notification.type === 'error' ? 'text-red-500' :
                  notification.type === 'warning' ? 'text-yellow-500' :
                  notification.type === 'success' ? 'text-green-500' :
                  'text-blue-500'
                }`}
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                {notification.type === 'error' ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                ) : notification.type === 'warning' ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                ) : notification.type === 'success' ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                )}
              </svg>
              <p className="text-sm font-medium break-words">
                {notification.message}
              </p>
            </div>
            <button
              onClick={() => removeNotification(notification.id)}
              className="ml-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

// Hook for accessing notification actions (stable, won't cause re-renders when notifications change)
export function useNotifications(): NotificationActionsContextType {
  const ctx = useContext(NotificationActionsContext);
  if (!ctx) throw new Error('useNotifications must be used within NotificationProvider');
  return ctx;
}

// Hook for accessing notification state (will cause re-renders when state changes)
export function useNotificationState(): NotificationStateContextType {
  const ctx = useContext(NotificationStateContext);
  if (!ctx) throw new Error('useNotificationState must be used within NotificationProvider');
  return ctx;
}
