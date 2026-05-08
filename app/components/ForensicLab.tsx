"use client";
import React from 'react';
import { Stage, Layer, Rect, Text as KonvaText, Group, Line, Circle } from 'react-konva';

interface Node {
  id: number;
  x: number;
  y: number;
  text: string;
  type?: 'text' | 'image';
}

interface Edge {
  from: number;
  to: number;
}

interface ForensicLabProps {
  nodes: Node[];
  edges: Edge[];
  onNodeDrag: (id: number, x: number, y: number) => void;
  onNodeDragStart: (id: number) => void;
  onNodeDragEnd: () => void;
  onToggleEdge: (from: number, to: number) => void;
  onDeleteNode: (id: number) => void;
  onRunAnalysis?: (nodeId: number) => void;
  runningNodeIds?: number[];
}

export default function ForensicLab({ 
  nodes, 
  edges, 
  onNodeDrag, 
  onNodeDragStart, 
  onNodeDragEnd,
  onToggleEdge,
  onDeleteNode,
  onRunAnalysis,
  runningNodeIds = []
}: ForensicLabProps) {
  const [draggingFrom, setDraggingFrom] = React.useState<number | null>(null);
  const [mousePos, setMousePos] = React.useState<{ x: number; y: number } | null>(null);

  const handleStageMouseMove = (e: any) => {
    if (draggingFrom !== null) {
      const stage = e.target.getStage();
      const pos = stage.getPointerPosition();
      setMousePos(pos);
    }
  };

  const handleStageMouseUp = (e: any) => {
    if (draggingFrom !== null) {
      const stage = e.target.getStage();
      const pos = stage.getPointerPosition();
      
      const targetNode = nodes.find(n => {
        if (n.type !== 'image') return false;
        return (
          pos.x >= n.x - 60 && pos.x <= n.x + 60 &&
          pos.y >= n.y - 80 && pos.y <= n.y + 80
        );
      });

      if (targetNode && targetNode.id !== draggingFrom) {
        onToggleEdge(draggingFrom, targetNode.id);
      }

      setDraggingFrom(null);
      setMousePos(null);
    }
  };

  return (
    <Stage 
      width={1000} 
      height={800} 
      className="cursor-crosshair"
      onMouseMove={handleStageMouseMove}
      onMouseUp={handleStageMouseUp}
    >
      <Layer>
        {/* Tactical Grid Pattern (Clinical Emerald) */}
        {Array.from({ length: 25 }).map((_, i) => 
          Array.from({ length: 20 }).map((_, j) => (
            <Circle key={`${i}-${j}`} x={i * 40} y={j * 40} radius={1} fill="#10b981" opacity={0.1} />
          ))
        )}

        {/* Drag Preview Line */}
        {draggingFrom !== null && mousePos && (
          <Line 
            points={[
              nodes.find(n => n.id === draggingFrom)!.x,
              nodes.find(n => n.id === draggingFrom)!.y + 40,
              mousePos.x,
              mousePos.y
            ]}
            stroke="#10b981"
            strokeWidth={2}
            dash={[6, 3]}
            opacity={0.8}
          />
        )}

        {/* Connection Lines */}
        {edges.map((edge, idx) => {
          const from = nodes.find(n => n.id === edge.from);
          const to = nodes.find(n => n.id === edge.to);
          if (!from || !to) return null;
          return (
            <Line 
              key={idx}
              points={[from.x, from.y + 40, to.x, to.type === 'image' ? to.y - 80 : to.y]}
              stroke="#10b981"
              strokeWidth={2}
              opacity={0.6}
              dash={[6, 3]}
            />
          );
        })}

        {/* Nodes */}
        {nodes.map((node) => (
          <Group 
            key={node.id} 
            x={node.x} 
            y={node.y}
            draggable
            onDragMove={(e) => {
              onNodeDrag(node.id, e.target.x(), e.target.y());
            }}
            onDragStart={() => onNodeDragStart(node.id)}
            onDragEnd={() => onNodeDragEnd()}
          >
            {/* Clinic Card Background */}
            <Rect 
              width={node.type === 'image' ? 120 : 100}
              height={node.type === 'image' ? 160 : 50}
              x={node.type === 'image' ? -60 : -50}
              y={node.type === 'image' ? -80 : -25}
              fill="#ffffff"
              stroke="#d1fae5"
              strokeWidth={1}
              shadowBlur={15}
              shadowColor="#10b981"
              shadowOpacity={0.05}
              cornerRadius={8}
            />
            
            {/* Content: Image Placeholder */}
            {node.type === 'image' && (
              <Rect 
                width={80}
                height={80}
                x={-40}
                y={-50}
                fill="#f0fdf4"
                stroke="#d1fae5"
                strokeWidth={1}
              />
            )}

            {/* Content: Text */}
            <KonvaText 
              text={node.text}
              width={node.type === 'image' ? 100 : 90}
              x={node.type === 'image' ? -50 : -45}
              y={node.type === 'image' ? 40 : -10}
              fontSize={11}
              fontStyle="bold"
              fontFamily="sans-serif"
              align="center"
              fill="#064e3b"
            />

            {/* Card Type Tag */}
            <KonvaText 
              text={node.type === 'image' ? "ANALYSIS_SCAN" : "BIOMETRIC_DATA"}
              width={100}
              x={-50}
              y={node.type === 'image' ? 60 : 12}
              fontSize={7}
              fontFamily="monospace"
              align="center"
              opacity={0.4}
              fill="#059669"
            />

            {/* DELETE BUTTON (X) */}
            <Group 
              x={node.type === 'image' ? 50 : 35} 
              y={node.type === 'image' ? -70 : -10}
              onClick={() => onDeleteNode(node.id)}
              onMouseEnter={(e: any) => {
                const container = e.target.getStage().container();
                container.style.cursor = 'pointer';
              }}
              onMouseLeave={(e: any) => {
                const container = e.target.getStage().container();
                container.style.cursor = 'default';
              }}
            >
              <Circle radius={6} fill="#ef4444" opacity={0.6} />
              <Line points={[-3, -3, 3, 3]} stroke="white" strokeWidth={1} />
              <Line points={[3, -3, -3, 3]} stroke="white" strokeWidth={1} />
            </Group>

            {/* LINK HANDLE (Only for non-image nodes - now DRAG-TO-LINK) */}
            {node.type !== 'image' && (
              <Group 
                x={0} y={40}
                onMouseDown={(e) => {
                  e.cancelBubble = true;
                  setDraggingFrom(node.id);
                }}
                onMouseEnter={(e: any) => {
                  const container = e.target.getStage().container();
                  container.style.cursor = 'crosshair';
                }}
                onMouseLeave={(e: any) => {
                  const container = e.target.getStage().container();
                  container.style.cursor = 'default';
                }}
              >
                <Circle 
                   radius={8} 
                   fill={draggingFrom === node.id ? "#10b981" : "#ffffff"} 
                   opacity={draggingFrom === node.id ? 1 : 0.8} 
                   stroke="#10b981"
                   strokeWidth={1.5}
                   shadowBlur={5}
                   shadowOpacity={0.1}
                />
                <KonvaText text="+" y={-5} x={-4} fontSize={10} fontStyle="bold" fill={draggingFrom === node.id ? "white" : "#10b981"} />
              </Group>
            )}

            {/* RUN BUTTON (Only for image nodes with connections) */}
            {node.type === 'image' && edges.filter(e => e.to === node.id || e.from === node.id).length >= 1 && (() => {
               const isRunning = runningNodeIds.includes(node.id);
               return (
                 <Group 
                    x={45} y={65}
                    onClick={() => {
                       if (!isRunning) onRunAnalysis?.(node.id);
                    }}
                    onMouseEnter={(e: any) => {
                      const container = e.target.getStage().container();
                      container.style.cursor = isRunning ? 'not-allowed' : 'pointer';
                    }}
                    onMouseLeave={(e: any) => {
                      const container = e.target.getStage().container();
                      container.style.cursor = 'default';
                    }}
                    opacity={isRunning ? 0.4 : 1}
                 >
                    <Circle 
                       radius={10}
                       fill="#064e3b"
                       shadowBlur={10}
                       shadowOpacity={0.4}
                       shadowColor="#10b981"
                    />
                    <Line 
                      points={[-2, -3, 3, 0, -2, 3]}
                      closed
                      fill="white"
                    />
                 </Group>
               );
            })()}
          </Group>
        ))}
      </Layer>
    </Stage>
  );
}
