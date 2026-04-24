export type Cell = {
  shipId: number | null;
  hit: boolean;
  miss: boolean;
};

export type Board = Cell[][];

export type Ship = {
  id: number;
  size: number;
  hits: number;
  cells: { x: number; y: number }[];
  horizontal: boolean;
  x: number;
  y: number;
};

export type GamePhase = 'playing' | 'player_won' | 'ai_won';

export type GameState = {
  playerBoard: Board;
  aiBoard: Board;
  playerShips: Ship[];
  aiShips: Ship[];
  playerTurn: boolean;
  gameOver: boolean;
  phase: GamePhase;
  aiMemory: { x: number; y: number }[];
};

export type LogEntryType = 'hit' | 'miss' | 'sunk' | 'info';

export type LogEntry = {
  type: LogEntryType;
  text: string;
};
