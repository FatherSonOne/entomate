/**
 * WorkflowToolbar Component
 *
 * Top toolbar with workflow actions and controls
 */

import React, { useState } from 'react'
import {
  Save, Play, TestTube, Undo, Redo,
  ZoomIn, ZoomOut, Maximize2, Grid,
  Settings, History, Download, Upload,
  ToggleLeft, ToggleRight, ChevronLeft,
  MoreVertical, Copy, Trash2, AlertCircle
} from 'lucide-react'

export default function WorkflowToolbar({
  workflow,
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
  showGrid
}) {
  const [showMenu, setShowMenu] = useState(false)

  return (
    <div className="h-14 bg-surface border-b border-line-default flex items-center justify-between px-4">
      {/* Left section */}
      <div className="flex items-center gap-4">
        {/* Back button */}
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-content-tertiary hover:text-content-secondary"
        >
          <ChevronLeft className="w-5 h-5" />
          <span className="text-sm">Back</span>
        </button>

        {/* Workflow name */}
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-semibold text-content-primary max-w-xs truncate">
            {workflow?.name || 'Untitled Workflow'}
          </h1>
          {isDirty && (
            <span className="w-2 h-2 bg-orange-400 rounded-full" title="Unsaved changes" />
          )}
          <span className={`px-2 py-0.5 text-xs rounded-full ${
            isActive
              ? 'bg-semantic-success-dim text-semantic-success'
              : 'bg-surface-muted text-content-secondary'
          }`}>
            {isActive ? 'Active' : 'Inactive'}
          </span>
        </div>
      </div>

      {/* Center section - Actions */}
      <div className="flex items-center gap-1">
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
        <div className="flex items-center gap-1">
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
        </div>
      </div>

      {/* Right section */}
      <div className="flex items-center gap-2">
        {/* Toggle Active */}
        <button
          onClick={onToggleActive}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md ${
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
        </button>

        {/* Save button */}
        <button
          onClick={onSave}
          disabled={isSaving || !isDirty}
          className="flex items-center gap-1.5 px-4 py-1.5 text-sm bg-accent-primary text-white rounded-md hover:opacity-90 disabled:opacity-50"
        >
          {isSaving ? (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          Save
        </button>

        {/* More menu */}
        <div className="relative">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="p-2 text-content-tertiary hover:text-content-secondary hover:bg-surface-muted rounded"
          >
            <MoreVertical className="w-4 h-4" />
          </button>

          {showMenu && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setShowMenu(false)}
              />
              <div className="absolute right-0 top-full mt-1 w-48 bg-surface border border-line-default rounded-lg shadow-lg py-1 z-20">
                <button
                  onClick={() => { onOpenSettings?.(); setShowMenu(false); }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-content-secondary hover:bg-surface-muted"
                >
                  <Settings className="w-4 h-4" />
                  Workflow Settings
                </button>
                <button
                  onClick={() => { onOpenHistory?.(); setShowMenu(false); }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-content-secondary hover:bg-surface-muted"
                >
                  <History className="w-4 h-4" />
                  Version History
                </button>
                <hr className="my-1 border-line-subtle" />
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
                <hr className="my-1 border-line-subtle" />
                <button
                  onClick={() => { onDuplicate?.(); setShowMenu(false); }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-content-secondary hover:bg-surface-muted"
                >
                  <Copy className="w-4 h-4" />
                  Duplicate Workflow
                </button>
                <button
                  onClick={() => { onDelete?.(); setShowMenu(false); }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-semantic-error hover:bg-semantic-error-dim"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete Workflow
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
