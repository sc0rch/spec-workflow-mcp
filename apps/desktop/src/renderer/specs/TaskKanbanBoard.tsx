import { useEffect, useMemo, useRef, useState } from 'react';
import type { DesktopProjectWorkspace } from '../../shared/desktop-api.js';

type WorkspaceTask = DesktopProjectWorkspace['specs'][number]['tasks'][number];
type TaskColumnStatus = WorkspaceTask['status'];

const taskColumns: Array<{
  id: TaskColumnStatus;
  label: string;
}> = [
  { id: 'pending', label: 'Pending' },
  { id: 'in-progress', label: 'In progress' },
  { id: 'completed', label: 'Completed' }
];

interface TaskKanbanBoardProps {
  readonly spec: DesktopProjectWorkspace['specs'][number];
}

interface TaskHintProps {
  readonly label: string;
  readonly value: string;
}

export function TaskKanbanBoard({ spec }: TaskKanbanBoardProps) {
  const columnRefs = useRef<Partial<Record<TaskColumnStatus, HTMLDivElement | null>>>({});
  const scrollPositions = useRef<Record<TaskColumnStatus, number>>({
    pending: 0,
    'in-progress': 0,
    completed: 0
  });

  const tasksByStatus = useMemo(() => {
    const grouped: Record<TaskColumnStatus, WorkspaceTask[]> = {
      pending: [],
      'in-progress': [],
      completed: []
    };

    for (const task of spec.tasks) {
      grouped[task.status].push(task);
    }

    return grouped;
  }, [spec.tasks]);

  const taskSignature = useMemo(
    () =>
      spec.tasks
        .map((task) => `${task.id}:${task.status}:${task.description}`)
        .join('|'),
    [spec.tasks]
  );

  useEffect(() => {
    for (const column of taskColumns) {
      const element = columnRefs.current[column.id];
      if (!element) {
        continue;
      }

      element.scrollTop = scrollPositions.current[column.id];
    }
  }, [taskSignature]);

  return (
    <section className="task-board-shell">
      <div className="task-board-grid">
        {taskColumns.map((column) => {
          const tasks = tasksByStatus[column.id];

          return (
            <section className="task-board-column" key={column.id}>
              <div className="task-board-column-header">
                <h4>{column.label}</h4>
              </div>

              <div
                aria-label={`${column.label} tasks`}
                className="task-board-column-body"
                onScroll={(event) => {
                  scrollPositions.current[column.id] = event.currentTarget.scrollTop;
                }}
                ref={(element) => {
                  columnRefs.current[column.id] = element;
                }}
              >
                {tasks.length === 0 ? (
                  <p className="panel-copy task-board-empty">No tasks in this lane.</p>
                ) : (
                  tasks.map((task) => (
                    <article className="task-card" data-status={task.status} key={task.id}>
                      <div className="task-card-header">
                        <span className="task-card-id">{task.id}</span>
                        {task.isHeader ? (
                          <span className="badge badge-neutral">Header</span>
                        ) : null}
                      </div>
                      <strong className="task-card-title">{task.description}</strong>
                      <div className="task-card-hints">
                        {task.prompt ? (
                          <TaskHint label="Prompt" value={task.prompt} />
                        ) : null}
                        {task.purposes?.length ? (
                          <TaskHint label="Purpose" value={task.purposes.join('\n\n')} />
                        ) : null}
                        {task.requirements?.length ? (
                          <TaskHint label="Requirements" value={task.requirements.join(', ')} />
                        ) : null}
                        {task.files?.length ? (
                          <TaskHint label="Files" value={task.files.join('\n')} />
                        ) : null}
                        {task.implementationDetails?.length ? (
                          <TaskHint label="Details" value={task.implementationDetails.join('\n\n')} />
                        ) : null}
                      </div>
                    </article>
                  ))
                )}
              </div>
            </section>
          );
        })}
      </div>
    </section>
  );
}

function TaskHint({ label, value }: TaskHintProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <span
      className="task-card-hint"
      onBlur={() => {
        setIsOpen(false);
      }}
      onFocus={() => {
        setIsOpen(true);
      }}
      onMouseEnter={() => {
        setIsOpen(true);
      }}
      onMouseLeave={() => {
        setIsOpen(false);
      }}
    >
      <button
        className="task-card-hint-trigger"
        type="button"
      >
        {label}
      </button>
      {isOpen ? (
        <span className="task-card-hint-popover" role="tooltip">
          {value}
        </span>
      ) : null}
    </span>
  );
}
