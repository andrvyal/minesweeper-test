import { Component, OnInit } from '@angular/core';

import { environment } from '../../../environments/environment';
import { MinesweeperCell, MinesweeperCellCoordinates, MinesweeperCellGroup, MinesweeperStatus } from '../../helpers/minesweeper';
import { MinesweeperService } from '../../services/minesweeper.service';
import { SpinnerService } from '../../services/spinner.service';

@Component({
  selector: 'egt-minesweeper',
  templateUrl: './minesweeper.component.html',
  styleUrls: ['./minesweeper.component.scss']
})
export class MinesweeperComponent implements OnInit {

  automated = false;
  finished = false;
  grid: Array<Array<string>>;
  levels: Array<number>;
  opening = false;
  ready = false;
  started = false;

  constructor(
    private minesweeperService: MinesweeperService,
    private spinnerService: SpinnerService,
  ) {
    this.levels = Array.from(Array(environment.levelCount)).map((value: number, index: number): number => {
      return index + 1;
    });
  }

  async ngOnInit(): Promise<void> {
    this.spinnerService.start();

    try {
      await this.minesweeperService.ready;
      this.ready = true;
    } finally {
      this.spinnerService.stop();
    }
  }

  private getUnknown(): Array<MinesweeperCellCoordinates> {
    const unknown: Array<MinesweeperCellCoordinates> = [];

    this.minesweeperService.forEach((rowIndex: number, colIndex: number) => {
      if (this.minesweeperService.isUnknown(rowIndex, colIndex)) {
        unknown.push({
          rowIndex,
          colIndex,
        });
      }
    });

    return unknown;
  }

  private getFlagsAround(originRowIndex: number, originColIndex: number): number {
    let flagsAround = 0;

    const fromRow: number = Math.max(originRowIndex - 1, 0);
    const toRow: number = Math.min(originRowIndex + 1, this.grid.length - 1);

    for (let rowIndex = fromRow; rowIndex <= toRow; ++rowIndex) {
      const row: Array<string> = this.grid[rowIndex];

      const fromCol: number = Math.max(originColIndex - 1, 0);
      const toCol: number = Math.min(originColIndex + 1, row.length - 1);

      for (let colIndex = fromCol; colIndex <= toCol; ++colIndex) {
        if (rowIndex === originRowIndex && colIndex === originColIndex) {
          continue;
        }

        if (this.minesweeperService.isFlagged(rowIndex, colIndex)) {
          ++flagsAround;
        }
      }
    }

    return flagsAround;
  }

  private getUnknownAround(originRowIndex: number, originColIndex: number): Array<MinesweeperCellCoordinates> {
    const unknownNeighbors: Array<MinesweeperCellCoordinates> = [];

    const fromRow: number = Math.max(originRowIndex - 1, 0);
    const toRow: number = Math.min(originRowIndex + 1, this.grid.length - 1);

    for (let rowIndex = fromRow; rowIndex <= toRow; ++rowIndex) {
      const row: Array<string> = this.grid[rowIndex];

      const fromCol: number = Math.max(originColIndex - 1, 0);
      const toCol: number = Math.min(originColIndex + 1, row.length - 1);

      for (let colIndex = fromCol; colIndex <= toCol; ++colIndex) {
        if (rowIndex === originRowIndex && colIndex === originColIndex) {
          continue;
        }

        if (this.minesweeperService.isUnknown(rowIndex, colIndex)) {
          unknownNeighbors.push({
            rowIndex,
            colIndex,
          });
        }
      }
    }

    return unknownNeighbors;
  }

  private hasCell(cells: Array<MinesweeperCellCoordinates>, targetCell: MinesweeperCellCoordinates): boolean {
    for (const cell of cells) {
      if (this.isCellEqual(cell, targetCell)) {
        return true;
      }
    }

    return false;
  }

  private isCellEqual(cell1: MinesweeperCellCoordinates, cell2: MinesweeperCellCoordinates): boolean {
    return (
      cell1.rowIndex === cell2.rowIndex &&
      cell1.colIndex === cell2.colIndex
    );
  }

  private isGroupEqual(group1: MinesweeperCellGroup, group2: MinesweeperCellGroup): boolean {
    if (group1.cells.length !== group1.cells.length) {
      return false;
    }

    for (const cell of group1.cells) {
      if (!this.hasCell(group2.cells, cell)) {
        return false;
      }
    }

    return true;
  }

  private isGroupParentChild(parent: MinesweeperCellGroup, child: MinesweeperCellGroup): boolean {
    if (parent.cells.length <= child.cells.length) {
      return false;
    }

    for (const cell of child.cells) {
      if (!this.hasCell(parent.cells, cell)) {
        return false;
      }
    }

    return true;
  }

  private nextMove(): void {
    setTimeout(() => {
      let flagsSet: boolean;

      do {
        flagsSet = this.setFlags();
      } while (flagsSet);

      this.openNext();
    });
  }

  onAutomatedChange(automated: boolean): void {
    this.automated = automated;

    if (this.automated) {
      this.nextMove();
    }
  }

  async open({rowIndex, colIndex}: MinesweeperCellCoordinates): Promise<void> {
    this.opening = true;

    try {
      const result: string = await this.minesweeperService.open(rowIndex, colIndex);
      this.grid = this.minesweeperService.grid;

      switch (this.minesweeperService.status) {
        case MinesweeperStatus.Ok:
          if (this.automated) {
            this.nextMove();
          }
          break;
        case MinesweeperStatus.Lose:
        case MinesweeperStatus.Win:
          this.finished = true;

          setTimeout(() => {
            alert(result);
          });

          break;
      }
    } finally {
      this.opening = false;
    }
  }

  private async openNext(): Promise<void> {
    let selected: MinesweeperCellCoordinates;

    this.minesweeperService.forEach((rowIndex: number, colIndex: number) => {
      if (selected) {
        return;
      }

      if (this.minesweeperService.isOpen(rowIndex, colIndex)) {
        const mines: number = this.minesweeperService.getValue(rowIndex, colIndex);

        if (!mines) {
          return;
        }

        const unknownAround: Array<MinesweeperCellCoordinates> = this.getUnknownAround(rowIndex, colIndex);

        if (unknownAround.length) {
          const flagsAround: number = this.getFlagsAround(rowIndex, colIndex);

          if (flagsAround === mines) {
            selected = unknownAround[0];
          }
        }
      }
    });

    if (!selected) {
      const groups: Array<MinesweeperCellGroup> = [];

      this.minesweeperService.forEach((rowIndex: number, colIndex: number) => {
        if (this.minesweeperService.isOpen(rowIndex, colIndex)) {
          const mines: number = this.minesweeperService.getValue(rowIndex, colIndex);

          if (!mines) {
            return;
          }

          const unknownAround: Array<MinesweeperCellCoordinates> = this.getUnknownAround(rowIndex, colIndex);

          if (unknownAround.length) {
            const flagsAround: number = this.getFlagsAround(rowIndex, colIndex);
            const unknownMines: number = mines - flagsAround;

            if (unknownMines) {
              groups.push({
                cells: unknownAround,
                mines: unknownMines,
              });
            }
          }
        }
      });

      for (const group1 of groups) {
        if (selected) {
          break;
        }

        for (const group2 of groups) {
          if (this.isGroupEqual(group1, group2)) {
            continue;
          }

          if (this.isGroupParentChild(group1, group2)) {
            const difference: MinesweeperCellGroup = this.subtractGroup(group1, group2);

            if (difference.mines === 0) {
              selected = difference.cells[0];
              break;
            }
          }
        }
      }
    }

    if (!selected) {
      this.minesweeperService.forEach((rowIndex: number, colIndex: number) => {
        if (selected) {
          return;
        }

        if (this.minesweeperService.isOpen(rowIndex, colIndex)) {
          const unknownAround: Array<MinesweeperCellCoordinates> = this.getUnknownAround(rowIndex, colIndex);

          if (unknownAround.length) {
            const index: number = Math.floor(Math.random() * unknownAround.length);
            selected = unknownAround[index];
          }
        }
      });
    }

    if (!selected) {
      const unknown: Array<MinesweeperCellCoordinates> = this.getUnknown();
      const index: number = Math.floor(Math.random() * unknown.length);

      selected = unknown[index];
    }

    await this.open(selected);
  }

  private setFlags(): boolean {
    let flagsSet = false;

    this.minesweeperService.forEach((rowIndex: number, colIndex: number) => {
      if (this.minesweeperService.isOpen(rowIndex, colIndex)) {
        const mines: number = this.minesweeperService.getValue(rowIndex, colIndex);

        if (!mines) {
          return;
        }

        const unknownAround: Array<MinesweeperCellCoordinates> = this.getUnknownAround(rowIndex, colIndex);

        if (unknownAround.length) {
          const flagsAround: number = this.getFlagsAround(rowIndex, colIndex);
          const unknownMines: number = mines - flagsAround;

          if (unknownMines) {
            if (unknownAround.length === unknownMines) {
              for (const cell of unknownAround) {
                if (!this.minesweeperService.isFlagged(cell.rowIndex, cell.colIndex)) {
                  this.minesweeperService.toggleFlag(cell.rowIndex, cell.colIndex);
                  flagsSet = true;
                }
              }
            }
          }
        }
      }
    });

    const groups: Array<MinesweeperCellGroup> = [];

    this.minesweeperService.forEach((rowIndex: number, colIndex: number) => {
      if (this.minesweeperService.isOpen(rowIndex, colIndex)) {
        const mines: number = this.minesweeperService.getValue(rowIndex, colIndex);

        if (!mines) {
          return;
        }

        const unknownAround: Array<MinesweeperCellCoordinates> = this.getUnknownAround(rowIndex, colIndex);

        if (unknownAround.length) {
          const flagsAround: number = this.getFlagsAround(rowIndex, colIndex);
          const unknownMines: number = mines - flagsAround;

          if (unknownMines) {
            groups.push({
              cells: unknownAround,
              mines: unknownMines,
            });
          }
        }
      }
    });

    for (const group1 of groups) {
      for (const group2 of groups) {
        if (this.isGroupParentChild(group1, group2)) {
          const difference: MinesweeperCellGroup = this.subtractGroup(group1, group2);

          if (difference.mines === difference.cells.length) {
            for (const cell of difference.cells) {
              if (!this.minesweeperService.isFlagged(cell.rowIndex, cell.colIndex)) {
                this.minesweeperService.toggleFlag(cell.rowIndex, cell.colIndex);
                flagsSet = true;
              }
            }
          }
        }
      }
    }

    return flagsSet;
  }

  async start(level: number): Promise<void> {
    this.spinnerService.start();

    try {
      await this.minesweeperService.start(level);

      this.started = true;
      this.grid = this.minesweeperService.grid;
    } finally {
      this.spinnerService.stop();
    }
  }

  private subtractGroup(from: MinesweeperCellGroup, minus: MinesweeperCellGroup): MinesweeperCellGroup {
    const difference: MinesweeperCellGroup = {
      cells: [],
      mines: from.mines - minus.mines,
    };

    for (const cell of from.cells) {
      if (!this.hasCell(minus.cells, cell)) {
        difference.cells.push(cell);
      }
    }

    return difference;
  }
}
