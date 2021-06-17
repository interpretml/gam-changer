import * as d3 from 'd3';

export class SelectedInfo {
  constructor() {
    this.hasSelected = false;
    this.nodeData = [];
    this.boundingBox = [];
    this.nodeDataBuffer = null;
  }

  computeBBox() {
    if (this.nodeData.length > 0) {
      this.boundingBox = [{
        x1: d3.min(this.nodeData.map(d => d.x)),
        y1: d3.max(this.nodeData.map(d => d.y)),
        x2: d3.max(this.nodeData.map(d => d.x)),
        y2: d3.min(this.nodeData.map(d => d.y))
      }];
    } else {
      this.boundingBox = [];
    }
  }

  computeBBoxBuffer() {
    if (this.nodeDataBuffer.length > 0) {
      this.nodeDataBuffer = [{
        x1: d3.min(this.nodeDataBuffer.map(d => d.x)),
        y1: d3.max(this.nodeDataBuffer.map(d => d.y)),
        x2: d3.max(this.nodeDataBuffer.map(d => d.x)),
        y2: d3.min(this.nodeDataBuffer.map(d => d.y))
      }];
    } else {
      this.boundingBox = [];
    }
  }

  updateNodeData(pointData) {
    for (let i = 0; i < this.nodeData.length; i++) {
      this.nodeData[i].x = pointData[this.nodeData[i].id].x;
      this.nodeData[i].y = pointData[this.nodeData[i].id].y;
    }
  }
}