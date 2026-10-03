export interface PaperLayout {
  left: number;
  top: number;
  width: number;
  height: number;
}

export class PaperLayoutModel implements PaperLayout {
  constructor(
    public left: number = 0,
    public top: number = 0,
    public width: number = 576,
    public height: number = 576
  ) {}

  static fromTemplate(templateData: any): PaperLayoutModel {
    if (templateData?.paperLayout) {
      return new PaperLayoutModel(
        templateData.paperLayout.left || 0,
        templateData.paperLayout.top || 0,
        templateData.paperLayout.width || 576,
        templateData.paperLayout.height || 576
      );
    }
    return new PaperLayoutModel();
  }

  static fromObject(obj: { left: number; top: number; width: number; height: number }): PaperLayoutModel {
    return new PaperLayoutModel(obj.left, obj.top, obj.width, obj.height);
  }

  toObject(): PaperLayout {
    return {
      left: this.left,
      top: this.top,
      width: this.width,
      height: this.height
    };
  }

  isValid(): boolean {
    return this.width > 0 && this.height > 0;
  }

  getCenter(): { x: number, y: number } {
    return {
      x: this.left + this.width / 2,
      y: this.top + this.height / 2
    };
  }

  contains(x: number, y: number): boolean {
    return x >= this.left && x <= this.left + this.width &&
           y >= this.top && y <= this.top + this.height;
  }

  clone(): PaperLayoutModel {
    return new PaperLayoutModel(this.left, this.top, this.width, this.height);
  }
}
