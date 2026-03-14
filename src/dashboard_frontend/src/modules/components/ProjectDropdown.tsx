import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useProjects } from '../projects/ProjectProvider';
import { TextInputModal } from '../modals/TextInputModal';
import { ConfirmationModal } from '../modals/ConfirmationModal';

export function ProjectDropdown() {
  const { t } = useTranslation();
  const { projects, currentProject, setCurrentProject, addProjectByPath, removeProjectById, loading } = useProjects();
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [projectPendingRemoval, setProjectPendingRemoval] = useState<{ projectId: string; projectName: string } | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchQuery('');
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        setIsOpen(false);
        setSearchQuery('');
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
      setTimeout(() => searchInputRef.current?.focus(), 0);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const filteredProjects = projects.filter(project =>
    `${project.projectName} ${project.gitBranch || ''} ${project.latestSpec?.displayName || ''}`.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleProjectSelect = (projectId: string) => {
    setCurrentProject(projectId);
    setIsOpen(false);
    setSearchQuery('');
  };

  const toggleDropdown = () => {
    setIsOpen(!isOpen);
    if (isOpen) {
      setSearchQuery('');
    }
  };

  const openAddModal = () => {
    setIsAddModalOpen(true);
    setIsOpen(false);
    setSearchQuery('');
  };

  return (
    <>
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={toggleDropdown}
          data-testid="project-dropdown-toggle"
          className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-[var(--surface-hover)] transition-colors text-[var(--text-primary)]"
          aria-label={t('projects.selectProject', 'Select project')}
        >
          <span className="text-sm font-medium">
            {t('projects.label', 'Projects')}:
          </span>
          <span className="text-sm font-semibold">
            {currentProject?.projectName
              ? `${currentProject.projectName}${currentProject.gitBranch ? ` (${currentProject.gitBranch})` : ''}`
              : t('projects.none', 'No Project')
            }
          </span>
          <svg
            className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {isOpen && (
          <div
            data-testid="project-dropdown-menu"
            className="absolute left-0 mt-2 w-[36rem] max-w-[calc(100vw-2rem)] bg-[var(--surface-panel)] border border-[var(--border-default)] rounded-lg shadow-lg z-50 max-h-96 flex flex-col"
          >
            <div className="p-3 border-b border-[var(--border-default)]">
              <input
                ref={searchInputRef}
                type="text"
                data-testid="project-dropdown-search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('projects.search', 'Search projects...')}
                className="w-full px-3 py-2 text-sm bg-[var(--surface-inset)] border border-[var(--border-default)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)] text-[var(--text-primary)]"
              />
            </div>

            <div className="overflow-y-auto flex-1">
              {loading ? (
                <div className="text-center text-[var(--text-muted)] py-6 text-sm">
                  {t('projects.loading', 'Loading projects...')}
                </div>
              ) : filteredProjects.length === 0 ? (
                <div className="px-4 py-8 text-center text-[var(--text-muted)]">
                  <p className="text-sm">
                    {searchQuery
                      ? t('projects.noResults', 'No projects found')
                      : t('projects.noProjects', 'No projects available')}
                  </p>
                  {!searchQuery && (
                    <button
                      onClick={openAddModal}
                      className="mt-4 inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md bg-[var(--accent-primary)] text-white hover:bg-[var(--accent-primary-hover)] transition-colors"
                    >
                      {t('projects.addProject', 'Add project')}
                    </button>
                  )}
                </div>
              ) : (
                <div className="py-1">
                  {filteredProjects.map((project) => {
                    const isCurrent = project.projectId === currentProject?.projectId;
                    const isDisconnected = !project.instances?.length;

                    return (
                      <div
                        key={project.projectId}
                        className={`px-2 py-1 ${isCurrent ? 'bg-indigo-50 dark:bg-indigo-900/20' : ''}`}
                      >
                        <div className="flex items-stretch gap-2">
                          <button
                            onClick={() => handleProjectSelect(project.projectId)}
                            data-testid={`project-dropdown-item-${project.projectId}`}
                            className="flex-1 min-w-0 text-left px-3 py-2.5 rounded-md hover:bg-[var(--surface-hover)] transition-colors flex items-center justify-between"
                          >
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <div
                                className={`w-2 h-2 rounded-full ${
                                  isCurrent
                                    ? 'bg-indigo-600 dark:bg-indigo-400'
                                    : isDisconnected
                                      ? 'bg-amber-500'
                                      : 'bg-[var(--status-success)]'
                                }`}
                              />
                              <div className="min-w-0 flex-1">
                                <div
                                  className={`text-sm truncate ${
                                    isCurrent
                                      ? 'font-semibold text-indigo-900 dark:text-indigo-100'
                                      : 'text-[var(--text-primary)]'
                                  }`}
                                  title={project.projectName}
                                >
                                  {project.projectName}
                                </div>
                                <div className="mt-0.5 flex items-center gap-2 text-xs text-[var(--text-muted)] flex-wrap">
                                  {project.gitBranch && (
                                    <span className="truncate" title={project.gitBranch}>
                                      {project.gitBranch}
                                    </span>
                                  )}
                                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 ${
                                    isDisconnected
                                      ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200'
                                      : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200'
                                  }`}>
                                    {isDisconnected
                                      ? t('projects.disconnected', 'Remembered')
                                      : t('projects.connected', 'Live')}
                                  </span>
                                  {project.instances?.length > 0 && (
                                    <span>
                                      {project.instances.length === 1
                                        ? `PID: ${project.instances[0].pid}`
                                        : t('projects.instanceCount', { count: project.instances.length, defaultValue: `${project.instances.length} instances` })}
                                    </span>
                                  )}
                                </div>
                                {project.latestSpec?.displayName && (
                                  <div
                                    className="text-xs text-[var(--text-muted)] truncate mt-1"
                                    title={project.latestSpec.displayName}
                                  >
                                    Latest spec: {project.latestSpec.displayName}
                                  </div>
                                )}
                              </div>
                            </div>
                            {isCurrent && (
                              <svg
                                className="w-5 h-5 text-indigo-600 dark:text-indigo-400 flex-shrink-0"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth="2"
                                  d="M5 13l4 4L19 7"
                                />
                              </svg>
                            )}
                          </button>

                          <button
                            onClick={(event) => {
                              event.stopPropagation();
                              setProjectPendingRemoval({
                                projectId: project.projectId,
                                projectName: project.projectName
                              });
                            }}
                            className="px-3 rounded-md text-[var(--text-muted)] hover:text-[var(--status-error)] hover:bg-[var(--surface-hover)] transition-colors"
                            title={t('projects.forgetProject', 'Forget project')}
                            aria-label={t('projects.forgetProject', 'Forget project')}
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7L5 7M10 11v6M14 11v6M6 7l1 12a2 2 0 002 2h6a2 2 0 002-2l1-12M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="px-4 py-3 border-t border-[var(--border-default)] flex items-center justify-between gap-3">
              <div className="text-xs text-[var(--text-muted)]">
                {!loading && projects.length > 0
                  ? t('projects.count', {
                      count: projects.length,
                      defaultValue: `${projects.length} project(s)`,
                    })
                  : t('projects.recoveryHint', 'Remembered projects stay available after MCP restarts.')}
              </div>
              <button
                onClick={openAddModal}
                className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md border border-[var(--border-default)] text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                </svg>
                {t('projects.addProject', 'Add project')}
              </button>
            </div>
          </div>
        )}
      </div>

      <TextInputModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSubmit={async (projectPath) => {
          await addProjectByPath(projectPath);
        }}
        title={t('projects.addProject', 'Add project')}
        placeholder={t('projects.pathPlaceholder', 'Enter a repository or worktree path')}
        submitText={t('projects.addProject', 'Add project')}
        cancelText={t('common.cancel', 'Cancel')}
      />

      <ConfirmationModal
        isOpen={!!projectPendingRemoval}
        onClose={() => setProjectPendingRemoval(null)}
        onConfirm={async () => {
          if (projectPendingRemoval) {
            await removeProjectById(projectPendingRemoval.projectId);
          }
        }}
        title={t('projects.forgetProject', 'Forget project')}
        message={
          projectPendingRemoval
            ? `Remove "${projectPendingRemoval.projectName}" from remembered dashboard projects? Live MCP instances will stay visible until they disconnect.`
            : ''
        }
        confirmText={t('projects.forgetProject', 'Forget project')}
        cancelText={t('common.cancel', 'Cancel')}
        variant="danger"
      />
    </>
  );
}
