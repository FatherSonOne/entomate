/**
 * WorkflowToolbar Component
 *
 * Top toolbar with workflow actions and controls
 */

import React, { useId, useRef, useState } from 'react'
import {
  Save, Play, TestTube, Undo, Redo,
  ZoomIn, ZoomOut, Maximize2, Grid,
  Settings, History, Download, Upload,
  ToggleLeft, ToggleRight, ChevronLeft,
  MoreVertical, Copy, Trash2, AlertCircle
} from 'lucide-react'

export default function WorkflowToolbar({
  workflow,
  draft = false,
  isDirty,
  canUndo,
  canRedo,
  isActive,
  isSaving,
  isExecuting,
  onSave,
  onExecute,
  onTest,
  onUndo,
  onRedo,
  onZoomIn,
  onZoomOut,
  onFitView,
  onToggleGrid,
  onToggleActive,
  onOpenSettings,
  onOpenHistory,
  onExport,
  onImport,
  onDuplicate,
  onDelete,
  onBack,
  onNameChange,
  showGrid,
  compact = false,
  onOpenNodes
}) {
  const [showMenu, setShowMenu] = useState(false)
  const moreButton = useRef(null)
  const moreId = useId()
  const [isEditingName, setIsEditingName] = useState(false)
  const [editName, setEditName] = useState('')

  return (
    <div className={`relative z-10 min-h-14 shrink-0 bg-surface border-b border-line-default flex flex-wrap items-center justify-between py-2 ${compact ? 'gap-2 px-3' : 'gap-x-3 gap-y-1 px-4'}`}>
      {/* Left section */}
      <div className={`flex min-w-0 items-center gap-3 ${compact ? 'w-full' : 'flex-[1_1_12rem]'}`}>
        {/* Back button */}
        <button
          onClick={onBack}
          className="flex min-h-9 shrink-0 items-center gap-1 text-content-tertiary hover:text-content-secondary"
        >
          <ChevronLeft className="w-5 h-5" />
          <span className="text-sm">Back</span>
        </button>

        {/* Workflow name — click to edit */}
        <div className="grid min-w-0 flex-1 grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2">
          {isEditingName ? (
            <input
              type="text"
              aria-label="Workflow name"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onBlur={() => {
                if (editName.trim() && editName !== workflow?.name) {
                  onNameChange?.(editName.trim())
                }
                setIsEditingName(false)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  if (editName.trim() && editName !== workflow?.name) {
                    onNameChange?.(editName.trim())
                  }
                  setIsEditingName(false)
                }
                if (e.key === 'Escape') {
                  setIsEditingName(false)
                }
              }}
              autoFocus
              className="w-full min-w-0 text-lg font-semibold text-content-primary max-w-xs bg-transparent border-b-2 border-accent-primary focus:outline-none"
            />
          ) : (
            <h1 className="min-w-0 max-w-xs text-lg font-semibold text-content-primary">
              <button type="button" className="block max-w-full truncate text-left hover:opacity-80"
                onClick={() => {
                  setEditName(workflow?.name || '')
                  setIsEditingName(true)
                }}
                title="Rename workflow"
              >
                {workflow?.name || 'Untitled Workflow'}
              </button>
            </h1>
          )}
          <span className={`w-2 h-2 shrink-0 vc-bg-warning rounded-full ${isDirty ? '' : 'invisible'}`} title={isDirty ? 'Unsaved changes' : undefined} />
          <span className={`min-w-16 shrink-0 whitespace-nowrap px-2 py-0.5 text-center text-xs rounded-full ${
            isActive
              ? 'bg-semantic-success-dim text-semantic-success'
              : 'bg-surface-muted text-content-secondary'
          }`}>
            {draft ? 'Unsaved draft' : isActive ? 'Active' : 'Inactive'}
          </span>
        </div>
      </div>

      {/* Center section - Actions */}
      {!compact && <div className="flex shrink-0 items-center gap-1">
        {/* Undo/Redo */}
        <div className="flex items-center border-r border-line-default pr-2 mr-2">
          <button
            onClick={onUndo}
            disabled={!canUndo}
            className="p-2 text-content-tertiary hover:text-content-secondary hover:bg-surface-muted rounded disabled:opacity-30 disabled:cursor-not-allowed"
            title="Undo (Ctrl+Z)"
          >
            <Undo className="w-4 h-4" />
          </button>
          <button
            onClick={onRedo}
            disabled={!canRedo}
            className="p-2 text-content-tertiary hover:text-content-secondary hover:bg-surface-muted rounded disabled:opacity-30 disabled:cursor-not-allowed"
            title="Redo (Ctrl+Y)"
          >
            <Redo className="w-4 h-4" />
          </button>
        </div>

        {/* Zoom controls */}
        <div className="flex items-center border-r border-line-default pr-2 mr-2">
          <button
            onClick={onZoomOut}
            className="p-2 text-content-tertiary hover:text-content-secondary hover:bg-surface-muted rounded"
            title="Zoom Out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <button
            onClick={onZoomIn}
            className="p-2 text-content-tertiary hover:text-content-secondary hover:bg-surface-muted rounded"
            title="Zoom In"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            onClick={onFitView}
            className="p-2 text-content-tertiary hover:text-content-secondary hover:bg-surface-muted rounded"
            title="Fit to View"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
          <button
            onClick={onToggleGrid}
            className={`p-2 rounded ${
              showGrid
                ? 'text-accent-primary bg-primary-50'
                : 'text-content-tertiary hover:text-content-secondary hover:bg-surface-muted'
            }`}
            title="Toggle Grid"
          >
            <Grid className="w-4 h-4" />
          </button>
        </div>

        {/* Test & Execute */}
        {!draft && <div className="flex items-center gap-1">
          <button
            onClick={onTest}
            disabled={isExecuting}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-content-secondary hover:bg-surface-muted rounded-md disabled:opacity-50"
          >
            <TestTube className="w-4 h-4" />
            Test
          </button>
          <button
            onClick={onExecute}
            disabled={isExecuting || !isActive}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-semantic-success text-white rounded-md hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isExecuting ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Play className="w-4 h-4" />
            )}
            Execute
          </button>
        </div>}
      </div>}

      {/* Right section */}
      <div className={`flex shrink-0 items-center gap-2 ${compact ? 'w-full' : ''}`}>
        {compact && <button type="button" onClick={onOpenNodes} aria-haspopup="dialog"
          className="min-h-9 mr-auto rounded bg-surface-muted px-3 text-sm text-content-primary">Nodes</button>}
        {/* Toggle Active */}
        {!compact && !draft && <button
          onClick={onToggleActive}
          className={`flex w-28 items-center justify-center gap-1.5 px-3 py-1.5 text-sm rounded-md ${
            isActive
              ? 'bg-semantic-success-dim text-semantic-success hover:bg-semantic-success-dim'
              : 'bg-surface-muted text-content-secondary hover:bg-surface-muted'
          }`}
        >
          {isActive ? (
            <ToggleRight className="w-4 h-4" />
          ) : (
            <ToggleLeft className="w-4 h-4" />
          )}
          {isActive ? 'Active' : 'Inactive'}
        </button>}

        {/* Save button */}
        <button
          onClick={onSave}
          disabled={isSaving || (!draft && !isDirty)}
          className="flex min-h-9 items-center gap-1.5 px-4 py-1.5 text-sm bg-accent-primary text-[color:var(--bs-on-brand,white)] rounded-md hover:opacity-90 disabled:opacity-50"
        >
          {isSaving ? (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          Save
        </button>

        {/* More menu */}
        <div className="relative" onKeyDown={(event) => {
          if (event.key === 'Escape' && showMenu) {
            event.stopPropagation()
            setShowMenu(false)
            moreButton.current?.focus()
          }
        }}>
          <button
            type="button"
            ref={moreButton}
            aria-label="More workflow actions"
            aria-expanded={showMenu}
            aria-controls={showMenu ? moreId : undefined}
            onClick={() => setShowMenu(!showMenu)}
            className="min-h-9 min-w-9 p-2 text-content-tertiary hover:text-content-secondary hover:bg-surface-muted rounded"
          >
            <MoreVertical className="w-4 h-4" />
          </button>

          {showMenu && (
            <>
              <div
                className="fixed inset-0 z-10"
                aria-hidden="true"
                onClick={() => setShowMenu(false)}
              />
              <div id={moreId} className="absolute right-0 top-full mt-1 max-h-[55dvh] overflow-y-auto w-48 bg-surface border border-line-default rounded-lg shadow-lg py-1 z-20">
                {compact && [
                  ['Undo', onUndo, !canUndo], ['Redo', onRedo, !canRedo],
                  [showGrid ? 'Hide grid' : 'Show grid', onToggleGrid, false],
                  ...(!draft ? [
                    ['Test', onTest, isExecuting], ['Execute', onExecute, isExecuting || !isActive],
                    [isActive ? 'Deactivate workflow' : 'Activate workflow', onToggleActive, false],
                  ] : []),
                ].map(([label, action, disabled]) => (
                  <button key={label} type="button" disabled={disabled}
                    onClick={() => { setShowMenu(false); action?.(); moreButton.current?.focus() }}
                    className="w-full px-3 py-2 text-left text-sm text-content-secondary hover:bg-surface-muted disabled:opacity-50">{label}</button>
                ))}
                {onOpenSettings && <button
                  onClick={() => { onOpenSettings(); setShowMenu(false); }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-content-secondary hover:bg-surface-muted"
                >
                  <Settings className="w-4 h-4" />
                  Workflow Settings
                </button>}
                {!draft && <button
                  onClick={() => { onOpenHistory?.(); setShowMenu(false); }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-content-secondary hover:bg-surface-muted"
                >
                  <History className="w-4 h-4" />
                  Version History
                </button>}
                {!draft && <hr className="my-1 border-line-subtle" />}
                <button
                  onClick={() => { onExport?.(); setShowMenu(false); }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-content-secondary hover:bg-surface-muted"
                >
                  <Download className="w-4 h-4" />
                  Export Workflow
                </button>
                <button
                  onClick={() => { onImport?.(); setShowMenu(false); }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-content-secondary hover:bg-surface-muted"
                >
                  <Upload className="w-4 h-4" />
                  Import Workflow
                </button>
                {!draft && <hr className="my-1 border-line-subtle" />}
                {!draft && <button
                  onClick={() => { onDuplicate?.(); setShowMenu(false); }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-content-secondary hover:bg-surface-muted"
                >
                  <Copy className="w-4 h-4" />
                  Duplicate Workflow
                </button>}
                {!draft && <button
                  onClick={() => { onDelete?.(); setShowMenu(false); }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-semantic-error hover:bg-semantic-error-dim"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete Workflow
                </button>}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
