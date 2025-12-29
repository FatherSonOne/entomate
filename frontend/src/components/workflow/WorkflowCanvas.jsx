/**
 * WorkflowCanvas Component
 *
 * The main visual workflow editor using React Flow
 */

import React, { useState, useCallback, useRef, useMemo } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  useReactFlow,
  ReactFlowProvider,
  Panel
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'

import { nodeTypes, categoryColors, getCategory } from './nodes'
import NodePalette from './NodePalette'
import NodeConfigPanel from './NodeConfigPanel'
import WorkflowToolbar from './WorkflowToolbar'
import WorkflowDebugPanel from './WorkflowDebugPanel'

// Default edge options
const defaultEdgeOptions = {
  type: 'smoothstep',
  animated: false,
  style: {
    strokeWidth: 2,
    stroke: '#94a3b8'
  }
}

// Connection line style
const connectionLineStyle = {
  strokeWidth: 2,
  stroke: '#6366f1'
}

// Generate unique ID
const generateId = () => `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

// Inner component with flow instance access
function WorkflowCanvasInner({
  workflow,
  onSave,
  onExecute,
  onTest,
  onBack,
  onChange
}) {
  const reactFlowWrapper = useRef(null)
  const { fitView, zoomIn, zoomOut, getZoom, setViewport, screenToFlowPosition } = useReactFlow()

  // State
  const [nodes, setNodes, onNodesChange] = useNodesState(workflow?.nodes || [])
  const [edges, setEdges, onEdgesChange] = useEdgesState(workflow?.connections || [])
  const [selectedNode, setSelectedNode] = useState(null)
  const [showGrid, setShowGrid] = useState(true)
  const [isDirty, setIsDirty] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isExecuting, setIsExecuting] = useState(false)
  const [pinnedNodes, setPinnedNodes] = useState(new Set())
  const [pinnedData, setPinnedData] = useState({})
  const [lastExecution, setLastExecution] = useState(null)
  const [showDebugPanel, setShowDebugPanel] = useState(true)
  const [debugPanelExpanded, setDebugPanelExpanded] = useState(false)

  // History for undo/redo
  const [history, setHistory] = useState([{ nodes: [], edges: [] }])
  const [historyIndex, setHistoryIndex] = useState(0)

  // Track changes
  const markDirty = useCallback(() => {
    setIsDirty(true)
    onChange?.({ nodes, edges })
  }, [nodes, edges, onChange])

  // Save to history
  const saveToHistory = useCallback(() => {
    const newHistory = history.slice(0, historyIndex + 1)
    newHistory.push({ nodes: [...nodes], edges: [...edges] })
    setHistory(newHistory)
    setHistoryIndex(newHistory.length - 1)
  }, [history, historyIndex, nodes, edges])

  // Handle connection
  const onConnect = useCallback((params) => {
    setEdges((eds) => addEdge({
      ...params,
      id: `edge_${Date.now()}`,
      type: 'smoothstep',
      animated: false
    }, eds))
    markDirty()
    saveToHistory()
  }, [setEdges, markDirty, saveToHistory])

  // Handle node selection
  const onNodeClick = useCallback((event, node) => {
    setSelectedNode(node)
  }, [])

  // Handle pane click (deselect)
  const onPaneClick = useCallback(() => {
    setSelectedNode(null)
  }, [])

  // Handle node drag stop
  const onNodeDragStop = useCallback((event, node) => {
    markDirty()
    saveToHistory()
  }, [markDirty, saveToHistory])

  // Handle drop from palette
  const onDragOver = useCallback((event) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
  }, [])

  const onDrop = useCallback((event) => {
    event.preventDefault()

    const data = event.dataTransfer.getData('application/reactflow')
    if (!data) return

    const { type, label } = JSON.parse(data)
    const position = screenToFlowPosition({
      x: event.clientX,
      y: event.clientY
    })

    const newNode = {
      id: generateId(),
      type,
      position,
      data: {
        label: label || type.replace(/_/g, ' '),
        config: {}
      }
    }

    setNodes((nds) => [...nds, newNode])
    setSelectedNode(newNode)
    markDirty()
    saveToHistory()
  }, [screenToFlowPosition, setNodes, markDirty, saveToHistory])

  // Add node at center
  const handleAddNode = useCallback((type, label) => {
    const position = {
      x: 250 + Math.random() * 100,
      y: 150 + Math.random() * 100
    }

    const newNode = {
      id: generateId(),
      type,
      position,
      data: {
        label: label || type.replace(/_/g, ' '),
        config: {}
      }
    }

    setNodes((nds) => [...nds, newNode])
    setSelectedNode(newNode)
    markDirty()
    saveToHistory()
  }, [setNodes, markDirty, saveToHistory])

  // Update node
  const handleUpdateNode = useCallback((nodeId, updates) => {
    setNodes((nds) =>
      nds.map((node) => {
        if (node.id === nodeId) {
          return {
            ...node,
            data: {
              ...node.data,
              ...updates
            }
          }
        }
        return node
      })
    )
    setSelectedNode((prev) => prev ? { ...prev, data: { ...prev.data, ...updates } } : null)
    markDirty()
  }, [setNodes, markDirty])

  // Delete node
  const handleDeleteNode = useCallback((nodeId) => {
    setNodes((nds) => nds.filter((node) => node.id !== nodeId))
    setEdges((eds) => eds.filter((edge) => edge.source !== nodeId && edge.target !== nodeId))
    setSelectedNode(null)
    markDirty()
    saveToHistory()
  }, [setNodes, setEdges, markDirty, saveToHistory])

  // Duplicate node
  const handleDuplicateNode = useCallback((nodeId) => {
    const node = nodes.find((n) => n.id === nodeId)
    if (!node) return

    const newNode = {
      ...node,
      id: generateId(),
      position: {
        x: node.position.x + 50,
        y: node.position.y + 50
      },
      data: {
        ...node.data,
        label: `${node.data.label} (copy)`
      }
    }

    setNodes((nds) => [...nds, newNode])
    setSelectedNode(newNode)
    markDirty()
    saveToHistory()
  }, [nodes, setNodes, markDirty, saveToHistory])

  // Toggle pin
  const handleTogglePin = useCallback((nodeId) => {
    setPinnedNodes((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(nodeId)) {
        newSet.delete(nodeId)
      } else {
        newSet.add(nodeId)
      }
      return newSet
    })
  }, [])

  // Pin data handler
  const handlePinData = useCallback((nodeId, data) => {
    setPinnedData(prev => ({ ...prev, [nodeId]: data }))
    setPinnedNodes(prev => new Set([...prev, nodeId]))
  }, [])

  // Unpin data handler
  const handleUnpinData = useCallback((nodeId) => {
    setPinnedData(prev => {
      const next = { ...prev }
      delete next[nodeId]
      return next
    })
    setPinnedNodes(prev => {
      const newSet = new Set(prev)
      newSet.delete(nodeId)
      return newSet
    })
  }, [])

  // Test node
  const handleTestNode = useCallback((nodeId) => {
    console.log('Testing node:', nodeId)
    // TODO: Implement node testing
  }, [])

  // Undo
  const handleUndo = useCallback(() => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1
      setHistoryIndex(newIndex)
      setNodes(history[newIndex].nodes)
      setEdges(history[newIndex].edges)
      markDirty()
    }
  }, [history, historyIndex, setNodes, setEdges, markDirty])

  // Redo
  const handleRedo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1
      setHistoryIndex(newIndex)
      setNodes(history[newIndex].nodes)
      setEdges(history[newIndex].edges)
      markDirty()
    }
  }, [history, historyIndex, setNodes, setEdges, markDirty])

  // Save workflow
  const handleSave = useCallback(async () => {
    setIsSaving(true)
    try {
      await onSave?.({
        nodes,
        connections: edges
      })
      setIsDirty(false)
    } catch (error) {
      console.error('Save failed:', error)
    } finally {
      setIsSaving(false)
    }
  }, [nodes, edges, onSave])

  // Execute workflow
  const handleExecute = useCallback(async () => {
    setIsExecuting(true)
    try {
      const result = await onExecute?.()
      setLastExecution(result)
      return result
    } catch (error) {
      console.error('Execution failed:', error)
      setLastExecution({ status: 'failed', error_message: error.message })
    } finally {
      setIsExecuting(false)
    }
  }, [onExecute])

  // Test workflow
  const handleTest = useCallback(async () => {
    setIsExecuting(true)
    try {
      const result = await onTest?.()
      setLastExecution(result)
      return result
    } catch (error) {
      console.error('Test failed:', error)
      setLastExecution({ status: 'failed', error_message: error.message })
    } finally {
      setIsExecuting(false)
    }
  }, [onTest])

  // Export workflow
  const handleExport = useCallback(() => {
    const data = {
      name: workflow?.name,
      nodes,
      connections: edges,
      exportedAt: new Date().toISOString()
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${workflow?.name || 'workflow'}.json`
    a.click()
    URL.revokeObjectURL(url)
  }, [workflow, nodes, edges])

  // Import workflow
  const handleImport = useCallback(() => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = async (e) => {
      const file = e.target.files?.[0]
      if (!file) return

      const text = await file.text()
      const data = JSON.parse(text)

      if (data.nodes) setNodes(data.nodes)
      if (data.connections) setEdges(data.connections)
      markDirty()
      saveToHistory()
    }
    input.click()
  }, [setNodes, setEdges, markDirty, saveToHistory])

  // MiniMap node color
  const nodeColor = useCallback((node) => {
    const category = getCategory(node.type)
    switch (category) {
      case 'trigger': return '#22c55e'
      case 'logic': return '#eab308'
      case 'action': return '#3b82f6'
      case 'ai': return '#a855f7'
      default: return '#6b7280'
    }
  }, [])

  return (
    <div className="flex h-full">
      {/* Node Palette */}
      <NodePalette onAddNode={handleAddNode} />

      {/* Main canvas area */}
      <div className="flex-1 flex flex-col">
        {/* Toolbar */}
        <WorkflowToolbar
          workflow={workflow}
          isDirty={isDirty}
          canUndo={historyIndex > 0}
          canRedo={historyIndex < history.length - 1}
          isActive={workflow?.active}
          isSaving={isSaving}
          isExecuting={isExecuting}
          showGrid={showGrid}
          onSave={handleSave}
          onExecute={handleExecute}
          onTest={handleTest}
          onUndo={handleUndo}
          onRedo={handleRedo}
          onZoomIn={() => zoomIn()}
          onZoomOut={() => zoomOut()}
          onFitView={() => fitView({ padding: 0.2 })}
          onToggleGrid={() => setShowGrid(!showGrid)}
          onToggleActive={() => {/* TODO */}}
          onExport={handleExport}
          onImport={handleImport}
          onBack={onBack}
        />

        {/* React Flow Canvas */}
        <div ref={reactFlowWrapper} className="flex-1">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            onPaneClick={onPaneClick}
            onNodeDragStop={onNodeDragStop}
            onDragOver={onDragOver}
            onDrop={onDrop}
            nodeTypes={nodeTypes}
            defaultEdgeOptions={defaultEdgeOptions}
            connectionLineStyle={connectionLineStyle}
            fitView
            snapToGrid={showGrid}
            snapGrid={[15, 15]}
            deleteKeyCode={['Backspace', 'Delete']}
            multiSelectionKeyCode={['Control', 'Meta']}
            className="bg-gray-50"
          >
            {showGrid && <Background gap={15} size={1} color="#e5e7eb" />}
            <Controls position="bottom-left" />
            <MiniMap
              nodeColor={nodeColor}
              nodeStrokeWidth={2}
              zoomable
              pannable
              position="bottom-right"
            />

            {/* Empty state panel */}
            {nodes.length === 0 && (
              <Panel position="center">
                <div className="text-center p-8 bg-white rounded-lg shadow-sm border border-gray-200">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Start building your workflow</h3>
                  <p className="text-gray-500 text-sm mb-4">
                    Drag nodes from the left panel or click to add them to the canvas
                  </p>
                  <p className="text-gray-400 text-xs">
                    Start with a trigger node to define when your workflow runs
                  </p>
                </div>
              </Panel>
            )}
          </ReactFlow>
        </div>
      </div>

      {/* Node Config Panel */}
      <NodeConfigPanel
        node={selectedNode}
        onClose={() => setSelectedNode(null)}
        onUpdate={handleUpdateNode}
        onDelete={handleDeleteNode}
        onDuplicate={handleDuplicateNode}
        onTest={handleTestNode}
        onTogglePin={handleTogglePin}
        isPinned={selectedNode ? pinnedNodes.has(selectedNode.id) : false}
      />

      {/* Debug Panel */}
      {showDebugPanel && (
        <WorkflowDebugPanel
          workflowId={workflow?.id}
          nodes={nodes}
          selectedNodeId={selectedNode?.id}
          execution={lastExecution}
          pinnedData={pinnedData}
          onTest={handleTest}
          onExecute={handleExecute}
          onPinData={handlePinData}
          onUnpinData={handleUnpinData}
          onSelectNode={(nodeId) => {
            const node = nodes.find(n => n.id === nodeId)
            if (node) setSelectedNode(node)
          }}
          onRestore={() => {
            // Reload workflow after restore
            window.location.reload()
          }}
          isExpanded={debugPanelExpanded}
          onToggleExpand={() => setDebugPanelExpanded(!debugPanelExpanded)}
        />
      )}
    </div>
  )
}

// Wrapper component with ReactFlowProvider
export default function WorkflowCanvas(props) {
  return (
    <ReactFlowProvider>
      <WorkflowCanvasInner {...props} />
    </ReactFlowProvider>
  )
}
