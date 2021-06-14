import * as d3 from 'd3';

export class SelectedInfo {
  constructor() {
    this.hasSelected = false;
    this.nodeIndexes = new Set();
    this.nodeData = [];
    this.boundingBox = [];
  }

  updateNodeDataY(yChange) {
    for (let i = 0; i < this.nodeData.length; i++) {
      this.nodeData[i][1] += yChange;
    }
  }

  computeBBox() {
    if (this.nodeData.length > 0) {
      this.boundingBox = [{
        x1: d3.min(this.nodeData.map(d => d[0])),
        y1: d3.max(this.nodeData.map(d => d[1])),
        x2: d3.max(this.nodeData.map(d => d[0])),
        y2: d3.min(this.nodeData.map(d => d[1]))
      }];
    } else {
      this.boundingBox = [];
    }
  }
}