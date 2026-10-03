import { Directive, ElementRef, HostListener, Input, OnDestroy, OnInit } from '@angular/core';
import { TooltipService, TooltipOptions } from '../../services/tooltip.service';

@Directive({
  selector: '[appTooltip]',
  standalone: true
})
export class TooltipDirective implements OnInit, OnDestroy {
  @Input('appTooltip') tooltipText: string = '';
  @Input() tooltipPosition: 'top' | 'bottom' | 'left' | 'right' | 'auto' = 'auto';
  @Input() tooltipDelay: number = 300;
  @Input() tooltipMaxWidth: number = 200;
  @Input() tooltipTheme: 'light' | 'dark' = 'dark';
  @Input() tooltipOffset: number = 8;

  private isVisible = false;

  constructor(
    private elementRef: ElementRef,
    private tooltipService: TooltipService
  ) {}

  ngOnInit(): void {
    // Set cursor style for better UX
    this.elementRef.nativeElement.style.cursor = 'help';
  }

  ngOnDestroy(): void {
    if (this.isVisible) {
      this.tooltipService.hideTooltip();
    }
  }

  @HostListener('mouseenter')
  onMouseEnter(): void {
    if (this.tooltipText && this.tooltipText.trim()) {
      this.showTooltip();
    }
  }

  @HostListener('mouseleave')
  onMouseLeave(): void {
    this.hideTooltip();
  }

  @HostListener('focus')
  onFocus(): void {
    if (this.tooltipText && this.tooltipText.trim()) {
      this.showTooltip();
    }
  }

  @HostListener('blur')
  onBlur(): void {
    this.hideTooltip();
  }

  private showTooltip(): void {
    if (this.isVisible) return;

    const options: TooltipOptions = {
      text: this.tooltipText,
      position: this.tooltipPosition,
      delay: this.tooltipDelay,
      maxWidth: this.tooltipMaxWidth,
      theme: this.tooltipTheme,
      offset: this.tooltipOffset
    };

    this.tooltipService.showTooltip(this.elementRef.nativeElement, options);
    this.isVisible = true;
  }

  private hideTooltip(): void {
    if (!this.isVisible) return;

    this.tooltipService.hideTooltip();
    this.isVisible = false;
  }
}
