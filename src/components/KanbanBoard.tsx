import React, { useState, useEffect } from 'react';

interface Task {
  id: string;
  title: string;
  description?: string;
  status: 'open' | 'in_progress' | 'done';
  priority: 'high' | 'medium' | 'low';
  due_date?: string;
  assigned_to?: string;
  meeting_id?: string;
}

interface Column {
  id: 'open' | 'in_progress' | 'done';
  title: string;
  color: string;
}

const COLUMNS: Column[] = [
  { id: 'open', title: 'To Do', color: 'gray' },
  { id: 'in_progress', title: 'In Progress', color: 'blue' },
  { id: 'done', title: 'Done', color: 'green' }
];

// Icons as inline SVGs
const CircleIcon = () => (
  <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="10"></circle>
  </svg>
);

const ArrowRightIcon = () => (
  <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <line x1="5" y1="12" x2="19" y2="12"></line>
    <polyline points="12 5 19 12 12 19"></polyline>
  </svg>
);

const CheckCircleIcon = () => (
  <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
    <polyline points="22 4 12 14.01 9 11.01"></polyline>
  </svg>
);

const GripIcon = () => (
  <svg className="w-4 h-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <circle cx="9" cy="5" r="1"></circle>
    <circle cx="9" cy="12" r="1"></circle>
    <circle cx="9" cy="19" r="1"></circle>
    <circle cx="15" cy="5" r="1"></circle>
    <circle cx="15" cy="12" r="1"></circle>
    <circle cx="15" cy="19" r="1"></circle>
  </svg>
);

const ClockIcon = () => (
  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="10"></circle>
    <polyline points="12 6 12 12 16 14"></polyline>
  </svg>
);

const AlertIcon = () => (
  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
    <line x1="12" y1="9" x2="12" y2="13"></line>
    <line x1="12" y1="17" x2="12.01" y2="17"></line>
  </svg>
);

const UserIcon = () => (
  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
    <circle cx="12" cy="7" r="4"></circle>
  </svg>
);

interface KanbanBoardProps {
  projectId?: string;
  tasks?: Task[];
  onTaskUpdate?: (taskId: string, newStatus: string) => void;
  onNavigate?: (tab: string) => void;
}

export function KanbanBoard({ projectId, tasks: propTasks, onTaskUpdate, onNavigate }: KanbanBoardProps) {
  const [tasks, setTasks] = useState<Task[]>(propTasks || []);
  const [loading, setLoading] = useState(!propTasks);
  const [draggedTask, setDraggedTask] = useState<Task | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);

  useEffect(() => {
    if (propTasks) {
      setTasks(propTasks);
      setLoading(false);
    } else {
      loadTasks();
    }
  }, [projectId, propTasks]);

  const loadTasks = async () => {
    try {
      setLoading(true);
      // Mock tasks for demo - replace with actual API call
      const mockTasks: Task[] = [
        { id: '1', title: 'Review Q4 proposal', status: 'open', priority: 'high', due_date: '2024-12-25' },
        { id: '2', title: 'Update documentation', status: 'open', priority: 'medium' },
        { id: '3', title: 'Schedule team sync', status: 'in_progress', priority: 'medium', assigned_to: 'John' },
        { id: '4', title: 'Complete onboarding', status: 'done', priority: 'low' },
      ];
      setTasks(mockTasks);
    } catch (error) {
      console.error('Failed to load tasks:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDragStart = (e: React.DragEvent, task: Task) => {
    setDraggedTask(task);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', task.id);
    setTimeout(() => {
      (e.target as HTMLElement).classList.add('opacity-50');
    }, 0);
  };

  const handleDragEnd = (e: React.DragEvent) => {
    (e.target as HTMLElement).classList.remove('opacity-50');
    setDraggedTask(null);
    setDragOverColumn(null);
  };

  const handleDragOver = (e: React.DragEvent, columnId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverColumn(columnId);
  };

  const handleDragLeave = () => {
    setDragOverColumn(null);
  };

  const handleDrop = async (e: React.DragEvent, newStatus: 'open' | 'in_progress' | 'done') => {
    e.preventDefault();
    setDragOverColumn(null);

    if (!draggedTask || draggedTask.status === newStatus) return;

    const taskId = draggedTask.id;
    const oldStatus = draggedTask.status;

    // Optimistic update
    setTasks(prev => prev.map(t =>
      t.id === taskId ? { ...t, status: newStatus } : t
    ));

    try {
      if (onTaskUpdate) {
        onTaskUpdate(taskId, newStatus);
      }
    } catch (error) {
      console.error('Failed to update task:', error);
      // Revert on error
      setTasks(prev => prev.map(t =>
        t.id === taskId ? { ...t, status: oldStatus } : t
      ));
    }
  };

  const getTasksByStatus = (status: string) => {
    return tasks.filter(t => t.status === status);
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'text-red-600 bg-red-50';
      case 'medium': return 'text-amber-600 bg-amber-50';
      case 'low': return 'text-green-600 bg-green-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const isOverdue = (dueDate?: string) => {
    if (!dueDate) return false;
    return new Date(dueDate) < new Date();
  };

  const getColumnIcon = (columnId: string) => {
    switch (columnId) {
      case 'open': return <CircleIcon />;
      case 'in_progress': return <ArrowRightIcon />;
      case 'done': return <CheckCircleIcon />;
      default: return <CircleIcon />;
    }
  };

  const getColumnBadgeClasses = (color: string) => {
    switch (color) {
      case 'blue': return 'bg-blue-100 text-blue-700';
      case 'green': return 'bg-green-100 text-green-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {COLUMNS.map(col => (
          <div key={col.id} className="bg-gray-50 rounded-lg p-4">
            <div className="animate-pulse">
              <div className="h-6 bg-gray-200 rounded w-24 mb-4"></div>
              <div className="space-y-3">
                <div className="h-24 bg-gray-200 rounded"></div>
                <div className="h-24 bg-gray-200 rounded"></div>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {COLUMNS.map(column => {
        const columnTasks = getTasksByStatus(column.id);
        const isOver = dragOverColumn === column.id;

        return (
          <div
            key={column.id}
            className={`bg-gray-50 rounded-lg transition-colors ${
              isOver ? 'bg-blue-50 ring-2 ring-blue-300' : ''
            }`}
            onDragOver={(e) => handleDragOver(e, column.id)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, column.id)}
          >
            {/* Column Header */}
            <div className="p-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {getColumnIcon(column.id)}
                  <h3 className="font-semibold text-gray-900">{column.title}</h3>
                  <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${getColumnBadgeClasses(column.color)}`}>
                    {columnTasks.length}
                  </span>
                </div>
              </div>
            </div>

            {/* Tasks */}
            <div className="p-2 min-h-[300px] space-y-2">
              {columnTasks.length === 0 ? (
                <div className="text-center py-8 text-gray-400 text-sm">
                  {isOver ? 'Drop here' : 'No tasks'}
                </div>
              ) : (
                columnTasks.map(task => (
                  <div
                    key={task.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, task)}
                    onDragEnd={handleDragEnd}
                    className={`bg-white rounded-lg border border-gray-200 p-3 cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow ${
                      draggedTask?.id === task.id ? 'ring-2 ring-[#2563EB]' : ''
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <GripIcon />
                      <div className="flex-1 min-w-0">
                        <button
                          onClick={() => onNavigate?.('inbox')}
                          className="font-medium text-gray-900 hover:text-[#2563EB] line-clamp-2 text-left"
                        >
                          {task.title}
                        </button>

                        {task.description && (
                          <p className="text-sm text-gray-500 line-clamp-2 mt-1">
                            {task.description}
                          </p>
                        )}

                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                          {/* Priority badge */}
                          <span className={`px-2 py-0.5 text-xs font-medium rounded ${getPriorityColor(task.priority)}`}>
                            {task.priority}
                          </span>

                          {/* Due date */}
                          {task.due_date && (
                            <span className={`flex items-center gap-1 text-xs ${
                              isOverdue(task.due_date) && task.status !== 'done'
                                ? 'text-red-600 font-medium'
                                : 'text-gray-400'
                            }`}>
                              {isOverdue(task.due_date) && task.status !== 'done' && <AlertIcon />}
                              <ClockIcon />
                              {new Date(task.due_date).toLocaleDateString()}
                            </span>
                          )}

                          {/* Assignee */}
                          {task.assigned_to && (
                            <span className="flex items-center gap-1 text-xs text-gray-400">
                              <UserIcon />
                              {task.assigned_to}
                            </span>
                          )}
                        </div>

                        {/* Meeting link */}
                        {task.meeting_id && (
                          <button
                            onClick={() => onNavigate?.('meetings')}
                            className="text-xs text-[#2563EB] hover:text-[#1d4ed8] mt-2 inline-block"
                          >
                            From meeting
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default KanbanBoard;
