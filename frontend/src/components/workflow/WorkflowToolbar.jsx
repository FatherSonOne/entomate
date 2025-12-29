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
  onBack,
  showGrid
}) {
  const [showMenu, setShowMenu] = useState(false)

  return (
    <div className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-4">
      {/* Left section */}
      <div className="flex items-center gap-4">
        {/* Back button */}
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-gray-500 hover:text-gray-700"
        >
          <ChevronLeft className="w-5 h-5" />
          <span className="text-sm">Back</span>
        </button>

        {/* Workflow name */}
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-semibold text-gray-900 max-w-xs truncate">
            {workflow?.name || 'Untitled Workflow'}
          </h1>
          {isDirty && (
            <span className="w-2 h-2 bg-orange-400 rounded-full" title="Unsaved changes" />
          )}
          <span className={`px-2 py-0.5 text-xs rounded-full ${
            isActive
              ? 'bg-green-100 text-green-700'
              : 'bg-gray-100 text-gray-600'
          }`}>
            {isActive ? 'Active' : 'Inactive'}
          </span>
        </div>
      </div>

      {/* Center section - Actions */}
      <div className="flex items-center gap-1">
        {/* Undo/Redo */}
        <div className="flex items-center border-r border-gray-200 pr-2 mr-2">
          <button
            onClick={onUndo}
            disabled={!canUndo}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded disabled:opacity-30 disabled:cursor-not-allowed"
            title="Undo (Ctrl+Z)"
          >
            <Undo className="w-4 h-4" />
          </button>
          <button
            onClick={onRedo}
            disabled={!canRedo}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded disabled:opacity-30 disabled:cursor-not-allowed"
            title="Redo (Ctrl+Y)"
          >
            <Redo className="w-4 h-4" />
          </button>
        </div>

        {/* Zoom controls */}
        <div className="flex items-center border-r border-gray-200 pr-2 mr-2">
          <button
            onClick={onZoomOut}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded"
            title="Zoom Out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <button
            onClick={onZoomIn}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded"
            title="Zoom In"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            onClick={onFitView}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded"
            title="Fit to View"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
          <button
            onClick={onToggleGrid}
            className={`p-2 rounded ${
              showGrid
                ? 'text-primary-600 bg-primary-50'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
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
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 rounded-md disabled:opacity-50"
          >
            <TestTube className="w-4 h-4" />
            Test
          </button>
          <button
            onClick={onExecute}
            disabled={isExecuting || !isActive}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
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
              ? 'bg-green-50 text-green-700 hover:bg-green-100'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
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
          className="flex items-center gap-1.5 px-4 py-1.5 text-sm bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50"
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
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded"
          >
            <MoreVertical className="w-4 h-4" />
          </button>

          {showMenu && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setShowMenu(false)}
              />
              <div className="absolute right-0 top-full mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-20">
                <button
                  onClick={() => { onOpenSettings?.(); setShowMenu(false); }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
                >
                  <Settings className="w-4 h-4" />
                  Workflow Settings
                </button>
                <button
                  onClick={() => { onOpenHistory?.(); setShowMenu(false); }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
                >
                  <History className="w-4 h-4" />
                  Version History
                </button>
                <hr className="my-1 border-gray-100" />
                <button
                  onClick={() => { onExport?.(); setShowMenu(false); }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
                >
                  <Download className="w-4 h-4" />
                  Export Workflow
                </button>
                <button
                  onClick={() => { onImport?.(); setShowMenu(false); }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
                >
                  <Upload className="w-4 h-4" />
                  Import Workflow
                </button>
                <hr className="my-1 border-gray-100" />
                <button
                  onClick={() => { /* TODO: duplicate */ setShowMenu(false); }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
                >
                  <Copy className="w-4 h-4" />
                  Duplicate Workflow
                </button>
                <button
                  onClick={() => { /* TODO: delete */ setShowMenu(false); }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50"
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
