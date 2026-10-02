"use client";

import { cn } from "@/lib/utils";

/**
 * Nine dots that morph between shapes — grid (square) → circle → triangle →
 * star — by animating each dot's position along a shared timeline. The 24px
 * layout box never changes, so the glyph never shifts nearby text.
 *
 * Used as the agent "work" glyph: leading the working row and, as
 * `AgentWorkCursor`, pinned under the assistant output while a turn runs.
 */

const WORK_DOT_FRAMES = [
  // square — 3×3 grid
  [
    [5.6, 5.6],
    [12, 5.6],
    [18.4, 5.6],
    [5.6, 12],
    [12, 12],
    [18.4, 12],
    [5.6, 18.4],
    [12, 18.4],
    [18.4, 18.4],
  ],
  // circle — ring of eight plus center
  [
    [12, 4.2],
    [17.5, 6.5],
    [19.8, 12],
    [17.5, 17.5],
    [12, 19.8],
    [6.5, 17.5],
    [4.2, 12],
    [6.5, 6.5],
    [12, 12],
  ],
  // triangle
  [
    [12, 3.8],
    [9.2, 8.5],
    [14.8, 8.5],
    [6.4, 13.2],
    [12, 13.2],
    [17.6, 13.2],
    [4.2, 18.6],
    [12, 18.6],
    [19.8, 18.6],
  ],
  // star
  [
    [12, 3.5],
    [14.2, 8.7],
    [19.8, 9.2],
    [15.6, 12.8],
    [17.2, 18.5],
    [12, 15.2],
    [6.8, 18.5],
    [8.4, 12.8],
    [4.2, 9.2],
  ],
] as const;

const WORK_DOT_KEY_TIMES = "0;0.16;0.28;0.41;0.53;0.66;0.78;0.91;1";

function dotValues(index: number, axis: 0 | 1): string {
  const [grid, circle, triangle, star] = WORK_DOT_FRAMES;
  return [
    grid[index][axis],
    grid[index][axis],
    circle[index][axis],
    circle[index][axis],
    triangle[index][axis],
    triangle[index][axis],
    star[index][axis],
    star[index][axis],
    grid[index][axis],
  ].join(";");
}

export function AgentMorphDots({
  active = true,
  className,
}: {
  /** False parks the dots on the star silhouette, static. */
  active?: boolean;
  className?: string;
}) {
  const settledDots = WORK_DOT_FRAMES[3];
  return (
    <span
      className={cn(
        "agent-work-morph",
        !active && "agent-work-morph--settled",
        className,
      )}
      aria-hidden
    >
      <svg viewBox="0 0 24 24" width="24" height="24">
        {WORK_DOT_FRAMES[0].map((point, index) => (
          <circle
            key={index}
            className="agent-work-dot"
            cx={active ? point[0] : settledDots[index][0]}
            cy={active ? point[1] : settledDots[index][1]}
            r="1.45"
            style={{ animationDelay: `${index * -90}ms` }}
          >
            {active ? (
              <>
                <animate
                  attributeName="cx"
                  dur="6.4s"
                  repeatCount="indefinite"
                  values={dotValues(index, 0)}
                  keyTimes={WORK_DOT_KEY_TIMES}
                />
                <animate
                  attributeName="cy"
                  dur="6.4s"
                  repeatCount="indefinite"
                  values={dotValues(index, 1)}
                  keyTimes={WORK_DOT_KEY_TIMES}
                />
              </>
            ) : null}
          </circle>
        ))}
      </svg>
    </span>
  );
}
