import { Injectable, ElementRef, Renderer2, RendererFactory2 } from '@angular/core';

export interface TooltipOptions {
  text: string;
  position?: 'top' | 'bottom' | 'left' | 'right' | 'auto';
  delay?: number;
  maxWidth?: number;
  theme?: 'light' | 'dark';
  offset?: number;
  htmlContent?: string; // [CHANGE] Support HTML content
  actions?: TooltipAction[]; // [CHANGE] Support action buttons
}

export interface TooltipAction {
  label: string;
  icon?: string;
  action: () => void;
  type?: 'primary' | 'secondary' | 'danger';
}

@Injectable({
  providedIn: 'root'
})
export class TooltipService {
  private renderer: Renderer2;
  private tooltipElement: HTMLElement | null = null;
  private currentTarget: HTMLElement | null = null;
  private showTimeout: any = null;
  private hideTimeout: any = null;

  constructor(rendererFactory: RendererFactory2) {
    this.renderer = rendererFactory.createRenderer(null, null);
  }

  showTooltip(target: HTMLElement, options: TooltipOptions): void {
    // Clear any existing timeouts
    this.clearTimeouts();
    
    // Hide existing tooltip if different target
    if (this.currentTarget && this.currentTarget !== target) {
      this.hideTooltip();
    }

    this.currentTarget = target;

    // Set up show timeout
    this.showTimeout = setTimeout(() => {
      this.createTooltip(target, options);
    }, options.delay || 300);
  }

  hideTooltip(): void {
    this.clearTimeouts();
    
    if (this.tooltipElement) {
      this.renderer.removeClass(this.tooltipElement, 'tooltip-visible');
      
      // Remove element after animation
      setTimeout(() => {
        if (this.tooltipElement && this.tooltipElement.parentNode) {
          this.renderer.removeChild(this.tooltipElement.parentNode, this.tooltipElement);
        }
        this.tooltipElement = null;
        this.currentTarget = null;
      }, 200);
    }
  }

  private clearTimeouts(): void {
    if (this.showTimeout) {
      clearTimeout(this.showTimeout);
      this.showTimeout = null;
    }
    if (this.hideTimeout) {
      clearTimeout(this.hideTimeout);
      this.hideTimeout = null;
    }
  }

  private createTooltip(target: HTMLElement, options: TooltipOptions): void {
    // Remove existing tooltip
    if (this.tooltipElement) {
      this.renderer.removeChild(this.tooltipElement.parentNode, this.tooltipElement);
    }

    // Create tooltip element
    this.tooltipElement = this.renderer.createElement('div');
    this.renderer.addClass(this.tooltipElement, 'modern-tooltip');
    this.renderer.addClass(this.tooltipElement, `tooltip-${options.theme || 'light'}`);
    
    // [CHANGE] Set tooltip content - support HTML or text
    if (options.htmlContent) {
      this.renderer.setProperty(this.tooltipElement, 'innerHTML', options.htmlContent);
    } else {
      this.renderer.setProperty(this.tooltipElement, 'textContent', options.text);
    }
    
    // Set max width if specified
    if (options.maxWidth) {
      this.renderer.setStyle(this.tooltipElement, 'max-width', `${options.maxWidth}px`);
    }

    // [CHANGE] Add action buttons if provided
    if (options.actions && options.actions.length > 0) {
      this.addActionButtons(options.actions);
    }

    // Add to body to avoid clipping
    this.renderer.appendChild(document.body, this.tooltipElement);

    // Position tooltip
    this.positionTooltip(target, options);

    // Show with animation
    setTimeout(() => {
      if (this.tooltipElement) {
        this.renderer.addClass(this.tooltipElement, 'tooltip-visible');
      }
    }, 10);
  }

  private positionTooltip(target: HTMLElement, options: TooltipOptions): void {
    if (!this.tooltipElement) return;

    const targetRect = target.getBoundingClientRect();
    const tooltipRect = this.tooltipElement.getBoundingClientRect();
    const viewport = {
      width: window.innerWidth,
      height: window.innerHeight
    };

    let position = options.position || 'auto';
    let top = 0;
    let left = 0;

    // Auto positioning logic
    if (position === 'auto') {
      const spaceAbove = targetRect.top;
      const spaceBelow = viewport.height - targetRect.bottom;
      const spaceLeft = targetRect.left;
      const spaceRight = viewport.width - targetRect.right;

      if (spaceBelow >= tooltipRect.height + 10) {
        position = 'bottom';
      } else if (spaceAbove >= tooltipRect.height + 10) {
        position = 'top';
      } else if (spaceRight >= tooltipRect.width + 10) {
        position = 'right';
      } else if (spaceLeft >= tooltipRect.width + 10) {
        position = 'left';
      } else {
        position = 'bottom'; // Default fallback
      }
    }

    const offset = options.offset || 8;

    // Calculate position based on chosen direction
    switch (position) {
      case 'top':
        top = targetRect.top - tooltipRect.height - offset;
        left = targetRect.left + (targetRect.width - tooltipRect.width) / 2;
        this.renderer.addClass(this.tooltipElement, 'tooltip-top');
        break;
      
      case 'bottom':
        top = targetRect.bottom + offset;
        left = targetRect.left + (targetRect.width - tooltipRect.width) / 2;
        this.renderer.addClass(this.tooltipElement, 'tooltip-bottom');
        break;
      
      case 'left':
        top = targetRect.top + (targetRect.height - tooltipRect.height) / 2;
        left = targetRect.left - tooltipRect.width - offset;
        this.renderer.addClass(this.tooltipElement, 'tooltip-left');
        break;
      
      case 'right':
        top = targetRect.top + (targetRect.height - tooltipRect.height) / 2;
        left = targetRect.right + offset;
        this.renderer.addClass(this.tooltipElement, 'tooltip-right');
        break;
    }

    // Ensure tooltip stays within viewport
    const adjustedPosition = this.adjustForViewport(left, top, tooltipRect, viewport);
    
    this.renderer.setStyle(this.tooltipElement, 'position', 'fixed');
    this.renderer.setStyle(this.tooltipElement, 'top', `${adjustedPosition.top}px`);
    this.renderer.setStyle(this.tooltipElement, 'left', `${adjustedPosition.left}px`);
    this.renderer.setStyle(this.tooltipElement, 'z-index', '10000');
  }

  private adjustForViewport(left: number, top: number, tooltipRect: DOMRect, viewport: { width: number, height: number }): { left: number, top: number } {
    let adjustedLeft = left;
    let adjustedTop = top;

    // Adjust horizontal position
    if (adjustedLeft < 10) {
      adjustedLeft = 10;
    } else if (adjustedLeft + tooltipRect.width > viewport.width - 10) {
      adjustedLeft = viewport.width - tooltipRect.width - 10;
    }

    // Adjust vertical position
    if (adjustedTop < 10) {
      adjustedTop = 10;
    } else if (adjustedTop + tooltipRect.height > viewport.height - 10) {
      adjustedTop = viewport.height - tooltipRect.height - 10;
    }

    return { left: adjustedLeft, top: adjustedTop };
  }

  // [CHANGE] Add action buttons to tooltip
  private addActionButtons(actions: TooltipAction[]): void {
    if (!this.tooltipElement) return;

    const actionsContainer = this.renderer.createElement('div');
    this.renderer.addClass(actionsContainer, 'tooltip-actions');

    actions.forEach(action => {
      const button = this.renderer.createElement('button');
      this.renderer.addClass(button, 'tooltip-action-btn');
      this.renderer.addClass(button, `tooltip-action-${action.type || 'secondary'}`);
      
      // Add icon if provided
      if (action.icon) {
        const icon = this.renderer.createElement('span');
        this.renderer.addClass(icon, 'tooltip-action-icon');
        this.renderer.setProperty(icon, 'innerHTML', action.icon);
        this.renderer.appendChild(button, icon);
      }
      
      // Add label
      const label = this.renderer.createElement('span');
      this.renderer.setProperty(label, 'textContent', action.label);
      this.renderer.appendChild(button, label);
      
      // Add click handler
      this.renderer.listen(button, 'click', (event) => {
        event.stopPropagation();
        action.action();
        this.hideTooltip();
      });
      
      this.renderer.appendChild(actionsContainer, button);
    });

    this.renderer.appendChild(this.tooltipElement, actionsContainer);
  }
}
