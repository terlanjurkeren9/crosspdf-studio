export interface DiffLine {
  type: 'equal' | 'added' | 'removed';
  content: string;
  leftLineNum: number | null;
  rightLineNum: number | null;
}

/**
 * Simple text-based diff algorithm (LCS-based).
 * Compares two texts line by line and returns diff result.
 */
export function diffTexts(leftText: string, rightText: string): DiffLine[] {
  const leftLines = leftText.split('\n');
  const rightLines = rightText.split('\n');

  // Build LCS table
  const m = leftLines.length;
  const n = rightLines.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (leftLines[i - 1] === rightLines[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Backtrack to find diff
  const result: DiffLine[] = [];
  let i = m;
  let j = n;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && leftLines[i - 1] === rightLines[j - 1]) {
      result.unshift({
        type: 'equal',
        content: leftLines[i - 1],
        leftLineNum: i,
        rightLineNum: j,
      });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      result.unshift({
        type: 'added',
        content: rightLines[j - 1],
        leftLineNum: null,
        rightLineNum: j,
      });
      j--;
    } else {
      result.unshift({
        type: 'removed',
        content: leftLines[i - 1],
        leftLineNum: i,
        rightLineNum: null,
      });
      i--;
    }
  }

  return result;
}

export interface CompareResult {
  leftText: string;
  rightText: string;
  leftFileName: string;
  rightFileName: string;
  diffs: DiffLine[];
  stats: {
    added: number;
    removed: number;
    equal: number;
    total: number;
  };
}
