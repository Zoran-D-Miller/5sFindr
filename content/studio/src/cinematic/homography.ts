// Corner pin: maps a w×h rectangle onto four destination points (TL, TR, BR, BL)
// and returns a CSS matrix3d (use with transform-origin: 0 0).
import type { Corner } from "../types";

export function cornerPinMatrix(w: number, h: number, dst: [Corner, Corner, Corner, Corner]): string {
  const src: Corner[] = [
    [0, 0],
    [w, 0],
    [w, h],
    [0, h],
  ];
  // Solve for a..h in x' = (a x + b y + c)/(g x + h y + 1), y' = (d x + e y + f)/(g x + h y + 1)
  const A: number[][] = [];
  const B: number[] = [];
  for (let i = 0; i < 4; i++) {
    const [x, y] = src[i];
    const [X, Y] = dst[i];
    A.push([x, y, 1, 0, 0, 0, -x * X, -y * X]);
    B.push(X);
    A.push([0, 0, 0, x, y, 1, -x * Y, -y * Y]);
    B.push(Y);
  }
  const s = solve(A, B);
  const [a, b, c, d, e, f, g, hh] = s;
  return `matrix3d(${a},${d},0,${g},${b},${e},0,${hh},0,0,1,0,${c},${f},0,1)`;
}

function solve(A: number[][], B: number[]): number[] {
  const n = B.length;
  const M = A.map((row, i) => [...row, B[i]]);
  for (let col = 0; col < n; col++) {
    let piv = col;
    for (let r = col + 1; r < n; r++) if (Math.abs(M[r][col]) > Math.abs(M[piv][col])) piv = r;
    [M[col], M[piv]] = [M[piv], M[col]];
    const p = M[col][col] || 1e-12;
    for (let k = col; k <= n; k++) M[col][k] /= p;
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const fct = M[r][col];
      for (let k = col; k <= n; k++) M[r][k] -= fct * M[col][k];
    }
  }
  return M.map((row) => row[n]);
}

// Linear interpolation of corner keyframes at time t (seconds).
export function cornersAt(keys: { t: number; corners: [Corner, Corner, Corner, Corner] }[], t: number) {
  if (t <= keys[0].t) return keys[0].corners;
  for (let i = 0; i < keys.length - 1; i++) {
    const a = keys[i];
    const b = keys[i + 1];
    if (t <= b.t) {
      const k = (t - a.t) / (b.t - a.t || 1);
      return a.corners.map((p, j) => [p[0] + (b.corners[j][0] - p[0]) * k, p[1] + (b.corners[j][1] - p[1]) * k]) as [
        Corner,
        Corner,
        Corner,
        Corner,
      ];
    }
  }
  return keys[keys.length - 1].corners;
}
