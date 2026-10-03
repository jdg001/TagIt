import { Injectable } from '@angular/core';
import { CanvasElement } from './index';

/**
 * Represents a single action in the canvas history
 */
export interface HistoryAction {
  id: string;
  type: HistoryActionType;
  timestamp: Date;
  description: string;
  data: any; // Action-specific data
  inverseData?: any; // Data needed to reverse the action
}

/**
 * Types of actions that can be performed on the canvas
 */
export enum HistoryActionType {
  ADD_ELEMENT = 'add_element',
  REMOVE_ELEMENT = 'remove_element',
  MOVE_ELEMENT = 'move_element',
  RESIZE_ELEMENT = 'resize_element',
  UPDATE_ELEMENT_PROPERTIES = 'update_element_properties',
  DUPLICATE_ELEMENT = 'duplicate_element',
  GROUP_ELEMENTS = 'group_elements',
  UNGROUP_ELEMENTS = 'ungroup_elements',
  PAPER_LAYOUT_MOVE = 'paper_layout_move',
  PAPER_LAYOUT_RESIZE = 'paper_layout_resize',
  BRING_TO_FRONT = 'bring_to_front',
  BATCH_OPERATION = 'batch_operation'
}

/**
 * Configuration for the history service
 */
export interface HistoryConfig {
  maxHistorySize: number;
  enableCompression: boolean;
  autoSave: boolean;
}

/**
 * Service for managing undo/redo functionality in the canvas
 */
@Injectable({
  providedIn: 'root'
})
export class HistoryService {
  private history: HistoryAction[] = [];
  private currentIndex: number = -1;
  private config: HistoryConfig = {
    maxHistorySize: 50,
    enableCompression: true,
    autoSave: false
  };

  /**
   * Add a new action to the history
   * @param action The action to add
   */
  addAction(action: Omit<HistoryAction, 'id' | 'timestamp'>): void {
    const historyAction: HistoryAction = {
      ...action,
      id: this.generateId(),
      timestamp: new Date()
    };

    // Remove any actions after current index (when branching)
    this.history = this.history.slice(0, this.currentIndex + 1);

    // Add new action
    this.history.push(historyAction);
    this.currentIndex++;

    // Limit history size
    if (this.history.length > this.config.maxHistorySize) {
      this.history.shift();
      this.currentIndex--;
    }

    // Compress similar actions if enabled
    if (this.config.enableCompression) {
      this.compressHistory();
    }
  }

  /**
   * Undo the last action
   * @returns The action that was undone, or null if no action to undo
   */
  undo(): HistoryAction | null {
    if (!this.canUndo()) {
      return null;
    }

    const action = this.history[this.currentIndex];
    this.currentIndex--;
    return action;
  }

  /**
   * Redo the next action
   * @returns The action that was redone, or null if no action to redo
   */
  redo(): HistoryAction | null {
    if (!this.canRedo()) {
      return null;
    }

    this.currentIndex++;
    return this.history[this.currentIndex];
  }

  /**
   * Check if undo is possible
   */
  canUndo(): boolean {
    return this.currentIndex >= 0;
  }

  /**
   * Check if redo is possible
   */
  canRedo(): boolean {
    return this.currentIndex < this.history.length - 1;
  }

  /**
   * Get the current history state
   */
  getHistory(): HistoryAction[] {
    return [...this.history];
  }

  /**
   * Get the current index
   */
  getCurrentIndex(): number {
    return this.currentIndex;
  }

  /**
   * Clear all history
   */
  clear(): void {
    this.history = [];
    this.currentIndex = -1;
  }

  /**
   * Get the last action
   */
  getLastAction(): HistoryAction | null {
    return this.currentIndex >= 0 ? this.history[this.currentIndex] : null;
  }

  /**
   * Get actions that can be undone
   */
  getUndoableActions(): HistoryAction[] {
    return this.history.slice(0, this.currentIndex + 1).reverse();
  }

  /**
   * Get actions that can be redone
   */
  getRedoableActions(): HistoryAction[] {
    return this.history.slice(this.currentIndex + 1);
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<HistoryConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Generate a unique ID for actions
   */
  private generateId(): string {
    return `action_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Compress similar consecutive actions
   */
  private compressHistory(): void {
    if (this.history.length < 2) return;

    const lastAction = this.history[this.history.length - 1];
    const secondLastAction = this.history[this.history.length - 2];

    // Compress consecutive move operations
    if (this.canCompressActions(secondLastAction, lastAction)) {
      this.compressMoveActions(secondLastAction, lastAction);
    }
  }

  /**
   * Check if two actions can be compressed
   */
  private canCompressActions(action1: HistoryAction, action2: HistoryAction): boolean {
    // Compress consecutive move operations of the same element
    if (action1.type === HistoryActionType.MOVE_ELEMENT && 
        action2.type === HistoryActionType.MOVE_ELEMENT &&
        action1.data.elementId === action2.data.elementId) {
      return true;
    }

    // Compress consecutive resize operations of the same element
    if (action1.type === HistoryActionType.RESIZE_ELEMENT && 
        action2.type === HistoryActionType.RESIZE_ELEMENT &&
        action1.data.elementId === action2.data.elementId) {
      return true;
    }

    return false;
  }

  /**
   * Compress two move actions into one
   */
  private compressMoveActions(action1: HistoryAction, action2: HistoryAction): void {
    // Update the first action with the final position
    action1.data.finalX = action2.data.finalX;
    action1.data.finalY = action2.data.finalY;
    action1.description = `Move ${action1.data.elementId} to (${action2.data.finalX}, ${action2.data.finalY})`;
    
    // Remove the second action
    this.history.pop();
    this.currentIndex--;
  }
}

/**
 * Helper functions for creating common history actions
 */
export class HistoryActionFactory {
  /**
   * Create an action for adding an element
   */
  static createAddElementAction(element: CanvasElement): Omit<HistoryAction, 'id' | 'timestamp'> {
    return {
      type: HistoryActionType.ADD_ELEMENT,
      description: `Add ${element.type} element`,
      data: { element: { ...element } }
    };
  }

  /**
   * Create an action for removing an element
   */
  static createRemoveElementAction(element: CanvasElement): Omit<HistoryAction, 'id' | 'timestamp'> {
    return {
      type: HistoryActionType.REMOVE_ELEMENT,
      description: `Remove ${element.type} element`,
      data: { element: { ...element } }
    };
  }

  /**
   * Create an action for moving an element
   */
  static createMoveElementAction(
    elementId: string, 
    fromX: number, 
    fromY: number, 
    toX: number, 
    toY: number
  ): Omit<HistoryAction, 'id' | 'timestamp'> {
    return {
      type: HistoryActionType.MOVE_ELEMENT,
      description: `Move element to (${toX}, ${toY})`,
      data: { 
        elementId, 
        fromX, 
        fromY, 
        finalX: toX, 
        finalY: toY 
      },
      inverseData: { fromX: toX, fromY: toY, toX: fromX, toY: fromY }
    };
  }

  /**
   * Create an action for resizing an element
   */
  static createResizeElementAction(
    elementId: string,
    fromWidth: number,
    fromHeight: number,
    toWidth: number,
    toHeight: number
  ): Omit<HistoryAction, 'id' | 'timestamp'> {
    return {
      type: HistoryActionType.RESIZE_ELEMENT,
      description: `Resize element to ${toWidth}x${toHeight}`,
      data: { 
        elementId, 
        fromWidth, 
        fromHeight, 
        finalWidth: toWidth, 
        finalHeight: toHeight 
      },
      inverseData: { fromWidth: toWidth, fromHeight: toHeight, toWidth: fromWidth, toHeight: fromHeight }
    };
  }

  /**
   * Create an action for updating element properties
   */
  static createUpdateElementPropertiesAction(
    elementId: string,
    oldProperties: Partial<CanvasElement>,
    newProperties: Partial<CanvasElement>
  ): Omit<HistoryAction, 'id' | 'timestamp'> {
    return {
      type: HistoryActionType.UPDATE_ELEMENT_PROPERTIES,
      description: `Update element properties`,
      data: { 
        elementId, 
        oldProperties: { ...oldProperties }, 
        newProperties: { ...newProperties } 
      },
      inverseData: { oldProperties: { ...newProperties }, newProperties: { ...oldProperties } }
    };
  }

  /**
   * Create an action for duplicating an element
   */
  static createDuplicateElementAction(originalElement: CanvasElement, duplicatedElement: CanvasElement): Omit<HistoryAction, 'id' | 'timestamp'> {
    return {
      type: HistoryActionType.DUPLICATE_ELEMENT,
      description: `Duplicate ${originalElement.type} element`,
      data: { 
        originalElement: { ...originalElement }, 
        duplicatedElement: { ...duplicatedElement } 
      }
    };
  }

  /**
   * Create an action for grouping elements
   */
  static createGroupElementsAction(elementIds: string[], groupId: string): Omit<HistoryAction, 'id' | 'timestamp'> {
    return {
      type: HistoryActionType.GROUP_ELEMENTS,
      description: `Group ${elementIds.length} elements`,
      data: { elementIds: [...elementIds], groupId }
    };
  }

  /**
   * Create an action for ungrouping elements
   */
  static createUngroupElementsAction(elementIds: string[], groupId: string): Omit<HistoryAction, 'id' | 'timestamp'> {
    return {
      type: HistoryActionType.UNGROUP_ELEMENTS,
      description: `Ungroup ${elementIds.length} elements`,
      data: { elementIds: [...elementIds], groupId }
    };
  }

  /**
   * Create an action for paper layout movement
   */
  static createPaperLayoutMoveAction(
    fromX: number, 
    fromY: number, 
    toX: number, 
    toY: number
  ): Omit<HistoryAction, 'id' | 'timestamp'> {
    return {
      type: HistoryActionType.PAPER_LAYOUT_MOVE,
      description: `Move paper layout to (${toX}, ${toY})`,
      data: { fromX, fromY, finalX: toX, finalY: toY },
      inverseData: { fromX: toX, fromY: toY, toX: fromX, toY: fromY }
    };
  }

  /**
   * Create an action for paper layout resizing
   */
  static createPaperLayoutResizeAction(
    fromWidth: number,
    fromHeight: number,
    toWidth: number,
    toHeight: number
  ): Omit<HistoryAction, 'id' | 'timestamp'> {
    return {
      type: HistoryActionType.PAPER_LAYOUT_RESIZE,
      description: `Resize paper layout to ${toWidth}x${toHeight}`,
      data: { fromWidth, fromHeight, finalWidth: toWidth, finalHeight: toHeight },
      inverseData: { fromWidth: toWidth, fromHeight: toHeight, toWidth: fromWidth, toHeight: toHeight }
    };
  }

  /**
   * Create an action for bringing an element to front
   */
  static createBringToFrontAction(
    elementId: string,
    fromIndex: number,
    toIndex: number
  ): Omit<HistoryAction, 'id' | 'timestamp'> {
    return {
      type: HistoryActionType.BRING_TO_FRONT,
      description: `Bring element to front`,
      data: { 
        elementId, 
        fromIndex, 
        toIndex 
      },
      inverseData: { fromIndex: toIndex, toIndex: fromIndex }
    };
  }

  /**
   * Create a batch operation action
   */
  static createBatchOperationAction(
    actions: Omit<HistoryAction, 'id' | 'timestamp'>[],
    description: string
  ): Omit<HistoryAction, 'id' | 'timestamp'> {
    return {
      type: HistoryActionType.BATCH_OPERATION,
      description,
      data: { actions: actions.map(action => ({ ...action, id: this.generateId(), timestamp: new Date() })) }
    };
  }

  private static generateId(): string {
    return `action_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
