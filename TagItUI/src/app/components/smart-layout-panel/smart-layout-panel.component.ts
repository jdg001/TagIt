import { Component, EventEmitter, Input, model, Output } from '@angular/core';

import { FormsModule } from '@angular/forms';
import { TooltipDirective } from '../tooltip/tooltip.directive';
import { SmartLayoutSettings } from './smart-layout-panel.model';

@Component({
    standalone: true,
    selector: 'app-smart-layout-panel',
    imports: [FormsModule, TooltipDirective],
    templateUrl: './smart-layout-panel.component.html',
    styleUrls: ['./smart-layout-panel.component.css']
})
export class SmartLayoutPanelComponent {
  isVisible = model<boolean>(false);
  @Input() settings: SmartLayoutSettings = {
    elementSticking: true,
    rowWiseAdjustment: true,
    heightWiseAdjustment: true,
    alignmentLines: true,
  };

  @Output() settingsChange = new EventEmitter<SmartLayoutSettings>();

  isMinimized = false;

  onToggleSetting(setting: keyof SmartLayoutSettings) {
    
    this.settings = {
      ...this.settings,
      [setting]: !this.settings[setting]
    };
    this.settingsChange.emit(this.settings);
  }

  toggleMinimize() {
    this.isMinimized = !this.isMinimized;
  }
}
