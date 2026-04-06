import { AtmBalance, AtmStatus } from './api';

export interface FileSnapshot {
  fileName: string;
  date: string;
  balances: AtmBalance[];
  statuses: AtmStatus[];
  balanceStats?: {
    critical: number;
    low: number;
    healthy: number;
  };
  hardwareStats?: {
    healthy: number;
    errors: number;
    warnings: number;
  };
}

export interface DataChange {
  balanceChange?: {
    critical: number;
    low: number;
    healthy: number;
  };
  hardwareChange?: {
    healthy: number;
    errors: number;
    warnings: number;
  };
}

class DataSnapshotManager {
  private currentSnapshot: FileSnapshot | null = null;
  private previousSnapshot: FileSnapshot | null = null;

  getCurrentSnapshot(): FileSnapshot | null {
    return this.currentSnapshot;
  }

  getPreviousSnapshot(): FileSnapshot | null {
    return this.previousSnapshot;
  }

  updateSnapshot(
    fileName: string,
    date: string,
    balances: AtmBalance[],
    statuses: AtmStatus[],
    balanceStats: FileSnapshot['balanceStats'],
    hardwareStats: FileSnapshot['hardwareStats']
  ) {
    this.previousSnapshot = this.currentSnapshot;
    this.currentSnapshot = {
      fileName,
      date,
      balances,
      statuses,
      balanceStats,
      hardwareStats,
    };
  }

  getChanges(): DataChange {
    if (!this.currentSnapshot || !this.previousSnapshot) {
      return {};
    }

    return {
      balanceChange: this.currentSnapshot.balanceStats && this.previousSnapshot.balanceStats ? {
        critical: (this.currentSnapshot.balanceStats.critical || 0) - (this.previousSnapshot.balanceStats.critical || 0),
        low: (this.currentSnapshot.balanceStats.low || 0) - (this.previousSnapshot.balanceStats.low || 0),
        healthy: (this.currentSnapshot.balanceStats.healthy || 0) - (this.previousSnapshot.balanceStats.healthy || 0),
      } : undefined,
      hardwareChange: this.currentSnapshot.hardwareStats && this.previousSnapshot.hardwareStats ? {
        healthy: (this.currentSnapshot.hardwareStats.healthy || 0) - (this.previousSnapshot.hardwareStats.healthy || 0),
        errors: (this.currentSnapshot.hardwareStats.errors || 0) - (this.previousSnapshot.hardwareStats.errors || 0),
        warnings: (this.currentSnapshot.hardwareStats.warnings || 0) - (this.previousSnapshot.hardwareStats.warnings || 0),
      } : undefined,
    };
  }

  isNewFile(fileName: string): boolean {
    return this.currentSnapshot === null || this.currentSnapshot.fileName !== fileName;
  }
}

export const snapshotManager = new DataSnapshotManager();
