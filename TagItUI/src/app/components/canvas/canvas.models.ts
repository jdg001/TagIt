
export type MarkType = 'major' | 'minor' | 'sub-minor';

export interface RulerMark {
  position: number;
  label: string;
  isMajor: boolean;
  markType: MarkType;
}

export interface ScaleConfig {
  majorStep: number;
  minorStep: number;
  subMinorStep: number;
  majorMultiple: number;
}

export interface FixedScaleConfig {
  tickInterval: number;    // fixed pixel interval between tick marks
  numberInterval: number;  // how often to show numbers (every Nth tick)
  baseUnitValue: number;   // base unit value at zoom level 1.0
}

export interface ElementGroup {
  id: string;
  name: string;
  elementIds: Set<string>;
  color: string;           // visual identification
  createdAt: Date;
}
